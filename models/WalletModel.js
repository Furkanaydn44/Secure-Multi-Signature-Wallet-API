const db = require('../config/db');
const CryptoHelper = require('../utils/cryptoHelper');

class WalletModel {

    // ─────────────────────────────────────────────────────────
    // 1. Create Wallet
    // ─────────────────────────────────────────────────────────
    static async createWallet(username, publicKey) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const [userResult] = await connection.execute(
                'INSERT INTO users (username) VALUES (?)',
                [username]
            );
            const userId = userResult.insertId;

            await connection.execute(
                'INSERT INTO wallets (user_id, public_key, balance) VALUES (?, ?, ?)',
                [userId, publicKey, 1000.00]
            );

            await connection.commit();
            return { userId, publicKey, balance: 1000.00 };

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // ─────────────────────────────────────────────────────────
    // 2. Find Wallet by Public Key
    // ─────────────────────────────────────────────────────────
    static async findByPublicKey(publicKey) {
        const [rows] = await db.execute(
            'SELECT id, public_key, balance, is_multisig, required_signatures, created_at FROM wallets WHERE public_key = ?',
            [publicKey]
        );
        return rows[0] || null;
    }

    // ─────────────────────────────────────────────────────────
    // 3. Transfer Funds (Multi-Sig Aware)
    // ─────────────────────────────────────────────────────────
    static async transferFunds(fromAddress, toAddress, amount, signature, signerAddress) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Lock sender row to prevent double-spend
            const [walletRows] = await connection.execute(
                'SELECT * FROM wallets WHERE public_key = ? FOR UPDATE',
                [fromAddress]
            );
            if (walletRows.length === 0) throw new Error('Gönderen cüzdan bulunamadı.');
            const wallet = walletRows[0];

            // Verify receiver exists
            const [receiverRows] = await connection.execute(
                'SELECT id FROM wallets WHERE public_key = ?',
                [toAddress]
            );
            if (receiverRows.length === 0) throw new Error('Alıcı cüzdan bulunamadı.');

            if (parseFloat(wallet.balance) < parseFloat(amount)) {
                throw new Error('Yetersiz bakiye!');
            }

            // Multi-sig wallets start in 'pending'; single-sig complete immediately
            const status = (wallet.is_multisig && wallet.required_signatures > 1)
                ? 'pending'
                : 'completed';

            const [txResult] = await connection.execute(
                'INSERT INTO transactions (from_wallet, to_wallet, amount, signature, status) VALUES (?, ?, ?, ?, ?)',
                [fromAddress, toAddress, amount, signature, status]
            );
            const transactionId = txResult.insertId;

            // Record first signature
            await connection.execute(
                'INSERT INTO transaction_signatures (transaction_id, signer_public_key, signature) VALUES (?, ?, ?)',
                [transactionId, signerAddress, signature]
            );

            if (status === 'completed') {
                await connection.execute(
                    'UPDATE wallets SET balance = balance - ? WHERE public_key = ?',
                    [amount, fromAddress]
                );
                await connection.execute(
                    'UPDATE wallets SET balance = balance + ? WHERE public_key = ?',
                    [amount, toAddress]
                );
            }

            await connection.commit();
            return { transactionId, status };

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // ─────────────────────────────────────────────────────────
    // 4. Approve a Pending Transaction (Multi-Sig)
    //    SECURITY FIX: signature is now cryptographically verified
    //    against the original transaction data stored in the DB.
    // ─────────────────────────────────────────────────────────
    static async approveTransaction(transactionId, signerAddress, signature) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // A. Fetch & lock the transaction row
            const [txRows] = await connection.execute(
                'SELECT * FROM transactions WHERE id = ? FOR UPDATE',
                [transactionId]
            );
            if (txRows.length === 0) throw new Error('İşlem bulunamadı.');
            const transaction = txRows[0];

            if (transaction.status !== 'pending') {
                throw new Error('Bu işlem zaten tamamlanmış veya iptal edilmiş.');
            }

