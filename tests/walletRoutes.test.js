/**
 * Route / Controller integration tests.
 * WalletModel is mocked so no DB connection is required.
 */

jest.mock('../config/db', () => ({
    getConnection: jest.fn(),
    execute:       jest.fn(),
}));
jest.mock('../models/WalletModel');

const request      = require('supertest');
const app          = require('../app');
const WalletModel  = require('../models/WalletModel');
const CryptoHelper = require('../utils/cryptoHelper');

// ── Shared key pair used across tests ─────────────────────────
let testPair;
beforeAll(() => { testPair = CryptoHelper.generateKeyPair(); });

afterEach(() => { jest.clearAllMocks(); });

// ─────────────────────────────────────────────────────────────
describe('POST /api/wallet/create', () => {
    it('returns 201 with wallet data on success', async () => {
        WalletModel.createWallet.mockResolvedValue({
            userId: 1, publicKey: testPair.publicKey, balance: 1000,
        });

        const res = await request(app)
            .post('/api/wallet/create')
            .send({ username: 'Ahmet' });

        expect(res.status).toBe(201);
        expect(res.body.publicKey).toBe(testPair.publicKey);
        expect(res.body.privateKey).toBeDefined(); // returned once on creation
    });

    it('returns 422 when username is missing', async () => {
        const res = await request(app)
            .post('/api/wallet/create')
            .send({});
        expect(res.status).toBe(422);
        expect(res.body.errors).toBeDefined();
    });

    it('returns 422 for username with invalid chars', async () => {
        const res = await request(app)
            .post('/api/wallet/create')
            .send({ username: '<script>alert(1)</script>' });
        expect(res.status).toBe(422);
    });

    it('returns 409 for duplicate username', async () => {
        WalletModel.createWallet.mockRejectedValue({ code: 'ER_DUP_ENTRY' });
        const res = await request(app)
            .post('/api/wallet/create')
            .send({ username: 'Ahmet' });
        expect(res.status).toBe(409);
    });
});

// ─────────────────────────────────────────────────────────────
describe('GET /api/wallet/:publicKey', () => {
    it('returns 200 with wallet info', async () => {
        const fakeWallet = {
            id: 1, public_key: testPair.publicKey, balance: '950.00',
            is_multisig: 0, required_signatures: 1,
        };
        WalletModel.findByPublicKey.mockResolvedValue(fakeWallet);

        const res = await request(app).get(`/api/wallet/${testPair.publicKey}`);
        expect(res.status).toBe(200);
        expect(res.body.balance).toBe('950.00');
    });

    it('returns 404 when wallet does not exist', async () => {
        WalletModel.findByPublicKey.mockResolvedValue(null);
        const res = await request(app).get(`/api/wallet/${testPair.publicKey}`);
        expect(res.status).toBe(404);
    });

    it('returns 422 for a malformed public key', async () => {
        const res = await request(app).get('/api/wallet/NOT_A_HEX_KEY!!');
        expect(res.status).toBe(422);
    });
});

