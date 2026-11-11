const crypto = require("crypto");

// Process-local counters suit the current single-server setup. Use a shared
// store before running multiple API instances so every instance enforces the same limits.
const ipBuckets = new Map();
const accountFailures = new Map();
const ACCOUNT_WINDOW_MS = 15 * 60 * 1000;
const ACCOUNT_FAILURE_THRESHOLD = 5;
const ACCOUNT_COOLDOWN_BASE_MS = 60 * 1000;
const ACCOUNT_COOLDOWN_MAX_MS = 15 * 60 * 1000;

function requestIp(req) {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function logRateLimitEvent(req, { action, endpoint, scope, limit, windowMs }) {
  const { logAudit } = require("../services/auditLogger");
  void logAudit({
    req,
    actor: { user: null, name: "System", email: "", role: "system" },
    action,
    category: "system",
    target: { entityType: "AuthenticationEndpoint", name: endpoint },
    description: `Authentication rate limit reached for ${endpoint}.`,
    details: { scope, limit, windowMs },
    status: "warning",
  });
}

function pruneMap(map, now, maxEntries = 10000) {
  if (map.size <= maxEntries) return;
  for (const [key, value] of map) {
    if (!value.expiresAt || value.expiresAt <= now || map.size > maxEntries) map.delete(key);
    if (map.size <= maxEntries * 0.8) break;
  }
}

function createIpRateLimiter({ endpoint, limit, windowMs, message = "Too many requests. Please try again later." }) {
  return (req, res, next) => {
    const now = Date.now();
    const key = `${requestIp(req)}:${req.route?.path || req.path}`;
    let bucket = ipBuckets.get(key);
    if (!bucket) {
      bucket = { attempts: [], expiresAt: now + windowMs };
      ipBuckets.set(key, bucket);
    }
    bucket.attempts = bucket.attempts.filter((timestamp) => timestamp > now - windowMs);
    if (bucket.attempts.length === 0) bucket.limitEventLogged = false;
    pruneMap(ipBuckets, now);

    if (bucket.attempts.length >= limit) {
      if (!bucket.limitEventLogged) {
        bucket.limitEventLogged = true;
        logRateLimitEvent(req, { action: "AUTH_RATE_LIMITED", endpoint, scope: "ip", limit, windowMs });
      }
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.attempts[0] + windowMs - now) / 1000));
      res.set("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({ error: message, retryAfterSeconds });
    }
    bucket.attempts.push(now);
    bucket.expiresAt = now + windowMs;
    return next();
  };
}

