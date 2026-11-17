const crypto = require("crypto");
const IntegrationSecurityGrant = require("../models/IntegrationSecurityGrant");
const { logAudit } = require("../services/auditLogger");

let ephemeralMfaSecret;

function getMfaSecret() {
  const configuredSecret = process.env.CUSTOM_AUTH_TOKEN_SECRET?.trim()
    || process.env.AUTH_TOKEN_SECRET;

  if (configuredSecret) {
    if (Buffer.byteLength(configuredSecret) < 32) {
      throw new Error("AUTH_TOKEN_SECRET must be configured with at least 32 bytes");
    }
    return configuredSecret;
  }

  if (!ephemeralMfaSecret) ephemeralMfaSecret = crypto.randomBytes(32);
  return ephemeralMfaSecret;
}

function hashValue(value) {
  return crypto.createHmac("sha256", getMfaSecret()).update(value).digest("hex");
}

function hashCode(grantId, code) {
  return hashValue(`${grantId}:${code}`);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
}

function hashPayload(payload) {
  return crypto.createHash("sha256").update(JSON.stringify(canonicalize(payload))).digest("hex");
}

async function requireIntegrationAccess(req, res, next) {
  const token = req.get("x-integration-access") || "";
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return res.status(403).json({ error: "Verify super-user access before opening integrations." });
  }

  try {
    const grant = await IntegrationSecurityGrant.findOne({
      adminId: req.authenticatedUser._id,
      purpose: "access-session",
      accessTokenHash: hashValue(token),
      expiresAt: { $gt: new Date() },
    });

    if (!grant) {
      return res.status(403).json({ error: "Integration access has expired. Verify with the super user again." });
    }

    req.integrationAccess = grant;
    return next();
  } catch (error) {
    console.error("Integration access verification error:", error);
    return res.status(500).json({ error: "Unable to verify integration access." });
  }
}

async function consumeApproval(req, { action, payload }) {
  const approvalId = req.get("x-su-approval") || "";
  const pin = req.get("x-su-pin") || "";
  if (!/^[a-f0-9]{24}$/i.test(approvalId) || !/^\d{8}$/.test(pin)) return false;

  const now = new Date();
  const grant = await IntegrationSecurityGrant.findOneAndUpdate(
    {
      _id: approvalId,
      adminId: req.authenticatedUser._id,
      purpose: "change-approval",
      action,
      payloadHash: hashPayload(payload),
      codeHash: hashCode(approvalId, pin),
      codeExpiresAt: { $gt: now },
      expiresAt: { $gt: now },
      consumedAt: null,
    },
    {
      $set: { consumedAt: now },
      $unset: { codeHash: "" },
    },
    { new: true }
  );

  if (!grant) {
    await IntegrationSecurityGrant.updateOne(
      {
        _id: approvalId,
        adminId: req.authenticatedUser._id,
        purpose: "change-approval",
        action,
        payloadHash: hashPayload(payload),
        codeExpiresAt: { $gt: now },
        expiresAt: { $gt: now },
        consumedAt: null,
        attemptCount: { $lt: 5 },
      },
      { $inc: { attemptCount: 1 } }
    );
    await logAudit({
      req,
      action: "INTEGRATION_CHANGE_APPROVAL_FAILED",
      category: "system",
      target: { entityType: "IntegrationSecurity", name: "Integration change approval" },
      description: "An invalid or expired super-user approval PIN was submitted.",
      details: { action, failureReason: "invalid_or_expired_pin" },
      status: "failed",
    });
  }

  return Boolean(grant);
}

module.exports = {
  hashValue,
  hashCode,
  hashPayload,
  requireIntegrationAccess,
  consumeApproval,
};