            // B. ✅ SECURITY FIX: Re-verify the signature against the original tx data.
            //    The signer must prove they approved exactly this transfer (same from/to/amount).
            const txData = {
                from:   transaction.from_wallet,
                to:     transaction.to_wallet,
                amount: parseFloat(transaction.amount),
            };
            const isValid = CryptoHelper.verifySignature(signerAddress, txData, signature);
            if (!isValid) {
                throw new Error('GEÇERSİZ İMZA! İmzalayan adres bu işlemi onaylamamış.');
            }

            // C. Fetch sender wallet (for required_signatures)
            const [walletRows] = await connection.execute(
                'SELECT * FROM wallets WHERE public_key = ?',
                [transaction.from_wallet]
            );
            const wallet = walletRows[0];

            // D. Duplicate signature check (enforced by DB UNIQUE KEY too)
            const [existing] = await connection.execute(
                'SELECT id FROM transaction_signatures WHERE transaction_id = ? AND signer_public_key = ?',
                [transactionId, signerAddress]
            );
            if (existing.length > 0) throw new Error('Bu işlemi zaten imzaladınız!');

            // E. Record new signature
            await connection.execute(
                'INSERT INTO transaction_signatures (transaction_id, signer_public_key, signature) VALUES (?, ?, ?)',
                [transactionId, signerAddress, signature]
            );

            // F. Check if quorum is reached
            const [countRows] = await connection.execute(
                'SELECT COUNT(*) AS count FROM transaction_signatures WHERE transaction_id = ?',
                [transactionId]
            );
            const currentSignatures = countRows[0].count;

            if (currentSignatures >= wallet.required_signatures) {
                // G. Execute the transfer
                await connection.execute(
                    'UPDATE wallets SET balance = balance - ? WHERE public_key = ?',
                    [transaction.amount, transaction.from_wallet]
                );
                await connection.execute(
                    'UPDATE wallets SET balance = balance + ? WHERE public_key = ?',
                    [transaction.amount, transaction.to_wallet]
                );
                await connection.execute(
                    'UPDATE transactions SET status = "completed" WHERE id = ?',
                    [transactionId]
                );

                await connection.commit();
                return {
                    status: 'completed',
                    message: 'Yeterli imzaya ulaşıldı. Transfer gerçekleşti.',
                };
            }

            await connection.commit();
            return {
                status: 'pending',
                message: `İmza kaydedildi. Gereken: ${wallet.required_signatures}, Şu anki: ${currentSignatures}`,
            };

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // ─────────────────────────────────────────────────────────
    // 5. Transaction History for a Wallet
    // ─────────────────────────────────────────────────────────
    static async getTransactionHistory(publicKey, { limit = 20, offset = 0 } = {}) {
        // Validate wallet existence first
        const wallet = await this.findByPublicKey(publicKey);
        if (!wallet) throw new Error('Cüzdan bulunamadı.');

        const [rows] = await db.execute(
            `SELECT
                t.id,
                t.from_wallet,
                t.to_wallet,
                t.amount,
                t.status,
                t.created_at,
                t.updated_at,
                (SELECT COUNT(*) FROM transaction_signatures ts WHERE ts.transaction_id = t.id) AS signature_count
             FROM transactions t
             WHERE t.from_wallet = ? OR t.to_wallet = ?
             ORDER BY t.created_at DESC
             LIMIT ? OFFSET ?`,
            [publicKey, publicKey, parseInt(limit), parseInt(offset)]
        );

        const [[{ total }]] = await db.execute(
            `SELECT COUNT(*) AS total FROM transactions
             WHERE from_wallet = ? OR to_wallet = ?`,
            [publicKey, publicKey]
        );

        return { transactions: rows, total, limit, offset };
    }

    // ─────────────────────────────────────────────────────────
    // 6. Get Pending Transaction Detail (for signers to review)
    // ─────────────────────────────────────────────────────────
    static async getPendingTransaction(transactionId) {
        const [txRows] = await db.execute(
            'SELECT * FROM transactions WHERE id = ? AND status = "pending"',
            [transactionId]
        );
        if (txRows.length === 0) return null;

        const [sigRows] = await db.execute(
            'SELECT signer_public_key, signed_at FROM transaction_signatures WHERE transaction_id = ?',
            [transactionId]
        );

        return { ...txRows[0], signatures: sigRows };
    }
}

module.exports = WalletModel;
