const { getTranslations } = require("./i18n");

function getReadyNotificationOptions(appName = "EpiTalk", lang) {
  const t = getTranslations(lang);
  return {
    title: t.readyTitle(appName),
    body: t.readyBody,
  };
}

function shouldShowReadyNotification({ isFirstLaunch, hasFocus }) {
  if (!isFirstLaunch) return false;
  if (hasFocus) return false;
  return true;
}

module.exports = {
  getReadyNotificationOptions,
  shouldShowReadyNotification,
};
