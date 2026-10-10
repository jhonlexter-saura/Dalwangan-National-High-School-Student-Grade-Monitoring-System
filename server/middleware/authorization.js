const crypto = require("crypto");
const User = require("../models/User");

const TOKEN_LIFETIME_SECONDS = 8 * 60 * 60;
let temporaryTokenSecret;
let warnedAboutTemporarySecret = false;

function getTokenSecret() {
  const secret = process.env.AUTH_TOKEN_SECRET;

  if (secret && Buffer.byteLength(secret) >= 32) {
    return secret;
  }

  if (secret) {
    return null;
  }

  if (!temporaryTokenSecret) {
    temporaryTokenSecret = crypto.randomBytes(32).toString("hex");
  }

  if (!warnedAboutTemporarySecret) {
    console.warn(
      "AUTH_TOKEN_SECRET is not configured; login tokens will expire when this server restarts"
    );
    warnedAboutTemporarySecret = true;
  }

  return temporaryTokenSecret;
}

function isAuthenticationConfigured() {
  return !process.env.AUTH_TOKEN_SECRET ||
    Buffer.byteLength(process.env.AUTH_TOKEN_SECRET) >= 32;
}

function createAccessToken(userId) {
  const secret = getTokenSecret();

  if (!secret) {
    throw new Error("AUTH_TOKEN_SECRET must be configured with at least 32 bytes");
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" }))
    .toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId.toString(),
      iat: issuedAt,
      exp: issuedAt + TOKEN_LIFETIME_SECONDS,
    })
  ).toString("base64url");
  const unsignedToken = `${header}.${payload}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(unsignedToken)
    .digest("base64url");

  return `${unsignedToken}.${signature}`;
}

function getTokenUserId(token) {
  const secret = getTokenSecret();
  const parts = token.split(".");

  if (!secret || parts.length !== 3) {
    return null;
  }

  const [header, payload, suppliedSignature] = parts;

  try {
    const parsedHeader = JSON.parse(
      Buffer.from(header, "base64url").toString("utf8")
    );
    const parsedPayload = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    );
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${header}.${payload}`)
      .digest();
    const actualSignature = Buffer.from(suppliedSignature, "base64url");

    if (
      parsedHeader.alg !== "HS256" ||
      actualSignature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(actualSignature, expectedSignature) ||
      typeof parsedPayload.sub !== "string" ||
      !Number.isInteger(parsedPayload.exp) ||
      parsedPayload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return parsedPayload.sub;
  } catch {
    return null;
  }
}

async function requireAdmin(req, res, next) {
  if (!isAuthenticationConfigured()) {
    return res.status(503).json({
      error: "Admin authentication is not configured on this server",
    });
  }

  const authorization = req.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const userId = match ? getTokenUserId(match[1]) : null;

  if (!userId) {
    return res.status(401).json({ error: "A valid login is required" });
  }

  try {
    const user = await User.findById(userId).select("role status");

    if (!user || user.status !== "active" || user.role !== "admin") {
      return res.status(403).json({
        error: "Administrator access is required",
      });
    }

    req.authenticatedUser = user;
    return next();
  } catch (error) {
    console.error("Admin authorization error:", error);
    return res.status(500).json({
      error: "Failed to verify administrator access",
    });
  }
}

module.exports = {
  createAccessToken,
  isAuthenticationConfigured,
  requireAdmin,
  getTokenUserId,
};
