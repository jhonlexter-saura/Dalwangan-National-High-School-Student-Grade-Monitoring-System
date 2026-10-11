require("dotenv").config();
const nodemailer = require("nodemailer");

const user = process.env.EMAIL_USER;
const pass = process.env.EMAIL_APP_PASSWORD;

console.log("EMAIL_USER:", JSON.stringify(user));
console.log("Password length:", pass ? pass.length : "MISSING", "(should be 16)");

nodemailer
  .createTransport({ service: "gmail", auth: { user, pass } })
  .verify()
  .then(() => console.log("Login OK"))
  .catch((err) => console.log("Login failed:", err.message));