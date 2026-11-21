-- =====================================================================
--  Araç Filo Yönetimi — Supabase veritabanı kurulumu
--  Supabase panelinde: SQL Editor > New query > bu dosyanın tamamını
--  yapıştır > Run. Tekrar çalıştırmak güvenlidir (idempotent).
-- =====================================================================

-- 1) Yetkili kullanıcı listesi --------------------------------------------
-- Uygulamaya yalnızca bu tabloda e-postası olan kişiler erişebilir.
create table if not exists public.filo_users (
  email      text primary key,
  full_name  text,
  role       text not null default 'user' check (role in ('admin','user')),
  created_at timestamptz not null default now()
);

-- 2) Kayıtlar (tüm modüller tek tabloda) ---------------------------------
create table if not exists public.filo_records (
  id          text primary key,
  module      text not null,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  text default (auth.jwt() ->> 'email')
);
create index if not exists filo_records_module_idx on public.filo_records(module);
create index if not exists filo_records_vehicle_idx on public.filo_records((data ->> 'vehicle'));

-- 3) Ayarlar (tek satır) ---------------------------------------------------
create table if not exists public.filo_settings (
  id          int primary key default 1 check (id = 1),
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  text default (auth.jwt() ->> 'email')
);
insert into public.filo_settings (id, data) values (1, '{}'::jsonb) on conflict (id) do nothing;

-- 4) İşlem geçmişi (değiştirilemez denetim kaydı) ---------------------------
create table if not exists public.filo_audit (
  id          bigserial primary key,
  at          timestamptz not null default now(),
  user_email  text default (auth.jwt() ->> 'email'),
  action      text not null,
  details     text
);
create index if not exists filo_audit_at_idx on public.filo_audit(at desc);

-- 5) Yardımcı fonksiyonlar -------------------------------------------------
create or replace function public.filo_is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.filo_users where lower(email) = lower(auth.jwt() ->> 'email'));
$$;

create or replace function public.filo_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.filo_users where lower(email) = lower(auth.jwt() ->> 'email') and role = 'admin');
$$;

-- Giriş yapan kişinin rolünü döndürür (uygulama arayüzü için)
create or replace function public.filo_my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.filo_users where lower(email) = lower(auth.jwt() ->> 'email');
$$;

-- 6) Otomatik denetim kaydı (sunucu tarafında, istemci atlatamaz) ---------
create or replace function public.filo_audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  label text;
begin
  if current_setting('filo.skip_audit', true) = '1' then
    return coalesce(new, old);
  end if;
  r := coalesce(to_jsonb(new), to_jsonb(old));
  if tg_table_name = 'filo_settings' then
    insert into filo_audit(action, details) values ('Ayar', 'Genel ayarlar güncellendi');
    return new;
  end if;
  label := coalesce(r->'data'->>'plate', r->'data'->>'name', r->'data'->>'title', r->'data'->>'type', r->>'id');
  insert into filo_audit(action, details)
  values (case tg_op when 'INSERT' then 'Yeni kayıt' when 'UPDATE' then 'Düzenleme' else 'Silme' end,
          (r->>'module') || ' • ' || coalesce(label, ''));
  return coalesce(new, old);
end $$;

drop trigger if exists filo_records_audit on public.filo_records;
create trigger filo_records_audit after insert or update or delete on public.filo_records
  for each row execute function public.filo_audit_trigger();

drop trigger if exists filo_settings_audit on public.filo_settings;
create trigger filo_settings_audit after update on public.filo_settings
  for each row execute function public.filo_audit_trigger();

create or replace function public.filo_touch() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.jwt() ->> 'email';
  return new;
end $$;
drop trigger if exists filo_records_touch on public.filo_records;
create trigger filo_records_touch before update on public.filo_records for each row execute function public.filo_touch();
drop trigger if exists filo_settings_touch on public.filo_settings;
create trigger filo_settings_touch before update on public.filo_settings for each row execute function public.filo_touch();

