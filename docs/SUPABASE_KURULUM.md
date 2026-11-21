# Supabase Kurulumu (ortak bulut veritabanı)

Bu adımlardan sonra web sürümü ve Windows uygulaması **aynı veritabanını** kullanır. Herkes kendi e-posta ve şifresiyle giriş yapar, kayıtlar anında herkese yansır, işlem geçmişi kimin neyi değiştirdiğini sunucu tarafında tutar.

## 1. Proje oluştur
1. https://supabase.com adresinde hesap aç (GitHub ile giriş yapılabilir).
2. **New project** → ad: `arac-filo-yonetimi`.
   - **Region:** `Central EU (Frankfurt)` önerilir (Türkiye'ye en yakın AB bölgesi).
   - Veritabanı şifresini güvenli bir yere kaydet.

## 2. Tabloları kur
**SQL Editor → New query** → [`supabase/schema.sql`](../supabase/schema.sql) dosyasının tamamını yapıştır → **Run**.

## 3. Kayıt olmayı kapat (önemli)
**Authentication → Sign In / Providers → Email**:
- **Allow new users to sign up**: **KAPALI**
- **Confirm email**: açık kalabilir

> Bu kapatılmazsa dışarıdan biri hesap açabilir. Yine de verileri göremez (`filo_users` listesinde olmadığı için), ama kapalı olması gerekir.

## 4. Kullanıcı ekle
Her kullanıcı için iki adım:

1. **Authentication → Users → Add user → Create new user**: e-posta + şifre, **Auto Confirm User** işaretli.
2. **SQL Editor**'de:
```sql
insert into public.filo_users (email, full_name, role) values
  ('onur.turkyilmaz@dardanel.com.tr', 'Onur Türkyılmaz', 'admin'),
  ('ornek.kullanici@dardanel.com.tr', 'Örnek Kullanıcı', 'user')
on conflict (email) do update set role = excluded.role, full_name = excluded.full_name;
```

| Rol | Yetki |
|---|---|
| `admin` | Tüm kayıtlar + ayarlar + toplu içe aktarma + tüm kayıtları silme |
| `user` | Kayıt ekleme / düzenleme / silme, raporlar |

Kullanıcıyı çıkarmak için: `delete from public.filo_users where email = '...';` (ve Authentication'dan kullanıcıyı silin).

## 5. Uygulamaya bağla
**Project Settings → API** (veya **Data API**) sayfasından:
- **Project URL** (ör. `https://abcd1234.supabase.co`)
- **anon public** (veya **publishable**) anahtar

Bunları [`app/config.js`](../app/config.js) dosyasına yaz ve GitHub'a gönder. Web sürümü 1–2 dakikada güncellenir. Windows sürümü için **Actions → Windows sürümü derle → Run workflow**.

> ⚠️ **service_role / secret** anahtarını ASLA bu dosyaya yazma. Sadece **anon / publishable** anahtar sayfada görünebilir; veriler giriş + RLS kurallarıyla korunur.

## 6. Şifre sıfırlama e-postası
**Authentication → URL Configuration → Site URL**: `https://dizayn17.github.io/arac-yonetim-kilavuzu/`

## 7. Eski verileri taşıma
Eski sürümde kayıt girdiysen: eski sürümde JSON yedeği indir → yeni sürümde yönetici hesabıyla **Ayarlar → Eski yedekten veri aktar**.

## Yedekleme ve güvenlik notları
- Veriler Supabase'in AB bölgesindeki sunucularında durur. Kişisel veri (sürücü, ceza, kaza) içerdiği için KVKK kapsamında yurt dışına aktarım değerlendirmesi yapılmalıdır.
- Ücretsiz planda otomatik yedek **indirilemez** ve 1 hafta hareketsiz kalan proje **duraklatılır** (panelden tek tıkla açılır). Kritik kullanımda Pro plan veya düzenli `pg_dump` önerilir.
- İşlem geçmişi (`filo_audit`) istemciden değiştirilemez/silinemez; tüm kayıt değişiklikleri veritabanı tetikleyicisiyle yazılır.
