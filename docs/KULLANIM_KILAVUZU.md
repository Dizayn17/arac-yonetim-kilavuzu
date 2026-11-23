# Araç Filo Yönetimi — Kullanım Kılavuzu

**Sürüm:** 1.0 (Windows masaüstü + web)

---

## 1. İlk kullanım

1. Uygulamayı açın (masaüstü kısayolu veya web adresi).
2. **Araç Kartları → + Yeni Kayıt** ile araçlarınızı girin. Diğer modüllerdeki "Araç" listesi buradan dolar; araç eklenmeden o modüllerde kayıt açılamaz.
3. **Personel ve Sürücüler** bölümüne sürücüleri girin. Zimmet, ceza ve kaza formlarındaki sürücü alanı bu listeden öneri getirir.
4. **Ayarlar ve Yedekleme** ekranında şirket adını, uyarı gün eşiğini ve bakım KM eşiğini ayarlayın.

## 2. Verileriniz nerede?

| | Masaüstü (Windows) | Web |
|---|---|---|
| Konum | `Belgeler\AracFiloYonetimi\filo-veri.json` | Tarayıcının yerel depolaması |
| Otomatik yedek | Her gün, son 30 gün (`yedekler\` klasörü) | Yok, elle JSON yedeği alın |
| Risk | Dosya silinirse yedekten dönülür | Tarayıcı verisi temizlenirse kayıtlar kaybolur |

Masaüstünde **Dosya → Veri klasörünü aç** ile dosyaya ulaşabilirsiniz. Web sürümünde, 7 günden uzun süre yedek alınmazsa Gösterge Paneli sizi uyarır.

## 3. Genel işlemler

- **+ Yeni Kayıt**: Formu açar. Yıldızlı (*) alanlar zorunludur.
- **Düzenle / Sil**: Her satırın sonundaki düğmeler. Silme işlemi onay ister.
- **Arama ve araç filtresi**: Listeyi daraltır. **Temizle** sıfırlar.
- **Sütun başlığına tıklama**: O sütuna göre sıralar (tekrar tıklayınca ters sıralar).
- **CSV**: Ekranda **görünen** kayıtları Excel'de açılabilir CSV olarak indirir. Filtre yoksa düğme "Tümünü CSV" yazar.
- **Esc** tuşu formu kapatır.

## 4. Modüller

| Modül | Ne girilir |
|---|---|
| Araç Kartları | Plaka, marka, model, yıl, tip, mülkiyet, şube, şasi, yakıt, KM, durum |
| Araç Zimmet | Araç, personel, teslim/iade tarihi ve KM'si, yakıt seviyesi, ekipman, hasar notu |
| Personel ve Sürücüler | Ad soyad, şube, ehliyet sınıfı/bitişi, SRC bitişi, telefon |
| Belge ve Süre Takibi | Muayene, egzoz, ruhsat vb. belge ve bitiş tarihi |
| Trafik Sigortası ve Kasko | Poliçe, şirket, acente, başlangıç/bitiş, prim |
| Yakıt Yönetimi | Tarih, istasyon, litre, birim fiyat, tutar, KM |
| Bakım ve Servis | Bakım türü, servis, KM, sonraki bakım KM/tarihi, tutar |
| Lastik Yönetimi | Marka, ebat, sezon, DOT, takma/sökme, KM, tutar |
| Hasar ve Kaza | Tarih, sürücü, konum, kusur %, dosya no, onarım, sigorta tahsilatı |
| Trafik Cezaları | Tarih, sürücü, tür, tutar, tebliğ ve son ödeme tarihi |
| HGS ve Otoyol | Etiket, işlem türü, güzergâh, tutar |
| Kiralama ve Leasing | Firma, sözleşme, başlangıç/bitiş, aylık kira, KM limiti |
| Satın Alma ve Satış | İşlem türü, karşı taraf, tutar, durum |
| Tedarikçi ve Sözleşmeler | Firma, kategori, yetkili, iletişim, sözleşme bitişi |
| Görev ve İş Akışı | Görev, araç, sorumlu, son tarih, öncelik, durum |
| Maliyet ve Bütçe | Kira, vergi, otopark, yıkama vb. diğer giderler |

### Otomatik hesaplamalar
- **Yakıt:** Toplam tutar boşsa `litre × birim fiyat` hesaplanır (ör. 40 L × 48 ₺ = 1.920 ₺).
- **KM güncelleme:** Yakıt, bakım veya zimmet kaydındaki KM, araç kartındaki KM'den büyükse araç kartı güncellenir.
- **Plaka:** Büyük harfe çevrilir. Aynı plaka (boşluk farkı olsa da) ikinci kez kaydedilemez.

## 5. Uyarılar

**Bildirim ve Hatırlatmalar** ekranı ve soldaki kırmızı rozet şunları gösterir:

- Belge, sigorta/kasko, aktif kiralama sözleşmesi bitişleri
- Aktif sürücülerin ehliyet ve SRC bitişleri
- Tedarikçi sözleşme bitişleri
- Tamamlanmamış görevlerin son tarihleri
- Ödenmemiş cezaların son ödeme tarihleri
- **Bakım:** Her aracın en son bakım kaydındaki *sonraki bakım tarihi* ve *sonraki bakım KM*'si

Tarih eşiği varsayılan olarak 30 gün, KM eşiği 1.000 km'dir; Ayarlar'dan değiştirilebilir. Uyarılar sadece uygulama içinde görünür. **E-posta veya SMS gönderilmez**, uygulamayı düzenli açmayı alışkanlık haline getirin.

## 6. Raporlar

- **Gider türleri** ve **araç bazlı toplam maliyet** (₺/km dahil) gösterilir.
- Üstteki tarih alanlarıyla **dönem seçebilirsiniz** (ör. yalnızca bu yıl).
- Dahil edilen giderler: Yakıt, Bakım, Lastik, Sigorta primi, Ceza, HGS, Maliyet ve Bütçe.
- Kiralama bedelleri varsayılan olarak dahil değildir. Ayarlar'dan açılırsa `aylık kira × ay` olarak hesaplanır.
- Satın alma/satış tutarları ve hasar onarımları toplam maliyete dahil edilmez.
- Aynı gideri iki modüle girmeyin (ör. sigorta primini hem Sigorta'ya hem Maliyet'e). Aksi halde rapor bunu iki kez toplar.
- **Maliyet CSV** ve **Yazdır / PDF** ile dışa aktarabilirsiniz.

## 7. Excel'den araç listesi aktarma

**Araç Kartları → 📥 Excel'den Aktar** (veya Ayarlar → Veri Yönetimi). Yalnızca yönetici kullanabilir.

1. Araç listesi Excel dosyasını seçin. Her ay ayrı sayfa olabilir; en yeni (son) sayfa otomatik seçilir, isterseniz başka ayı seçebilirsiniz.
2. Ön izlemede kaç aracın yeni, güncellenecek ve değişmeyen olduğunu görürsünüz. Araçla birlikte muayene tarihleri, sürücüler, zimmetler, kiralama sözleşmeleri ve satışlar da aktarılır; istemediklerinizin işaretini kaldırın.
3. **İçe Aktar** ile onaylayın.

Kurallar:
- Eşleşme **plakaya** göre yapılır. Aynı dosyayı tekrar yüklemek kopya oluşturmaz; sadece değişen kayıtlar yazılır.
- Excel'de boş bırakılan alan sistemdeki mevcut bilgiyi silmez. KM geriye gitmez.
- Kullanıcısı değişen aracın eski zimmeti "İade Edildi" olarak kapatılır, yeni zimmet açılır. Satılmış/pert araçlara zimmet açılmaz.
- Sistemde olup dosyada olmayan araçlara dokunulmaz (ön izlemede listelenir).
- Durum eşleştirmesi: KULLANIMDA → Aktif, SATILDI → Satıldı, SANCAKTEPE / BOŞTA → Boşta, PERTE ÇIKTI → Pert, İade edildi → Pasif. Excel'deki asıl yazı "Durum Detayı" alanında saklanır.
- Özmal → Şirket, Kiralık → Kiralık. Yakıt türü MODEL DETAYI içindeki "Dizel / Benzin / Hibrit" ifadesinden tahmin edilir.

## 8. Yedekleme ve geri yükleme

- **JSON Yedeği İndir:** Tüm kayıtları, ayarları ve işlem geçmişini tek dosyada indirir.
- **JSON Yedeği Yükle:** Yüklemeden önce yedekteki kayıt sayısını gösterir. Onay verirseniz **mevcut tüm veriler yedekle değiştirilir** (birleştirme yapılmaz).
- **Tüm Verileri Sıfırla:** Devam etmek için `SİL` yazmanız istenir. Önce yedek alın.
- Masaüstünde günlük yedekler `yedekler` klasöründedir. Bir günlük dosyayı **JSON Yedeği Yükle** ile geri yükleyebilirsiniz.

## 8. Sınırlar ve güvenlik

- Kullanıcı girişi, şifre ve yetki sistemi **yoktur**.
- Birden fazla kişinin aynı verilerle eşzamanlı çalışması desteklenmez (web sürümünde herkesin verisi kendi tarayıcısındadır).
- Belge alanına dosya yüklenemez. Dosya yolu veya referans numarası yazın.
- Sürücü ve personel bilgileri KVKK kapsamında kişisel veridir. Yedek dosyalarını yetkisiz erişime kapalı bir klasörde saklayın.

## 9. Sık karşılaşılan durumlar

| Durum | Çözüm |
|---|---|
| "Önce araç ekleyin" uyarısı | Araç Kartları'na en az bir araç girin. |
| Plaka kaydedilmiyor | Bu plaka zaten kayıtlı; mevcut kartı arayın. |
| Araç silinemiyor | Araca bağlı kayıtlar var. Ya o kayıtları silin ya da aracın durumunu "Pasif / Satıldı" yapın. |
| Uyarı görünmüyor | Bitiş tarihini, eşik gün sayısını ve kaydın durumunu (ör. "Tamamlandı", "Ödendi") kontrol edin. |
| Başka bilgisayarda kayıtlar yok | Eski yerde JSON yedeği indirin, yeni yerde yükleyin. |
| Yanlışlıkla silindi | Masaüstü: `yedekler` klasöründen dünkü dosyayı yükleyin. Web: son JSON yedeğini yükleyin. |

## 10. Önerilen çalışma düzeni

- **Her gün:** Gösterge Paneli ve Bildirimler'i kontrol edin; yakıt, servis, ceza, HGS, zimmet ve görevleri işleyin.
- **Her hafta:** Belge/poliçe bitişlerini, bakım planını ve giderleri gözden geçirin. Web kullanıyorsanız JSON yedeği alın.
- **Her ay:** Raporlar'dan dönem seçip maliyet CSV'sini arşivleyin.
