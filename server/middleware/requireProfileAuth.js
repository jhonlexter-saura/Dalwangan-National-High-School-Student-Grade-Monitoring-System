const mongoose = require("mongoose");
const User = require("../models/User");
const { getTokenUserId, isAuthenticationConfigured } = require("./authorization");

/**
 * Authentication for a user's own profile.
 * The account ID always comes from the verified access token.
 * Sets req.authenticatedUser (with the profile fields loaded).
 */
async function requireProfileAuth(req, res, next) {
  if (!isAuthenticationConfigured()) {
    return res.status(503).json({
      error: "Authentication is not configured correctly",
    });
  }

  const authorization = req.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const userId = match ? getTokenUserId(match[1]) : null;

  if (!userId || !mongoose.isValidObjectId(userId)) {
    return res.status(401).json({ error: "A valid login is required" });
  }

  try {
    const user = await User.findById(userId).select(
      "name firstName middleName lastName nameExtension email role status contactNumber address birthdate"
    );

    if (!user || user.status !== "active") {
      return res.status(401).json({ error: "Your account is unavailable or inactive" });
    }

    req.authenticatedUser = user;
    next();
  } catch (error) {
    console.error("Authentication verification failed:", error);
    return res.status(500).json({ error: "Unable to verify your account" });
  }
}

module.exports = { requireProfileAuth };