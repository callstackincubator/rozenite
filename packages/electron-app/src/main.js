import { app, BrowserWindow } from 'electron';

const url = process.argv[process.argv.length - 1];

if (!url || !url.startsWith('http')) {
  console.error('Usage: rozenite-electron-app <url>');
  app.exit(1);
}

app.whenReady().then(() => {
  const window = new BrowserWindow({ width: 1280, height: 800 });
  window.loadURL(url);
});

app.on('window-all-closed', () => {
  app.quit();
});
