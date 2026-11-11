const express = require("express");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} = require("@simplewebauthn/server");
const User = require("../models/User");
const Passkey = require("../models/Passkey");
const PasskeyChallenge = require("../models/PasskeyChallenge");
const { createAccessToken, isAuthenticationConfigured, requireAdmin } = require("../middleware/authorization");
const { logAudit } = require("../services/auditLogger");
const {
  limits: authRateLimits,
  accountFailureGuard,
  recordFailedAccountLogin,
  clearAccountFailures,
} = require("../middleware/authRateLimit");

const router = express.Router();
const CHALLENGE_TTL_MS = 90 * 1000;

function webAuthnConfig(req) {
  const originValues = (process.env.WEBAUTHN_ORIGIN || process.env.CLIENT_URL || "http://localhost:5173")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const originsSet = new Set();
  for (const value of originValues) {
    try {
      originsSet.add(new URL(value).origin);
    } catch {}
  }
  originsSet.add("http://localhost:5173");
  originsSet.add("http://127.0.0.1:5173");
  originsSet.add("http://localhost:5000");
  originsSet.add("http://127.0.0.1:5000");

  const reqOrigin = req?.get?.("origin");
  if (reqOrigin) {
    try {
      originsSet.add(new URL(reqOrigin).origin);
    } catch {}
  }

  const origins = Array.from(originsSet);
  let rpID = process.env.WEBAUTHN_RP_ID?.trim();
  if (!rpID) {
    if (reqOrigin) {
      try {
        rpID = new URL(reqOrigin).hostname;
      } catch {}
    }
    if (!rpID && origins.length > 0) {
      rpID = new URL(origins[0]).hostname;
    }
  }
  rpID = rpID || "localhost";
  const rpName = process.env.WEBAUTHN_RP_NAME?.trim() || "DNHS-SGMS";
  return { origins, rpID, rpName };
}

async function getRecentlyAuthenticatedAdmin(userId, password) {
  if (typeof password !== "string" || !password) return null;
  const user = await User.findById(userId).select("name email role status password");
  if (!user || user.role !== "admin" || user.status !== "active" || !user.password) return null;
  return await bcrypt.compare(password, user.password) ? user : null;
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

async function invalidPasskeyResponse(req, res, user = null, reason = "invalid_credential") {
  if (user?.email) recordFailedAccountLogin(user.email);
  await logAudit({
    req,
    actor: user
      ? { user: user._id, name: user.name || "Administrator", email: user.email || "", role: user.role || "admin" }
      : { user: null, name: "Unrecognized sign-in", email: "", role: "system" },
    action: "USER_LOGIN",
    category: "system",
    target: user
      ? { entityType: "User", entityId: String(user._id), name: user.name || user.email || "Administrator" }
      : { entityType: "AuthenticationAttempt", name: "Unrecognized account" },
    description: "Failed administrator sign-in using passkey.",
    details: { loginMethod: "passkey", failureReason: reason },
    status: "failed",
  });
  return res.status(401).json({ error: "Passkey could not be verified. Try again or sign in with your password." });
}

router.post("/register/options", requireAdmin, async (req, res) => {
  try {
    const user = await getRecentlyAuthenticatedAdmin(req.authenticatedUser._id, req.body?.password);
    if (!user) return res.status(401).json({ error: "Enter your current administrator password to add a passkey." });

    const { rpID, rpName } = webAuthnConfig(req);
    const existingPasskeys = await Passkey.find({ userId: user._id }).select("credentialId transports").lean();
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new Uint8Array(Buffer.from(String(user._id))),
      userName: user.email,
      userDisplayName: user.name,
      attestationType: "none",
      excludeCredentials: existingPasskeys.map((passkey) => ({ id: passkey.credentialId, transports: passkey.transports })),
      authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
    });

    await PasskeyChallenge.deleteMany({ userId: user._id, purpose: "registration" });
    await PasskeyChallenge.create({ challenge: options.challenge, purpose: "registration", userId: user._id, expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS) });
    return res.json({ options });
  } catch (error) {
    console.error("Passkey registration options error:", error.message);
    return res.status(500).json({ error: "Unable to start passkey registration." });
  }
});

