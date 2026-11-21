'use strict';
/* Açık / koyu tema. Tercih bu cihazda saklanır; ilk açılışta sistem temasına uyar.
   <head> içinde erken yüklenir ki sayfa yanlış renkte yanıp sönmesin. */
(function () {
  const KEY = 'filo-theme';
  const root = document.documentElement;
  const read = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const write = v => { try { localStorage.setItem(KEY, v); } catch (e) { /* yoksay */ } };
  const systemDark = () => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const current = () => root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    document.querySelectorAll('[data-theme-toggle]').forEach(b => {
      const dark = theme === 'dark';
      b.textContent = dark ? '☀️' : '🌙';
      b.title = dark ? 'Açık temaya geç' : 'Koyu temaya geç';
      b.setAttribute('aria-label', b.title);
      b.setAttribute('aria-pressed', String(dark));
    });
  }

  apply(read() || (systemDark() ? 'dark' : 'light'));

  document.addEventListener('DOMContentLoaded', () => apply(current()));
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-theme-toggle]')) return;
    const next = current() === 'dark' ? 'light' : 'dark';
    write(next); apply(next);
  });
  // Kullanıcı elle seçmediyse sistem teması değişince takip et
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', ev => {
    if (!read()) apply(ev.matches ? 'dark' : 'light');
  });
})();
