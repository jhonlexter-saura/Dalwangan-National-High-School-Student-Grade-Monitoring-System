const IntegrationSetting = require("../models/IntegrationSetting");

async function getIntegrationFlags() {
  const settings = await IntegrationSetting.findOne({ key: "global" }).lean();

  return {
    googleSignIn: settings?.googleSignIn ?? true,
    recaptcha: settings?.recaptcha ?? true,
  };
}

module.exports = { getIntegrationFlags };