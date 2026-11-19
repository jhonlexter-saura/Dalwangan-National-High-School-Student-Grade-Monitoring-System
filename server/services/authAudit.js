const crypto = require("crypto");
const { logAudit } = require("./auditLogger");

const auditIdentifierSecret =
  process.env.CUSTOM_AUTH_TOKEN_SECRET?.trim() ||
  process.env.AUTH_TOKEN_SECRET ||
  crypto.randomBytes(32).toString("hex");

async function logSuccessfulLogin(req, user, method) {
  await logAudit({
    req,
    actor: {
      user: user._id,
      name: user.name || "User",
      email: user.email || "",
      role: user.role || "system",
    },
    action: "USER_LOGIN",
    category: "system",
    target: {
      entityType: "User",
      entityId: String(user._id),
      name: user.name || user.email || "User",
    },
    description: `${user.role || "User"} signed in using ${method}.`,
    details: { role: user.role, loginMethod: method },
  });
}

async function logFailedLogin(req, { user = null, identifier = "", method, reason }) {
  const identifierHash = identifier
    ? crypto
        .createHmac("sha256", auditIdentifierSecret)
        .update(identifier.trim().toLowerCase())
        .digest("hex")
    : "";

  await logAudit({
    req,
    actor: user
      ? {
          user: user._id,
          name: user.name || "User",
          email: user.email || "",
          role: user.role || "system",
        }
      : { user: null, name: "Unrecognized sign-in", email: "", role: "system" },
    action: "USER_LOGIN",
    category: "system",
    target: user
      ? {
          entityType: "User",
          entityId: String(user._id),
          name: user.name || user.email || "User",
        }
      : { entityType: "AuthenticationAttempt", name: "Unrecognized account" },
    description: `Failed sign-in${user?.role ? ` for ${user.role}` : ""} using ${method}.`,
    details: {
      loginMethod: method,
      failureReason: reason,
      ...(identifierHash ? { attemptedIdentifierHash: identifierHash } : {}),
    },
    status: "failed",
  });
}

module.exports = { logSuccessfulLogin, logFailedLogin };