const crypto = require("crypto");

// Used only when no stable secret is configured (state then dies on restart).
const ephemeralStateSecret = crypto.randomBytes(32).toString("hex");

function getStateSecret() {
  return (
    process.env.CUSTOM_AUTH_TOKEN_SECRET?.trim() ||
    process.env.AUTH_TOKEN_SECRET ||
    ephemeralStateSecret
  );
}

function createSignedState(payload) {
  const jsonStr = JSON.stringify(payload);
  const data = Buffer.from(jsonStr).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getStateSecret())
    .update(data)
    .digest("base64url");
  return `${data}.${signature}`;
}

function verifySignedState(stateString) {
  if (!stateString || typeof stateString !== "string") return null;
  const parts = stateString.split(".");
  if (parts.length !== 2) return null;

  const [data, signature] = parts;
  const expectedSig = crypto.createHmac("sha256", getStateSecret()).update(data).digest();
  let suppliedSig;
  try {
    suppliedSig = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (
    suppliedSig.length !== expectedSig.length ||
    !crypto.timingSafeEqual(suppliedSig, expectedSig)
  ) {
    return null;
  }

  try {
    const jsonStr = Buffer.from(data, "base64url").toString("utf8");
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

module.exports = { createSignedState, verifySignedState };