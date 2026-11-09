const fs = require("fs/promises");
const path = require("path");

const SERVER_ENV_PATH = path.resolve(__dirname, "../.env");
const FRONTEND_ENV_PATH = path.resolve(__dirname, "../../.env");
const pendingRestartOverrides = {};

const CUSTOM_ENV_KEYS = {
  CUSTOM_DATABASE_URI: { file: SERVER_ENV_PATH, requiresRestart: true },
  CUSTOM_AUTH_TOKEN_SECRET: { file: SERVER_ENV_PATH, requiresRestart: true },
  CUSTOM_EMAIL_USER: { file: SERVER_ENV_PATH },
  CUSTOM_EMAIL_APP_PASSWORD: { file: SERVER_ENV_PATH },
  CUSTOM_GOOGLE_CLIENT_ID: { file: SERVER_ENV_PATH },
  CUSTOM_RECAPTCHA_SECRET_KEY: { file: SERVER_ENV_PATH },
  CUSTOM_VITE_GOOGLE_CLIENT_ID: { file: FRONTEND_ENV_PATH },
  CUSTOM_VITE_RECAPTCHA_SITE_KEY: { file: FRONTEND_ENV_PATH },
};

function getCustomConfigStatus() {
  return Object.fromEntries(
    Object.entries(CUSTOM_ENV_KEYS).map(([key, metadata]) => [
      key,
      {
        configured: Boolean((Object.hasOwn(pendingRestartOverrides, key) ? pendingRestartOverrides[key] : process.env[key])?.trim()),
        requiresRestart: Boolean(metadata.requiresRestart),
      },
    ])
  );
}

function toEnvLine(key, value) {
  return `${key}=${JSON.stringify(value)}`;
}

async function updateEnvFile(filePath, updates) {
  let contents = "";
  try {
    contents = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  contents = contents.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = contents.split("\n");

  const pendingUpdates = { ...updates };
  const updatedLines = [];

  for (const rawLine of lines) {
    const match = rawLine.match(/^\s*([A-Za-z0-9_]+)\s*=/);
    if (match) {
      const key = match[1];
      if (Object.hasOwn(pendingUpdates, key)) {
        updatedLines.push(toEnvLine(key, pendingUpdates[key]));
        delete pendingUpdates[key];
        continue;
      }
    }
    updatedLines.push(rawLine);
  }

  for (const [key, value] of Object.entries(pendingUpdates)) {
    if (updatedLines.length > 0 && updatedLines[updatedLines.length - 1] === "") {
      updatedLines.splice(updatedLines.length - 1, 0, toEnvLine(key, value));
    } else {
      updatedLines.push(toEnvLine(key, value));
    }
  }

  let result = updatedLines.join("\n").trim();
  if (result) result += "\n";

  await fs.writeFile(filePath, result, "utf8");
}

async function saveCustomConfig(updates) {
  const grouped = new Map();
  for (const [key, value] of Object.entries(updates)) {
    const filePath = CUSTOM_ENV_KEYS[key].file;
    if (!grouped.has(filePath)) grouped.set(filePath, {});
    grouped.get(filePath)[key] = value;
  }

  for (const [filePath, fileUpdates] of grouped) {
    await updateEnvFile(filePath, fileUpdates);
  }

  for (const [key, value] of Object.entries(updates)) {
    // The signing secret is intentionally activated only after a restart,
    // so the saving administrator can receive this response before tokens rotate.
    if (key !== "CUSTOM_AUTH_TOKEN_SECRET" && key !== "CUSTOM_DATABASE_URI") {
      process.env[key] = value;
    } else {
      pendingRestartOverrides[key] = value;
    }
  }
}

module.exports = {
  CUSTOM_ENV_KEYS,
  getCustomConfigStatus,
  saveCustomConfig,
};
