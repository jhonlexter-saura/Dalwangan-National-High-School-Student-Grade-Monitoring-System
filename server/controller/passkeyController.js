const bcrypt = require("bcrypt");
const {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} = require("@simplewebauthn/server");

const User = require("../models/User");
const Passkey = require("../models/Passkey");
const PasskeyChallenge = require("../models/PasskeyChallenge");
const IntegrationSecurityGrant = require("../models/IntegrationSecurityGrant");
const { createAccessToken } = require("../middleware/authorization");
const {
  recordFailedAccountLogin,
  clearAccountFailures,
} = require("../middleware/authRateLimit");
const { logAudit } = require("../services/auditLogger");
const { webAuthnConfig } = require("../services/webauthnConfig");
const { safeUser } = require("../utils/safeUser");

const CHALLENGE_TTL_MS = 90 * 1000;

/* ---------- helpers (used only by this controller) ---------- */

async function getRecentlyAuthenticatedAdmin(userId, password) {
  if (typeof password !== "string" || !password) return null;
  const user = await User.findById(userId).select("name email role status password");
  if (!user || user.role !== "admin" || user.status !== "active" || !user.password) return null;
  return (await bcrypt.compare(password, user.password)) ? user : null;
}

function publicPasskey(passkey) {
  return {
    _id: passkey._id,
    deviceName: passkey.deviceName,
    transports: passkey.transports,
    createdAt: passkey.createdAt,
    lastUsedAt: passkey.lastUsedAt,
  };
}

// Not moved to middleware on purpose: by the time this runs, the challenge has been
// consumed, and the failure must be recorded in the audit log and the rate limiter.
async function invalidPasskeyResponse(req, res, user = null, reason = "invalid_credential") {
  if (user?.email) recordFailedAccountLogin(user.email);
  await logAudit({
    req,
    actor: user
      ? {
          user: user._id,
          name: user.name || "Administrator",
          email: user.email || "",
          role: user.role || "admin",
        }
      : { user: null, name: "Unrecognized sign-in", email: "", role: "system" },
    action: "USER_LOGIN",
    category: "system",
    target: user
      ? {
          entityType: "User",
          entityId: String(user._id),
          name: user.name || user.email || "Administrator",
        }
      : { entityType: "AuthenticationAttempt", name: "Unrecognized account" },
    description: "Failed administrator sign-in using passkey.",
    details: { loginMethod: "passkey", failureReason: reason },
    status: "failed",
  });
  return res
    .status(401)
    .json({ error: "Passkey could not be verified. Try again or sign in with your password." });
}

/* ---------- handlers ---------- */

// POST /register/options
async function registerOptions(req, res) {
  try {
    const user = await getRecentlyAuthenticatedAdmin(req.authenticatedUser._id, req.body?.password);
    if (!user) {
      return res
        .status(401)
        .json({ error: "Enter your current administrator password to add a passkey." });
    }

    const { rpID, rpName } = webAuthnConfig(req);
    const existingPasskeys = await Passkey.find({ userId: user._id })
      .select("credentialId transports")
      .lean();
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new Uint8Array(Buffer.from(String(user._id))),
      userName: user.email,
      userDisplayName: user.name,
      attestationType: "none",
      excludeCredentials: existingPasskeys.map((passkey) => ({
        id: passkey.credentialId,
        transports: passkey.transports,
      })),
      authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
    });

    await PasskeyChallenge.deleteMany({ userId: user._id, purpose: "registration" });
    await PasskeyChallenge.create({
      challenge: options.challenge,
      purpose: "registration",
      userId: user._id,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    });
    return res.json({ options });
  } catch (error) {
    console.error("Passkey registration options error:", error.message);
    return res.status(500).json({ error: "Unable to start passkey registration." });
  }
}

