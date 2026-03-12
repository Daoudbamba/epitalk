const { app, BrowserWindow, Menu } = require("electron");
const { getWebAppUrl } = require("./src/config");
const { buildMenuTemplate } = require("./src/menu");

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
    },
  });

  const url = getWebAppUrl();
  win.loadURL(url);
}

app.whenReady().then(() => {
  createMainWindow();

  const menu = Menu.buildFromTemplate(buildMenuTemplate());
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
