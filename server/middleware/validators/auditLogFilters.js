const DAY_MS = 24 * 60 * 60 * 1000;

const SECURITY_ACTIONS = [
  "AUTH_RATE_LIMITED",
  "ACCOUNT_SIGN_IN_DELAYED",
  "PASSWORD_RECOVERY_RATE_LIMITED",
];

// Escape regex special characters so user search text is matched literally
function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

/**
 * Pure function: query-string filters -> MongoDB query object.
 * This logic was copy-pasted in both GET / and GET /export.
 */
function buildAuditLogQuery(params) {
  const { search, category, action, role, timeframe, startDate, endDate, securityOnly } =
    params;
  const query = {};

  if (securityOnly === "true") {
    query.$or = [
      { status: { $in: ["failed", "warning"] } },
      { action: { $in: SECURITY_ACTIONS } },
      { description: /failed sign-in|authentication rate limit/i },
    ];
  }

  if (category && category !== "all") query.category = category;
  if (action && action !== "all") query.action = action;
  if (role && role !== "all") query["actor.role"] = role;

  const now = new Date();
  if (timeframe === "today") {
    query.createdAt = {
      $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    };
  } else if (timeframe === "week") {
    query.createdAt = { $gte: new Date(now.getTime() - 7 * DAY_MS) };
  } else if (timeframe === "month") {
    query.createdAt = { $gte: new Date(now.getTime() - 30 * DAY_MS) };
  } else if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }

  if (search && search.trim()) {
    const regex = new RegExp(escapeRegex(search.trim()), "i");
    const searchTerms = [
      { description: regex },
      { "actor.name": regex },
      { "actor.email": regex },
      { "target.name": regex },
      { action: regex },
    ];
    if (query.$or) query.$and = [{ $or: query.$or }, { $or: searchTerms }];
    else query.$or = searchTerms;
  }

  return query;
}

/** Middleware: stores the built query on req.auditFilter for the controller. */
function buildAuditLogFilter(req, res, next) {
  req.auditFilter = buildAuditLogQuery(req.query);
  next();
}

module.exports = { buildAuditLogQuery, buildAuditLogFilter };