// POST /register/verify (body shape validated by middleware)
async function registerVerify(req, res) {
  const { response, challenge, deviceName } = req.passkeyRegistration;

  try {
    const pendingChallenge = await PasskeyChallenge.findOneAndDelete({
      challenge,
      purpose: "registration",
      userId: req.authenticatedUser._id,
      expiresAt: { $gt: new Date() },
    });
    if (!pendingChallenge) {
      return res.status(400).json({ error: "Passkey registration expired. Start again." });
    }

    const { origins, rpID } = webAuthnConfig(req);
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: pendingChallenge.challenge,
        expectedOrigin: origins,
        expectedRPID: rpID,
        requireUserVerification: false,
      });
    } catch (error) {
      console.warn("Passkey registration verification failed:", error.message);
      return res
        .status(400)
        .json({ error: "Passkey registration could not be verified. Try again." });
    }
    if (!verification.verified || !verification.registrationInfo?.credential) {
      return res
        .status(400)
        .json({ error: "Passkey registration could not be verified. Try again." });
    }

    const { credential } = verification.registrationInfo;
    const passkey = await Passkey.create({
      userId: req.authenticatedUser._id,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: credential.counter,
      transports: response.response?.transports || credential.transports || [],
      deviceName,
    });
    await logAudit({
      req,
      action: "ADMIN_PASSKEY_REGISTERED",
      category: "accounts",
      target: { entityType: "Passkey", entityId: String(passkey._id), name: passkey.deviceName },
      description: `Added passkey “${passkey.deviceName}”`,
    });
    return res.json({ success: true, passkey: publicPasskey(passkey) });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ error: "This passkey is already registered." });
    }
    console.error("Passkey registration verification error:", error.message);
    return res.status(500).json({ error: "Unable to save this passkey." });
  }
}

// GET /
async function listPasskeys(req, res) {
  try {
    const passkeys = await Passkey.find({ userId: req.authenticatedUser._id })
      .select("deviceName transports createdAt lastUsedAt")
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ passkeys });
  } catch (error) {
    console.error("List passkeys error:", error.message);
    return res.status(500).json({ error: "Unable to load passkeys." });
  }
}

// DELETE /:id (ID validated by middleware)
async function removePasskey(req, res) {
  try {
    const user = await getRecentlyAuthenticatedAdmin(req.authenticatedUser._id, req.body?.password);
    if (!user) {
      return res
        .status(401)
        .json({ error: "Enter your current administrator password to remove a passkey." });
    }
    const passkey = await Passkey.findOneAndDelete({ _id: req.params.id, userId: user._id });
    if (!passkey) return res.status(404).json({ error: "Passkey not found." });
    await logAudit({
      req,
      action: "ADMIN_PASSKEY_REMOVED",
      category: "accounts",
      target: { entityType: "Passkey", entityId: String(passkey._id), name: passkey.deviceName },
      description: `Removed passkey “${passkey.deviceName}”`,
    });
    return res.json({ success: true, message: "Passkey removed." });
  } catch (error) {
    console.error("Remove passkey error:", error.message);
    return res.status(500).json({ error: "Unable to remove this passkey." });
  }
}

// POST /login/options (config + email validated by middleware)
async function loginOptions(req, res) {
  try {
    const email = req.passkeyLoginEmail;

    const user = await User.findOne({ email, role: "admin", status: "active" })
      .select("_id")
      .lean();
    const passkeys = user
      ? await Passkey.find({ userId: user._id }).select("credentialId transports").lean()
      : [];
    const { rpID } = webAuthnConfig(req);
    const options = await generateAuthenticationOptions({
      rpID,
      ...(passkeys.length
        ? {
            allowCredentials: passkeys.map((passkey) => ({
              id: passkey.credentialId,
              transports: passkey.transports,
            })),
          }
        : {}),
      userVerification: "preferred",
    });
    await PasskeyChallenge.create({
      challenge: options.challenge,
      purpose: "authentication",
      userId: user?._id || null,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    });
    return res.json({ options });
  } catch (error) {
    console.error("Passkey login options error:", error.message);
    return res.status(500).json({ error: "Unable to start passkey sign-in." });
  }
}

