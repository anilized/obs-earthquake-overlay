# Türkiye Deprem Uyarı Overlay (EMSC Gerçek Zamanlı)

Bu proje, **EMSC (European-Mediterranean Seismological Centre)** verilerini kullanarak **Türkiye’de meydana gelen depremleri gerçek zamanlı** olarak tespit eder ve yayın sırasında **OBS üzerinden acil durum bildirimi** şeklinde gösterir.
  
> Kaynak: [EMSC Realtime WebSocket](https://www.seismicportal.eu/standing_order/websocket)

---

## 🚀 OBS Üzerinde Kullanım (Yayıncılar için)

### 1- Ayarlar Paneli (OBS Dock)

OBS menüsünde:  
**View → Docks → Custom Browser Docks...**

Yeni dock ekle:

- **Ad:** Deprem Uyarı Ayarları  
- **URL:**
  ```
  https://anilcan.github.io/deprem-overlay/#/settings
  ```

Bu panel üzerinden:
- Minimum büyüklük (`Min Magnitude`)
- Ses dosyası (`Sound URL`)
- Beep (aç/kapat)
- Test uyarısı gönderme

ayarlarını yönetebilirsin.

### 2- Ana Overlay (Deprem Bildirimi)

OBS → **Kaynak Ekle → Tarayıcı (Browser Source)**  
Aşağıdaki URL’yi yapıştır:

```
https://anilcan.github.io/deprem-overlay/#/overlay?size=800
```

> `size=800` değeri overlay’in kapladığı alanı belirtir.  
> Önerilen: `800` veya `1000` piksel.  
> Overlay şeffaftır, yalnızca deprem olduğunda görünür.


---

## Test Uyarısı Gönderme

Ayarlar sayfasında **“Send Test”** butonuna basarak sahte bir deprem uyarısı oluşturabilirsin.  
Bu sayede overlay tasarımını veya ses dosyasını test edebilirsin.

---

## Ses Dosyası

- Varsayılan ses: `assets/default_alert.mp3`
- Kendi sesini eklemek istersen .mp3 uzantili herhangi bir link verebilirsin:
     ```
     assets/senin_sesin.mp3
     ```
  3. Kaydet → Test → Ses çalacaktır

---

## ⚡ Geliştirici Notları

| Özellik | Teknoloji |
|----------|------------|
| Arayüz | React + TypeScript + Tailwind |
| Gerçek Zamanlı Veri | EMSC WebSocket |
| Şehir Bilgisi | BigDataCloud Reverse Geocode API |
| Barındırma | GitHub Pages |
| Tarayıcı Uyumlu | ✅ OBS (Chromium tabanlı) |

---

## ⚠️ Uyarı

Bu sistem yalnızca **yayın içi bilgilendirme** amaçlıdır.  
**Resmî uyarı veya afet bildirimi değildir.**

Kaynak veriler, **EMSC** tarafından sağlanır.  
Resmî kurum uyarıları için [AFAD](https://deprem.afad.gov.tr/) veya [Kandilli Rasathanesi](http://www.koeri.boun.edu.tr/) kaynaklarını takip ediniz.

---

## 💬 Geri Bildirim / İletişim

**Geliştirici:** [Anıl Can](https://github.com/anilcan)  
🎥 **Kick / Twitch:** [kick.com/anildev](https://kick.com/anildev)  
📧 **E-posta:** —  

---

> 🧡 **Katkıda bulunmak istersen:**  
> Pull Request açabilir veya GitHub Issues üzerinden fikirlerini paylaşabilirsin.
