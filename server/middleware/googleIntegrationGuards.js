const { requireIntegrationAccess } = require("./integrationSecurity");
const { verifySignedState } = require("../services/googleOAuthState");

/* ---------- shared helpers ---------- */

// Only allow same-site relative paths (blocks "//evil.com" and backslash tricks).
function isSafeReturnPath(value) {
  return (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
  );
}

const defaultReturnPath = (role) =>
  role === "admin" ? "/admin/integrations" : "/student/grades";

const resolveReturnTo = (candidate, role) =>
  isSafeReturnPath(candidate) ? candidate : defaultReturnPath(role);

/* ---------- middleware ---------- */

/** Admins must also pass the integration-access check; other roles skip it. */
function requireIntegrationAccessForAdmins(req, res, next) {
  if (req.authenticatedUser?.role !== "admin") return next();
  return requireIntegrationAccess(req, res, next);
}

/** POST /connect -> req.safeReturnTo */
function sanitizeConnectReturnTo(req, res, next) {
  const requested = typeof req.body?.returnTo === "string" ? req.body.returnTo : "";
  req.safeReturnTo = resolveReturnTo(requested, req.authenticatedUser?.role);
  next();
}

/**
 * GET /callback: validates Google's redirect query. Failures are redirects
 * (not JSON) because the browser is mid-OAuth. On success:
 * req.oauthCallback = { code, stateData, returnTo, clientUrl }
 */
function validateOAuthCallback(req, res, next) {
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
  if (
    !stateData ||
    !stateData.userId ||
    !Number.isFinite(stateData.createdAt) ||
    Date.now() - stateData.createdAt > 10 * 60 * 1000 ||
    stateData.createdAt > Date.now() + 60 * 1000
  ) {
    return res.redirect(`${clientUrl}/login?google_error=invalid_or_expired_state`);
  }

  req.oauthCallback = {
    code,
    stateData,
    returnTo: resolveReturnTo(stateData.returnTo, stateData.role),
    clientUrl,
  };
  next();
}

module.exports = {
  requireIntegrationAccessForAdmins,
  sanitizeConnectReturnTo,
  validateOAuthCallback,
};