// POST /login/verify (challenge + config validated by middleware)
async function loginVerify(req, res) {
  const { response, challenge } = req.passkeyLogin;

  try {
    const pendingChallenge = await PasskeyChallenge.findOneAndDelete({
      challenge,
      purpose: "authentication",
      expiresAt: { $gt: new Date() },
    });
    if (!pendingChallenge) {
      return invalidPasskeyResponse(req, res, null, "invalid_or_expired_challenge");
    }
    const challengeUser = pendingChallenge.userId
      ? await User.findById(pendingChallenge.userId).select("name email role")
      : null;
    if (!response || !response.id) {
      return invalidPasskeyResponse(req, res, challengeUser, "invalid_credential");
    }

    let passkey = await Passkey.findOne({
      credentialId: response.id,
      ...(pendingChallenge.userId ? { userId: pendingChallenge.userId } : {}),
    });
    if (!passkey) {
      passkey = await Passkey.findOne({ credentialId: response.id });
    }
    if (!passkey) return invalidPasskeyResponse(req, res, challengeUser, "invalid_credential");
    const user = await User.findOne({ _id: passkey.userId, role: "admin", status: "active" });
    if (!user) return invalidPasskeyResponse(req, res, challengeUser, "account_unavailable");

    const { origins, rpID } = webAuthnConfig(req);
    let verification;
    try {
      const rawPublicKey = passkey.publicKey?.buffer
        ? new Uint8Array(
            passkey.publicKey.buffer,
            passkey.publicKey.byteOffset || 0,
            passkey.publicKey.byteLength || passkey.publicKey.length
          )
        : new Uint8Array(passkey.publicKey);

      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: pendingChallenge.challenge,
        expectedOrigin: origins,
        expectedRPID: rpID,
        credential: {
          id: passkey.credentialId,
          publicKey: rawPublicKey,
          counter: passkey.counter,
          transports: passkey.transports,
        },
        requireUserVerification: false,
      });
    } catch (error) {
      console.warn("Passkey authentication verification failed:", error.message);
      return invalidPasskeyResponse(req, res, user, "invalid_credential");
    }
    if (!verification.verified) return invalidPasskeyResponse(req, res, user, "invalid_credential");

    const newCounter = verification.authenticationInfo?.newCounter ?? 0;
    // Multi-device synced passkeys (e.g. iCloud Keychain, Google Password Manager) always return counter = 0.
    // Only detect counter rollback when BOTH stored counter and new counter are greater than 0.
    if (passkey.counter > 0 && newCounter > 0 && newCounter <= passkey.counter) {
      console.warn(`Passkey counter rollback detected: stored ${passkey.counter}, received ${newCounter}`);
      return invalidPasskeyResponse(req, res, user, "counter_rollback");
    }

    await Passkey.updateOne(
      { _id: passkey._id },
      { $set: { counter: newCounter > 0 ? newCounter : passkey.counter, lastUsedAt: new Date() } }
    );

    await logAudit({
      req,
      actor: {
        user: user._id,
        name: user.name || "Administrator",
        email: user.email || "",
        role: user.role,
      },
      action: "USER_LOGIN",
      category: "system",
      target: {
        entityType: "User",
        entityId: String(user._id),
        name: user.name || user.email || "Administrator",
      },
      description: "Administrator signed in using a passkey.",
      details: { role: user.role, loginMethod: "passkey" },
    });
    clearAccountFailures(user.email);

    if (user.role === "admin") {
      await IntegrationSecurityGrant.deleteMany({ adminId: user._id, purpose: "access-session" });
    }

    return res.json({ success: true, user: safeUser(user), token: createAccessToken(user._id) });
  } catch (error) {
    console.error("Passkey login verification error:", error.message);
    return res.status(500).json({ error: "Passkey sign-in failed." });
  }
}

module.exports = {
  registerOptions,
  registerVerify,
  listPasskeys,
  removePasskey,
  loginOptions,
  loginVerify,
};