-- 7) Toplu işlemler (yalnızca admin) --------------------------------------
create or replace function public.filo_reset() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not filo_is_admin() then raise exception 'Bu işlem için yönetici yetkisi gerekir'; end if;
  perform set_config('filo.skip_audit', '1', true);
  delete from filo_records where true;
  insert into filo_audit(action, details) values ('Sıfırlama', 'Tüm kayıtlar silindi');
end $$;

create or replace function public.filo_import(payload jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not filo_is_admin() then raise exception 'Bu işlem için yönetici yetkisi gerekir'; end if;
  perform set_config('filo.skip_audit', '1', true);
  insert into filo_records(id, module, data)
  select e->>'id', e->>'module', e->'data' from jsonb_array_elements(payload) e
  on conflict (id) do update set module = excluded.module, data = excluded.data;
  get diagnostics n = row_count;
  insert into filo_audit(action, details) values ('İçe aktarma', n || ' kayıt aktarıldı');
  return n;
end $$;

-- 8) Satır düzeyi güvenlik (RLS) -------------------------------------------
alter table public.filo_users    enable row level security;
alter table public.filo_records  enable row level security;
alter table public.filo_settings enable row level security;
alter table public.filo_audit    enable row level security;

drop policy if exists "uyeler okur"        on public.filo_records;
drop policy if exists "uyeler ekler"       on public.filo_records;
drop policy if exists "uyeler gunceller"   on public.filo_records;
drop policy if exists "uyeler siler"       on public.filo_records;
create policy "uyeler okur"      on public.filo_records for select to authenticated using (filo_is_member());
create policy "uyeler ekler"     on public.filo_records for insert to authenticated with check (filo_is_member());
create policy "uyeler gunceller" on public.filo_records for update to authenticated using (filo_is_member()) with check (filo_is_member());
create policy "uyeler siler"     on public.filo_records for delete to authenticated using (filo_is_member());

drop policy if exists "uyeler okur"      on public.filo_settings;
drop policy if exists "admin gunceller"  on public.filo_settings;
create policy "uyeler okur"     on public.filo_settings for select to authenticated using (filo_is_member());
create policy "admin gunceller" on public.filo_settings for update to authenticated using (filo_is_admin()) with check (filo_is_admin());

drop policy if exists "uyeler okur" on public.filo_audit;
create policy "uyeler okur" on public.filo_audit for select to authenticated using (filo_is_member());
-- filo_audit'e istemciden yazma/silme/güncelleme izni YOK: kayıtları sadece tetikleyiciler yazar.

drop policy if exists "kendini gorur" on public.filo_users;
drop policy if exists "admin gorur"   on public.filo_users;
create policy "kendini gorur" on public.filo_users for select to authenticated using (lower(email) = lower(auth.jwt() ->> 'email'));
create policy "admin gorur"   on public.filo_users for select to authenticated using (filo_is_admin());

-- Anonim (giriş yapmamış) erişimi tamamen kapat
revoke all on public.filo_users, public.filo_records, public.filo_settings, public.filo_audit from anon;
revoke execute on function public.filo_reset(), public.filo_import(jsonb) from anon, public;
grant execute on function public.filo_reset(), public.filo_import(jsonb), public.filo_my_role() to authenticated;

-- 9) Canlı güncelleme (başka kullanıcının değişikliği ekrana anında düşer)
do $$ begin
  alter publication supabase_realtime add table public.filo_records;
exception when duplicate_object then null; when undefined_object then null; end $$;

-- =====================================================================
--  10) KULLANICI EKLEME — aşağıdaki satırı kendi e-postanla düzenleyip
--      çalıştır. Önce Authentication > Users > Add user ile aynı
--      e-postaya şifreli kullanıcı oluşturmayı unutma.
-- =====================================================================
-- insert into public.filo_users (email, full_name, role) values
--   ('onur.turkyilmaz@dardanel.com.tr', 'Onur Türkyılmaz', 'admin')
-- on conflict (email) do update set role = excluded.role;
