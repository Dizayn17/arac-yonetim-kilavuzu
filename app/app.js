'use strict';
/* Araç Filo Yönetimi — uygulama mantığı (web + masaüstü ortak) */
(function () {
  const MODULES = window.MODULES, PAGES = window.PAGES, Store = window.Store;
  const COST_MODULES = MODULES.filter(m => m.cost);
  const DAY = 86400000;

  // ---------- Durum ----------
  const defaultState = () => ({
    version: 1,
    records: {},
    settings: { company: 'Filo Yönetim Sistemi', alertDays: 30, kmAlert: 1000, includeLeasing: false },
    audit: [],
    lastBackup: null
  });

  let state = defaultState();
  const loaded = Store.load();
  if (loaded && loaded.records) {
    state = { ...state, ...loaded, settings: { ...state.settings, ...(loaded.settings || {}) } };
  }
  for (const m of MODULES) if (!Array.isArray(state.records[m.id])) state.records[m.id] = [];

  const ui = { page: 'dashboard', query: '', vehicle: '', sort: null, sortDir: 1, from: '', to: '' };

  // ---------- Yardımcılar ----------
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 }).format(Number(n) || 0);
  const num = n => new Intl.NumberFormat('tr-TR').format(Number(n) || 0);
  const today = () => new Date().toLocaleDateString('en-CA');
  const dateTR = s => s ? new Date(s + 'T12:00:00').toLocaleDateString('tr-TR') : '—';
  const daysUntil = s => s ? Math.ceil((new Date(s + 'T12:00:00') - new Date(new Date().toDateString())) / DAY) : null;
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const mod = id => MODULES.find(m => m.id === id);
  const vehicleById = id => state.records.vehicles.find(v => v.id === id);
  const vehicleName = id => { const v = vehicleById(id); return v ? `${v.plate} · ${v.brand || ''} ${v.model || ''}`.trim() : '—'; };

  function persist() {
    if (!Store.save(state)) toast('Kayıt yapılamadı! Depolama dolu olabilir; hemen JSON yedeği alın.', 6000);
  }
  function log(action, details) {
    state.audit.unshift({ date: new Date().toISOString(), action, details });
    state.audit = state.audit.slice(0, 500);
  }
  function toast(msg, ms = 2500) {
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }

  // ---------- Diyaloglar (Electron'da window.prompt çalışmadığı için özel) ----------
  function dialog({ title, message, input = false, okText = 'Tamam', cancelText = 'Vazgeç', danger = false }) {
    return new Promise(resolve => {
      const box = document.createElement('div');
      box.className = 'modalback'; box.style.zIndex = 15;
      box.innerHTML = `<div class="modal narrow"><h2>${esc(title)}</h2><p style="margin-bottom:16px">${esc(message)}</p>
        ${input ? '<input id="dlgInput" style="width:100%;margin-bottom:16px" autocomplete="off">' : ''}
        <div class="actions"><button class="btn ${danger ? 'danger' : ''}" data-r="ok">${esc(okText)}</button>
        ${cancelText ? `<button class="btn secondary" data-r="cancel">${esc(cancelText)}</button>` : ''}</div></div>`;
      document.body.appendChild(box);
      const inp = box.querySelector('#dlgInput'); if (inp) inp.focus();
      const done = ok => { const v = inp ? inp.value : true; box.remove(); resolve(ok ? v : null); };
      box.addEventListener('click', e => {
        const r = e.target.dataset && e.target.dataset.r;
        if (r === 'ok') done(true); else if (r === 'cancel' || e.target === box) done(false);
      });
      box.addEventListener('keydown', e => { if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); });
    });
  }
  const confirmDlg = (title, message, danger) => dialog({ title, message, danger, okText: danger ? 'Evet, devam et' : 'Tamam' });
  const alertDlg = (title, message) => dialog({ title, message, cancelText: '' });

  // ---------- Uyarılar ----------
  function allAlerts() {
    const out = [];
    const limit = Number(state.settings.alertDays) || 30;
    const add = (title, end, vehicle, source) => {
      const d = daysUntil(end);
      if (d !== null && d <= limit) out.push({ title, end, vehicle, source, days: d, kind: 'date' });
    };
    const R = state.records;
    R.documents.forEach(x => add(x.type || 'Belge', x.end, x.vehicle, 'documents'));
    R.insurance.filter(x => x.status !== 'Sona Erdi').forEach(x => add(x.type || 'Poliçe', x.end, x.vehicle, 'insurance'));
    R.leasing.filter(x => x.status === 'Aktif' || !x.status).forEach(x => add('Kiralama sözleşmesi', x.end, x.vehicle, 'leasing'));
    R.drivers.filter(x => x.status !== 'Pasif').forEach(x => { add('Ehliyet: ' + x.name, x.licenseEnd, null, 'drivers'); add('SRC: ' + x.name, x.srcEnd, null, 'drivers'); });
    R.vendors.forEach(x => add('Tedarikçi sözleşmesi: ' + x.name, x.contractEnd, null, 'vendors'));
    R.tasks.filter(x => x.status !== 'Tamamlandı').forEach(x => add('Görev: ' + x.title, x.due, x.vehicle, 'tasks'));
    R.fines.filter(x => x.status === 'Ödenmedi').forEach(x => add('Ceza son ödeme', x.due, x.vehicle, 'fines'));

    // Bakım: her araç için en güncel bakım kaydındaki "sonraki bakım" tarih ve KM'sine bakılır
    const latest = {};
    for (const m of R.maintenance) {
      if (!m.vehicle) continue;
      const cur = latest[m.vehicle];
      if (!cur || (m.date || '') >= (cur.date || '')) latest[m.vehicle] = m;
    }
    const kmLimit = Number(state.settings.kmAlert) || 1000;
    for (const [vid, m] of Object.entries(latest)) {
      add('Planlanan bakım (tarih)', m.nextDate, vid, 'maintenance');
      const v = vehicleById(vid);
      if (m.nextKm && v && v.km) {
        const left = Number(m.nextKm) - Number(v.km);
        if (left <= kmLimit) out.push({ title: 'Planlanan bakım (KM)', end: null, vehicle: vid, source: 'maintenance', days: left < 0 ? -1 : 0, kmLeft: left, kind: 'km' });
      }
    }
    return out.sort((a, b) => a.days - b.days);
  }
  function alertPill(a) {
    if (a.kind === 'km') return a.kmLeft < 0
      ? `<span class="pill bad">${num(-a.kmLeft)} km geçti</span>`
      : `<span class="pill warn">${num(a.kmLeft)} km kaldı</span>`;
    if (a.days < 0) return `<span class="pill bad">${Math.abs(a.days)} gün gecikti</span>`;
    return `<span class="pill ${a.days <= 7 ? 'warn' : 'info'}">${a.days === 0 ? 'Bugün' : a.days + ' gün kaldı'}</span>`;
  }

  // ---------- Maliyet ----------
  function inRange(d) { return (!ui.from || (d || '') >= ui.from) && (!ui.to || (d || '') <= ui.to); }
  function recordDate(m, x) { return x.date || x.start || ''; }
  function leasingCost(x) {
    // Aylık kira × seçili aralıkla çakışan ay sayısı (yaklaşık)
    if (!x.monthly || !x.start) return 0;
    const s = new Date(Math.max(new Date(x.start), ui.from ? new Date(ui.from) : 0));
    const endRaw = Math.min(new Date(x.end || today()), new Date(today()), ui.to ? new Date(ui.to) : Infinity);
    const e = new Date(endRaw);
    if (e < s) return 0;
    const months = Math.max(0, Math.round((e - s) / DAY / 30.44));
    return months * Number(x.monthly);
  }
  function costTotals() {
    const cats = {}, perVehicle = {};
    for (const m of COST_MODULES) cats[m.cost] = 0;
    if (state.settings.includeLeasing) cats['Kiralama'] = 0;
    const addTo = (vid, cat, amt) => { cats[cat] += amt; if (vid) perVehicle[vid] = (perVehicle[vid] || 0) + amt; };
    for (const m of COST_MODULES)
      for (const x of state.records[m.id]) if (inRange(recordDate(m, x))) addTo(x.vehicle, m.cost, Number(x.amount) || 0);
    if (state.settings.includeLeasing)
      for (const x of state.records.leasing) if (x.status !== 'İptal') addTo(x.vehicle, 'Kiralama', leasingCost(x));
    return { cats, perVehicle, total: Object.values(cats).reduce((a, b) => a + b, 0) };
  }
  function costChart(cats) {
    const max = Math.max(...Object.values(cats), 1);
    return Object.entries(cats).map(([k, v]) =>
      `<div class="chartrow"><label>${esc(k)}</label><div class="bar"><i style="width:${(v / max * 100).toFixed(1)}%"></i></div><b>${money(v)}</b></div>`).join('');
  }

  // ---------- Navigasyon ----------
  function renderNav() {
    const alertCount = allAlerts().length;
    let html = `<button data-page="dashboard" class="${ui.page === 'dashboard' ? 'active' : ''}"><span>🏠&nbsp; Gösterge Paneli</span></button>`;
    let group = '';
    for (const p of [...MODULES, ...PAGES]) {
      if (p.group !== group) { group = p.group; html += `<div class="group">${esc(group)}</div>`; }
      const badge = p.id === 'alerts' && alertCount ? `<span class="badge">${alertCount}</span>` : '';
      html += `<button data-page="${p.id}" class="${ui.page === p.id ? 'active' : ''}"><span>${p.icon}&nbsp; ${esc(p.name)}</span>${badge}</button>`;
    }
    $('nav').innerHTML = html;
  }

  function heading(title, sub, buttons = '') {
    return `<div class="heading"><div><h1>${esc(title)}</h1><p>${esc(sub)}</p></div><div class="actions">${buttons}</div></div>`;
  }

  // ---------- Sayfalar ----------
  function backupNotice() {
    if (Store.mode === 'desktop') return '';
    const last = state.lastBackup;
    const age = last ? Math.floor((Date.now() - new Date(last)) / DAY) : null;
    if (age !== null && age < 7) return '';
    return `<div class="notice">⚠️ ${last ? `Son JSON yedeği ${age} gün önce alındı.` : 'Henüz JSON yedeği alınmadı.'}
      Bu web sürümünde veriler yalnızca bu tarayıcıda durur. <a href="#" data-action="backup">Şimdi yedek al</a>.</div>`;
  }

  function dashboard() {
    const v = state.records.vehicles, alerts = allAlerts(), c = costTotals();
    let h = heading('Filo Gösterge Paneli', 'Araç, operasyon, maliyet ve yaklaşan işlemler tek ekranda.',
      `<button class="btn" data-action="new" data-module="vehicles">+ Yeni Araç</button>`);
    h += backupNotice();
    h += '<div class="cards">' + [
      ['Toplam Araç', v.length],
      ['Aktif Araç', v.filter(x => x.status === 'Aktif').length],
      ['Yaklaşan / Geciken Uyarı', alerts.length],
      ['Toplam Kayıtlı Gider', money(c.total)]
    ].map(([l, val]) => `<div class="card"><div class="label">${l}</div><div class="value">${val}</div></div>`).join('') + '</div>';
    h += `<div class="panels"><section class="panel"><h2>Gider Dağılımı</h2>${costChart(c.cats)}</section>
      <section class="panel"><h2>Yaklaşan İşlemler</h2>${alerts.slice(0, 8).map(a =>
        `<div class="chartrow">${alertPill(a)}<div><b>${esc(a.title)}</b><div class="muted">${esc(a.vehicle ? vehicleName(a.vehicle) : 'Genel')}${a.end ? ' • ' + dateTR(a.end) : ''}</div></div></div>`).join('')
        || '<div class="empty">Yaklaşan uyarı yok.</div>'}
        ${alerts.length > 8 ? `<button class="btn secondary small" data-page="alerts">Tümünü gör (${alerts.length})</button>` : ''}</section></div>`;
    h += `<section class="panel"><h2>Son Araç Kayıtları</h2>${table('vehicles', v.slice(-6).reverse(), false)}</section>`;
    return h;
  }

  function filteredItems(id) {
    const q = ui.query.toLocaleLowerCase('tr');
    let items = state.records[id].filter(x =>
      (!ui.vehicle || x.vehicle === ui.vehicle) &&
      (!q || (Object.values(x).join(' ') + ' ' + vehicleName(x.vehicle)).toLocaleLowerCase('tr').includes(q)));
    if (ui.sort) {
      const f = mod(id).fields.find(f => f.key === ui.sort);
      items = items.slice().sort((a, b) => {
        let A = a[ui.sort] ?? '', B = b[ui.sort] ?? '';
        if (f && f.type === 'vehicle') { A = vehicleName(A); B = vehicleName(B); }
        if (f && f.type === 'number') return ((Number(A) || 0) - (Number(B) || 0)) * ui.sortDir;
        return String(A).localeCompare(String(B), 'tr') * ui.sortDir;
      });
    }
    return items;
  }

  function cellValue(f, x) {
    const val = x[f.key];
    if (f.type === 'vehicle') return esc(vehicleName(val));
    if (f.type === 'date') return dateTR(val);
    if (f.money) return val ? money(val) : '—';
    if (f.type === 'number' && val !== '' && val != null) return num(val);
    if (f.key === 'status' && val) {
      const bad = ['Pasif', 'Satıldı', 'Ödenmedi', 'Açık', 'Sona Erdi', 'İptal'], warn = ['Serviste', 'Planlandı', 'Devam Ediyor', 'Yenilenecek', 'Eksperde', 'Onay Bekliyor', 'İtiraz Edildi', 'Talep'];
      return `<span class="pill ${bad.includes(val) ? 'bad' : warn.includes(val) ? 'warn' : ''}">${esc(val)}</span>`;
    }
    return esc(val || '—');
  }

  function table(id, items, sortable = true) {
    if (!items.length) return '<div class="empty">Henüz kayıt bulunmuyor. “+ Yeni Kayıt” ile başlayabilirsiniz.</div>';
    const cols = mod(id).fields.filter(f => f.list).slice(0, 7);
    const arrow = k => ui.sort === k ? (ui.sortDir > 0 ? ' ▲' : ' ▼') : '';
    return `<table><thead><tr>${cols.map(f => `<th class="${sortable ? 'sortable' : ''}" ${sortable ? `data-sort="${f.key}"` : ''}>${esc(f.label)}${sortable ? arrow(f.key) : ''}</th>`).join('')}<th>İşlemler</th></tr></thead><tbody>` +
      items.map(x => `<tr>${cols.map(f => `<td>${cellValue(f, x)}</td>`).join('')}<td><div class="actions">
        <button class="btn secondary small" data-action="edit" data-module="${id}" data-id="${esc(x.id)}">Düzenle</button>
        <button class="btn danger small" data-action="delete" data-module="${id}" data-id="${esc(x.id)}">Sil</button></div></td></tr>`).join('') +
      '</tbody></table>';
  }

  function recordsPage(id) {
    const m = mod(id), items = filteredItems(id), total = state.records[id].length;
    const filtered = items.length !== total;
    let h = heading(m.name, `${items.length} / ${total} kayıt görüntüleniyor`,
      `<button class="btn secondary" data-action="csv" data-module="${id}">⬇ ${filtered ? 'Görünenleri' : 'Tümünü'} CSV</button>
       <button class="btn" data-action="new" data-module="${id}">+ Yeni Kayıt</button>`);
    const hasVehicle = m.fields.some(f => f.type === 'vehicle');
    h += `<section class="panel"><div class="toolbar">
      <input id="search" placeholder="Kayıtlarda ara..." value="${esc(ui.query)}">
      ${hasVehicle ? `<select id="vehicleFilter"><option value="">Tüm Araçlar</option>${state.records.vehicles.map(v =>
        `<option value="${esc(v.id)}" ${ui.vehicle === v.id ? 'selected' : ''}>${esc(v.plate)}</option>`).join('')}</select>` : ''}
      <button class="btn secondary small" data-action="clear">Temizle</button></div>
      <div id="results">${table(id, items)}</div></section>`;
    return h;
  }

  function reports() {
    const c = costTotals(), vehicles = state.records.vehicles;
    const rows = vehicles.map(v => ({ v, amount: c.perVehicle[v.id] || 0 })).sort((a, b) => b.amount - a.amount);
    let h = heading('Raporlama ve Analiz', 'Araç bazlı maliyetler ve filo genelinde gider dağılımı.',
      `<button class="btn secondary" data-action="costcsv">⬇ Maliyet CSV</button><button class="btn secondary" data-action="print">🖨 Yazdır / PDF</button>`);
    h += `<section class="panel"><div class="toolbar"><label class="muted">Başlangıç</label><input type="date" id="from" value="${esc(ui.from)}">
      <label class="muted">Bitiş</label><input type="date" id="to" value="${esc(ui.to)}">
      <button class="btn secondary small" data-action="clearRange">Tüm zamanlar</button></div>
      <p>Dahil edilen giderler: ${COST_MODULES.map(m => m.name).join(', ')}${state.settings.includeLeasing ? ', Kiralama (aylık kira × ay)' : ''}.
      ${state.settings.includeLeasing ? '' : 'Kiralama bedellerini dahil etmek için Ayarlar ekranını kullanın.'}</p></section>`;
    h += '<div class="cards">' + [
      ['Toplam Araç', vehicles.length],
      ['Şirket Araçları', vehicles.filter(v => v.ownership === 'Şirket').length],
      ['Kiralık Araçlar', vehicles.filter(v => v.ownership === 'Kiralık').length],
      ['Toplam Gider', money(c.total)]
    ].map(([l, val]) => `<div class="card"><div class="label">${l}</div><div class="value">${val}</div></div>`).join('') + '</div>';
    h += `<div class="panel"><h2>Gider Türleri</h2>${costChart(c.cats)}</div>`;
    h += `<div class="panel"><h2>Araç Bazlı Toplam Maliyet</h2>${rows.length ? `<table><thead><tr><th>Plaka</th><th>Marka / Model</th><th>Mülkiyet</th><th>Şube</th><th>KM</th><th>Toplam Gider</th><th>₺ / km</th></tr></thead><tbody>${rows.map(({ v, amount }) =>
      `<tr><td>${esc(v.plate)}</td><td>${esc((v.brand || '') + ' ' + (v.model || ''))}</td><td>${esc(v.ownership || '—')}</td><td>${esc(v.branch || '—')}</td><td>${v.km ? num(v.km) : '—'}</td><td>${money(amount)}</td><td>${v.km && amount ? money(amount / v.km) : '—'}</td></tr>`).join('')}</tbody></table>`
      : '<div class="empty">Rapor için araç ekleyin.</div>'}</div>`;
    return h;
  }

  function alertsPage() {
    const a = allAlerts();
    return heading('Bildirim ve Hatırlatmalar', `Tarih eşiği: ${state.settings.alertDays} gün • KM eşiği: ${num(state.settings.kmAlert)} km`) +
      `<div class="panel">${a.length ? `<table><thead><tr><th>Durum</th><th>İşlem</th><th>Araç</th><th>Son Tarih</th><th></th></tr></thead><tbody>${a.map(x =>
        `<tr><td>${alertPill(x)}</td><td>${esc(x.title)}</td><td>${esc(x.vehicle ? vehicleName(x.vehicle) : 'Genel')}</td><td>${x.end ? dateTR(x.end) : '—'}</td>
        <td><button class="btn secondary small" data-page="${x.source}">Görüntüle</button></td></tr>`).join('')}</tbody></table>`
        : '<div class="empty">Yaklaşan veya geciken işlem bulunmuyor.</div>'}</div>`;
  }

  function settingsPage() {
    const info = Store.info(), s = state.settings;
    return heading('Ayarlar ve Yedekleme', 'Genel ayarlar, veri yedekleme ve işlem geçmişi.') +
      `<div class="panel"><h2>Genel Ayarlar</h2><div class="formgrid">
        <div class="field"><label>Şirket / Sistem Adı</label><input id="setCompany" value="${esc(s.company)}"></div>
        <div class="field"><label>Kaç gün önce uyarı verilsin? (1–365)</label><input id="setDays" type="number" min="1" max="365" value="${esc(s.alertDays)}"></div>
        <div class="field"><label>Bakıma kaç km kala uyarı verilsin?</label><input id="setKm" type="number" min="0" value="${esc(s.kmAlert)}"></div>
        <div class="field"><label>Kiralama bedelleri raporlara dahil edilsin mi?</label><select id="setLeasing"><option value="0">Hayır</option><option value="1" ${s.includeLeasing ? 'selected' : ''}>Evet (aylık kira × ay)</option></select></div>
      </div><button class="btn" data-action="saveSettings">Ayarları Kaydet</button></div>
      <div class="panel"><h2>Veri Yönetimi</h2>
        <div class="notice ${Store.mode === 'desktop' ? 'ok' : ''}">${Store.mode === 'desktop'
          ? `Masaüstü sürümü: veriler bu dosyada tutulur:<br><b>${esc(info.dataFile)}</b><br>Her gün otomatik yedek alınır (son 30 gün): ${esc(info.backupDir)}`
          : 'Web sürümü: veriler yalnızca bu tarayıcıda (localStorage) tutulur. Tarayıcı verisini temizlemek veya başka bir tarayıcı kullanmak kayıtları göstermez. Düzenli JSON yedeği alın.'}</div>
        <div class="actions">
          <button class="btn secondary" data-action="backup">⬇ JSON Yedeği İndir</button>
          <label class="btn secondary filelabel">⬆ JSON Yedeği Yükle<input type="file" id="importFile" accept=".json,application/json"></label>
          ${Store.mode === 'desktop' ? '<button class="btn secondary" data-action="openFolder">📂 Veri Klasörünü Aç</button>' : ''}
          <button class="btn danger" data-action="reset">Tüm Verileri Sıfırla</button>
        </div>
        <p style="margin-top:10px">Son JSON yedeği: ${state.lastBackup ? new Date(state.lastBackup).toLocaleString('tr-TR') : 'hiç alınmadı'}</p></div>
      <div class="panel"><h2>İşlem Geçmişi (son 50)</h2>${state.audit.length ? `<table><thead><tr><th>Tarih</th><th>İşlem</th><th>Açıklama</th></tr></thead><tbody>${state.audit.slice(0, 50).map(a =>
        `<tr><td>${new Date(a.date).toLocaleString('tr-TR')}</td><td>${esc(a.action)}</td><td>${esc(a.details)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Henüz işlem yok.</div>'}</div>`;
  }

  // ---------- Render ----------
  function render() {
    renderNav();
    $('companyName').textContent = state.settings.company;
    $('modeLabel').textContent = Store.mode === 'desktop' ? 'Masaüstü sürümü • Veriler bilgisayarda dosyada saklanır' : 'Web sürümü • Veriler bu tarayıcıda saklanır';
    $('clock').textContent = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });
    $('footer').textContent = Store.mode === 'desktop'
      ? 'Araç Filo Yönetimi • Masaüstü • Günlük otomatik yedek açık'
      : 'Araç Filo Yönetimi • Web • Verilerinizi düzenli olarak JSON yedeğiyle dışa aktarın';
    const p = ui.page;
    $('view').innerHTML = p === 'dashboard' ? dashboard() : p === 'reports' ? reports() : p === 'alerts' ? alertsPage() : p === 'settings' ? settingsPage() : recordsPage(p);
    bindInputs();
  }

  function bindInputs() {
    const search = $('search');
    if (search) search.addEventListener('input', () => { ui.query = search.value; $('results').innerHTML = table(ui.page, filteredItems(ui.page)); });
    const vf = $('vehicleFilter');
    if (vf) vf.addEventListener('change', () => { ui.vehicle = vf.value; render(); });
    const from = $('from'), to = $('to');
    if (from) from.addEventListener('change', () => { ui.from = from.value; render(); });
    if (to) to.addEventListener('change', () => { ui.to = to.value; render(); });
    const imp = $('importFile');
    if (imp) imp.addEventListener('change', importJSON);
  }

  function go(page) {
    ui.page = page; ui.query = ''; ui.vehicle = ''; ui.sort = null; ui.sortDir = 1;
    $('sidebar').classList.remove('open');
    render(); window.scrollTo(0, 0);
  }

  // ---------- Form ----------
  function fieldHtml(f, value) {
    const req = f.required ? 'required' : '';
    const name = `name="${f.key}" id="f_${f.key}" ${req}`;
    if (f.type === 'select') return `<select ${name}><option value="">Seçiniz</option>${f.options.map(o => `<option ${value === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    if (f.type === 'vehicle') return `<select ${name}><option value="">Araç seçiniz</option>${state.records.vehicles.map(v =>
      `<option value="${esc(v.id)}" ${value === v.id ? 'selected' : ''}>${esc(v.plate)} · ${esc(v.brand || '')} ${esc(v.model || '')}</option>`).join('')}</select>`;
    if (f.type === 'driver') return `<input ${name} list="driverList" value="${esc(value)}" autocomplete="off">`;
    if (f.type === 'textarea') return `<textarea ${name}>${esc(value)}</textarea>`;
    return `<input type="${f.type}" ${name} value="${esc(value)}" ${f.type === 'number' ? 'step="any" min="0"' : ''}>`;
  }

  function openForm(id, recordId) {
    const m = mod(id);
    if (m.fields.some(f => f.type === 'vehicle' && f.required) && !state.records.vehicles.length) {
      alertDlg('Önce araç ekleyin', 'Bu modül araç seçimi istiyor. Önce Araç Kartları bölümünde en az bir araç oluşturun.');
      return;
    }
    const old = recordId ? state.records[id].find(x => x.id === recordId) : {};
    if (!old) return;
    const fields = m.fields.map(f => {
      const value = old[f.key] ?? (f.defaultToday && !recordId ? today() : '');
      return `<div class="field ${f.type === 'textarea' ? 'full' : ''}"><label for="f_${f.key}">${esc(f.label)}${f.required ? ' *' : ''}</label>${fieldHtml(f, value)}${f.hint ? `<span class="hint">${esc(f.hint)}</span>` : ''}</div>`;
    }).join('');
    $('modalroot').innerHTML = `<div class="modalback" id="modalback"><div class="modal">
      <div class="heading"><div><h2>${recordId ? 'Kaydı Düzenle' : 'Yeni Kayıt'} · ${esc(m.name)}</h2><p>Yıldızlı (*) alanlar zorunludur.</p></div>
      <button class="btn secondary small" data-close>✕ Kapat</button></div>
      <form id="recordform"><div class="formgrid">${fields}</div>
      <datalist id="driverList">${state.records.drivers.map(d => `<option value="${esc(d.name)}">`).join('')}</datalist>
      <div class="actions"><button class="btn" type="submit">💾 Kaydet</button><button class="btn secondary" type="button" data-close>Vazgeç</button></div></form></div></div>`;
    const back = $('modalback');
    back.addEventListener('click', e => { if (e.target === back || e.target.hasAttribute('data-close')) closeModal(); });
    $('recordform').addEventListener('submit', e => { e.preventDefault(); submitForm(id, old, new FormData(e.target)); });
    const first = back.querySelector('input,select,textarea'); if (first) first.focus();
  }
  function closeModal() { $('modalroot').innerHTML = ''; }

  function bumpVehicleKm(vid, km) {
    const v = vehicleById(vid);
    if (v && km && Number(km) > (Number(v.km) || 0)) v.km = String(km);
  }

  function submitForm(id, old, form) {
    const m = mod(id);
    const item = { ...old, id: old.id || uid() };
    for (const [k, v] of form) item[k] = String(v).trim();
    if (id === 'vehicles') {
      item.plate = item.plate.toLocaleUpperCase('tr-TR').replace(/\s+/g, ' ');
      const norm = p => p.replace(/\s/g, '');
      if (state.records.vehicles.some(v => v.id !== item.id && norm(v.plate) === norm(item.plate))) {
        alertDlg('Mükerrer plaka', `${item.plate} plakalı araç zaten kayıtlı.`); return;
      }
    }
    if (id === 'fuel' && !item.amount && item.liters && item.unitPrice) item.amount = (Number(item.liters) * Number(item.unitPrice)).toFixed(2);
    if (['fuel', 'maintenance'].includes(id)) bumpVehicleKm(item.vehicle, item.km);
    if (id === 'assignments') bumpVehicleKm(item.vehicle, item.returnKm || item.km);
    const list = state.records[id], ix = list.findIndex(x => x.id === item.id);
    if (ix >= 0) list[ix] = item; else list.push(item);
    const label = (m.title && m.title(item)) || vehicleName(item.vehicle);
    log(ix >= 0 ? 'Düzenleme' : 'Yeni kayıt', `${m.name} • ${label}`);
    persist(); closeModal(); render(); toast('Kaydedildi');
  }

  async function removeRecord(id, recordId) {
    const m = mod(id);
    if (id === 'vehicles') {
      const linked = MODULES.filter(x => x.id !== 'vehicles' && state.records[x.id].some(r => r.vehicle === recordId)).map(x => x.name);
      if (linked.length) { alertDlg('Araç silinemiyor', 'Bu araca bağlı kayıtlar var: ' + linked.join(', ') + '. Önce bu kayıtları silin veya aracın durumunu "Pasif/Satıldı" yapın.'); return; }
    }
    if (!(await confirmDlg('Kaydı sil', 'Bu kayıt kalıcı olarak silinecek. Emin misiniz?', true))) return;
    const rec = state.records[id].find(x => x.id === recordId);
    state.records[id] = state.records[id].filter(x => x.id !== recordId);
    log('Silme', `${m.name} • ${(m.title && rec && m.title(rec)) || vehicleName(rec && rec.vehicle)}`);
    persist(); render(); toast('Silindi');
  }

  // ---------- Dışa / içe aktarma ----------
  const csvCell = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  function download(name, content, type) {
    const blob = new Blob(['﻿', content], { type });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportCSV(id) {
    const m = mod(id), items = filteredItems(id);
    const lines = [m.fields.map(f => csvCell(f.label)).join(';')];
    for (const x of items) lines.push(m.fields.map(f => csvCell(f.type === 'vehicle' ? vehicleName(x[f.key]) : x[f.key])).join(';'));
    download(`filo_${id}_${today()}.csv`, lines.join('\r\n'), 'text/csv;charset=utf-8');
  }
  function exportCostCSV() {
    const c = costTotals();
    const rows = [['Plaka', 'Marka', 'Model', 'Mülkiyet', 'Şube', 'KM', 'Toplam Gider']];
    for (const v of state.records.vehicles) rows.push([v.plate, v.brand, v.model, v.ownership, v.branch, v.km, (c.perVehicle[v.id] || 0).toFixed(2).replace('.', ',')]);
    const range = ui.from || ui.to ? `_${ui.from || 'bas'}_${ui.to || 'son'}` : '';
    download(`filo_maliyet${range}.csv`, rows.map(r => r.map(csvCell).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
  }
  function exportJSON() {
    state.lastBackup = new Date().toISOString();
    log('Yedek', 'JSON yedeği indirildi');
    persist();
    download(`filo_yedek_${today()}.json`, JSON.stringify(state, null, 2), 'application/json');
    render();
  }
  function importJSON(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const obj = JSON.parse(reader.result);
        if (!obj || !obj.records || !Array.isArray(obj.records.vehicles)) throw new Error('Dosya bu uygulamanın yedek formatında değil.');
        const count = Object.values(obj.records).reduce((a, b) => a + (Array.isArray(b) ? b.length : 0), 0);
        if (!(await confirmDlg('Yedeği geri yükle', `Yedekte ${obj.records.vehicles.length} araç ve toplam ${count} kayıt var. Mevcut TÜM veriler bu yedekle DEĞİŞTİRİLECEK. Devam edilsin mi?`, true))) return;
        for (const m of MODULES) if (!Array.isArray(obj.records[m.id])) obj.records[m.id] = [];
        state = { ...defaultState(), ...obj, settings: { ...defaultState().settings, ...(obj.settings || {}) }, audit: Array.isArray(obj.audit) ? obj.audit : [] };
        log('Geri yükleme', file.name);
        persist(); render(); toast('Yedek geri yüklendi');
      } catch (err) {
        alertDlg('Yedek yüklenemedi', err.message);
      } finally { e.target.value = ''; }
    };
    reader.readAsText(file);
  }
  async function resetAll() {
    const v = await dialog({ title: 'Tüm verileri sıfırla', message: 'Bütün kayıtlar silinecek. Devam etmek için SİL yazın. (Önce JSON yedeği almanız önerilir.)', input: true, danger: true, okText: 'Sıfırla' });
    if (v === null) return;
    if (v.trim().toLocaleUpperCase('tr-TR') !== 'SİL') { toast('Onay metni hatalı, işlem iptal edildi.'); return; }
    for (const m of MODULES) state.records[m.id] = [];
    state.audit = []; log('Sıfırlama', 'Tüm veriler silindi');
    persist(); render(); toast('Tüm veriler silindi');
  }
  function saveSettings() {
    const s = state.settings;
    s.company = $('setCompany').value.trim() || 'Filo Yönetim Sistemi';
    s.alertDays = Math.max(1, Math.min(365, Number($('setDays').value) || 30));
    s.kmAlert = Math.max(0, Number($('setKm').value) || 0);
    s.includeLeasing = $('setLeasing').value === '1';
    log('Ayar', 'Genel ayarlar güncellendi');
    persist(); render(); toast('Ayarlar kaydedildi');
  }

  // ---------- Olay yönetimi (tek noktadan) ----------
  document.addEventListener('click', e => {
    const pageBtn = e.target.closest('[data-page]');
    if (pageBtn) { go(pageBtn.dataset.page); return; }
    const th = e.target.closest('th[data-sort]');
    if (th) { const k = th.dataset.sort; if (ui.sort === k) ui.sortDir *= -1; else { ui.sort = k; ui.sortDir = 1; } $('results').innerHTML = table(ui.page, filteredItems(ui.page)); return; }
    const a = e.target.closest('[data-action]');
    if (!a) return;
    const { action, module, id } = a.dataset;
    if (a.tagName === 'A') e.preventDefault();
    switch (action) {
      case 'new': openForm(module); break;
      case 'edit': openForm(module, id); break;
      case 'delete': removeRecord(module, id); break;
      case 'csv': exportCSV(module); break;
      case 'costcsv': exportCostCSV(); break;
      case 'clear': ui.query = ''; ui.vehicle = ''; ui.sort = null; render(); break;
      case 'clearRange': ui.from = ''; ui.to = ''; render(); break;
      case 'backup': exportJSON(); break;
      case 'reset': resetAll(); break;
      case 'saveSettings': saveSettings(); break;
      case 'openFolder': Store.openDataFolder(); break;
      case 'print': window.print(); break;
    }
  });
  $('menuBtn').addEventListener('click', () => $('sidebar').classList.toggle('open'));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('modalback') && !document.querySelector('body > .modalback')) closeModal(); });

  render();
})();
