/**
 * Reusable middleware factory: reads ?page= and ?limit= from the query string,
 * clamps them to safe values, and stores { page, limit, skip } on req.pagination.
 *
 * Usage: router.get("/", parsePagination({ defaultLimit: 20, maxLimit: 100 }), ctrl.list)
 */
function parsePagination({ defaultLimit = 20, maxLimit = 100 } = {}) {
  return (req, res, next) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      maxLimit,
      Math.max(1, parseInt(req.query.limit, 10) || defaultLimit)
    );
    req.pagination = { page, limit, skip: (page - 1) * limit };
    next();
  };
}

module.exports = { parsePagination };