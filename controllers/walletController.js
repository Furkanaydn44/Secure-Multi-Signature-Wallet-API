const WalletModel = require('../models/WalletModel');
const CryptoHelper = require('../utils/cryptoHelper');

// ── Create Wallet ──────────────────────────────────────────────
exports.createWallet = async (req, res) => {
    try {
        const { username } = req.body;

        const keyPair = CryptoHelper.generateKeyPair();
        const wallet  = await WalletModel.createWallet(username, keyPair.publicKey);

        res.status(201).json({
            message: '⚠️  Cüzdan oluşturuldu. Private Key\'inizi güvenli saklayın; bir daha gösterilmeyecek!',
            ...wallet,
            privateKey: keyPair.privateKey,
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Bu kullanıcı adı zaten alınmış.' });
        }
        res.status(500).json({ error: error.message });
    }
};

// ── Get Wallet Info ────────────────────────────────────────────
exports.getWallet = async (req, res) => {
    try {
        const wallet = await WalletModel.findByPublicKey(req.params.publicKey);
        if (!wallet) return res.status(404).json({ error: 'Cüzdan bulunamadı.' });
        res.json(wallet);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ── Transfer ──────────────────────────────────────────────────
exports.transfer = async (req, res) => {
    try {
        const { fromAddress, toAddress, amount, signature, signerAddress } = req.body;
        const actualSigner = signerAddress || fromAddress;

        // Verify ECDSA signature
        const txData = { from: fromAddress, to: toAddress, amount: parseFloat(amount) };
        if (!CryptoHelper.verifySignature(actualSigner, txData, signature)) {
            return res.status(401).json({ error: 'GEÇERSİZ İMZA! İşlem reddedildi.' });
        }

        const result = await WalletModel.transferFunds(
            fromAddress, toAddress, parseFloat(amount), signature, actualSigner
        );
        res.status(200).json(result);

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// ── Approve (Multi-Sig) ───────────────────────────────────────
exports.approve = async (req, res) => {
    try {
        const { transactionId, signerAddress, signature } = req.body;

        // Signature verification now happens inside WalletModel.approveTransaction
        // (fetches original tx data from DB, then verifies — no trust on client input)
        const result = await WalletModel.approveTransaction(
            parseInt(transactionId), signerAddress, signature
        );
        res.status(200).json(result);

    } catch (error) {
        const status = error.message.includes('GEÇERSİZ İMZA') ? 401 : 400;
        res.status(status).json({ error: error.message });
    }
};

// ── Transaction History ───────────────────────────────────────
exports.getHistory = async (req, res) => {
    try {
        const { limit = 20, offset = 0 } = req.query;
        const history = await WalletModel.getTransactionHistory(req.params.publicKey, {
            limit:  Math.min(parseInt(limit)  || 20, 100),
            offset: Math.max(parseInt(offset) || 0,  0),
        });
        res.json(history);
    } catch (error) {
        const status = error.message.includes('bulunamadı') ? 404 : 500;
        res.status(status).json({ error: error.message });
    }
};

// ── Pending Transaction Detail ────────────────────────────────
exports.getPendingTransaction = async (req, res) => {
    try {
        const tx = await WalletModel.getPendingTransaction(parseInt(req.params.transactionId));
        if (!tx) return res.status(404).json({ error: 'Bekleyen işlem bulunamadı.' });
        res.json(tx);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
