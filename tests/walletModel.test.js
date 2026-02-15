/**
 * WalletModel unit tests — DB is fully mocked, no real MySQL connection needed.
 */

// ── DB Mock Setup ─────────────────────────────────────────────
const mockConnection = {
    beginTransaction: jest.fn().mockResolvedValue(undefined),
    execute:          jest.fn(),
    commit:           jest.fn().mockResolvedValue(undefined),
    rollback:         jest.fn().mockResolvedValue(undefined),
    release:          jest.fn(),
};

jest.mock('../config/db', () => ({
    getConnection: jest.fn().mockResolvedValue(mockConnection),
    execute:       jest.fn(),
}));

const db           = require('../config/db');
const WalletModel  = require('../models/WalletModel');
const CryptoHelper = require('../utils/cryptoHelper');

// ── Helpers ───────────────────────────────────────────────────
function mockExec(returnValues) {
    // returnValues: array of results for each consecutive .execute() call
    let i = 0;
    mockConnection.execute.mockImplementation(() => {
        const val = returnValues[i++] ?? [[]];
        return Promise.resolve(val);
    });
}

// ─────────────────────────────────────────────────────────────
describe('WalletModel', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ── createWallet ────────────────────────────────────────────
    describe('createWallet()', () => {
        it('inserts user + wallet and returns correct shape', async () => {
            mockExec([
                [{ insertId: 42 }],  // INSERT users
                [{}],                // INSERT wallets
            ]);

            const result = await WalletModel.createWallet('Ahmet', '0xPUBLICKEY');

            expect(result).toEqual({ userId: 42, publicKey: '0xPUBLICKEY', balance: 1000.00 });
            expect(mockConnection.commit).toHaveBeenCalledTimes(1);
            expect(mockConnection.release).toHaveBeenCalledTimes(1);
        });

        it('rolls back and rethrows on DB error', async () => {
            mockConnection.execute.mockRejectedValueOnce(new Error('ER_DUP_ENTRY'));

            await expect(WalletModel.createWallet('Ahmet', '0xKEY')).rejects.toThrow('ER_DUP_ENTRY');
            expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
            expect(mockConnection.release).toHaveBeenCalledTimes(1);
        });
    });

    // ── findByPublicKey ─────────────────────────────────────────
    describe('findByPublicKey()', () => {
        it('returns the wallet row when found', async () => {
            const fakeWallet = { id: 1, public_key: '0xABC', balance: '1000.00' };
            db.execute.mockResolvedValueOnce([[fakeWallet]]);

            const result = await WalletModel.findByPublicKey('0xABC');
            expect(result).toEqual(fakeWallet);
        });

        it('returns null when wallet not found', async () => {
            db.execute.mockResolvedValueOnce([[]]);
            const result = await WalletModel.findByPublicKey('0xNOPE');
            expect(result).toBeNull();
        });
    });

    // ── transferFunds ───────────────────────────────────────────
    describe('transferFunds()', () => {
        const senderKey   = '0xSENDER';
        const receiverKey = '0xRECEIVER';

        it('completes immediately for a single-sig wallet', async () => {
            const wallet = { balance: '1000.00', is_multisig: 0, required_signatures: 1 };
            mockExec([
                [[wallet]],          // SELECT sender FOR UPDATE
                [[{ id: 1 }]],       // SELECT receiver
                [{ insertId: 99 }],  // INSERT transactions
                [{}],                // INSERT transaction_signatures
                [{}],                // UPDATE balance (sender)
                [{}],                // UPDATE balance (receiver)
            ]);

            const result = await WalletModel.transferFunds(senderKey, receiverKey, 100, 'SIG', senderKey);
            expect(result).toEqual({ transactionId: 99, status: 'completed' });
        });

        it('sets status to pending for a multi-sig wallet', async () => {
            const wallet = { balance: '1000.00', is_multisig: 1, required_signatures: 2 };
            mockExec([
                [[wallet]],          // SELECT sender FOR UPDATE
                [[{ id: 2 }]],       // SELECT receiver
                [{ insertId: 55 }],  // INSERT transactions
                [{}],                // INSERT transaction_signatures
                // balance UPDATEs should NOT be called
            ]);

            const result = await WalletModel.transferFunds(senderKey, receiverKey, 200, 'SIG', senderKey);
            expect(result).toEqual({ transactionId: 55, status: 'pending' });
        });

        it('throws when balance is insufficient', async () => {
            const wallet = { balance: '50.00', is_multisig: 0, required_signatures: 1 };
            mockExec([
                [[wallet]],    // SELECT sender FOR UPDATE
                [[{ id: 1 }]], // SELECT receiver
            ]);

            await expect(
                WalletModel.transferFunds(senderKey, receiverKey, 500, 'SIG', senderKey)
            ).rejects.toThrow('Yetersiz bakiye!');
            expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
        });

        it('throws when sender wallet does not exist', async () => {
            mockExec([[[]]]);  // Empty result for sender lookup
            await expect(
                WalletModel.transferFunds('0xGHOST', receiverKey, 100, 'SIG', '0xGHOST')
            ).rejects.toThrow('bulunamadı');
        });
    });

    // ── approveTransaction ──────────────────────────────────────
    describe('approveTransaction()', () => {
        let ahmet, bob;
        const txData = { from: 'SENDER_PUB', to: 'RECEIVER_PUB', amount: 300 };

        beforeEach(() => {
            ahmet = CryptoHelper.generateKeyPair();
            bob   = CryptoHelper.generateKeyPair();
        });

        it('rejects a tampered/invalid signature immediately', async () => {
            const transaction = {
                id: 1, status: 'pending',
                from_wallet: txData.from,
                to_wallet:   txData.to,
                amount:      txData.amount,
            };
            mockExec([[[transaction]]]);  // SELECT transaction FOR UPDATE

            await expect(
                WalletModel.approveTransaction(1, ahmet.publicKey, 'invalid_sig')
            ).rejects.toThrow('GEÇERSİZ İMZA');
            expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
        });

        it('rejects when transaction is already completed', async () => {
            mockExec([[[{ id: 1, status: 'completed' }]]]);

            await expect(
                WalletModel.approveTransaction(1, ahmet.publicKey, 'anySig')
            ).rejects.toThrow('zaten tamamlanmış');
        });

        it('rejects duplicate signature from the same signer', async () => {
            // Ahmet signs the real transaction data
            const sig = CryptoHelper.signData(ahmet.privateKey, txData);

            const transaction = {
                id: 1, status: 'pending',
                from_wallet: txData.from,
                to_wallet:   txData.to,
                amount:      txData.amount,
            };
            const wallet = { required_signatures: 2 };

            mockExec([
                [[transaction]],     // SELECT tx FOR UPDATE
                [[wallet]],          // SELECT wallet
                [[{ id: 77 }]],      // SELECT existing signatures → found → duplicate!
            ]);

            await expect(
                WalletModel.approveTransaction(1, ahmet.publicKey, sig)
            ).rejects.toThrow('zaten imzaladınız');
        });

        it('completes the transfer when quorum is reached', async () => {
            const sig = CryptoHelper.signData(bob.privateKey, txData);

            const transaction = {
                id: 1, status: 'pending',
                from_wallet: txData.from,
                to_wallet:   txData.to,
                amount:      txData.amount,
            };
            const wallet = { required_signatures: 2 };

            mockExec([
                [[transaction]],           // SELECT tx FOR UPDATE
                [[wallet]],               // SELECT wallet
                [[]],                     // SELECT existing sigs → none (no dup)
                [{}],                     // INSERT new signature
                [[{ count: 2 }]],         // COUNT signatures → 2 (quorum!)
                [{}],                     // UPDATE sender balance
                [{}],                     // UPDATE receiver balance
                [{}],                     // UPDATE tx status = completed
            ]);

            const result = await WalletModel.approveTransaction(1, bob.publicKey, sig);
            expect(result.status).toBe('completed');
            expect(mockConnection.commit).toHaveBeenCalledTimes(1);
        });

        it('stays pending when quorum is not yet reached', async () => {
            const sig = CryptoHelper.signData(bob.privateKey, txData);

            const transaction = {
                id: 1, status: 'pending',
                from_wallet: txData.from,
                to_wallet:   txData.to,
                amount:      txData.amount,
            };
            const wallet = { required_signatures: 3 };

            mockExec([
                [[transaction]],
                [[wallet]],
                [[]],               // no dup
                [{}],               // INSERT sig
                [[{ count: 2 }]],   // count = 2 < 3 → still pending
            ]);

            const result = await WalletModel.approveTransaction(1, bob.publicKey, sig);
            expect(result.status).toBe('pending');
            expect(result.message).toContain('Gereken: 3');
        });
    });
});
