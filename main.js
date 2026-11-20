'use strict';
/* Araç Filo Yönetimi — Electron ana süreci (masaüstü sürüm) */
const { app, BrowserWindow, ipcMain, shell, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const BACKUP_KEEP_DAYS = 30;
let dataDir, dataFile, backupDir;

function initPaths() {
  // Taşınabilir kullanım: exe'nin yanında "veri" klasörü varsa orayı kullan (ör. ağ paylaşımı / USB)
  const portable = path.join(path.dirname(app.getPath('exe')), 'veri');
  dataDir = fs.existsSync(portable) ? portable : path.join(app.getPath('documents'), 'AracFiloYonetimi');
  backupDir = path.join(dataDir, 'yedekler');
  dataFile = path.join(dataDir, 'filo-veri.json');
  fs.mkdirSync(backupDir, { recursive: true });
}

function dailyBackup() {
  if (!fs.existsSync(dataFile)) return;
  const stamp = new Date().toISOString().slice(0, 10);
  const target = path.join(backupDir, `filo-veri-${stamp}.json`);
  if (!fs.existsSync(target)) fs.copyFileSync(dataFile, target);
  // Eski yedekleri temizle
  const files = fs.readdirSync(backupDir).filter(f => /^filo-veri-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  while (files.length > BACKUP_KEEP_DAYS) fs.unlinkSync(path.join(backupDir, files.shift()));
}

function registerIpc() {
  ipcMain.on('filo:load', e => {
    try { e.returnValue = fs.existsSync(dataFile) ? fs.readFileSync(dataFile, 'utf8') : null; }
    catch (err) { console.error(err); e.returnValue = null; }
  });

  ipcMain.on('filo:save', (e, json) => {
    try {
      dailyBackup();
      const tmp = dataFile + '.tmp';
      fs.writeFileSync(tmp, json, 'utf8');   // önce geçici dosyaya yaz,
      fs.renameSync(tmp, dataFile);          // sonra atomik olarak değiştir
      e.returnValue = true;
    } catch (err) {
      console.error(err);
      dialog.showErrorBox('Kayıt hatası', 'Veri dosyasına yazılamadı:\n' + err.message);
      e.returnValue = false;
    }
  });

  ipcMain.on('filo:info', e => { e.returnValue = { dataFile, backupDir }; });
  ipcMain.on('filo:openFolder', () => shell.openPath(dataDir));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Araç Filo Yönetimi',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  // Uygulama dışına gezinmeyi engelle, harici linkleri varsayılan tarayıcıda aç
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file://')) { e.preventDefault(); shell.openExternal(url); } });

  win.loadFile(path.join(__dirname, 'app', 'index.html'));
}

const menu = Menu.buildFromTemplate([
  { label: 'Dosya', submenu: [
    { label: 'Veri klasörünü aç', click: () => shell.openPath(dataDir) },
    { type: 'separator' },
    { role: 'quit', label: 'Çıkış' }
  ]},
  { label: 'Görünüm', submenu: [
    { role: 'reload', label: 'Yenile' },
    { role: 'zoomIn', label: 'Yakınlaştır' },
    { role: 'zoomOut', label: 'Uzaklaştır' },
    { role: 'resetZoom', label: 'Gerçek boyut' },
    { role: 'togglefullscreen', label: 'Tam ekran' },
    { type: 'separator' },
    { role: 'toggleDevTools', label: 'Geliştirici araçları' }
  ]}
]);

// Aynı anda tek pencere (iki kopyanın aynı dosyaya yazmasını engeller)
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const w = BrowserWindow.getAllWindows()[0];
    if (w) { if (w.isMinimized()) w.restore(); w.focus(); }
  });
  app.whenReady().then(() => {
    initPaths();
    registerIpc();
    Menu.setApplicationMenu(menu);
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
