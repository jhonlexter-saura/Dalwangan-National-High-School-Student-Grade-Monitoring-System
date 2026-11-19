async function verifyRecaptcha(captchaToken, remoteIp) {
  const rawSecret =
    process.env.CUSTOM_RECAPTCHA_SECRET_KEY?.trim() || process.env.RECAPTCHA_SECRET_KEY;
  const recaptchaSecret = rawSecret ? rawSecret.replace(/^["']|["']$/g, "").trim() : "";
  if (!recaptchaSecret) {
    throw new Error("RECAPTCHA_NOT_CONFIGURED");
  }

  if (typeof captchaToken !== "string" || !captchaToken) {
    return false;
  }

  const params = new URLSearchParams({
    secret: recaptchaSecret,
    response: captchaToken,
  });

  if (
    remoteIp &&
    remoteIp !== "127.0.0.1" &&
    remoteIp !== "::1" &&
    !remoteIp.startsWith("::ffff:127.")
  ) {
    params.set("remoteip", remoteIp);
  }

  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  if (!response.ok) {
    throw new Error("RECAPTCHA_VERIFICATION_UNAVAILABLE");
  }

  const result = await response.json();
  if (result.success !== true) {
    console.warn("reCAPTCHA verification returned false:", result["error-codes"]);
  }
  return (
    result.success === true &&
    result.action === "login" &&
    typeof result.score === "number" &&
    result.score >= 0.5
  );
}

module.exports = { verifyRecaptcha };