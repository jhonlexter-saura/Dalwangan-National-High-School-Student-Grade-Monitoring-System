function validateScoreInput(req, res, next) {
  const { score } = req.body || {};

  if (score === undefined || score === null || score === "") {
    return res.status(400).json({ error: "A score is required" });
  }

  const numericScore = Number(score);
  if (!Number.isFinite(numericScore)) {
    return res.status(400).json({ error: "Score must be a valid number" });
  }

  const totalPoints = Number(req.gradebookActivity?.totalPoints);
  if (
    Number.isFinite(totalPoints) &&
    (numericScore < 0 || numericScore > totalPoints)
  ) {
    return res.status(400).json({
      error: `Score must be between 0 and ${totalPoints}`,
    });
  }

  req.validatedScore = numericScore;
  return next();
}

module.exports = { validateScoreInput };
