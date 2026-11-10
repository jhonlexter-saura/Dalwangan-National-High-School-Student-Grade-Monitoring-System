const express = require("express");
const crypto = require("crypto");
const GoogleIntegration = require("../models/GoogleIntegration");
const User = require("../models/User");
const { requireAuthenticatedUser } = require("../middleware/authorization");
const { logAudit } = require("../services/auditLogger");
const {
  generateGoogleAuthUrl,
  exchangeGoogleCode,
  getGoogleCredentials,
} = require("../services/googleDriveService");
const { encryptGoogleToken, isGoogleTokenEncryptionConfigured } = require("../utils/googleTokenVault");

const router = express.Router();
const ephemeralStateSecret = crypto.randomBytes(32).toString("hex");

function getStateSecret() {
  return process.env.CUSTOM_AUTH_TOKEN_SECRET?.trim() || process.env.AUTH_TOKEN_SECRET || ephemeralStateSecret;
}

function createSignedState(payload) {
  const jsonStr = JSON.stringify(payload);
  const data = Buffer.from(jsonStr).toString("base64url");
  const signature = crypto.createHmac("sha256", getStateSecret()).update(data).digest("base64url");
  return `${data}.${signature}`;
}

function verifySignedState(stateString) {
  if (!stateString || typeof stateString !== "string") return null;
  const parts = stateString.split(".");
  if (parts.length !== 2) return null;

  const [data, signature] = parts;
  const expectedSig = crypto.createHmac("sha256", getStateSecret()).update(data).digest();
  let suppliedSig;
  try { suppliedSig = Buffer.from(signature, "base64url"); } catch { return null; }
  if (suppliedSig.length !== expectedSig.length || !crypto.timingSafeEqual(suppliedSig, expectedSig)) return null;

  try {
    const jsonStr = Buffer.from(data, "base64url").toString("utf8");
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

// GET /connect - Generates Google OAuth consent URL
router.get("/connect", requireAuthenticatedUser, (req, res) => {
  try {
    const { clientId } = getGoogleCredentials();
    if (!clientId || !getGoogleCredentials().clientSecret || !isGoogleTokenEncryptionConfigured()) {
      return res.status(503).json({
        error: "Google OAuth credentials and a stable token encryption secret must be configured on this server.",
      });
    }

    const requestedReturnTo = typeof req.query.returnTo === "string" ? req.query.returnTo : "";
    const safeReturnTo = requestedReturnTo.startsWith("/") && !requestedReturnTo.startsWith("//") && !requestedReturnTo.includes("\\")
      ? requestedReturnTo
      : (req.authenticatedUser?.role === "admin" ? "/admin/integrations" : "/student/grades");
    const state = createSignedState({
      userId: req.authenticatedUser._id.toString(),
      role: req.authenticatedUser.role,
      returnTo: safeReturnTo,
      createdAt: Date.now(),
    });

    const authUrl = generateGoogleAuthUrl(state);
    return res.json({ success: true, authUrl });
  } catch (error) {
    console.error("Google connect error:", error.message);
    return res.status(500).json({
      error: error.message || "Unable to initiate Google connection.",
    });
  }
});

// GET /callback - Handles Google OAuth redirect
router.get("/callback", async (req, res) => {
  const { code, state, error: googleError } = req.query;
  const clientUrl = (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/+$/, "");

  if (googleError) {
    console.warn("Google OAuth callback error:", googleError);
    return res.redirect(`${clientUrl}/login?google_error=${encodeURIComponent(googleError)}`);
  }

  if (!code || !state) {
    return res.redirect(`${clientUrl}/login?google_error=missing_code_or_state`);
  }

  const stateData = verifySignedState(state);
  if (!stateData || !stateData.userId || !Number.isFinite(stateData.createdAt) || Date.now() - stateData.createdAt > 10 * 60 * 1000 || stateData.createdAt > Date.now() + 60 * 1000) {
    return res.redirect(`${clientUrl}/login?google_error=invalid_or_expired_state`);
  }

  const returnTo = stateData.returnTo?.startsWith("/") && !stateData.returnTo.startsWith("//") && !stateData.returnTo.includes("\\")
    ? stateData.returnTo
    : (stateData.role === "admin" ? "/admin/integrations" : "/student/grades");

  try {
    const user = await User.findById(stateData.userId).select("role status");
    if (!user || user.status !== "active" || user.role !== stateData.role) {
      const separator = returnTo.includes("?") ? "&" : "?";
      return res.redirect(`${clientUrl}${returnTo}${separator}google_error=account_unavailable`);
    }
    const { tokens, googleEmail } = await exchangeGoogleCode(code);
    if (!tokens.access_token) throw new Error("Google did not return an access token.");

    await GoogleIntegration.findOneAndUpdate(
      { userId: stateData.userId },
      {
        $set: {
          googleEmail: googleEmail || "",
          accessToken: encryptGoogleToken(tokens.access_token),
          ...(tokens.refresh_token ? { refreshToken: encryptGoogleToken(tokens.refresh_token) } : {}),
          expiryDate: tokens.expiry_date || 0,
          scope: tokens.scope || "",
          connectedAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    logAudit({
      req,
      action: "GOOGLE_DRIVE_CONNECTED",
      category: "system",
      actor: { id: stateData.userId, role: stateData.role },
      target: { entityType: "GoogleIntegration", name: googleEmail || "Google Drive" },
      description: `Connected Google Drive (${googleEmail || "authorized"})`,
    });

    const separator = returnTo.includes("?") ? "&" : "?";
    return res.redirect(`${clientUrl}${returnTo}${separator}google_connected=true`);
  } catch (exchangeError) {
    console.error("Google token exchange error:", exchangeError.message);
    const separator = returnTo.includes("?") ? "&" : "?";
    return res.redirect(`${clientUrl}${returnTo}${separator}google_error=${encodeURIComponent(exchangeError.message || "exchange_failed")}`);
  }
});

// GET /status - Returns connection status for authenticated user
router.get("/status", requireAuthenticatedUser, async (req, res) => {
  try {
    res.set("Cache-Control", "no-store, max-age=0");
    const integration = await GoogleIntegration.findOne({
      userId: req.authenticatedUser._id,
    }).select("_id googleEmail connectedAt lastUsedAt").lean();

    const { clientId } = getGoogleCredentials();

    return res.json({
      success: true,
      available: Boolean(clientId && getGoogleCredentials().clientSecret && isGoogleTokenEncryptionConfigured()),
      connected: Boolean(integration),
      email: integration?.googleEmail || "",
      connectedAt: integration?.connectedAt || null,
      lastUsedAt: integration?.lastUsedAt || null,
    });
  } catch (error) {
    console.error("Google integration status error:", error.message);
    return res.status(500).json({
      error: "Unable to read Google integration status.",
    });
  }
});

// POST /disconnect - Disconnects user's Google account
router.post("/disconnect", requireAuthenticatedUser, async (req, res) => {
  try {
    const integration = await GoogleIntegration.findOneAndDelete({
      userId: req.authenticatedUser._id,
    });

    if (integration) {
      logAudit({
        req,
        action: "GOOGLE_DRIVE_DISCONNECTED",
        category: "system",
        target: { entityType: "GoogleIntegration", name: integration.googleEmail || "Google Drive" },
        description: `Disconnected Google Drive (${integration.googleEmail || "account"})`,
      });
    }

    return res.json({
      success: true,
      message: "Google account disconnected successfully.",
    });
  } catch (error) {
    console.error("Google disconnect error:", error.message);
    return res.status(500).json({
      error: "Unable to disconnect Google account.",
    });
  }
});

module.exports = router;
