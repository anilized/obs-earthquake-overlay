# Türkiye Deprem Uyarı Overlay (EMSC Gerçek Zamanlı)

Bu proje, **EMSC (European-Mediterranean Seismological Centre)** verilerini kullanarak **Türkiye’de meydana gelen depremleri gerçek zamanlı** olarak tespit eder ve yayın sırasında **OBS üzerinden acil durum bildirimi** şeklinde gösterir.
  
> Kaynak: [EMSC Realtime WebSocket](https://www.seismicportal.eu/standing_order/websocket)

---

## Mimari (Java + React)

- `backend/`: Spring Boot 3 tabanlı Java servisi. EMSC WebSocket'ine bağlanır, verileri normalize eder ve frontend'e **Server-Sent Events (SSE)** ile yayınlar.
- `src/`: Vite + React arayüzü. OBS dock ve overlay bileşenleri bu klasörde yer alır; veri için Java servisindeki `/api/events/stream` endpoint'ini dinler. Build alındığında çıktılar otomatik olarak `backend/src/main/resources/static` altına düşer, böylece Spring Boot aynı pakette hem API'yi hem de UI'yı sunar.
- Tüm filtreleme (büyük deprem eşiği, coğrafi sınırlar), önbellekleme (son event ID'si) ve ayar yönetimi (tema, ses, stream aktifliği) backend üzerinde tutulur. Frontend yalnızca bu verileri görsel olarak sunar.
- İstemci tarafında herhangi bir token saklanmaz; kimlik doğrulama ve yeniden bağlanma akışı Java servisinde yürütülür.

---

## Yerel Geliştirme

Ön koşullar:
- Java 17+
- Maven 3.9+
- Node.js 18+

1. Bağımlılıkları yükle:
   ```bash
   npm install
   ```
2. Java servisinin ortam değişkenlerini ayarla (örnek için `backend/src/main/resources/application.yml` dosyasına bakabilirsin). En azından `EMSC_WS_URL` tanımlanmalı.
3. Backend'i başlat:
   ```bash
   mvn -f backend/pom.xml spring-boot:run
   ```
4. Frontend için `.env.dev` benzeri bir dosyada backend adresini belirt:
   ```
   VITE_BACKEND_URL=http://localhost:8080
   ```
5. Frontend'i çalıştır:
   ```bash
   npm run dev
   ```
   Bu komut React uygulamasını Vite üzerinden çalıştırır; API çağrıları arka uca gider. Üretim paketi oluşturmak için:
   ```bash
   npm run build
   ```
   Çıktılar `backend/src/main/resources/static` klasörüne yazılır ve Spring Boot jar dosyasına dahil edilir.

> Eğer farklı bir ortamda sadece frontend'i barındırmak istersen, backend'i uygun bir sunucuya deploy ederek `VITE_BACKEND_URL` değerini o sunucuya yönlendirmen yeterlidir. Tam entegre kurulumda ise Spring Boot build'i (`mvn package`) sonrasında tek jar hem UI'ı hem API'yi sunar.

## OBS Üzerinde Kullanım (Yayıncılar için)

### 1- Ayarlar Paneli (OBS Dock)

OBS menüsünde:  
**View → Docks → Custom Browser Docks...**

Yeni dock ekle:

- **Ad:** Deprem Uyarı Ayarları  
- **URL:**
  ```
  https://anilized.github.io/obs-earthquake-overlay/settings
  ```

Bu panel üzerinden:
- Minimum büyüklük (`Min Magnitude`)
- Ses dosyası (`Sound URL`)
- Beep (aç/kapat)
- Test uyarısı gönderme
- Tasarim ve renk secimleri
- Baglanti baslatip sonlandirma

ayarlarını yönetebilirsin.

### 2- Ana Overlay (Deprem Bildirimi)

OBS → **Kaynak Ekle → Tarayıcı (Browser Source)**  
Aşağıdaki URL’yi yapıştır:

```
https://anilized.github.io/obs-earthquake-overlay/overlay?size=800
```

> `size=800` değeri overlay’in kapladığı alanı belirtir.  
> Önerilen: `800` veya `1000` piksel.  
> Overlay şeffaftır, yalnızca deprem bildirimi geldiginde görünür.


---

## Test Uyarısı Gönderme

Ayarlar sayfasında **“Send Test”** butonuna basarak sahte bir deprem uyarısı oluşturabilirsin.  
Bu sayede overlay tasarımını veya ses dosyasını test edebilirsin.

---

## Ses Dosyası

- Varsayılan ses: `assets/default_alert.mp3`
- Kendi sesini eklemek istersen .mp3 veya wav uzantili herhangi bir link verebilirsin:

---

## Uyarı

Bu sistem yalnızca **yayın içi bilgilendirme** amaçlıdır.  
**Resmî uyarı veya afet bildirimi değildir.**

Kaynak veriler, IoT cihazlardan gelen veriler ile sağlanır.  
Resmî kurum uyarıları için [AFAD](https://deprem.afad.gov.tr/) veya [Kandilli Rasathanesi](http://www.koeri.boun.edu.tr/) kaynaklarını takip ediniz.

---

> **Katkıda bulunmak istersen:**  
> Pull Request açabilir veya GitHub Issues üzerinden fikirlerini paylaşabilirsin.

---

### Geliştirme Ortamı (.env.dev)

`npm run dev` komutu `--mode dev` ile çalışır ve `.env.dev` dosyasını yükler:

```
VITE_BACKEND_URL=http://localhost:8080
```

Gerekirse geliştirme sırasında farklı bir backend adresi verebilirsin. Eğer doğrudan EMSC WebSocket'ine bağlanmak istersen (örneğin Java servisiniz yoksa), `ws://` veya `wss://` ile başlayan bir URL verildiğinde istemci legacy WebSocket yolunu kullanmaya devam eder.

### Backend Ortam Değişkenleri

`backend` uygulaması aşağıdaki değişkenleri destekler:

| Değişken | Açıklama | Varsayılan |
| --- | --- | --- |
| `EMSC_WS_URL` | EMSC WebSocket adresi | _(zorunlu)_ |
| `EMSC_WS_BEARER` | Varsa Bearer token | boş |
| `EMSC_ALERT_TOPIC` | Abone olunacak topic adı | `earthquake_alerts` |
| `EMSC_ALERT_CLIENT_ID` | İstemci kimliği | `obs-overlay` |
| `EMSC_ALERT_SINCE_WINDOW_SEC` | Başlangıçta geçmiş kaç saniyeyi almak istediğin | `0` |
| `EMSC_ALERT_FIXED_TS` | Sabit timestamp ile başlatmak için epoch saniyesi | boş |
| `EMSC_WS_PING_SEC` | Heartbeat interval (sn) | `25` |
| `EMSC_LAST_EVENT_CACHE` | Son event ID'sinin tutulduğu dosya yolu | `backend-data/last-event.txt` |

Servis ayağa kalktığında `/api/events/stream` (SSE), `/api/events/latest` (REST) ve `/api/events/status` uç noktaları kullanılabilir hale gelir.

---
