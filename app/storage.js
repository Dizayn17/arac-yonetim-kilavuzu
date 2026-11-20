'use strict';
/*
 * Depolama katmanı.
 *  - Masaüstü (Electron): veriler bilgisayarda bir JSON dosyasına yazılır,
 *    her gün otomatik yedek alınır (preload.js -> window.filoDesktop).
 *  - Web (GitHub Pages / tarayıcı): veriler tarayıcının localStorage alanında tutulur.
 */
(function () {
  const KEY = 'arac-filo-yonetimi-v1';
  const desktop = window.filoDesktop;

  const Store = {
    mode: desktop ? 'desktop' : 'web',

    load() {
      try {
        const raw = desktop ? desktop.load() : localStorage.getItem(KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        console.error('Veri okunamadı', e);
        return null;
      }
    },

    save(state) {
      const json = JSON.stringify(state);
      if (desktop) return desktop.save(json);
      try {
        localStorage.setItem(KEY, json);
        return true;
      } catch (e) {
        return false;
      }
    },

    info() {
      return desktop ? desktop.info() : { dataFile: 'Tarayıcı yerel depolaması (localStorage)', backupDir: null };
    },

    openDataFolder() {
      if (desktop) desktop.openDataFolder();
    }
  };

  window.Store = Store;
})();