// ─────────────────────────────────────────────────────────────
describe('POST /api/wallet/transfer', () => {
    let receiverPair;
    beforeAll(() => { receiverPair = CryptoHelper.generateKeyPair(); });

    const buildTransferBody = (overrides = {}) => {
        const amount  = 100;
        const txData  = { from: testPair.publicKey, to: receiverPair.publicKey, amount };
        const signature = CryptoHelper.signData(testPair.privateKey, txData);
        return {
            fromAddress:   testPair.publicKey,
            toAddress:     receiverPair.publicKey,
            amount,
            signature,
            ...overrides,
        };
    };

    it('returns 200 with status when transfer succeeds', async () => {
        WalletModel.transferFunds.mockResolvedValue({ transactionId: 5, status: 'completed' });

        const res = await request(app)
            .post('/api/wallet/transfer')
            .send(buildTransferBody());

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('completed');
    });

    it('returns 401 for an invalid signature', async () => {
        const res = await request(app)
            .post('/api/wallet/transfer')
            .send(buildTransferBody({ signature: 'deadbeef01020304' }));
        expect(res.status).toBe(401);
        expect(res.body.error).toMatch(/GEÇERSİZ/);
    });

    it('returns 422 for a negative amount', async () => {
        const res = await request(app)
            .post('/api/wallet/transfer')
            .send(buildTransferBody({ amount: -50 }));
        expect(res.status).toBe(422);
    });

    it('returns 422 when fromAddress equals toAddress', async () => {
        const txData    = { from: testPair.publicKey, to: testPair.publicKey, amount: 100 };
        const signature = CryptoHelper.signData(testPair.privateKey, txData);

        const res = await request(app)
            .post('/api/wallet/transfer')
            .send({ fromAddress: testPair.publicKey, toAddress: testPair.publicKey, amount: 100, signature });
        expect(res.status).toBe(422);
    });

    it('returns 400 when model throws (e.g. insufficient balance)', async () => {
        WalletModel.transferFunds.mockRejectedValue(new Error('Yetersiz bakiye!'));
        const res = await request(app)
            .post('/api/wallet/transfer')
            .send(buildTransferBody());
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('bakiye');
    });

    it('returns 200 pending status for multi-sig wallet', async () => {
        WalletModel.transferFunds.mockResolvedValue({ transactionId: 9, status: 'pending' });

        const res = await request(app)
            .post('/api/wallet/transfer')
            .send(buildTransferBody());

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('pending');
    });
});

// ─────────────────────────────────────────────────────────────
describe('POST /api/wallet/approve', () => {
    it('returns 200 when approval succeeds (completed)', async () => {
        WalletModel.approveTransaction.mockResolvedValue({
            status: 'completed', message: 'Transfer gerçekleşti.',
        });

        const res = await request(app)
            .post('/api/wallet/approve')
            .send({
                transactionId: 1,
                signerAddress: testPair.publicKey,
                signature:     'aabbccdd00112233',
            });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('completed');
    });

    it('returns 401 for invalid signature from model', async () => {
        WalletModel.approveTransaction.mockRejectedValue(
            new Error('GEÇERSİZ İMZA! İmzalayan adres bu işlemi onaylamamış.')
        );

        const res = await request(app)
            .post('/api/wallet/approve')
            .send({
                transactionId: 1,
                signerAddress: testPair.publicKey,
                signature:     'aabbccdd00112233',
            });

        expect(res.status).toBe(401);
    });

    it('returns 422 for missing fields', async () => {
        const res = await request(app)
            .post('/api/wallet/approve')
            .send({ transactionId: 1 }); // missing signerAddress + signature
        expect(res.status).toBe(422);
    });

    it('returns 422 for non-integer transactionId', async () => {
        const res = await request(app)
            .post('/api/wallet/approve')
            .send({ transactionId: 'abc', signerAddress: testPair.publicKey, signature: 'aabbccdd' });
        expect(res.status).toBe(422);
    });
});

// ─────────────────────────────────────────────────────────────
describe('GET /api/wallet/:publicKey/history', () => {
    it('returns paginated transaction history', async () => {
        WalletModel.getTransactionHistory.mockResolvedValue({
            transactions: [{ id: 1, amount: '100.00', status: 'completed' }],
            total: 1, limit: 20, offset: 0,
        });

        const res = await request(app).get(`/api/wallet/${testPair.publicKey}/history`);
        expect(res.status).toBe(200);
        expect(res.body.transactions).toHaveLength(1);
        expect(res.body.total).toBe(1);
    });

    it('returns 404 when wallet not found', async () => {
        WalletModel.getTransactionHistory.mockRejectedValue(new Error('Cüzdan bulunamadı.'));
        const res = await request(app).get(`/api/wallet/${testPair.publicKey}/history`);
        expect(res.status).toBe(404);
    });
});

// ─────────────────────────────────────────────────────────────
describe('404 fallback', () => {
    it('returns 404 for unknown routes', async () => {
        const res = await request(app).get('/api/does-not-exist');
        expect(res.status).toBe(404);
    });
});
