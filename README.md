# Morph

[![Morph Version](https://img.shields.io/badge/Morph-1.1.10-42C9D9?style=flat-square)](https://github.com/husodogan/morphmobilestudio/releases)
[![Android APK](https://img.shields.io/github/v/release/husodogan/morphmobilestudio?label=APK%20Release&color=42C9D9&style=flat-square)](https://github.com/husodogan/morphmobilestudio/releases)
[![Build Status](https://img.shields.io/github/actions/workflow/status/husodogan/morphmobilestudio/build-apk.yml?branch=main&label=APK%20Build&style=flat-square)](https://github.com/husodogan/morphmobilestudio/actions)

**Morph**, görsel, PDF, arşiv, video, ses ve belge dosyalarını cihaz içinde hızlı ve güvenli biçimde dönüştüren mobil stüdyo uygulamasıdır. Tüm dosya işlemleri orijinallerine dokunmadan doğrudan cihazında çalışır.

## İndirme ve Kurulum

- **Android APK:** [Releases](https://github.com/husodogan/morphmobilestudio/releases) sayfasından güncel `Morph-v*.apk` dosyasını indirip kurabilirsin.
- Uygulama içindeki **Ayarlar → Güncelleme** sekmesinden yeni sürümleri tek dokunuşla denetleyip indirebilirsin.

## Temel Özellikler

- **Görsel Stüdyosu:** JPG, PNG, WEBP, GIF, ICO ve SVG dönüştürme, boyut küçültme, dokunmatik kırpma, renk & filtre ön ayarları, metin filigranı, belge tarama & netleştirme, sansür (mozaik/bulanıklık), kolaj, sosyal medya kadrajına sığdırma, vesikalık baskı dizilimi ve hareketli GIF oluşturma.
- **PDF & Belge İşlemleri:** PDF birleştirme, sayfa bölme/silme/sıralama, döndürme, optimize etme, Türkçe karakter destekli sayfa numarası & filigran ekleme, 2’li/4’lü baskı düzeni, PDF ↔ Görsel ve DOCX/XLSX/PPTX/HTML/TXT belge dönüştürme.
- **Video & Ses Araçları (Cihaz İçi):** Entegre FFmpeg motoru ile MP4, MKV, MOV, WEBM, MP3, WAV ve AAC format dönüştürme, kesme, hız/ses/kanal ayarı.
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
