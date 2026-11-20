const mongoose = require("mongoose");
const { isAuthenticationConfigured } = require("../authorization");

/** Guard: stops passkey sign-in early if the server has no auth secret. */
function requirePasskeyAuthConfigured(req, res, next) {
  if (!isAuthenticationConfigured()) {
    return res.status(503).json({ error: "Authentication is not configured on this server." });
  }
  next();
}

/** DELETE /:id (note: a bad ID is a 404 here, matching the original). */
function validatePasskeyId(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ error: "Passkey not found." });
  }
  next();
}

/** POST /register/verify -> req.passkeyRegistration = { response, challenge, deviceName (trimmed) } */
function validateRegistrationVerifyBody(req, res, next) {
  const { response, challenge, deviceName } = req.body || {};

  if (typeof challenge !== "string") {
    return res.status(400).json({ error: "Passkey challenge is required." });
  }
  if (
    !response ||
    typeof deviceName !== "string" ||
    !deviceName.trim() ||
    deviceName.trim().length > 80
  ) {
    return res
      .status(400)
      .json({ error: "Passkey response and a device name of 1–80 characters are required." });
  }

  req.passkeyRegistration = { response, challenge, deviceName: deviceName.trim() };
  next();
}

/** POST /login/options -> req.passkeyLoginEmail (normalized) */
function validatePasskeyLoginOptionsBody(req, res, next) {
  const email =
    typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!email) {
    return res.status(400).json({ error: "Enter your administrator email first." });
  }
  req.passkeyLoginEmail = email;
  next();
}

/** POST /login/verify -> req.passkeyLogin = { response, challenge } */
function validatePasskeyLoginVerifyBody(req, res, next) {
  const { response, challenge } = req.body || {};
  if (typeof challenge !== "string") {
    return res.status(400).json({ error: "Passkey challenge is required." });
  }
  req.passkeyLogin = { response, challenge };
  next();
}

module.exports = {
  requirePasskeyAuthConfigured,
  validatePasskeyId,
  validateRegistrationVerifyBody,
  validatePasskeyLoginOptionsBody,
  validatePasskeyLoginVerifyBody,
};