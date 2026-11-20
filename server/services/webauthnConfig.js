/**
 * Builds the allowed origins, relying-party ID and name for WebAuthn
 * from env vars and the incoming request's Origin header.
 */
function webAuthnConfig(req) {
  const originValues = (process.env.WEBAUTHN_ORIGIN || process.env.CLIENT_URL || "http://localhost:5173")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const originsSet = new Set();
  for (const value of originValues) {
    try {
      originsSet.add(new URL(value).origin);
    } catch {}
  }
  originsSet.add("http://localhost:5173");
  originsSet.add("http://127.0.0.1:5173");
  originsSet.add("http://localhost:5000");
  originsSet.add("http://127.0.0.1:5000");

  const reqOrigin = req?.get?.("origin");
  if (reqOrigin) {
    try {
      originsSet.add(new URL(reqOrigin).origin);
    } catch {}
  }

  const origins = Array.from(originsSet);
  let rpID = process.env.WEBAUTHN_RP_ID?.trim();
  if (!rpID) {
    if (reqOrigin) {
      try {
        rpID = new URL(reqOrigin).hostname;
      } catch {}
    }
    if (!rpID && origins.length > 0) {
      rpID = new URL(origins[0]).hostname;
    }
  }
  rpID = rpID || "localhost";
  const rpName = process.env.WEBAUTHN_RP_NAME?.trim() || "DNHS-SGMS";
  return { origins, rpID, rpName };
}

module.exports = { webAuthnConfig };