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




# 🔐 Secure Multi-Signature Wallet API

A Bitcoin-style **multi-signature (M-of-N) wallet backend** built with Node.js, Express, MySQL, and real secp256k1 ECDSA cryptography.

Every transaction is cryptographically signed by the sender, and multi-sig wallets require approval from M co-signers before funds are released — all without the server ever seeing a private key.

---

## ✨ Features

| Feature | Details |
|---|---|
| **ECDSA Signatures** | secp256k1 curve (same as Bitcoin/Ethereum) |
| **Multi-Sig Support** | Configurable M-of-N approval scheme |
| **Signature Verification** | Every approval re-verified against original DB data — client data never trusted |
| **Race Condition Protection** | `SELECT ... FOR UPDATE` prevents double-spend |
| **Input Validation** | express-validator on all endpoints |
| **Rate Limiting** | Global + per-operation limits |
| **Security Headers** | helmet.js |
| **Swagger Docs** | Interactive API docs at `/api-docs` |
| **Jest Tests** | Unit + integration tests with mocked DB |

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/secure-multisig-wallet.git
cd secure-multisig-wallet
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your MySQL credentials
```

### 3. Initialize Database

```bash
mysql -u root -p < schema.sql
```

### 4. Create MySQL User (optional)

```sql
CREATE USER 'banka_admin'@'localhost' IDENTIFIED BY 'your_strong_password';
GRANT ALL PRIVILEGES ON secure_bank_db.* TO 'banka_admin'@'localhost';
FLUSH PRIVILEGES;
```

### 5. Run

```bash
npm start           # production
npm run dev         # development (nodemon)
```

API docs: **http://localhost:3000/api-docs**

---

## 🧪 Tests

```bash
npm test              # run all tests
npm run test:coverage # with coverage report
```

The test suite requires **no database** — all DB calls are mocked.

---

## 📡 API Reference

A complete interactive reference is available at `/api-docs` (Swagger UI).

### `POST /api/wallet/create`
Create a new wallet. Returns private key **once** — store it securely.

```json
{ "username": "Ahmet" }
```

### `GET /api/wallet/:publicKey`
Get wallet info and current balance.

### `GET /api/wallet/:publicKey/history?limit=20&offset=0`
Paginated transaction history (sent + received).

### `POST /api/wallet/transfer`
Initiate a transfer. Signs must be ECDSA-valid.

```json
{
  "fromAddress":   "<sender_public_key>",
  "toAddress":     "<receiver_public_key>",
  "amount":        100.5,
  "signature":     "<ECDSA_DER_hex>",
  "signerAddress": "<signer_public_key>"
}
```

> For multi-sig wallets, returns `status: "pending"`. For single-sig, returns `status: "completed"` immediately.

### `POST /api/wallet/approve`
Co-signer approves a pending transaction. Signature is verified against **original DB data**.

```json
{
  "transactionId": 5,
  "signerAddress": "<cosigner_public_key>",
  "signature":     "<ECDSA_DER_hex>"
}
```

### `GET /api/wallet/pending/:transactionId`
Fetch pending transaction details so co-signers can review before signing.

---

## 🔒 Security Architecture

```
Client                             Server
  │                                  │
  ├─ generateKeyPair() ──────────►  privateKey stays on client
  │                                  publicKey stored in DB
  │                                  │
  ├─ sign(privateKey, txData) ──►   signature + publicKey only
  │                                  │
  │                          verifySignature(publicKey, txData, sig)
  │                                  │
  │                          ✅ proceed  or  ❌ 401 reject
```

**Key invariant:** Private keys never leave the client. The server only stores public keys and verifies ECDSA signatures.

### Multi-Sig Flow

```
1. Initiator signs txData → POST /transfer → status: "pending"
2. Co-signer fetches tx  → GET /pending/:id → reviews from/to/amount
3. Co-signer signs same txData → POST /approve → server re-verifies against DB data
4. When signature_count >= required_signatures → transfer executes atomically
```

---

## 🛠️ Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express 4
- **Database:** MySQL 8 (mysql2)
- **Cryptography:** elliptic (secp256k1)
- **Validation:** express-validator
- **Security:** helmet, express-rate-limit
- **Docs:** swagger-jsdoc + swagger-ui-express
- **Testing:** Jest + supertest

---

## 📁 Project Structure

```
secure-multisig-wallet/
├── config/
│   ├── db.js          # MySQL connection pool
│   └── swagger.js     # Swagger/OpenAPI spec
├── controllers/
│   └── walletController.js
├── middleware/
│   ├── rateLimiter.js
│   └── validate.js
├── models/
│   └── WalletModel.js # All DB interactions
├── routes/
│   └── walletRoutes.js
├── utils/
│   └── cryptoHelper.js # ECDSA helpers
├── tests/
│   ├── cryptoHelper.test.js
│   ├── walletModel.test.js
│   └── walletRoutes.test.js
├── schema.sql
├── app.js
├── .env.example
└── README.md
```

---

## ⚠️ Production Checklist

- [ ] Private key generation **must** happen on the client device, not the server
- [ ] Use HTTPS (TLS termination via nginx/load balancer)
- [ ] Restrict MySQL user to only needed privileges
- [ ] Consider HSM or KMS for any server-side key material
- [ ] Add authentication (JWT) to protect wallet endpoints

---

## 📜 License

MIT
