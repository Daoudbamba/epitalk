const path = require("node:path");
const { app, BrowserWindow, Menu } = require("electron");
const { getWebAppUrl } = require("./src/config");
const { buildMenuTemplate } = require("./src/menu");

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
  createMainWindow();

  const menu = Menu.buildFromTemplate(buildMenuTemplate(app.getLocale()));
  Menu.setApplicationMenu(menu);

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
