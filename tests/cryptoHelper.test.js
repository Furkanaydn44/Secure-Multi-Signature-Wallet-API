const CryptoHelper = require('../utils/cryptoHelper');

describe('CryptoHelper', () => {

    // ── Key Generation ──────────────────────────────────────────
    describe('generateKeyPair()', () => {
        it('returns an object with privateKey and publicKey strings', () => {
            const pair = CryptoHelper.generateKeyPair();
            expect(typeof pair.privateKey).toBe('string');
            expect(typeof pair.publicKey).toBe('string');
        });

        it('returns hex strings of expected lengths', () => {
            const pair = CryptoHelper.generateKeyPair();
            // Private key: 32 bytes = 64 hex chars
            expect(pair.privateKey).toHaveLength(64);
            // Public key (uncompressed): 65 bytes = 130 hex chars
            expect(pair.publicKey).toHaveLength(130);
        });

        it('generates unique pairs each call', () => {
            const a = CryptoHelper.generateKeyPair();
            const b = CryptoHelper.generateKeyPair();
            expect(a.privateKey).not.toBe(b.privateKey);
            expect(a.publicKey).not.toBe(b.publicKey);
        });
    });

    // ── Hashing ─────────────────────────────────────────────────
    describe('hashData()', () => {
        it('returns a 64-char hex string (SHA-256)', () => {
            const hash = CryptoHelper.hashData({ foo: 'bar' });
            expect(hash).toMatch(/^[0-9a-f]{64}$/);
        });

        it('produces the same hash for the same object regardless of key order', () => {
            const h1 = CryptoHelper.hashData({ from: 'A', to: 'B', amount: 100 });
            const h2 = CryptoHelper.hashData({ amount: 100, to: 'B', from: 'A' });
            expect(h1).toBe(h2);
        });

        it('produces different hashes when data differs', () => {
            const h1 = CryptoHelper.hashData({ amount: 100 });
            const h2 = CryptoHelper.hashData({ amount: 200 });
            expect(h1).not.toBe(h2);
        });
    });

    // ── Sign & Verify ───────────────────────────────────────────
    describe('signData() + verifySignature()', () => {
        let pair;
        const txData = { from: '0xAAA', to: '0xBBB', amount: 500 };

        beforeEach(() => {
            pair = CryptoHelper.generateKeyPair();
        });

        it('produces a non-empty hex signature', () => {
            const sig = CryptoHelper.signData(pair.privateKey, txData);
            expect(sig).toMatch(/^[0-9a-f]+$/);
            expect(sig.length).toBeGreaterThan(0);
        });

        it('verifies a valid signature → true', () => {
            const sig = CryptoHelper.signData(pair.privateKey, txData);
            expect(CryptoHelper.verifySignature(pair.publicKey, txData, sig)).toBe(true);
        });

        it('rejects a signature from a different key pair → false', () => {
            const other = CryptoHelper.generateKeyPair();
            const sig   = CryptoHelper.signData(other.privateKey, txData);
            expect(CryptoHelper.verifySignature(pair.publicKey, txData, sig)).toBe(false);
        });

        it('rejects a tampered amount → false', () => {
            const sig = CryptoHelper.signData(pair.privateKey, txData);
            const tampered = { ...txData, amount: 9999 };
            expect(CryptoHelper.verifySignature(pair.publicKey, tampered, sig)).toBe(false);
        });

        it('rejects a malformed signature string → false', () => {
            expect(CryptoHelper.verifySignature(pair.publicKey, txData, 'not_a_real_sig')).toBe(false);
        });

        it('rejects a malformed public key → false', () => {
            const sig = CryptoHelper.signData(pair.privateKey, txData);
            expect(CryptoHelper.verifySignature('bad_public_key', txData, sig)).toBe(false);
        });

        it('each signing call produces a deterministic DER signature', () => {
            // secp256k1 + RFC-6979 deterministic nonce → same sig for same input
            const sig1 = CryptoHelper.signData(pair.privateKey, txData);
            const sig2 = CryptoHelper.signData(pair.privateKey, txData);
            expect(sig1).toBe(sig2);
        });
    });

    // ── Multi-Signer ────────────────────────────────────────────
    describe('Multi-signer scenario', () => {
        it('each signer produces a valid, distinct signature for the same data', () => {
            const alice = CryptoHelper.generateKeyPair();
            const bob   = CryptoHelper.generateKeyPair();
            const data  = { from: 'company', to: 'vendor', amount: 1000 };

            const sigA = CryptoHelper.signData(alice.privateKey, data);
            const sigB = CryptoHelper.signData(bob.privateKey, data);

            expect(CryptoHelper.verifySignature(alice.publicKey, data, sigA)).toBe(true);
            expect(CryptoHelper.verifySignature(bob.publicKey,   data, sigB)).toBe(true);

            // Cross-verify must fail
            expect(CryptoHelper.verifySignature(alice.publicKey, data, sigB)).toBe(false);
            expect(CryptoHelper.verifySignature(bob.publicKey,   data, sigA)).toBe(false);
        });
    });
});
