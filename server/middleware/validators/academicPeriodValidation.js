/**
 * Pure function: checks and normalizes the request body.
 * Returns either { error } or the cleaned period data.
 * (Kept separate from the middleware so it is easy to test.)
 */
function validatePeriod(input) {
  const schoolYear =
    typeof input.schoolYear === "string" ? input.schoolYear.trim() : "";
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const trimester = Number(input.trimester);
  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);
  const status = input.status || "upcoming";

  const schoolYearMatch = schoolYear.match(/^(\d{4})-(\d{4})$/);

  if (!schoolYear || !name || !input.startDate || !input.endDate) {
    return {
      error: "School year, trimester, name, start date, and end date are required",
    };
  }
  if (!schoolYearMatch || Number(schoolYearMatch[2]) !== Number(schoolYearMatch[1]) + 1) {
    return { error: "School year must use consecutive years in YYYY-YYYY format" };
  }
  if (!Number.isInteger(trimester) || trimester < 1 || trimester > 3) {
    return { error: "Trimester must be 1, 2, or 3" };
  }
  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    startDate >= endDate
  ) {
    return { error: "Enter valid dates with the end date after the start date" };
  }
  if (!["upcoming", "active", "completed"].includes(status)) {
    return { error: "Status must be upcoming, active, or completed" };
  }

  return { schoolYear, trimester, name, startDate, endDate, status };
}

/**
 * Middleware: validates req.body and, if valid, stores the cleaned
 * data on req.periodData so the controller never touches raw input.
 */
function validatePeriodBody(req, res, next) {
  const result = validatePeriod(req.body || {});
  if (result.error) {
    return res.status(400).json({ error: result.error });
  }
  req.periodData = result;
  next();
}

module.exports = { validatePeriod, validatePeriodBody };