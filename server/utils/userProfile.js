const NAME_FIELDS = ["firstName", "middleName", "lastName", "nameExtension"];

const PROFILE_FIELDS = [...NAME_FIELDS, "birthdate", "contactNumber", "address"];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

// Builds the display name from the separate name parts.
function composeName(profile, fallback = "") {
  const parts = NAME_FIELDS.map((field) => cleanString(profile[field])).filter(Boolean);
  return parts.length ? parts.join(" ") : fallback;
}

module.exports = { NAME_FIELDS, PROFILE_FIELDS, EMAIL_REGEX, cleanString, composeName };