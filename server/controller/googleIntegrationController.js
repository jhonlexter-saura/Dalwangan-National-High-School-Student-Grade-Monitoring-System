const GoogleIntegration = require("../models/GoogleIntegration");
const User = require("../models/User");
const { consumeApproval } = require("../middleware/integrationSecurity");
const { logAudit } = require("../services/auditLogger");
const {
  generateGoogleAuthUrl,
  exchangeGoogleCode,
  getGoogleCredentials,
} = require("../services/googleDriveService");
const { createSignedState } = require("../services/googleOAuthState");
const {
  encryptGoogleToken,
  isGoogleTokenEncryptionConfigured,
} = require("../utils/googleTokenVault");

/* ---------- helpers (used only by this controller) ---------- */

// Was written out twice (connect + status) with a repeated getGoogleCredentials() call.
function isGoogleOAuthConfigured() {
  const { clientId, clientSecret } = getGoogleCredentials();
  return Boolean(clientId && clientSecret && isGoogleTokenEncryptionConfigured());
}

// Admins need a valid, unused super-user PIN; other roles skip this.
async function adminApprovalDenied(req, action) {
  if (req.authenticatedUser.role !== "admin") return false;
  const approved = await consumeApproval(req, { action, payload: {} });
  return !approved;
}

// The "?" or "&" separator logic was repeated three times in the callback.
function withQuery(path, query) {
  return `${path}${path.includes("?") ? "&" : "?"}${query}`;
}

/* ---------- handlers ---------- */

// POST /connect - Generates Google OAuth consent URL
async function connect(req, res) {
  try {
    if (!isGoogleOAuthConfigured()) {
      return res.status(503).json({
        error:
          "Google OAuth credentials and a stable token encryption secret must be configured on this server.",
      });
    }

    if (await adminApprovalDenied(req, "google-connect")) {
      return res.status(403).json({
        error: "A valid, unused super-user PIN is required to connect Google Drive.",
      });
    }

    const state = createSignedState({
      userId: req.authenticatedUser._id.toString(),
      role: req.authenticatedUser.role,
      returnTo: req.safeReturnTo, // sanitized by middleware
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
}

// GET /callback - Handles Google OAuth redirect (query + state validated by middleware)
async function callback(req, res) {
  const { code, stateData, returnTo, clientUrl } = req.oauthCallback;

  try {
    const user = await User.findById(stateData.userId).select("role status");
    if (!user || user.status !== "active" || user.role !== stateData.role) {
      return res.redirect(
        `${clientUrl}${withQuery(returnTo, "google_error=account_unavailable")}`
      );
    }

    const { tokens, googleEmail } = await exchangeGoogleCode(code);
    if (!tokens.access_token) throw new Error("Google did not return an access token.");

    await GoogleIntegration.findOneAndUpdate(
      { userId: stateData.userId },
      {
        $set: {
          googleEmail: googleEmail || "",
          accessToken: encryptGoogleToken(tokens.access_token),
          ...(tokens.refresh_token
            ? { refreshToken: encryptGoogleToken(tokens.refresh_token) }
            : {}),
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

    return res.redirect(`${clientUrl}${withQuery(returnTo, "google_connected=true")}`);
  } catch (exchangeError) {
    console.error("Google token exchange error:", exchangeError.message);
    return res.redirect(
      `${clientUrl}${withQuery(
        returnTo,
        `google_error=${encodeURIComponent(exchangeError.message || "exchange_failed")}`
      )}`
    );
  }
}

// GET /status - Returns connection status for authenticated user
async function getStatus(req, res) {
  try {
    res.set("Cache-Control", "no-store, max-age=0");
    const integration = await GoogleIntegration.findOne({
      userId: req.authenticatedUser._id,
    })
      .select("_id googleEmail connectedAt lastUsedAt")
      .lean();

    return res.json({
      success: true,
      available: isGoogleOAuthConfigured(),
      connected: Boolean(integration),
      email: integration?.googleEmail || "",
      connectedAt: integration?.connectedAt || null,
      lastUsedAt: integration?.lastUsedAt || null,
    });
  } catch (error) {
    console.error("Google integration status error:", error.message);
    return res.status(500).json({ error: "Unable to read Google integration status." });
  }
}

// POST /disconnect - Disconnects user's Google account
async function disconnect(req, res) {
  try {
    if (await adminApprovalDenied(req, "google-disconnect")) {
      return res.status(403).json({
        error: "A valid, unused super-user PIN is required to disconnect Google Drive.",
      });
    }

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
    return res.status(500).json({ error: "Unable to disconnect Google account." });
  }
}

module.exports = { connect, callback, getStatus, disconnect };