router.post("/register/verify", requireAdmin, async (req, res) => {
  const { response, challenge, deviceName } = req.body || {};
  if (typeof challenge !== "string") return res.status(400).json({ error: "Passkey challenge is required." });

  try {
    const pendingChallenge = await PasskeyChallenge.findOneAndDelete({
      challenge,
      purpose: "registration",
      userId: req.authenticatedUser._id,
      expiresAt: { $gt: new Date() },
    });
    if (!pendingChallenge) return res.status(400).json({ error: "Passkey registration expired. Start again." });
    if (!response || typeof deviceName !== "string" || !deviceName.trim() || deviceName.trim().length > 80) {
      return res.status(400).json({ error: "Passkey response and a device name of 1–80 characters are required." });
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
      return res.status(400).json({ error: "Passkey registration could not be verified. Try again." });
    }
    if (!verification.verified || !verification.registrationInfo?.credential) {
      return res.status(400).json({ error: "Passkey registration could not be verified. Try again." });
    }

    const { credential } = verification.registrationInfo;
    const passkey = await Passkey.create({
      userId: req.authenticatedUser._id,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: credential.counter,
      transports: response.response?.transports || credential.transports || [],
      deviceName: deviceName.trim(),
    });
    await logAudit({ req, action: "ADMIN_PASSKEY_REGISTERED", category: "accounts", target: { entityType: "Passkey", entityId: String(passkey._id), name: passkey.deviceName }, description: `Added passkey “${passkey.deviceName}”` });
    return res.json({ success: true, passkey: publicPasskey(passkey) });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ error: "This passkey is already registered." });
    console.error("Passkey registration verification error:", error.message);
    return res.status(500).json({ error: "Unable to save this passkey." });
  }
});

router.get("/", requireAdmin, async (req, res) => {
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
});

router.delete("/:id", requireAdmin, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Passkey not found." });
  try {
    const user = await getRecentlyAuthenticatedAdmin(req.authenticatedUser._id, req.body?.password);
    if (!user) return res.status(401).json({ error: "Enter your current administrator password to remove a passkey." });
    const passkey = await Passkey.findOneAndDelete({ _id: req.params.id, userId: user._id });
    if (!passkey) return res.status(404).json({ error: "Passkey not found." });
    await logAudit({ req, action: "ADMIN_PASSKEY_REMOVED", category: "accounts", target: { entityType: "Passkey", entityId: String(passkey._id), name: passkey.deviceName }, description: `Removed passkey “${passkey.deviceName}”` });
    return res.json({ success: true, message: "Passkey removed." });
  } catch (error) {
    console.error("Remove passkey error:", error.message);
    return res.status(500).json({ error: "Unable to remove this passkey." });
  }
});

router.post("/login/options", authRateLimits.passkeyOptionsIp, accountFailureGuard, async (req, res) => {
  try {
    if (!isAuthenticationConfigured()) return res.status(503).json({ error: "Authentication is not configured on this server." });
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!email) return res.status(400).json({ error: "Enter your administrator email first." });

    const user = await User.findOne({ email, role: "admin", status: "active" }).select("_id").lean();
    const passkeys = user ? await Passkey.find({ userId: user._id }).select("credentialId transports").lean() : [];
    const { rpID } = webAuthnConfig(req);
    const options = await generateAuthenticationOptions({
      rpID,
      ...(passkeys.length ? { allowCredentials: passkeys.map((passkey) => ({ id: passkey.credentialId, transports: passkey.transports })) } : {}),
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
});

router.post("/login/verify", authRateLimits.passkeyVerifyIp, async (req, res) => {
  const { response, challenge } = req.body || {};
  if (typeof challenge !== "string") return res.status(400).json({ error: "Passkey challenge is required." });

  try {
    if (!isAuthenticationConfigured()) return res.status(503).json({ error: "Authentication is not configured on this server." });
    const pendingChallenge = await PasskeyChallenge.findOneAndDelete({ challenge, purpose: "authentication", expiresAt: { $gt: new Date() } });
    if (!pendingChallenge) return invalidPasskeyResponse(req, res, null, "invalid_or_expired_challenge");
    const challengeUser = pendingChallenge.userId ? await User.findById(pendingChallenge.userId).select("name email role") : null;
    if (!response || !response.id) return invalidPasskeyResponse(req, res, challengeUser, "invalid_credential");

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
        ? new Uint8Array(passkey.publicKey.buffer, passkey.publicKey.byteOffset || 0, passkey.publicKey.byteLength || passkey.publicKey.length)
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
      target: { entityType: "User", entityId: String(user._id), name: user.name || user.email || "Administrator" },
      description: "Administrator signed in using a passkey.",
      details: { role: user.role, loginMethod: "passkey" },
    });
    clearAccountFailures(user.email);

    return res.json({ success: true, user: safeUser(user), token: createAccessToken(user._id) });
  } catch (error) {
    console.error("Passkey login verification error:", error.message);
    return res.status(500).json({ error: "Passkey sign-in failed." });
  }
});

function safeUser(user) {
  const result = user.toObject();
  delete result.password;
  delete result.resetPasswordToken;
  delete result.resetPasswordExpires;
  return result;
}

module.exports = router;
