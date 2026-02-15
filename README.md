# 🔐 Güvenli Çoklu İmzalı (Multi-Signature) Cüzdan API'si

Bitcoin tarzı **çoklu imza (M-of-N) cüzdan backend**'i. Node.js, Express, MySQL ve gerçek secp256k1 ECDSA kriptografisi ile geliştirilmiştir.

Her işlem kriptografik olarak gönderen tarafından imzalanır. Çoklu imzalı cüzdanlarda ise para transferi gerçekleşmeden önce belirlenen sayıda ortak imzacının onayı gerekir — sunucu hiçbir zaman private key görmez.

---

## ✨ Özellikler

| Özellik | Detay |
|---|---|
| **ECDSA İmzaları** | secp256k1 eğrisi (Bitcoin/Ethereum ile aynı standart) |
| **Multi-Sig Desteği** | Yapılandırılabilir M-of-N onay sistemi |
| **İmza Doğrulama** | Her onay, veritabanındaki orijinal işlem verisine karşı doğrulanır — istemci verisine güvenilmez |
| **Race Condition Koruması** | `SELECT ... FOR UPDATE` ile çift harcama önlenir |
| **Girdi Doğrulama** | Tüm endpoint'lerde express-validator |
| **Rate Limiting** | Global + işlem bazlı istek limiti |
| **Güvenlik Header'ları** | helmet.js |
| **Swagger Dokümantasyon** | `/api-docs` adresinde interaktif API dökümantasyonu |
| **Jest Testleri** | Mock'lanmış DB ile unit + entegrasyon testleri |

---

## 🚀 Hızlı Başlangıç

### 1. Klonla ve Kur

```bash
git clone https://github.com/KULLANICI_ADIN/secure-multisig-wallet.git
cd secure-multisig-wallet
npm install
```

### 2. Ortam Değişkenlerini Ayarla

```bash
# Windows
copy .env.example .env

# macOS / Linux
cp .env.example .env
```

`.env` dosyasını bir metin editörüyle aç ve MySQL bilgilerini gir:

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=mysql_sifren
DB_NAME=secure_bank_db
PORT=3000
```

### 3. Veritabanını Oluştur

```bash
mysql -u root -p < schema.sql
```

Bu komut veritabanını, tabloları ve kısıtlamaları otomatik olarak oluşturur.

### 4. MySQL Kullanıcısı Oluştur (opsiyonel)

```sql
CREATE USER 'banka_admin'@'localhost' IDENTIFIED BY 'guclu_sifre';
GRANT ALL PRIVILEGES ON secure_bank_db.* TO 'banka_admin'@'localhost';
FLUSH PRIVILEGES;
```

### 5. Sunucuyu Başlat

```bash
npm start          # normal çalıştırma
npm run dev        # geliştirme modu (nodemon ile otomatik yeniden başlatma)
```

Terminalde şunu görürsen her şey çalışıyor demektir:

```
✅ MySQL connection pool ready.
🚀 Sunucu çalışıyor: http://localhost:3000
📖 API Docs: http://localhost:3000/api-docs
🔐 Güvenli Mod: AÇIK (ECDSA + Helmet + Rate Limiting)
```

---

## 🧪 Testler

```bash
npm test              # tüm testleri çalıştır
npm run test:coverage # kapsam raporu ile çalıştır
```

Test paketi veritabanı bağlantısı **gerektirmez** — tüm DB çağrıları mock'lanmıştır.

---

## 📡 API Referansı

Tüm endpoint'lerin interaktif dokümantasyonuna `/api-docs` adresinden (Swagger UI) erişebilirsin.

### `POST /api/wallet/create`
Yeni cüzdan oluştur. Private key **yalnızca bir kez** döner — güvenli bir yerde sakla!

```json
{ "username": "Ahmet" }
```

### `GET /api/wallet/:publicKey`
Cüzdan bilgilerini ve güncel bakiyeyi getir.

### `GET /api/wallet/:publicKey/history?limit=20&offset=0`
Sayfalanmış işlem geçmişi (gönderilen + alınan).

### `POST /api/wallet/transfer`
Transfer başlat. İmza ECDSA geçerli olmalıdır.

```json
{
  "fromAddress":   "<gönderen_public_key>",
  "toAddress":     "<alıcı_public_key>",
  "amount":        100.5,
  "signature":     "<ECDSA_DER_hex>",
  "signerAddress": "<imzalayan_public_key>"
}
```

> Çoklu imzalı cüzdanlarda `status: "pending"` döner. Tekli imzalı cüzdanlarda işlem anında `status: "completed"` olarak tamamlanır.

### `POST /api/wallet/approve`
Bekleyen bir işlemi ortak imzacı olarak onayla. İmza **veritabanındaki orijinal işlem verisine** karşı doğrulanır.

```json
{
  "transactionId": 5,
  "signerAddress": "<ortak_imzacı_public_key>",
  "signature":     "<ECDSA_DER_hex>"
}
```

### `GET /api/wallet/pending/:transactionId`
Ortak imzacıların imzalamadan önce inceleyebileceği bekleyen işlem detayını getir.

---

## 🔒 Güvenlik Mimarisi

```
İstemci                            Sunucu
  │                                  │
  ├─ generateKeyPair() ──────────►  privateKey istemcide kalır
  │                                  publicKey DB'ye kaydedilir
  │                                  │
  ├─ sign(privateKey, txData) ──►   sadece imza + publicKey gönderilir
  │                                  │
  │                          verifySignature(publicKey, txData, sig)
  │                                  │
  │                          ✅ işleme devam  veya  ❌ 401 red
