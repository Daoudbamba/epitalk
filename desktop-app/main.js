const path = require("node:path");
const { app, BrowserWindow, Menu, Notification } = require("electron");
const { getWebAppUrl } = require("./src/config");
const { buildMenuTemplate } = require("./src/menu");
const { detectLanguage } = require("./src/i18n");
const {
  getReadyNotificationOptions,
  shouldShowReadyNotification,
} = require("./src/notifications");

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, "assets", "icon.svg"),
    webPreferences: {
      contextIsolation: true,
    },
  });

  const url = getWebAppUrl();
  win.loadURL(url);
}

app.whenReady().then(() => {
  const mainWindow = createMainWindow();

  const menu = Menu.buildFromTemplate(buildMenuTemplate());
  Menu.setApplicationMenu(menu);

  mainWindow.webContents.once("did-finish-load", () => {
    if (!Notification.isSupported()) return;

    const shouldNotify = shouldShowReadyNotification({
      isFirstLaunch: true,
      hasFocus: mainWindow.isFocused(),
    });

    if (!shouldNotify) return;

    const opts = getReadyNotificationOptions(app.getName(), detectLanguage());
    new Notification(opts).show();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

module.exports = {
  createMainWindow,
};
