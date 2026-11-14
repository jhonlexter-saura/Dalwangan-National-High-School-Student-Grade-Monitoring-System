const nodemailer = require("nodemailer");
const IntegrationSetting = require("../models/IntegrationSetting");

// The transporter is created lazily because server.js loads the routes
// before it calls dotenv.config(). Reading process.env at require-time
// would give undefined credentials.
let transporter;
let transporterCredentials = "";

function getTransporter() {
  const user = process.env.CUSTOM_EMAIL_USER?.trim() || process.env.EMAIL_USER;
  const pass = process.env.CUSTOM_EMAIL_APP_PASSWORD?.trim() || process.env.EMAIL_APP_PASSWORD;
  const credentials = `${user || ""}\u0000${pass || ""}`;
  if (!transporter || credentials !== transporterCredentials) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
    transporterCredentials = credentials;
  }

  return transporter;
}

async function sendPasswordResetEmail({ to, name, resetUrl, expiresInMinutes }) {
  const integrationSettings = await IntegrationSetting.findOne({ key: "global" })
    .select("emailMailer")
    .lean();
  if (integrationSettings?.emailMailer === false) {
    const error = new Error("Email mailer integration is disabled.");
    error.code = "MAILER_DISABLED";
    throw error;
  }

  const user = process.env.CUSTOM_EMAIL_USER?.trim() || process.env.EMAIL_USER;
  await getTransporter().sendMail({
    from: `"DNHS-SGMS" <${user}>`,
    to,
    subject: "Reset your DNHS-SGMS password",
    text: [
      `Hi ${name},`,
      "",
      "We received a request to reset your DNHS-SGMS password.",
      `Open this link to choose a new password (valid for ${expiresInMinutes} minutes):`,
      resetUrl,
      "",
      "If you didn't ask for this, you can ignore this email. Your password will stay the same.",
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
        <h2 style="color: #1d4ed8; margin-bottom: 4px;">DNHS-SGMS</h2>
        <p>Hi ${name},</p>
        <p>We received a request to reset your password. This link is valid for ${expiresInMinutes} minutes.</p>
        <p>
          <a href="${resetUrl}"
             style="display: inline-block; background: #2563eb; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">
            Reset password
          </a>
        </p>
        <p style="font-size: 13px; color: #6b7280;">
          Button not working? Copy this link into your browser:<br />
          <span style="word-break: break-all;">${resetUrl}</span>
        </p>
        <p style="font-size: 13px; color: #6b7280;">
          If you didn't ask for this, ignore this email. Your password will stay the same.
        </p>
      </div>
    `,
  });
}

module.exports = { sendPasswordResetEmail };
