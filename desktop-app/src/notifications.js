function getReadyNotificationOptions(appName = "EpiTalk") {
  return {
    title: `${appName} est prêt`,
    body: "Votre application de chat est maintenant disponible.",
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
