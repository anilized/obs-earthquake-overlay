# Türkiye Deprem Uyarı Overlay (EMSC Gerçek Zamanlı)

Bu proje, **EMSC (European-Mediterranean Seismological Centre)** verilerini kullanarak **Türkiye’de meydana gelen depremleri gerçek zamanlı** olarak tespit eder ve yayın sırasında **OBS üzerinden acil durum bildirimi** şeklinde gösterir.
  
> Kaynak: [EMSC Realtime WebSocket](https://www.seismicportal.eu/standing_order/websocket)

---

## OBS Üzerinde Kullanım (Yayıncılar için)

### 1- Ayarlar Paneli (OBS Dock)

OBS menüsünde:  
**View → Docks → Custom Browser Docks...**

Yeni dock ekle:

- **Ad:** Deprem Uyarı Ayarları  
- **URL:**
  ```
  https://anilized.github.io/obs-earthquake-overlay/#/settings
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
https://anilized.github.io/obs-earthquake-overlay/#/overlay?size=800
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
VITE_EMSC_WS_URL=ws://example-websocket-address
```

Gerekirse geliştirme sırasında farklı bir WS adresi verebilirsin.

---

### Production (Vercel) Üzerinde Güvenli WS Proxy (wss → ws)

Canlı ortam HTTPS çalıştığı için tarayıcı, `ws://` (güvensiz) hedefe doğrudan bağlanmayı engeller. Bu repo içinde, Vercel Edge Function ile bir WS proxy eklendi:

- Edge Function: `api/ws-proxy.ts`
- Route: `/ws` → dış `ws://` hedefe köprü
- `vercel.json` içinde `/ws` bu Edge Function'a yönlenir.
- Üretimde `.env.prod` şu şekilde ayarlı: `VITE_EMSC_WS_URL=/ws`

Kullanım: Frontend tarafı göreceli `/ws`'e bağlanır; tarayıcı sayfası HTTPS ise WebSocket otomatik olarak `wss://.../ws` olarak açılır ve proxy dıştaki `ws://...` hedefe iletir.

 Hedef dış WS adresini Vercel ortam değişkeni olarak ayarla:

```
UPSTREAM_WS_URL=ws://your-external-ws-host:port/path
```

Alternatif olarak geçici test için `wss://your-domain/ws?target=ws://external:port/path` şeklinde `target` query parametresi de kullanılabilir.
