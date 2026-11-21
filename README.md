# 🚘 Araç Yönetim Kılavuzu — Araç Filo Yönetimi

Araç kartları, zimmet, sürücüler, belge/poliçe takibi, yakıt, bakım, lastik, hasar, ceza, HGS, kiralama, tedarikçi, görev, maliyet, rapor ve uyarıları tek ekranda yöneten filo uygulaması.

Aynı kod iki şekilde çalışır:

| Sürüm | Nasıl açılır |
|---|---|
| **Web (internet)** | https://dizayn17.github.io/arac-yonetim-kilavuzu/ |
| **Windows masaüstü** | `.exe` kurulum veya taşınabilir sürüm (Releases) |

**Veriler:** İki sürüm de aynı **Supabase (PostgreSQL) bulut veritabanını** kullanır. Kullanıcılar e-posta + şifre ile giriş yapar, değişiklikler herkese anında yansır, işlem geçmişi sunucuda tutulur. Kurulum: [docs/SUPABASE_KURULUM.md](docs/SUPABASE_KURULUM.md)

> `app/config.js` boşsa uygulama yerel modda çalışır (masaüstünde dosya, web'de tarayıcı).

📖 Ayrıntılı kullanım: [docs/KULLANIM_KILAVUZU.md](docs/KULLANIM_KILAVUZU.md)

---

## Özellikler

- 16 kayıt modülü + Gösterge Paneli, Raporlama, Bildirimler, Ayarlar
- Tarih bazlı uyarılar (belge, poliçe, kiralama, ehliyet/SRC, tedarikçi, görev, ceza) — eşik 1–365 gün
- **KM bazlı bakım uyarısı**: araç KM'si "Sonraki Bakım KM" değerine yaklaşınca uyarır
- Yakıt, bakım ve zimmet iade KM'si girildiğinde araç kartındaki güncel KM otomatik güncellenir
- Yakıtta toplam tutar boşsa litre × birim fiyat hesaplanır
- Raporlarda **tarih aralığı**, araç başına **₺/km**, isteğe bağlı **kiralama bedeli** dahil etme
- CSV dışa aktarma (ekrandaki arama/filtre uygulanmış haliyle), yazdır / PDF
- JSON yedek al / geri yükle, işlem geçmişi
- Mükerrer plaka engeli (boşluk farkı dahil), bağlı kaydı olan aracın silinmesini engelleme
- Masaüstünde: atomik dosya yazımı, günlük otomatik yedek (son 30 gün), tek pencere kilidi

---

## 1) Windows'ta masaüstü uygulaması olarak kullanma

### Hazır .exe ile (önerilen)
1. Bu sayfada sağdaki **Releases** bölümüne gir (yoksa **Actions → Windows sürümü derle → son çalışma → Artifacts**).
2. `AracFiloYonetimi-Kurulum-….exe` → kurulum yapar, masaüstüne kısayol koyar.
   `AracFiloYonetimi-Tasinabilir-….exe` → kurulumsuz çalışır (USB'de taşınabilir).
3. İlk açılışta Windows SmartScreen "Tanınmayan uygulama" diyebilir: **Ek bilgi → Yine de çalıştır**. (Kod imzalı olmadığı için normal.)

> **Ortak klasör / taşınabilir veri:** `.exe` dosyasının yanına `veri` adında bir klasör açarsan uygulama verileri oraya yazar.

### Kaynaktan çalıştırma (geliştirici)
```bash
git clone https://github.com/Dizayn17/arac-yonetim-kilavuzu.git
cd arac-yonetim-kilavuzu
npm install
npm start            # uygulamayı açar
npm run dist         # dist/ altına Windows .exe üretir
```
Gerekli: [Node.js 20+](https://nodejs.org)

### Yeni sürüm yayınlama
`package.json` içindeki `"version"` değerini artırıp push et, sonra **Actions → Windows sürümü derle → Run workflow**. GitHub Actions Windows'ta derler ve `.exe` dosyalarını o sürümün Release'ine ekler.

---

## 2) İnternet üzerinden çalıştırma

### A. GitHub Pages (ücretsiz, hazır)
`main` dalına her push'ta `app/` klasörü otomatik olarak yayınlanır:

**https://dizayn17.github.io/arac-yonetim-kilavuzu/**

İlk sefer için: **Settings → Pages → Source: GitHub Actions** seçili olmalı.

Supabase bağlıysa (`app/config.js` dolu) bu adresi açan herkes giriş yapıp aynı veritabanında çalışır.

### B. Şirket içi ağda (intranet)
`app/` klasörü tamamen statik dosyadır; IIS, nginx veya herhangi bir web sunucusuna kopyalanabilir:
```bash
npm run web      # http://localhost:8080 (test için)
```
Aynı veri paylaşımı kısıtı burada da geçerlidir.

### C. Ortak veritabanı (Supabase)
Herkesin aynı verilerle, kullanıcı adı/şifreyle çalışması için Supabase kurulumu yeterli: [docs/SUPABASE_KURULUM.md](docs/SUPABASE_KURULUM.md).

---

## Güvenlik ve veri notları

- Supabase modunda giriş zorunludur; erişim `filo_users` listesi ve satır düzeyi güvenlik (RLS) kurallarıyla sınırlanır. Yerel modda giriş yoktur.
- Sürücü telefonları, ehliyet, ceza ve kaza bilgileri **kişisel veridir (KVKK)**. Web sürümünü ortak/kamuya açık bilgisayarlarda kullanmayın; yedek dosyalarını yetkisiz erişime kapalı bir yerde saklayın.
- İçerik Güvenlik Politikası (CSP) uygulamanın yalnızca kendi dosyalarına ve Supabase'e bağlanmasına izin verir.

## Proje yapısı

```
app/            Web arayüzü (hem web hem masaüstü kullanır)
  index.html
  style.css
  config.js     Supabase bağlantı bilgileri (URL + anon key)
  storage.js    Depolama katmanı (Supabase / dosya / localStorage)
  vendor/       supabase-js istemci kütüphanesi
  modules.js    Modül ve alan tanımları
  app.js        Uygulama mantığı
main.js         Electron ana süreci
supabase/schema.sql  Veritabanı tabloları, yetkiler (RLS), denetim tetikleyicileri
preload.js      Arayüz ↔ dosya sistemi köprüsü
docs/           Kullanım kılavuzu
.github/workflows/
  pages.yml     Web sürümünü GitHub Pages'e yayınlar
  release.yml   Windows .exe derler
```

## Lisans
MIT
