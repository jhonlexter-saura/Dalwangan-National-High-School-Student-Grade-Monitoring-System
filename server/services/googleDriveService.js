const { OAuth2Client } = require("google-auth-library");
const GoogleIntegration = require("../models/GoogleIntegration");
const { decryptGoogleToken, encryptGoogleToken } = require("../utils/googleTokenVault");

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets",
];

function getGoogleCredentials() {
  const clientId = (process.env.CUSTOM_GOOGLE_CLIENT_ID?.trim() || process.env.GOOGLE_CLIENT_ID?.trim() || "").replace(/^["']|["']$/g, "");
  const clientSecret = (process.env.CUSTOM_GOOGLE_CLIENT_SECRET?.trim() || process.env.GOOGLE_CLIENT_SECRET?.trim() || "").replace(/^["']|["']$/g, "");
  const redirectUri = (process.env.GOOGLE_REDIRECT_URI?.trim() || "http://localhost:5000/api/v1/integrations/google/callback").replace(/^["']|["']$/g, "");

  return { clientId, clientSecret, redirectUri };
}

function getOAuth2Client() {
  const { clientId, clientSecret, redirectUri } = getGoogleCredentials();
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth Client ID and Client Secret must be configured on the server.");
  }
  return new OAuth2Client(clientId, clientSecret, redirectUri);
}

function generateGoogleAuthUrl(state) {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_SCOPES,
    state: state || "",
  });
}

async function exchangeGoogleCode(code) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return { tokens, googleEmail: "" };
}

async function getAuthenticatedClient(userId) {
  const integration = await GoogleIntegration.findOne({ userId }).select("+accessToken +refreshToken");
  if (!integration) {
    const err = new Error("Google account is not connected. Please connect your Google Drive first.");
    err.statusCode = 401;
    throw err;
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: decryptGoogleToken(integration.accessToken),
    refresh_token: decryptGoogleToken(integration.refreshToken),
    expiry_date: integration.expiryDate,
  });

  oauth2Client.on("tokens", async (newTokens) => {
    try {
      const updateData = {
        accessToken: newTokens.access_token ? encryptGoogleToken(newTokens.access_token) : integration.accessToken,
        expiryDate: newTokens.expiry_date || integration.expiryDate,
      };
      if (newTokens.refresh_token) {
        updateData.refreshToken = encryptGoogleToken(newTokens.refresh_token);
      }
      await GoogleIntegration.updateOne({ userId }, { $set: updateData });
    } catch (tokenUpdateErr) {
      console.error("Failed to update refreshed Google tokens:", tokenUpdateErr.message);
    }
  });

  const { token: currentAccessToken } = await oauth2Client.getAccessToken();
  return { oauth2Client, accessToken: currentAccessToken || decryptGoogleToken(integration.accessToken), integration };
}

async function uploadFileToDrive({ userId, fileName, mimeType, fileBuffer, description }) {
  const { accessToken, integration } = await getAuthenticatedClient(userId);

  const boundary = "-------DNHS_SGMS_DRIVE_BOUNDARY_" + Date.now();
  const delimiter = "\r\n--" + boundary + "\r\n";
  const closeDelimiter = "\r\n--" + boundary + "--";

  const metadata = {
    name: fileName,
    description: description || "Exported from DNHS-SGMS",
    mimeType: mimeType || "application/octet-stream",
  };

  const bufferData = Buffer.isBuffer(fileBuffer)
    ? fileBuffer
    : Buffer.from(fileBuffer, typeof fileBuffer === "string" ? "base64" : "utf8");

  const multipartRequestBody = Buffer.concat([
    Buffer.from(
      delimiter +
        "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
        JSON.stringify(metadata) +
        delimiter +
        "Content-Type: " +
        (mimeType || "application/octet-stream") +
        "\r\n\r\n"
    ),
    bufferData,
    Buffer.from(closeDelimiter),
  ]);

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink,mimeType",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
        "Content-Length": String(multipartRequestBody.length),
      },
      body: multipartRequestBody,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    let parsedError;
    try {
      parsedError = JSON.parse(errorText);
    } catch {}
    const msg = parsedError?.error?.message || `Google Drive upload failed (${response.status})`;
    const error = new Error(msg);
    error.statusCode = response.status;
    throw error;
  }

  const file = await response.json();

  await GoogleIntegration.updateOne(
    { _id: integration._id },
    { $set: { lastUsedAt: new Date() } }
  );

  return {
    fileId: file.id,
    name: file.name,
    webViewLink: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
    mimeType: file.mimeType,
  };
}

async function createGoogleSheet({ userId, title, sheetName = "Report", headers = [], rows = [] }) {
  const { accessToken, integration } = await getAuthenticatedClient(userId);

  const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        title: title || `DNHS-SGMS Export - ${new Date().toISOString().slice(0, 10)}`,
      },
      sheets: [
        {
          properties: {
            title: sheetName,
            gridProperties: {
              frozenRowCount: headers.length ? 1 : 0,
            },
          },
        },
      ],
    }),
  });

  if (!createRes.ok) {
    const errorText = await createRes.text();
    let parsed;
    try {
      parsed = JSON.parse(errorText);
    } catch {}
    const msg = parsed?.error?.message || `Failed to create Google Spreadsheet (${createRes.status})`;
    const error = new Error(msg);
    error.statusCode = createRes.status;
    throw error;
  }

  const sheetData = await createRes.json();
  const spreadsheetId = sheetData.spreadsheetId;
  const spreadsheetUrl = sheetData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

  const valuesToInsert = [];
  if (headers && headers.length) {
    valuesToInsert.push(headers);
  }
  if (rows && rows.length) {
    valuesToInsert.push(...rows);
  }

  if (valuesToInsert.length) {
    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A1:append?valueInputOption=RAW`;
    const appendRes = await fetch(appendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: valuesToInsert,
      }),
    });

    if (!appendRes.ok) {
      const errorText = await appendRes.text();
      let parsed;
      try { parsed = JSON.parse(errorText); } catch {}
      const error = new Error(parsed?.error?.message || `Google Sheets rejected the exported data (${appendRes.status}).`);
      error.statusCode = appendRes.status;
      throw error;
    }
  }

  await GoogleIntegration.updateOne(
    { _id: integration._id },
    { $set: { lastUsedAt: new Date() } }
  );

  return {
    spreadsheetId,
    spreadsheetUrl,
    title: sheetData.properties?.title || title,
  };
}

module.exports = {
  getGoogleCredentials,
  generateGoogleAuthUrl,
  exchangeGoogleCode,
  getAuthenticatedClient,
  uploadFileToDrive,
  createGoogleSheet,
};
