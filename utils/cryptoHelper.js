const EC = require('elliptic').ec;
const crypto = require('crypto');

// secp256k1 — same curve used by Bitcoin & Ethereum
const ec = new EC('secp256k1');

class CryptoHelper {

    /**
     * Generate a new secp256k1 key pair.
     * ⚠️  The private key must NEVER leave the client device in production.
     * In this simulation it is returned once on wallet creation.
     */
    static generateKeyPair() {
        const key = ec.genKeyPair();
        return {
            privateKey: key.getPrivate('hex'),
            publicKey:  key.getPublic('hex'),
        };
    }

    /**
     * Deterministically hash arbitrary data with SHA-256.
     * Object keys are sorted before serialisation to avoid ordering bugs.
     */
    static hashData(data) {
        const sorted = JSON.stringify(data, Object.keys(data).sort());
        return crypto.createHash('sha256').update(sorted).digest('hex');
    }

    /**
     * Sign data with a private key → DER hex signature.
     * (Simulates what the client wallet app would do locally.)
     */
    static signData(privateKeyHex, data) {
        const key = ec.keyFromPrivate(privateKeyHex, 'hex');
        const hash = this.hashData(data);
        const sig = key.sign(hash);
        return sig.toDER('hex');
    }

    /**
     * Verify a DER hex signature against a public key and data.
     * Returns true only when both the key and the data are untampered.
     */
    static verifySignature(publicKeyHex, data, signatureHex) {
        try {
            const key = ec.keyFromPublic(publicKeyHex, 'hex');
            const hash = this.hashData(data);
            return key.verify(hash, signatureHex);
        } catch {
            return false; // malformed key or signature → reject silently
        }
    }
}

module.exports = CryptoHelper;
