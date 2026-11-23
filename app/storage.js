'use strict';
/*
 * Depolama katmanı — üç mod:
 *  - cloud   : Supabase (config.js doluysa). Giriş zorunlu, veriler bulut veritabanında,
 *              işlem geçmişi sunucu tarafında tutulur, değişiklikler canlı yansır.
 *  - desktop : Supabase ayarı yoksa Electron'da bilgisayardaki JSON dosyası.
 *  - web     : Supabase ayarı yoksa tarayıcı localStorage (yalnızca geçiş/deneme için).
 *
 * Arayüz:
 *   init() -> { needLogin }
 *   login(email, password), logout(), user, role
 *   loadAll() -> { records:{module:[...]}, settings }
 *   upsert(module, item), remove(module, id), saveSettings(settings)
 *   loadAudit(limit) -> [{date, user, action, details}]
 *   importAll(records), resetAll()
 *   onRemoteChange(cb)
 */
(function () {
  // Aynı alan adında birden fazla şirket kopyası çalışabildiği için anahtarlar markaya göre ayrılır
  const BRAND_ID = (window.FILO_BRAND && window.FILO_BRAND.id) || 'genel';
  const LOCAL_KEY = 'arac-filo-yonetimi-v1' + (BRAND_ID === 'dardanel' ? '' : '-' + BRAND_ID);
  const cfg = window.FILO_CONFIG || {};
  const desktop = window.filoDesktop;
  const useCloud = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);

  // ---------------- Bulut (Supabase) ----------------
  // E-postadaki bağlantıdan gelindiyse (şifre sıfırlama / davet / hata) bunu istemci URL'yi okumadan önce yakala
  const AUTH_HASH = new URLSearchParams((location.hash || '').replace(/^#/, ''));
  const AUTH_QUERY = new URLSearchParams(location.search || '');
  const LINK_TYPE = AUTH_HASH.get('type') || AUTH_QUERY.get('type');
  const LINK_ERROR = AUTH_HASH.get('error_description') || AUTH_QUERY.get('error_description');

  function cloudStore() {
    const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'filo-auth-' + BRAND_ID }
    });
    const S = {
      mode: 'cloud', user: null, role: null, client: sb,

      async init() {
        if (LINK_ERROR) {
          history.replaceState(null, '', location.pathname);
          const expired = /expired|invalid/i.test(LINK_ERROR);
          throw new Error(expired ? 'E-postadaki bağlantının süresi dolmuş ya da daha önce kullanılmış. "Şifremi unuttum" ile yeni bağlantı isteyin.' : LINK_ERROR);
        }
        const { data } = await sb.auth.getSession();
        if (!data.session) return { needLogin: true };
        if (LINK_TYPE === 'recovery' || LINK_TYPE === 'invite') {
          history.replaceState(null, '', location.pathname);
          S.user = data.session.user;
          return { needLogin: false, setPassword: LINK_TYPE };
        }
        return S._afterLogin(data.session.user);
      },

      // E-posta bağlantısıyla gelen kullanıcı için yeni şifre kaydeder ve oturumu tamamlar
      async setNewPassword(password) {
        const { data, error } = await sb.auth.updateUser({ password });
        if (error) throw new Error(/should be different/i.test(error.message) ? 'Yeni şifre eskisiyle aynı olamaz.' : /at least/i.test(error.message) ? 'Şifre en az 6 karakter olmalı.' : error.message);
        return S._afterLogin(data.user);
      },

      async _afterLogin(user) {
        S.user = user;
        const { data: role, error } = await sb.rpc('filo_my_role');
        if (error) throw new Error('Yetki kontrolü yapılamadı: ' + error.message);
        if (!role) {
          await sb.auth.signOut(); S.user = null;
          throw new Error('Bu e-posta (' + user.email + ') uygulamaya yetkili değil. Yöneticinizden filo_users listesine eklenmeyi isteyin.');
        }
        S.role = role;
        return { needLogin: false };
      },

      async login(email, password) {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message === 'Invalid login credentials' ? 'E-posta veya şifre hatalı.' : error.message);
        return S._afterLogin(data.user);
      },

      async logout() { await sb.auth.signOut(); S.user = null; S.role = null; },

      async resetPassword(email) {
        // Masaüstü uygulamasında (file://) bağlantı web sürümüne yönlenir
        const brand = window.FILO_BRAND || {};
        const redirectTo = location.protocol === 'file:' ? brand.webUrl : location.href.split('#')[0].split('?')[0];
        const { error } = await sb.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : {});
        if (error) throw new Error(error.message);
      },

      async loadAll() {
        const records = {}, page = 1000;
        for (let from = 0; ; from += page) {
          const { data, error } = await sb.from('filo_records').select('id,module,data').order('created_at').range(from, from + page - 1);
          if (error) throw new Error(error.message);
          for (const r of data) (records[r.module] = records[r.module] || []).push({ ...r.data, id: r.id });
          if (data.length < page) break;
        }
        const { data: st, error: e2 } = await sb.from('filo_settings').select('data').eq('id', 1).maybeSingle();
        if (e2) throw new Error(e2.message);
        return { records, settings: (st && st.data) || {} };
      },

      async upsert(module, item) {
        const { id, ...data } = item;
        const { error } = await sb.from('filo_records').upsert({ id, module, data: { ...data, id } });
        if (error) throw new Error(error.message);
      },

      async remove(module, id) {
        const { error } = await sb.from('filo_records').delete().eq('id', id);
        if (error) throw new Error(error.message);
      },

      async saveSettings(settings) {
        if (S.role !== 'admin') throw new Error('Ayarları yalnızca yönetici değiştirebilir.');
        const { error } = await sb.from('filo_settings').update({ data: settings }).eq('id', 1);
        if (error) throw new Error(error.message);
      },

      async loadAudit(limit = 50) {
        const { data, error } = await sb.from('filo_audit').select('at,user_email,action,details').order('at', { ascending: false }).limit(limit);
        if (error) throw new Error(error.message);
        return data.map(a => ({ date: a.at, user: a.user_email, action: a.action, details: a.details }));
      },

      async importAll(records) {
        const rows = [];
        for (const [module, list] of Object.entries(records))
          if (Array.isArray(list)) for (const it of list) if (it && it.id) rows.push({ id: String(it.id), module, data: it });
        let total = 0;
        for (let i = 0; i < rows.length; i += 500) {
          const { data, error } = await sb.rpc('filo_import', { payload: rows.slice(i, i + 500) });
          if (error) throw new Error(error.message);
          total += data || 0;
        }
        return total;
      },

      // Çok sayıda kaydı paketler halinde yazar (yalnızca yönetici). ops: [{ module, item }]
      async bulkUpsert(ops, onProgress) {
        if (S.role !== 'admin') throw new Error('Toplu içe aktarma yalnızca yönetici tarafından yapılabilir.');
        const rows = ops.map(o => ({ id: String(o.item.id), module: o.module, data: o.item }));
        let done = 0;
        for (let i = 0; i < rows.length; i += 300) {
          const chunk = rows.slice(i, i + 300);
          const { error } = await sb.rpc('filo_import', { payload: chunk });
          if (error) throw new Error(error.message + (done ? ` (${done} kayıt yazıldıktan sonra durdu; aynı dosyayı tekrar yüklemek güvenlidir)` : ''));
          done += chunk.length;
          if (onProgress) onProgress(done, rows.length);
        }
        return done;
      },

      async resetAll() {
        const { error } = await sb.rpc('filo_reset');
        if (error) throw new Error(error.message);
      },

      onRemoteChange(cb) {
        let timer;
        sb.channel('filo-records')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'filo_records' }, () => {
            clearTimeout(timer); timer = setTimeout(cb, 400);
          })
          .subscribe();
      }
    };
    return S;
  }

  // ---------------- Yerel (dosya / localStorage) ----------------
  function localStore() {
    let doc = { records: {}, settings: {}, audit: [] };
    const read = () => desktop ? desktop.load() : localStorage.getItem(LOCAL_KEY);
    const write = () => {
      const json = JSON.stringify(doc);
      if (desktop) { if (!desktop.save(json)) throw new Error('Veri dosyasına yazılamadı.'); return; }
      try { localStorage.setItem(LOCAL_KEY, json); } catch (e) { throw new Error('Tarayıcı depolama alanı dolu.'); }
    };
    const log = (action, details) => { doc.audit.unshift({ date: new Date().toISOString(), user: null, action, details }); doc.audit = doc.audit.slice(0, 500); };
    const label = it => it.plate || it.name || it.title || it.type || '';

    const S = {
      mode: desktop ? 'desktop' : 'web', user: null, role: 'admin',
      async init() {
        try { const raw = read(); if (raw) doc = { ...doc, ...JSON.parse(raw) }; } catch (e) { console.error(e); }
        doc.records = doc.records || {}; doc.audit = doc.audit || [];
        return { needLogin: false };
      },
      async login() {}, async logout() {}, async resetPassword() {},
      async loadAll() { return { records: doc.records, settings: doc.settings || {} }; },
      async upsert(module, item) {
        const list = doc.records[module] = doc.records[module] || [];
        const ix = list.findIndex(x => x.id === item.id);
        if (ix >= 0) list[ix] = item; else list.push(item);
        log(ix >= 0 ? 'Düzenleme' : 'Yeni kayıt', module + ' • ' + label(item)); write();
      },
      async remove(module, id) {
        doc.records[module] = (doc.records[module] || []).filter(x => x.id !== id);
        log('Silme', module); write();
      },
      async saveSettings(settings) { doc.settings = settings; log('Ayar', 'Genel ayarlar güncellendi'); write(); },
      async loadAudit(limit = 50) { return doc.audit.slice(0, limit); },
      async importAll(records) {
        let n = 0;
        for (const [m, list] of Object.entries(records)) if (Array.isArray(list)) { doc.records[m] = list; n += list.length; }
        log('İçe aktarma', n + ' kayıt aktarıldı'); write(); return n;
      },
      async bulkUpsert(ops, onProgress) {
        for (const { module, item } of ops) {
          const list = doc.records[module] = doc.records[module] || [];
          const ix = list.findIndex(x => x.id === item.id);
          if (ix >= 0) list[ix] = item; else list.push(item);
        }
        log('İçe aktarma', ops.length + ' kayıt aktarıldı'); write();
        if (onProgress) onProgress(ops.length, ops.length);
        return ops.length;
      },
      async resetAll() { doc.records = {}; log('Sıfırlama', 'Tüm kayıtlar silindi'); write(); },
      onRemoteChange() {},
      info() { return desktop ? desktop.info() : { dataFile: 'Tarayıcı yerel depolaması' }; },
      openDataFolder() { if (desktop) desktop.openDataFolder(); }
    };
    return S;
  }

  window.Store = useCloud ? cloudStore() : localStore();
})();
