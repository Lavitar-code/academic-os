const { app, BrowserWindow } = require("electron");
const path = require("path");

const exeDir = path.dirname(app.getPath("exe"));
app.setPath("userData", path.join(exeDir, "data"));

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "AcademicOS",
    backgroundColor: "#0b0f14",
    webPreferences: { contextIsolation: true },
  });

  const indexPath = path.join(__dirname, "..", "dist", "index.html");
  win.loadFile(indexPath);
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});