const rateLimit = require('express-rate-limit');

/**
 * Global limiter — applied to every route.
 */
const globalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 min
    max:      parseInt(process.env.RATE_LIMIT_MAX)        || 100,
    standardHeaders: true,
    legacyHeaders:   false,
    message: { error: 'Çok fazla istek. Lütfen bir süre bekleyin.' },
});

/**
 * Stricter limiter for sensitive write operations (transfer, approve).
 * Max 20 requests per IP per 15 minutes.
 */
const transferLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders:   false,
    message: { error: 'Transfer isteği limitine ulaşıldı. Lütfen 15 dakika bekleyin.' },
});

module.exports = { globalLimiter, transferLimiter };