```

**Temel kural:** Private key'ler hiçbir zaman istemciyi terk etmez. Sunucu yalnızca public key'leri saklar ve ECDSA imzalarını doğrular.

### Multi-Sig Akışı

```
1. Başlatıcı txData'yı imzalar  → POST /transfer  → status: "pending"
2. Ortak imzacı işlemi görüntüler → GET /pending/:id → from/to/amount'ı inceler
3. Ortak imzacı aynı txData'yı imzalar → POST /approve → sunucu DB verisiyle yeniden doğrular
4. signature_count >= required_signatures olduğunda → transfer atomik olarak gerçekleşir
```

---

## 🛠️ Teknoloji Yığını

- **Çalışma Ortamı:** Node.js 18+
- **Framework:** Express 4
- **Veritabanı:** MySQL 8 (mysql2)
- **Kriptografi:** elliptic (secp256k1)
- **Doğrulama:** express-validator
- **Güvenlik:** helmet, express-rate-limit
- **Dokümantasyon:** swagger-jsdoc + swagger-ui-express
- **Test:** Jest + supertest

---

## 📁 Proje Yapısı

```
secure-multisig-wallet/
├── config/
│   ├── db.js              # MySQL bağlantı havuzu
│   └── swagger.js         # Swagger/OpenAPI tanımı
├── controllers/
│   └── walletController.js
├── middleware/
│   ├── rateLimiter.js     # Rate limiting kuralları
│   └── validate.js        # Girdi doğrulama kuralları
├── models/
│   └── WalletModel.js     # Tüm veritabanı işlemleri
├── routes/
│   └── walletRoutes.js    # Swagger JSDoc anotasyonları dahil
├── utils/
│   └── cryptoHelper.js    # ECDSA yardımcı fonksiyonları
├── tests/
│   ├── cryptoHelper.test.js
│   ├── walletModel.test.js
│   └── walletRoutes.test.js
├── schema.sql             # Tam veritabanı şeması
├── app.js
├── .env.example           # Ortam değişkenleri şablonu
├── README.md              # İngilizce dokümantasyon
└── README.tr.md           # Türkçe dokümantasyon (bu dosya)
```

---

## ⚠️ Prodüksiyon Kontrol Listesi

- [ ] Private key üretimi **mutlaka** istemci cihazında yapılmalı, sunucuda değil
- [ ] HTTPS kullan (nginx veya load balancer üzerinden TLS sonlandırma)
- [ ] MySQL kullanıcısını yalnızca gerekli yetkilerle sınırlandır
- [ ] Sunucu tarafındaki anahtar materyali için HSM veya KMS düşün
- [ ] Cüzdan endpoint'lerini korumak için kimlik doğrulama (JWT) ekle

---

## 📜 Lisans

MIT