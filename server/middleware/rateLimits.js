const buckets = new Map();

function requestIp(req) {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function pruneMap(map, now, maxEntries = 10000) {
  if (map.size <= maxEntries) return;
  for (const [key, value] of map) {
    if (!value.expiresAt || value.expiresAt <= now || map.size > maxEntries) map.delete(key);
    if (map.size <= maxEntries * 0.8) break;
  }
}

function logRateLimitEvent(req, { action, category, endpoint, scope, limit, windowMs }) {
  try {
    const { logAudit } = require("../services/auditLogger");
    void logAudit({
      req,
      actor: { user: null, name: "System", email: "", role: "system" },
      action: action || "RATE_LIMITED",
      category: "system",
      target: { entityType: "RateLimit", name: endpoint || category },
      description: `Rate limit reached for ${endpoint || category} (${category}).`,
      details: { category, scope, limit, windowMs },
      status: "warning",
    });
  } catch (err) {
    console.warn("Could not log rate limit audit event:", err.message);
  }
}

function createCategoryRateLimiter({
  category,
  limit,
  windowMs,
  message = "Too many requests. Please try again later.",
}) {
  return (req, res, next) => {
    const now = Date.now();
    const actorKey = req.authenticatedUser?._id
      ? `user:${req.authenticatedUser._id}`
      : `ip:${requestIp(req)}`;
    const key = `${category}:${actorKey}`;

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { attempts: [], expiresAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.attempts = bucket.attempts.filter((timestamp) => timestamp > now - windowMs);
    if (bucket.attempts.length === 0) bucket.limitEventLogged = false;
    pruneMap(buckets, now);

    if (bucket.attempts.length >= limit) {
      if (!bucket.limitEventLogged) {
        bucket.limitEventLogged = true;
        logRateLimitEvent(req, {
          action: "RATE_LIMITED",
          category,
          endpoint: req.originalUrl || (req.baseUrl || "") + (req.path || ""),
          scope: actorKey.startsWith("user:") ? "user" : "ip",
          limit,
          windowMs,
        });
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

// Reusable rate-limit categories from specification:

// Account management: 15 minutes, 20 requests
const accountManagementLimiter = createCategoryRateLimiter({
  category: "account_management",
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: "Too many account management requests. Please try again later.",
});

// Data modification: 1 minute, 30 requests
const dataModificationLimiter = createCategoryRateLimiter({
  category: "data_modification",
  windowMs: 60 * 1000,
  limit: 30,
  message: "Too many modification requests. Please slow down and try again shortly.",
});

// Search and filtering: 1 minute, 60 requests
const searchFilterLimiter = createCategoryRateLimiter({
  category: "search_filter",
  windowMs: 60 * 1000,
  limit: 60,
  message: "Too many search or query requests. Please try again in a moment.",
});

// Report generation: 1 hour, 10 requests
const reportGenerationLimiter = createCategoryRateLimiter({
  category: "report_generation",
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: "Report generation limit reached. Please wait before generating more reports.",
});

// Cloud exports & File/PDF/Excel exports: 1 hour, 10 requests
const cloudExportsLimiter = createCategoryRateLimiter({
  category: "cloud_exports",
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: "Export limit reached. Please wait before exporting more files.",
});

// Public endpoints: 1 minute, 60 requests
const publicEndpointLimiter = createCategoryRateLimiter({
  category: "public_endpoints",
  windowMs: 60 * 1000,
  limit: 60,
  message: "Too many requests to public endpoints. Please slow down.",
});

module.exports = {
  createCategoryRateLimiter,
  accountManagementLimiter,
  dataModificationLimiter,
  searchFilterLimiter,
  reportGenerationLimiter,
  cloudExportsLimiter,
  publicEndpointLimiter,
};
