# Morph

[![Morph Version](https://img.shields.io/badge/Morph-1.1.25-42C9D9?style=flat-square)](https://github.com/husedogan/morphmobile/releases)
[![Web & PWA (Vercel)](https://img.shields.io/badge/Web_%26_PWA-morphmobile.vercel.app-FF3B6B?style=flat-square)](https://morphmobile.vercel.app)
[![Android APK](https://img.shields.io/github/v/release/husedogan/morphmobile?label=APK%20Release&color=42C9D9&style=flat-square)](https://github.com/husedogan/morphmobile/releases)
[![Build Status](https://img.shields.io/github/actions/workflow/status/husedogan/morphmobile/build-apk.yml?branch=main&label=APK%20Build&style=flat-square)](https://github.com/husedogan/morphmobile/actions)

**Morph**, görsel, PDF, arşiv, video, ses ve belge dosyalarını cihaz içinde hızlı ve güvenli biçimde dönüştüren mobil stüdyo uygulamasıdır. Tüm dosya işlemleri orijinallerine dokunmadan doğrudan cihazında çalışır.

## İndirme ve Kurulum (Android APK & Web PWA)

### 1. Android APK (Doğrudan Kurulum)
- **GitHub Releases:** [`husedogan/morphmobile/releases`](https://github.com/husedogan/morphmobile/releases) sayfasından güncel imzalı `Morph-v*.apk` paketini indirip kurabilirsin.
- **Uygulama İçi Güncelleme:** **Ayarlar → Güncelleme** sekmesinden yeni sürümleri tek dokunuşla denetleyip doğrudan güncel APK paketini indirebilirsin.

### 2. Web & PWA (Vercel — Kurulumsuz Tarayıcı & Çevrimdışı Ana Ekran Uygulaması)
- **Canlı Adres:** **[https://morphmobile.vercel.app](https://morphmobile.vercel.app)**
- Morph, **Progressive Web App (PWA)** mimarisine sahiptir; APK kurmadan doğrudan tarayıcıda çalışır veya ana ekrana tam ekran uygulama olarak kurulup **çevrimdışı (offline)** kullanılabilir:
  - **Android (Chrome / Edge / Brave):** Siteyi açtıktan sonra uygulama içindeki **"Telefona Kur"** butonuna veya tarayıcı menüsünden **"Uygulamayı Yükle / Ana ekrana ekle"** seçeneğine dokun.
  - **iPhone & iPad (iOS Safari):** `morphmobile.vercel.app` adresini Safari ile aç, alt bardaki **Paylaş** simgesine dokun ve **"Ana Ekrana Ekle"** seçeneğini seç.
  - **Bilgisayar (Windows / macOS / Linux):** Chrome veya Edge adres çubuğunun sağındaki **Uygulamayı Yükle** simgesine tıklayarak masaüstü uygulaması olarak çalıştır.

## Temel Özellikler

- **Görsel Stüdyosu:** JPG, PNG, WEBP, GIF, ICO ve SVG dönüştürme, boyut küçültme, dokunmatik kırpma, renk & filtre ön ayarları, metin filigranı, belge tarama & netleştirme, sansür (mozaik/bulanıklık), kolaj, sosyal medya kadrajına sığdırma, vesikalık baskı dizilimi ve hareketli GIF oluşturma.
- **PDF & Belge İşlemleri:** PDF birleştirme, sayfa bölme/silme/sıralama, döndürme, optimize etme, Türkçe karakter destekli sayfa numarası & filigran ekleme, 2’li/4’lü baskı düzeni, PDF ↔ Görsel ve DOCX/XLSX/PPTX/HTML/TXT belge dönüştürme.
- **Video Editörü & Ses Araçları (Cihaz İçi):** Çok katmanlı (`V1` film şeridi + `A1` ses dalga formu + `T1` metin) canlı **Pro Video Editörü** (`kırpma`, `bölme`, `bulanık/kenarlıklı/doldur kadraj`, `yakınlaştırma`, `renk derecelendirme & LUT`, `metin katmanı`, `0.5×–2× hız`, `bumerang`, `geri sarma`, `döngü`, `görüntü/ses fade`, `ses mikseri`, `MP3 ayıklama`, `kare yakalama`) ve entegre FFmpeg motoruyla MP4/MOV/WEBM/MKV/GIF dönüştürme.
- **Bağlantı İndirici & Arşiv:** ZIP oluşturma/çıkarma; Dahili Motor, NewPipe Extractor, yt-dlp Yerel Motor ve Cobalt API desteği ile doğrudan bağlantıdan video, ses, kapak görseli ve dosya indirme; Wi-Fi koruma ve mobil veri sınırı seçenekleri.
- **Mobil Deneyim & Kişiselleştirme:** Köşe değiştirebilen özelleştirilebilir radyal çark menüsü, sistem/gündüz/gece modlu çoklu renk temaları, arayüz boyut ve köşe yumuşaklığı kaydırma ayarları, Türkçe/İngilizce dil desteği ve yerel işlem kitaplığı.

## Geliştirme Komutları

```bash
npm install
npm run dev          # Yerel geliştirme (http://localhost:3000)
npm run lint         # TypeScript kontrolü
npm run build        # Üretim derlemesi (dist/)
npm run android:sync # Web derleme + Android Capacitor ikon/sürüm eşitleme
```
