const crypto = require("crypto");

function getEncryptionKey() {
  const secret = process.env.CUSTOM_GOOGLE_TOKEN_ENCRYPTION_KEY?.trim()
    || process.env.GOOGLE_TOKEN_ENCRYPTION_KEY?.trim()
    || process.env.AUTH_TOKEN_SECRET?.trim();
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error("Set GOOGLE_TOKEN_ENCRYPTION_KEY to a stable secret of at least 32 bytes to store Google tokens securely.");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

function encryptGoogleToken(value) {
  if (!value) return value;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

function decryptGoogleToken(value) {
  if (!value || !value.startsWith("enc:v1:")) return value;
  const [, , ivText, tagText, encryptedText] = value.split(":");
  if (!ivText || !tagText || !encryptedText) throw new Error("Stored Google token has an invalid encrypted format.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function isGoogleTokenEncryptionConfigured() {
  try { getEncryptionKey(); return true; } catch { return false; }
}

module.exports = { encryptGoogleToken, decryptGoogleToken, isGoogleTokenEncryptionConfigured };