function normalizeAccountIdentifier(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function accountKey(value) {
  const identifier = normalizeAccountIdentifier(value);
  return identifier ? crypto.createHash("sha256").update(identifier).digest("hex") : "";
}

function accountFailureGuard(req, res, next) {
  const key = accountKey(req.body?.email);
  if (!key) return next();

  const now = Date.now();
  const state = accountFailures.get(key);
  if (!state) return next();

  state.attempts = state.attempts.filter((timestamp) => timestamp > now - ACCOUNT_WINDOW_MS);
  if (state.attempts.length === 0 && state.cooldownUntil <= now) {
    accountFailures.delete(key);
    return next();
  }

  if (state.cooldownUntil > now) {
    if (state.cooldownLoggedUntil !== state.cooldownUntil) {
      state.cooldownLoggedUntil = state.cooldownUntil;
      logRateLimitEvent(req, { action: "ACCOUNT_SIGN_IN_DELAYED", endpoint: "account sign-in", scope: "account", limit: ACCOUNT_FAILURE_THRESHOLD, windowMs: ACCOUNT_WINDOW_MS });
    }
    const retryAfterSeconds = Math.max(1, Math.ceil((state.cooldownUntil - now) / 1000));
    res.set("Retry-After", String(retryAfterSeconds));
    return res.status(429).json({ error: "Too many sign-in attempts. Please try again later.", retryAfterSeconds });
  }
  return next();
}

function recordFailedAccountLogin(identifier) {
  const key = accountKey(identifier);
  if (!key) return;

  const now = Date.now();
  const state = accountFailures.get(key) || { attempts: [], cooldownLevel: 0, cooldownUntil: 0, expiresAt: now + ACCOUNT_WINDOW_MS };
  state.attempts = state.attempts.filter((timestamp) => timestamp > now - ACCOUNT_WINDOW_MS);
  state.attempts.push(now);
  state.expiresAt = now + ACCOUNT_WINDOW_MS;

  if (state.attempts.length >= ACCOUNT_FAILURE_THRESHOLD) {
    state.cooldownLevel += 1;
    const cooldownMs = Math.min(ACCOUNT_COOLDOWN_BASE_MS * (2 ** (state.cooldownLevel - 1)), ACCOUNT_COOLDOWN_MAX_MS);
    state.cooldownUntil = now + cooldownMs;
  }

  accountFailures.set(key, state);
  pruneMap(accountFailures, now);
}

function clearAccountFailures(identifier) {
  const key = accountKey(identifier);
  if (key) accountFailures.delete(key);
}

const limits = {
  passwordLoginIp: createIpRateLimiter({ endpoint: "password login", limit: 30, windowMs: 15 * 60 * 1000, message: "Too many sign-in attempts from this network. Please try again later." }),
  googleLoginIp: createIpRateLimiter({ endpoint: "Google sign-in", limit: 30, windowMs: 15 * 60 * 1000, message: "Too many sign-in attempts from this network. Please try again later." }),
  passkeyOptionsIp: createIpRateLimiter({ endpoint: "passkey options", limit: 10, windowMs: 60 * 1000, message: "Too many passkey requests. Please try again shortly." }),
  passkeyVerifyIp: createIpRateLimiter({ endpoint: "passkey verification", limit: 10, windowMs: 60 * 1000, message: "Too many passkey attempts. Please try again shortly." }),
  forgotPasswordIp: createIpRateLimiter({ endpoint: "password recovery", limit: 20, windowMs: 60 * 60 * 1000, message: "Too many password recovery requests. Please try again later." }),
  resetPasswordIp: createIpRateLimiter({ endpoint: "password reset", limit: 10, windowMs: 60 * 60 * 1000, message: "Too many password reset attempts. Please try again later." }),
};

function forgotPasswordAccountLimit(req, res, next) {
  const key = accountKey(req.body?.email);
  if (!key) return next();
  const now = Date.now();
  const bucketKey = `forgot:${key}`;
  let bucket = ipBuckets.get(bucketKey);
  if (!bucket) {
    bucket = { attempts: [], expiresAt: now + 60 * 60 * 1000 };
    ipBuckets.set(bucketKey, bucket);
  }
  bucket.attempts = bucket.attempts.filter((timestamp) => timestamp > now - 60 * 60 * 1000);
  if (bucket.attempts.length === 0) bucket.limitEventLogged = false;
  pruneMap(ipBuckets, now);
  if (bucket.attempts.length >= 5) {
    if (!bucket.limitEventLogged) {
      bucket.limitEventLogged = true;
      logRateLimitEvent(req, { action: "PASSWORD_RECOVERY_RATE_LIMITED", endpoint: "password recovery", scope: "account", limit: 5, windowMs: 60 * 60 * 1000 });
    }
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.attempts[0] + 60 * 60 * 1000 - now) / 1000));
    res.set("Retry-After", String(retryAfterSeconds));
    return res.status(429).json({ error: "Too many password recovery requests. Please try again later.", retryAfterSeconds });
  }
  bucket.attempts.push(now);
  bucket.expiresAt = now + 60 * 60 * 1000;
  return next();
}

module.exports = {
  limits,
  accountFailureGuard,
  recordFailedAccountLogin,
  clearAccountFailures,
  forgotPasswordAccountLimit,
};
