const { body, param, validationResult } = require('express-validator');

/**
 * Runs validation result and returns 422 if any errors exist.
 */
const handleValidation = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }
    next();
};

// Hex pattern for secp256k1 public keys (130 hex chars = uncompressed, 66 = compressed)
const HEX_KEY_REGEX = /^[0-9a-fA-F]{66,130}$/;
const HEX_SIG_REGEX = /^[0-9a-fA-F]{8,300}$/;

const createWalletRules = [
    body('username')
        .trim()
        .notEmpty()         .withMessage('username boş olamaz.')
        .isLength({ max: 64 }).withMessage('username en fazla 64 karakter olabilir.')
        .matches(/^[\w\-. ]+$/).withMessage('username geçersiz karakter içeriyor.'),
    handleValidation,
];

const transferRules = [
    body('fromAddress')
        .trim().notEmpty().withMessage('fromAddress zorunludur.')
        .matches(HEX_KEY_REGEX).withMessage('fromAddress geçerli bir hex public key olmalıdır.'),
    body('toAddress')
        .trim().notEmpty().withMessage('toAddress zorunludur.')
        .matches(HEX_KEY_REGEX).withMessage('toAddress geçerli bir hex public key olmalıdır.')
        .custom((val, { req }) => {
            if (val === req.body.fromAddress) throw new Error('Gönderen ve alıcı aynı cüzdan olamaz.');
            return true;
        }),
    body('amount')
        .notEmpty().withMessage('amount zorunludur.')
        .isFloat({ gt: 0 }).withMessage('amount sıfırdan büyük bir sayı olmalıdır.'),
    body('signature')
        .trim().notEmpty().withMessage('signature zorunludur.')
        .matches(HEX_SIG_REGEX).withMessage('signature geçerli bir hex DER imzası olmalıdır.'),
    body('signerAddress')
        .optional()
        .trim()
        .matches(HEX_KEY_REGEX).withMessage('signerAddress geçerli bir hex public key olmalıdır.'),
    handleValidation,
];

const approveRules = [
    body('transactionId')
        .notEmpty().withMessage('transactionId zorunludur.')
        .isInt({ gt: 0 }).withMessage('transactionId pozitif bir tamsayı olmalıdır.'),
    body('signerAddress')
        .trim().notEmpty().withMessage('signerAddress zorunludur.')
        .matches(HEX_KEY_REGEX).withMessage('signerAddress geçerli bir hex public key olmalıdır.'),
    body('signature')
        .trim().notEmpty().withMessage('signature zorunludur.')
        .matches(HEX_SIG_REGEX).withMessage('signature geçerli bir hex DER imzası olmalıdır.'),
    handleValidation,
];

const publicKeyParam = [
    param('publicKey')
        .trim()
        .matches(HEX_KEY_REGEX).withMessage('publicKey geçerli bir hex public key olmalıdır.'),
    handleValidation,
];

module.exports = { createWalletRules, transferRules, approveRules, publicKeyParam };
