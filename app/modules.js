'use strict';
/*
 * Modül ve alan tanımları.
 * Alan: { key, label, type, required, options, list }
 *   type: text | number | date | select | vehicle | driver | textarea
 *   list: true ise kayıt tablosunda sütun olarak gösterilir
 */
(function () {
  const F = (key, label, type = 'text', extra = {}) => ({ key, label, type, ...extra });
  const S = (key, label, options, extra = {}) => F(key, label, 'select', { options: options.split('|'), ...extra });

  const MODULES = [
    { id: 'vehicles', group: 'Filo', name: 'Araç Kartları', icon: '🚙', title: r => r.plate, fields: [
      F('plate', 'Plaka', 'text', { required: true, list: true }),
      F('brand', 'Marka', 'text', { required: true, list: true }),
      F('model', 'Model', 'text', { required: true, list: true }),
      F('modelDetail', 'Model Detayı'),
      F('year', 'Model Yılı', 'number'),
      S('type', 'Araç Tipi', 'Binek|Ticari|Otomobil|Hafif Ticari|Kamyonet|Kamyon|Minibüs|Diğer', { list: true }),
      S('ownership', 'Mülkiyet', 'Şirket|Kiralık'),
      F('branch', 'Bölge / Şube', 'text', { list: true }),
      F('usingCompany', 'Kullanan Firma'),
      F('regOwner', 'Ruhsat Sahibi'),
      F('regDate', 'Tescil Tarihi', 'date'),
      F('licenseSerial', 'Ruhsat Seri No'),
      F('vin', 'Şasi Numarası'),
      S('fuel', 'Yakıt Türü', 'Benzin|Dizel|LPG|Hibrit|Elektrik'),
      F('fuelCard', 'Akaryakıt Firması'),
      F('km', 'Güncel KM', 'number', { list: true }),
      S('status', 'Durum', 'Aktif|Boşta|Serviste|Pasif|Pert|Satıldı', { list: true }),
      F('statusDetail', 'Durum Detayı'),
      F('notes', 'Açıklama', 'textarea')
    ]},
    { id: 'assignments', group: 'Filo', name: 'Araç Zimmet Yönetimi', icon: '📝', fields: [
      F('vehicle', 'Araç', 'vehicle', { required: true, list: true }),
      F('person', 'Personel', 'driver', { required: true, list: true }),
      F('start', 'Teslim Tarihi', 'date', { required: true, list: true, defaultToday: true }),
      F('end', 'İade Tarihi', 'date', { list: true }),
      F('km', 'Teslim KM', 'number'),
      F('returnKm', 'İade KM', 'number'),
      F('fuelLevel', 'Yakıt Seviyesi (%)', 'number'),
      F('equipment', 'Teslim Edilen Ekipman'),
      F('condition', 'Hasar / Teslim Notu', 'textarea'),
      S('status', 'Durum', 'Aktif|İade Edildi', { list: true })
    ]},
    { id: 'drivers', group: 'Filo', name: 'Personel ve Sürücüler', icon: '👤', title: r => r.name, fields: [
      F('name', 'Ad Soyad', 'text', { required: true, list: true }),
      F('sicil', 'Sicil No', 'text', { list: true }),
      F('title', 'Görevi'),
      F('branch', 'Bölge / Şube', 'text', { list: true }),
      F('license', 'Ehliyet Sınıfı', 'text', { list: true }),
      F('licenseEnd', 'Ehliyet Bitiş', 'date', { list: true }),
      F('srcEnd', 'SRC Bitiş', 'date'),
      F('phone', 'Telefon'),
      S('status', 'Durum', 'Aktif|Pasif', { list: true })
    ]},
    { id: 'documents', group: 'Takip', name: 'Belge ve Süre Takibi', icon: '📄', fields: [
      F('vehicle', 'Araç', 'vehicle', { required: true, list: true }),
      S('type', 'Belge Türü', 'Muayene|Trafik Sigortası|Kasko|Egzoz Emisyon|Ruhsat|Diğer', { list: true }),
      F('number', 'Belge Numarası', 'text', { list: true }),
      F('start', 'Başlangıç', 'date'),
      F('end', 'Bitiş Tarihi', 'date', { required: true, list: true }),
      F('provider', 'Kurum'),
      F('notes', 'Açıklama / Dosya Referansı', 'textarea')
    ]},
    { id: 'insurance', group: 'Takip', name: 'Trafik Sigortası ve Kasko', icon: '🛡️', cost: 'Sigorta', fields: [
      F('vehicle', 'Araç', 'vehicle', { required: true, list: true }),
      S('type', 'Poliçe Türü', 'Trafik Sigortası|Kasko', { list: true }),
      F('policy', 'Poliçe No'),
      F('company', 'Sigorta Şirketi', 'text', { list: true }),
      F('agent', 'Acente'),
      F('start', 'Başlangıç', 'date'),
      F('end', 'Bitiş', 'date', { required: true, list: true }),
      F('amount', 'Prim (₺)', 'number', { list: true, money: true }),
      S('status', 'Durum', 'Aktif|Yenilenecek|Sona Erdi')
    ]},
    { id: 'fuel', group: 'Operasyon', name: 'Yakıt Yönetimi', icon: '⛽', cost: 'Yakıt', fields: [
      F('vehicle', 'Araç', 'vehicle', { required: true, list: true }),
      F('date', 'İşlem Tarihi', 'date', { required: true, list: true, defaultToday: true }),
      F('station', 'İstasyon'),
      F('liters', 'Litre', 'number', { required: true, list: true }),
      F('unitPrice', 'Birim Fiyat (₺)', 'number'),
      F('amount', 'Toplam Tutar (₺)', 'number', { list: true, money: true, hint: 'Boş bırakılırsa litre × birim fiyat hesaplanır.' }),
      F('km', 'Kilometre', 'number', { hint: 'Araç kartındaki güncel KM bundan küçükse otomatik güncellenir.' }),
      F('notes', 'Açıklama', 'textarea')
    ]},
    { id: 'maintenance', group: 'Operasyon', name: 'Bakım ve Servis', icon: '🔧', cost: 'Bakım', fields: [
      F('vehicle', 'Araç', 'vehicle', { required: true, list: true }),
      F('date', 'Bakım Tarihi', 'date', { required: true, list: true, defaultToday: true }),
      F('type', 'Bakım / Arıza Türü', 'text', { required: true, list: true }),
      F('service', 'Servis'),
      F('km', 'Bakım KM', 'number'),
      F('nextKm', 'Sonraki Bakım KM', 'number', { hint: 'Araç KM bu değere yaklaşınca uyarı verilir.' }),
      F('nextDate', 'Sonraki Bakım Tarihi', 'date'),
      F('amount', 'Tutar (₺)', 'number', { list: true, money: true }),
      S('status', 'Durum', 'Planlandı|Devam Ediyor|Tamamlandı', { list: true }),
      F('notes', 'Parça / İşçilik Açıklaması', 'textarea')
    ]},
    { id: 'tires', group: 'Operasyon', name: 'Lastik Yönetimi', icon: '🛞', cost: 'Lastik', fields: [
      F('vehicle', 'Araç', 'vehicle', { required: true, list: true }),
      F('brand', 'Marka', 'text', { list: true }),
      F('size', 'Ebat', 'text', { list: true }),
      S('season', 'Tip', 'Yazlık|Kışlık|Dört Mevsim', { list: true }),
      F('dot', 'DOT'),
      F('date', 'Takma Tarihi', 'date'),
      F('removeDate', 'Sökme Tarihi', 'date'),
      F('km', 'KM', 'number'),
      F('amount', 'Tutar (₺)', 'number', { list: true, money: true }),
      F('notes', 'Depo / Diş Derinliği', 'textarea')
    ]},
    { id: 'accidents', group: 'Operasyon', name: 'Hasar ve Kaza', icon: '🚨', fields: [
      F('vehicle', 'Araç', 'vehicle', { required: true, list: true }),
      F('date', 'Kaza Tarihi', 'date', { required: true, list: true }),
      F('driver', 'Sürücü', 'driver', { list: true }),
      F('location', 'Konum'),
      F('fault', 'Kusur (%)', 'number'),
      F('fileNo', 'Hasar Dosyası'),
      F('amount', 'Onarım Tutarı (₺)', 'number', { list: true, money: true }),
      F('recovery', 'Sigorta Tahsilatı (₺)', 'number'),
      S('status', 'Durum', 'Açık|Eksperde|Serviste|Kapandı', { list: true }),
      F('notes', 'Açıklama', 'textarea')
    ]},
    { id: 'fines', group: 'Operasyon', name: 'Trafik Cezaları', icon: '🚦', cost: 'Ceza', fields: [
      F('vehicle', 'Araç', 'vehicle', { required: true, list: true }),
      F('date', 'Ceza Tarihi', 'date', { required: true, list: true }),
      F('driver', 'Sürücü', 'driver', { list: true }),
      F('type', 'Ceza Türü'),
      F('amount', 'Ceza Tutarı (₺)', 'number', { list: true, money: true }),
      F('noticeDate', 'Tebliğ Tarihi', 'date'),
      F('due', 'Son Ödeme Tarihi', 'date'),
      S('status', 'Ödeme Durumu', 'Ödenmedi|Ödendi|İtiraz Edildi', { list: true }),
      F('notes', 'Açıklama', 'textarea')
    ]},
    { id: 'hgs', group: 'Operasyon', name: 'HGS ve Otoyol Giderleri', icon: '🛣️', cost: 'HGS', fields: [
      F('vehicle', 'Araç', 'vehicle', { required: true, list: true }),
      F('date', 'İşlem Tarihi', 'date', { required: true, list: true, defaultToday: true }),
      F('tag', 'HGS Etiket No'),
      S('type', 'İşlem Türü', 'Geçiş|Yükleme|İhlalli Geçiş', { list: true }),
      F('route', 'Güzergâh', 'text', { list: true }),
      F('amount', 'Tutar (₺)', 'number', { list: true, money: true }),
      F('notes', 'Açıklama', 'textarea')
    ]},
    { id: 'leasing', group: 'Sözleşme', name: 'Kiralama ve Leasing', icon: '📑', fields: [
      F('vehicle', 'Araç', 'vehicle', { required: true, list: true }),
      F('company', 'Kiralama Firması', 'text', { required: true, list: true }),
      F('contract', 'Sözleşme No'),
      F('start', 'Başlangıç', 'date'),
      F('end', 'Bitiş', 'date', { required: true, list: true }),
      F('monthly', 'Aylık Kira (₺)', 'number', { list: true, money: true }),
      F('kmLimit', 'KM Limiti', 'number'),
      F('overage', 'KM Aşım Bedeli (₺)', 'number'),
      F('deposit', 'Depozito (₺)', 'number'),
      S('status', 'Durum', 'Aktif|Bitti|İptal', { list: true })
    ]},
    { id: 'purchases', group: 'Sözleşme', name: 'Satın Alma ve Araç Satışı', icon: '🛒', fields: [
      F('vehicle', 'Araç', 'vehicle', { list: true }),
      F('date', 'İşlem Tarihi', 'date', { required: true, list: true }),
      S('type', 'İşlem Türü', 'Satın Alma|Satış|Devir', { list: true }),
      F('party', 'Firma / Alıcı'),
      F('amount', 'Tutar (₺)', 'number', { list: true, money: true }),
      S('status', 'Durum', 'Talep|Onay Bekliyor|Tamamlandı', { list: true }),
      F('notes', 'Açıklama', 'textarea')
    ]},
    { id: 'vendors', group: 'Sözleşme', name: 'Tedarikçi ve Sözleşmeler', icon: '🏢', title: r => r.name, fields: [
      F('name', 'Tedarikçi Adı', 'text', { required: true, list: true }),
      S('category', 'Kategori', 'Servis|Sigorta|Kiralama|Yakıt|Lastik|Diğer', { list: true }),
      F('contact', 'Yetkili', 'text', { list: true }),
      F('phone', 'Telefon', 'text', { list: true }),
      F('email', 'E-posta'),
      F('contractEnd', 'Sözleşme Bitiş', 'date', { list: true }),
      F('notes', 'Notlar', 'textarea')
    ]},
    { id: 'tasks', group: 'Yönetim', name: 'Görev ve İş Akışı', icon: '✅', title: r => r.title, fields: [
      F('title', 'Görev / Talep', 'text', { required: true, list: true }),
      F('vehicle', 'İlgili Araç', 'vehicle', { list: true }),
      F('owner', 'Sorumlu', 'text', { list: true }),
      F('date', 'Oluşturma Tarihi', 'date', { defaultToday: true }),
      F('due', 'Son Tarih', 'date', { list: true }),
      S('priority', 'Öncelik', 'Düşük|Orta|Yüksek|Kritik', { list: true }),
      S('status', 'Durum', 'Açık|Devam Ediyor|Onay Bekliyor|Tamamlandı', { list: true }),
      F('notes', 'Notlar', 'textarea')
    ]},
    { id: 'costs', group: 'Yönetim', name: 'Maliyet ve Bütçe', icon: '💰', cost: 'Diğer', fields: [
      F('vehicle', 'Araç', 'vehicle', { required: true, list: true }),
      F('date', 'Tarih', 'date', { required: true, list: true, defaultToday: true }),
      S('type', 'Gider Türü', 'Kira|Vergi|Otopark|Yıkama|Diğer', { list: true }),
      F('amount', 'Tutar (₺)', 'number', { required: true, list: true, money: true }),
      F('budget', 'Bütçe (₺)', 'number'),
      F('notes', 'Açıklama', 'textarea')
    ]}
  ];

  // Özel sayfalar (kayıt formu olmayan)
  const PAGES = [
    { id: 'reports', group: 'Yönetim', name: 'Raporlama ve Analiz', icon: '📊' },
    { id: 'alerts', group: 'Yönetim', name: 'Bildirim ve Hatırlatmalar', icon: '🔔' },
    { id: 'settings', group: 'Yönetim', name: 'Ayarlar', icon: '⚙️' }
  ];

  window.MODULES = MODULES;
  window.PAGES = PAGES;
})();
