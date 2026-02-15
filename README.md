<div align="center">

🌐 **Language / Dil:**
&nbsp;[🇬🇧 English](#-secure-multi-signature-wallet-api) (you are here)&nbsp;|&nbsp;[🇹🇷 Türkçe](./README.tr.md)

</div>

---

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


MIT
