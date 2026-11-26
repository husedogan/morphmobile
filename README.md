# Morph

[![Morph Version](https://img.shields.io/badge/Morph-1.1.53--beta-42C9D9?style=flat-square)](https://github.com/husedogan/morphmobile/releases)
[![Web & PWA (Vercel)](https://img.shields.io/badge/Web_%26_PWA-morphmobile.vercel.app-FF3B6B?style=flat-square)](https://morphmobile.vercel.app)
[![Android APK](https://img.shields.io/github/v/release/husedogan/morphmobile?label=APK%20Release&color=42C9D9&style=flat-square)](https://github.com/husedogan/morphmobile/releases)
[![Build Status](https://img.shields.io/github/actions/workflow/status/husedogan/morphmobile/build-apk.yml?branch=main&label=APK%20Build&style=flat-square)](https://github.com/husedogan/morphmobile/actions)

**Morph**, görsel, PDF, arşiv, video, ses ve belge dosyalarını cihaz içinde hızlı ve güvenli biçimde dönüştüren, düzenleyen ve yöneten çok yönlü mobil & web stüdyo uygulamasıdır. Tüm yerel dosya işlemleri orijinallerine dokunmadan doğrudan cihazında çalışır.

## İndirme ve Kurulum (Android APK & Web PWA)

### 1. Android APK (Doğrudan Kurulum)
- **GitHub Releases:** [`husedogan/morphmobile/releases`](https://github.com/husedogan/morphmobile/releases) sayfasından güncel imzalı `Morph-v*.apk` paketini indirip kurabilirsin.
- **Uygulama İçi Güncelleme:** **Ayarlar → Hakkında** bölümünden yeni sürümleri tek dokunuşla denetleyip doğrudan güncel APK paketini indirebilirsin.

### 2. Web & PWA (Vercel — Kurulumsuz Tarayıcı & Çevrimdışı Ana Ekran Uygulaması)
- **Canlı Adres:** **[https://morphmobile.vercel.app](https://morphmobile.vercel.app)**
- Morph, **Progressive Web App (PWA)** mimarisine sahiptir; APK kurmadan doğrudan tarayıcıda çalışır veya ana ekrana tam ekran uygulama olarak kurulup **çevrimdışı (offline)** kullanılabilir:
  - **Android (Chrome / Edge / Brave):** Siteyi açtıktan sonra uygulama içindeki **"Telefona Kur"** butonuna veya tarayıcı menüsünden **"Uygulamayı Yükle / Ana ekrana ekle"** seçeneğine dokun.
  - **iPhone & iPad (iOS Safari):** `morphmobile.vercel.app` adresini Safari ile aç, alt bardaki **Paylaş** simgesine dokun ve **"Ana Ekrana Ekle"** seçeneğini seç.
  - **Bilgisayar (Windows / macOS / Linux):** Chrome veya Edge adres çubuğunun sağındaki **Uygulamayı Yükle** simgesine tıklayarak masaüstü uygulaması olarak çalıştır.

## Öne Çıkan Özellikler

### Basit Mod & Gelişmiş Arayüz
- **Basit Mod (Sade Arayüz):** Uygulama fazla dolu geliyorsa **Ayarlar → Görünüm → Basit Mod** anahtarıyla tek dokunuşta sade görünüme geçebilirsin. Çark menüsü tamamen kapanır; altta yalnızca **Stüdyo** ve **Kitaplık** sekmeleri, üstte **Ayarlar**, ekranda ise sadece **Dosya Seç** ve **Bağlantıdan İndir** kartları kalır. Basit Mod’u kapattığında tüm gelişmiş ayarların aynen geri gelir.
- **Gelişmiş Arayüz & Tam Kontrol:** Köşe değiştirebilen özelleştirilebilir radyal çark menüsü, **Ayarlar → Gelişmiş** üzerinden modül görünürlüğü ve sıralaması, ana ekrandaki stüdyo şeritlerini tek dokunuşla gizleme, çoklu renk temaları ve Türkçe/İngilizce dil desteği.

### Bağlantı İndirici & Paralel Hızlandırıcı
- **Paralel HTTP Range İndirici (2×–8×) & Devam Önbelleği:** Doğrudan indirilebilir büyük dosyaları paralel parçalara bölerek hızlandırır; bağlantı kopsa bile parçaları yerel IndexedDB önbelleğinde saklayarak kaldığı yerden devam eder.
- **Otomatik Kategorileme Kuralları:** İndirilen dosyaları uzantı/türe göre (Video, Müzik, Belgeler, Arşivler, Görseller vb.) otomatik olarak Kitaplık klasörlerine yerleştirir.
- **Akıllı Medya İndirme:** Canlı önizleme kartı, çoklu bağlantı kuyruğu, **Akış Avcısı (Stream Sniffer)**, indirmeden önce kesit seçimi, SponsorBlock, altyazı/bölüm/ID3 gömme, çerez profili ve indirdikten sonra tek tıkla **Video Editör** veya **Ses Stüdyosu**’na aktarım.
- **Çoklu Motor Desteği:** Dahili Morph motoru, NewPipe Extractor, yt-dlp Yerel Motor ve Cobalt API desteği; Wi-Fi koruma ve mobil veri sınırı kontrolleri.

### Ses Stüdyosu (Cihaz İçi)
- Gerçek ses dalga formu üzerinde kırpma, **10-Bant Ekolayzır (EQ)** ve hazır ses profilleri, normalleştirme, dinamik kompresör, otomatik sessizlik kırpma ve **Ses Kaydedici**.

### Görsel Stüdyosu
- **Öncesi / Sonrası Kıyaslama**, **Hedef KB Boyutuna Akıllı Sıkıştırma**, **Arka Plan Temizleme**, EXIF/meta veri temizleme.
- JPG, PNG, WEBP, AVIF, GIF, ICO ve SVG dönüştürme; dokunmatik kırpma, renk/filtre ön ayarları, metin filigranı, belge tarama, sansürleme, kolaj, sosyal medya kadrajı, vesikalık baskı dizilimi ve hareketli GIF oluşturma.

### PDF, Arşiv Gezgini & Otomasyon Tarifleri
- **Görsel PDF Sayfa Düzenleyici:** Sayfaları küçük resimle önizle, sırayı değiştir, 90° döndür, sil ve sayfa numarası ekle.
- **PDF İmza & Sansürleme:** Parmakla/fareyle dijital imza çizip yerleştir, hassas alanlara kalıcı siyah sansür şeridi çek ve koruma üstverisi ekle.
- **Akıllı ZIP Arşiv Gezgini:** Arşivleri çıkarmadan içeriğini görsel/metin olarak önizle, yalnızca seçili dosyaları çıkar veya mevcut ZIP’e yeni dosya ekle.
- **Otomasyon Tarif Zincirleri (Pipelines):** Birden fazla görsel/dönüşüm adımını tek tıkla arka arkaya çalıştır; sonuç ekranından çıktıları doğrudan başka bir araca zincirle.
- PDF birleştirme, bölme, optimize etme, 2’li/4’lü baskı düzeni ve DOCX/XLSX/PPTX/HTML/CSV/JSON/TXT belge dönüştürme.

### Video Editörü (Cihaz İçi)
- Çok katmanlı (`V1` film şeridi + `A1` ses dalga formu + `T1` metin) canlı **Video Editörü**: kırpma, bölme, kadraj/bulanık dolgu, yakınlaştırma, renk derecelendirme, metin katmanı, 0.5×–2× hız, bumerang, ters çevirme, döngü, görüntü/ses fade, ses mikseri, MP3 ayıklama ve kare yakalama; entegre FFmpeg motoruyla MP4/MOV/WEBM/MKV/GIF dışa aktarımı.

### Kitaplık & Depolama Yönetimi
- Görsel depolama dağılım özeti, 7+ günden eski dosyaları tek tıkla temizleme, renkli proje klasörleri, çoklu seçimle tek tıkta ZIP dışa aktarımı ve uygulama içi görsel/video/ses/PDF önizleme.

## Son Değişiklikler (v1.1.49 Beta)

- **Armadillo Sinema Çarkı & Tam Ekran İyileştirmeleri:** Alt araç çubuğu zaman çizelgesine yaklaşınca kaymadan dönerek köşe Sinema Çarkı’na katlanır; yuvarlanırken arkası tamamen şeffaftır. Tam ekran önizlemede alttaki düz çubuk gizlenir, oynatma kontrollerinin üstünde Sinema Çarkı açılır. Deneysel ayarlara **Tam Önizlemede Çarkı Gizle** ve **Oynatırken Çarkı Gizle** seçenekleri ayrı ayrı eklendi.
- **Akıllı Alt Sınır Kilidi (0,5 sn Basılı Tut):** Önizlemeyi aşağı çekerken mevcut satırların (V/T/W/A) yarım kesilmesini önleyen dinamik alt sınır ve **0,5 saniye (50 salise) basılı tutarak** açılan kilit simgesi eklendi.
- **Çok Satırlı Normal Video & PiP Ayrımı (V1–V5):** Bölünmüş veya çoğaltılmış videolar artık doğrudan `V1` altındaki `V2–V5` satırlarına sürüklenebilir, otomatik PiP’e dönüşmeden **normal tam ekran video** olarak oynatılır ve varsayılan olarak üstteki videolarla çakışmaz. Klip paneli ve `...` menüsüne **Normal Video / PiP** geçişi ile **Alt Satır Video Çakışma Engeli** ayarı eklendi.
- **Zaman Çizelgesi Netliği:** `+` hızlı ekleme butonu üst araç çubuğuna taşındı, dar kliplerde süre/`...`/sessiz simgesi çakışmaları giderildi, beyaz imleç çizgisi son satırın hemen altında bitecek şekilde hizalandı.

## Geliştirme Komutları

```bash
npm install
npm run dev          # Yerel geliştirme (http://localhost:3000)
npm run lint         # TypeScript kontrolü
npm run build        # Üretim derlemesi (dist/)
npm run android:sync # Web derleme + Android Capacitor ikon/sürüm eşitleme
```
