'use strict';
/*
 * Excel içe aktarma (Araç Listesi formatı).
 * Dosyadaki her satır bir araçtır; plakaya göre mevcut kayıtla eşleştirilir.
 * Aynı dosya her ay tekrar yüklenebilir: kayıt kimlikleri plakadan türetildiği için
 * kopya oluşmaz, değişen alanlar güncellenir. Dosyada boş olan alan mevcut veriyi silmez.
 *
 * Tarayıcıda window.FiloImporter, Node'da module.exports olarak kullanılır.
 */
(function (root) {
  // ---------- Sütun eşleştirme ----------
  const norm = s => String(s ?? '').toLocaleLowerCase('tr').replace(/[^0-9a-zçğıöşü]/g, '');
  const COLUMNS = {
    plate: ['plaka'], status: ['güncel durum', 'durum'], saleDate: ['satış tarihleri', 'satış tarihi'],
    branch: ['bölge'], fuelCard: ['yakıt'], usingCompany: ['kullanan firma'], regOwner: ['ruhsat sahibi'],
    regDate: ['tescil tarihi'], brand: ['marka'], model: ['model'], modelDetail: ['model detayı'],
    vclass: ['binek-ticari', 'binek ticari'], year: ['araç yılı', 'model yılı'], km: { prefix: 'km' },
    licenseSerial: ['ruhsat seri no'], vin: ['şasi no'], inspectionEnd: ['muayene bitiş tarihi'],
    person: ['kullanıcı'], sicil: ['sicil no'], title: ['görevi'], ownership: ['mülkiyet türü'],
    leaseCompany: ['kiralama şirketi'], leaseStart: ['kira başlangıç'], leaseEnd: ['kira bitiş'],
    leaseMonthly: ['aylık kira bedeli']
  };
  const LABELS = {
    plate: 'Plaka', status: 'Güncel Durum', saleDate: 'Satış Tarihleri', branch: 'Bölge', fuelCard: 'Yakıt',
    usingCompany: 'Kullanan Firma', regOwner: 'Ruhsat Sahibi', regDate: 'Tescil Tarihi', brand: 'Marka', model: 'Model',
    modelDetail: 'MODEL DETAYI', vclass: 'Binek-Ticari', year: 'Araç Yılı', km: 'KM', licenseSerial: 'Ruhsat Seri No',
    vin: 'Şasi No', inspectionEnd: 'Muayene Bitiş Tarihi', person: 'Kullanıcı', sicil: 'Sicil No', title: 'Görevi',
    ownership: 'Mülkiyet Türü', leaseCompany: 'Kiralama Şirketi', leaseStart: 'Kira Başlangıç', leaseEnd: 'Kira Bitiş',
    leaseMonthly: 'Aylık Kira Bedeli'
  };

  function mapHeaders(headerRow) {
    const map = {};
    headerRow.forEach((h, i) => {
      const n = norm(h);
      if (!n) return;
      for (const [key, spec] of Object.entries(COLUMNS)) {
        if (key in map) continue;
        const hit = Array.isArray(spec) ? spec.some(a => norm(a) === n) : n.startsWith(spec.prefix);
        if (hit) { map[key] = i; break; }
      }
    });
    return map;
  }

  // Başlık satırını ilk 10 satır içinde "Plaka" sütununa göre bul
  function findHeaderRow(rows) {
    for (let i = 0; i < Math.min(rows.length, 10); i++)
      if ((rows[i] || []).some(c => norm(c) === 'plaka')) return i;
    return -1;
  }

  // ---------- Değer dönüştürücüler ----------
  const clean = v => (v === null || v === undefined) ? '' : String(v).replace(/\s+/g, ' ').trim();
  const pad = n => String(n).padStart(2, '0');
  // Excel seri tarihi, Date ya da "gg.aa.yyyy ..." metni -> { date: 'YYYY-MM-DD' | '', rest: kalan metin }
  function toDate(v) {
    if (v === null || v === undefined || v === '') return { date: '', rest: '' };
    if (typeof v === 'number' && v > 20000 && v < 80000) {
      const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
      return { date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`, rest: '' };
    }
    if (v instanceof Date && !isNaN(v)) return { date: `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`, rest: '' };
    const s = clean(v);
    const m = s.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
    if (m) {
      const [dd, mm, yy] = [Number(m[1]), Number(m[2]), Number(m[3])];
      if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) return { date: `${yy}-${pad(mm)}-${pad(dd)}`, rest: clean(s.replace(m[0], '')) };
    }
    const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return { date: iso[0], rest: clean(s.replace(iso[0], '')) };
    return { date: '', rest: s };
  }
  const toNum = v => {
    if (v === null || v === undefined || v === '') return '';
    if (typeof v === 'number') return isFinite(v) ? v : '';
    const s = clean(v).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    return s && !isNaN(Number(s)) ? Number(s) : '';
  };
  const plateKey = p => clean(p).toLocaleUpperCase('tr-TR').replace(/[^0-9A-ZÇĞİÖŞÜ]/g, '');
  const plateDisplay = p => clean(p).toLocaleUpperCase('tr-TR');
  const nameKey = s => norm(s);
  const titleCase = s => clean(s).toLocaleLowerCase('tr').replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toLocaleUpperCase('tr'));

  function mapStatus(raw) {
    const s = clean(raw).toLocaleUpperCase('tr-TR');
    if (!s) return '';
    if (/SATILDI|SATIŞ/.test(s)) return 'Satıldı';
    if (/PERT/.test(s)) return 'Pert';
    if (/SERV[İI]S/.test(s)) return 'Serviste';
    if (/KULLANIMDA/.test(s)) return 'Aktif';
    if (/BOŞTA|SANCAKTEP/.test(s)) return 'Boşta';
    if (/İADE|IADE/.test(s)) return 'Pasif';
    return 'Aktif';
  }
  const mapOwnership = v => { const s = norm(v); return s.startsWith('özmal') || s.startsWith('şirket') ? 'Şirket' : s.startsWith('kiral') ? 'Kiralık' : ''; };
  const mapClass = v => { const s = norm(v); return s === 'binek' ? 'Binek' : s === 'ticari' ? 'Ticari' : ''; };
  function inferFuel(detail) {
    const s = clean(detail);
    if (/hibri[dt]|hybrid/i.test(s)) return 'Hibrit';
    if (/elektrik|electric|\bBEV\b/i.test(s)) return 'Elektrik';
    if (/dizel|diesel|tdci|multijet|\bdci\b|crdi|\bhdi\b|\btdi\b|ecoblue/i.test(s)) return 'Dizel';
    if (/benzin|\btce\b|\btsi\b|vvt/i.test(s)) return 'Benzin';
    return '';
  }
  const leaseCompanyName = v => clean(v).replace(/\s*kiral[ıi]k\s*$/i, '').replace(/\s+/g, ' ');

  // ---------- Plan ----------
  /**
   * rows: dizi dizisi (sayfanın tamamı). state: { records: {module: [...]} }
   * opts: { modules: {documents, drivers, assignments, leasing, purchases}, sheetName, today }
   * Döner: { error } ya da { ops, summary, warnings, headers, missingColumns }
   */
  function buildPlan(rows, state, opts = {}) {
    const today = opts.today || new Date().toLocaleDateString('en-CA');
    const want = Object.assign({ documents: true, drivers: true, assignments: true, leasing: true, purchases: true }, opts.modules || {});
    const hdrIdx = findHeaderRow(rows);
    if (hdrIdx < 0) return { error: 'Başlık satırı bulunamadı: dosyada "Plaka" sütunu olmalı.' };
    const col = mapHeaders(rows[hdrIdx]);
    const missingColumns = Object.keys(COLUMNS).filter(k => !(k in col)).map(k => LABELS[k]);
    const get = (r, k) => (k in col ? r[col[k]] : undefined);

    const R = state.records || {};
    const list = m => (R[m] || []);
    const byPlate = new Map(list('vehicles').map(v => [plateKey(v.plate), v]));
    const byId = m => new Map(list(m).map(x => [x.id, x]));
    const docsById = byId('documents'), leasesById = byId('leasing'), salesById = byId('purchases'), driversById = byId('drivers');
    const driversByName = new Map(list('drivers').map(d => [nameKey(d.name), d]));
    const driverFinal = new Map(); // id -> { old, item }: aynı kişi birden çok satırda geçebilir, en sonunda bir kez karşılaştırılır
    const assignments = list('assignments').slice();

    const ops = [], warnings = [];
    const opIndex = new Map(); // module|id -> op (aynı kaydı iki kez yazmamak için)
    const push = (module, item, kind) => {
      const k = module + '|' + item.id;
      if (opIndex.has(k)) { opIndex.get(k).item = item; return; }
      const op = { module, item, kind }; opIndex.set(k, op); ops.push(op);
    };
    // Mevcut kayıtla birleştir: dosyadaki boş değerler mevcut veriyi silmez
    const merge = (existing, fresh) => {
      const out = { ...(existing || {}) };
      for (const [k, v] of Object.entries(fresh)) if (v !== '' && v !== null && v !== undefined) out[k] = typeof v === 'number' ? String(v) : v;
      return out;
    };
    const changed = (a, b) => !a || Object.keys(b).some(k => String(a[k] ?? '') !== String(b[k] ?? ''));

    const s = { rows: 0, skipped: 0, vehiclesNew: 0, vehiclesUpdated: 0, vehiclesSame: 0, documents: 0, drivers: 0, assignments: 0, assignmentsClosed: 0, leasing: 0, purchases: 0 };
    const seen = new Set();

    for (let i = hdrIdx + 1; i < rows.length; i++) {
      const r = rows[i] || [];
      if (!r.some(c => clean(c))) continue;
      const rowNo = i + 1;
      const plateRaw = get(r, 'plate');
      const key = plateKey(plateRaw);
      if (!key) { s.skipped++; warnings.push(`Satır ${rowNo}: plaka boş, atlandı.`); continue; }
      if (seen.has(key)) { s.skipped++; warnings.push(`Satır ${rowNo}: ${plateDisplay(plateRaw)} plakası dosyada ikinci kez geçiyor, atlandı.`); continue; }
      seen.add(key); s.rows++;

      // --- Araç ---
      const existing = byPlate.get(key);
      const detail = clean(get(r, 'modelDetail'));
      const fileKm = toNum(get(r, 'km'));
      const fresh = {
        plate: plateDisplay(plateRaw),
        brand: clean(get(r, 'brand')).toLocaleUpperCase('tr-TR'),
        model: clean(get(r, 'model')),
        modelDetail: detail,
        year: toNum(get(r, 'year')),
        type: mapClass(get(r, 'vclass')),
        ownership: mapOwnership(get(r, 'ownership')),
        branch: clean(get(r, 'branch')),
        vin: clean(get(r, 'vin')).toLocaleUpperCase('tr-TR'),
        status: mapStatus(get(r, 'status')),
        statusDetail: clean(get(r, 'status')),
        fuelCard: clean(get(r, 'fuelCard')),
        usingCompany: clean(get(r, 'usingCompany')),
        regOwner: clean(get(r, 'regOwner')),
        regDate: toDate(get(r, 'regDate')).date,
        licenseSerial: clean(get(r, 'licenseSerial')).toLocaleUpperCase('tr-TR')
      };
      // KM geriye gitmez (yakıt/bakım kayıtlarıyla artmış olabilir)
      if (fileKm !== '' && !(existing && Number(existing.km) > fileKm)) fresh.km = fileKm;
      if (!(existing && existing.fuel)) fresh.fuel = inferFuel(detail);
      const vehicle = merge(existing, fresh);
      vehicle.id = existing ? existing.id : 'xl-arac-' + key;
      if (!existing) { s.vehiclesNew++; push('vehicles', vehicle, 'new'); }
      else if (changed(existing, vehicle)) { s.vehiclesUpdated++; push('vehicles', vehicle, 'update'); }
      else s.vehiclesSame++;
      const vid = vehicle.id;

      // --- Muayene ---
      const insp = toDate(get(r, 'inspectionEnd'));
      if (want.documents) {
        if (insp.date) {
          const id = 'xl-muayene-' + key, old = docsById.get(id);
          const doc = merge(old, { id, vehicle: vid, type: 'Muayene', end: insp.date, notes: insp.rest ? 'Not: ' + insp.rest : '' });
          if (changed(old, doc)) { push('documents', doc); s.documents++; }
        } else if (insp.rest) warnings.push(`Satır ${rowNo} (${fresh.plate}): muayene tarihi okunamadı ("${insp.rest}").`);
      }

      // --- Sürücü ve zimmet ---
      const person = clean(get(r, 'person'));
      if (person) {
        const sicilRaw = clean(get(r, 'sicil'));
        const sicil = /^\d+$/.test(sicilRaw) ? sicilRaw : '';
        const pname = titleCase(person);
        if (want.drivers) {
          const did = 'xl-surucu-' + (sicil ? 's' + sicil : 'n' + nameKey(person));
          const old = driversById.get(did) || driversByName.get(nameKey(person));
          const id = old ? old.id : did;
          const prev = driverFinal.get(id);
          const base = prev ? prev.item : old;
          const drv = merge(base, { id, name: base ? base.name : pname, branch: fresh.branch, sicil, title: clean(get(r, 'title')), status: 'Aktif' });
          driverFinal.set(id, { old: prev ? prev.old : old, item: drv });
        }
        const gone = ['Satıldı', 'Pert'].includes(fresh.status);
        if (want.assignments) {
          const active = assignments.filter(a => a.vehicle === vid && a.status !== 'İade Edildi');
          const same = gone ? null : active.find(a => nameKey(a.person) === nameKey(person));
          if (!same) {
            for (const a of active) {
              const closed = { ...a, status: 'İade Edildi', end: a.end || today };
              push('assignments', closed); s.assignmentsClosed++;
              Object.assign(a, closed);
            }
            if (!gone) {
              const asg = { id: 'xl-zimmet-' + key + '-' + nameKey(person).slice(0, 24), vehicle: vid, person: pname, start: today, status: 'Aktif',
                condition: 'Excel içe aktarma' + (opts.sheetName ? ' (' + opts.sheetName + ')' : '') };
              if (fileKm !== '') asg.km = String(fileKm);
              push('assignments', asg); assignments.push(asg); s.assignments++;
            }
          }
        }
      }

      // --- Kiralama ---
      const monthly = toNum(get(r, 'leaseMonthly'));
      const lcomp = leaseCompanyName(get(r, 'leaseCompany'));
      if (want.leasing && fresh.ownership === 'Kiralık' && (lcomp || monthly !== '')) {
        const id = 'xl-kira-' + key, old = leasesById.get(id);
        const ended = ['Satıldı', 'Pasif', 'Pert'].includes(fresh.status);
        const lease = merge(old, { id, vehicle: vid, company: lcomp, start: toDate(get(r, 'leaseStart')).date, end: toDate(get(r, 'leaseEnd')).date, monthly, status: ended ? 'Bitti' : 'Aktif' });
        if (changed(old, lease)) { push('leasing', lease); s.leasing++; }
      }

      // --- Satış ---
      const sale = toDate(get(r, 'saleDate'));
      if (want.purchases && sale.date) {
        const id = 'xl-satis-' + key, old = salesById.get(id);
        const p = merge(old, { id, vehicle: vid, date: sale.date, type: 'Satış', status: 'Tamamlandı', notes: 'Excel içe aktarma' });
        if (changed(old, p)) { push('purchases', p); s.purchases++; }
      }
    }

    for (const { old, item } of driverFinal.values()) if (changed(old, item)) { push('drivers', item); s.drivers++; }

    const notInFile = list('vehicles').filter(v => !seen.has(plateKey(v.plate))).map(v => v.plate);
    return { ops, summary: s, warnings, missingColumns, notInFile, headerRow: hdrIdx + 1 };
  }

  const api = { buildPlan, mapHeaders, findHeaderRow, toDate, plateKey, mapStatus, inferFuel, LABELS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FiloImporter = api;
})(typeof window !== 'undefined' ? window : globalThis);
