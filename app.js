require('dotenv').config();

const express        = require('express');
const helmet         = require('helmet');
const swaggerUi      = require('swagger-ui-express');
const swaggerSpec    = require('./config/swagger');
const walletRoutes   = require('./routes/walletRoutes');
const { globalLimiter } = require('./middleware/rateLimiter');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Security Headers ──────────────────────────────────────────
app.use(helmet());

// ── Rate Limiting (global) ────────────────────────────────────
app.use(globalLimiter);

// ── Body Parsing ──────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));  // guard against oversized payloads

// ── API Docs ──────────────────────────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Multi-Sig Wallet API',
    swaggerOptions: { persistAuthorization: true },
}));

// ── Routes ────────────────────────────────────────────────────
app.use('/api/wallet', walletRoutes);

// ── 404 Fallback ──────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint bulunamadı.' });
});

// ── Global Error Handler ──────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Sunucu hatası.' });
});

// ── Start ─────────────────────────────────────────────────────
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 Sunucu çalışıyor: http://localhost:${PORT}`);
        console.log(`📖 API Docs: http://localhost:${PORT}/api-docs`);
        console.log(`🔐 Güvenli Mod: AÇIK (ECDSA + Helmet + Rate Limiting)`);
    });
}

module.exports = app; // exported for Jest
