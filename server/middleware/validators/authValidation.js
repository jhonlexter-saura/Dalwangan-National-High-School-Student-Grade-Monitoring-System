const MIN_PASSWORD_LENGTH = 8;

/** POST /login -> req.loginData = { email (normalized), password } */
function validateLoginBody(req, res, next) {
  const { email, password } = req.body || {};

  if (
    typeof email !== "string" ||
    !email.trim() ||
    typeof password !== "string" ||
    !password
  ) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  req.loginData = { email: email.trim().toLowerCase(), password };
  next();
}

/** POST /google -> req.googleCredential */
function validateGoogleBody(req, res, next) {
  const { credential } = req.body || {};

  if (typeof credential !== "string" || !credential) {
    return res.status(400).json({ error: "Google credential is required" });
  }

  req.googleCredential = credential;
  next();
}

/** POST /forgot-password -> req.forgotPasswordData = { email (normalized) } */
function validateForgotPasswordBody(req, res, next) {
  const { email } = req.body || {};

  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Email is required" });
  }

  req.forgotPasswordData = { email: email.trim().toLowerCase() };
  next();
}

/** POST /reset-password -> req.resetPasswordData = { token, password } */
function validateResetPasswordBody(req, res, next) {
  const { token, password } = req.body || {};

  if (!token || typeof token !== "string" || !password) {
    return res.status(400).json({ error: "Token and new password are required" });
  }

  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    });
  }

  req.resetPasswordData = { token, password };
  next();
}

module.exports = {
  validateLoginBody,
  validateGoogleBody,
  validateForgotPasswordBody,
  validateResetPasswordBody,
};