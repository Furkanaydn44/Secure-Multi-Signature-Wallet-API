const express = require('express');
const router  = express.Router();

const walletController = require('../controllers/walletController');
const { transferLimiter } = require('../middleware/rateLimiter');
const {
    createWalletRules,
    transferRules,
    approveRules,
    publicKeyParam,
} = require('../middleware/validate');

// ─────────────────────────────────────────────────────────────
// Wallet Routes
// ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/wallet/create:
 *   post:
 *     summary: Create a new wallet
 *     tags: [Wallet]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateWalletRequest'
 *     responses:
 *       201:
 *         description: Wallet created. Private key returned once.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateWalletResponse'
 *       409:
 *         description: Username already taken.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       422:
 *         description: Validation error.
 */
router.post('/create', createWalletRules, walletController.createWallet);

/**
 * @swagger
 * /api/wallet/{publicKey}:
 *   get:
 *     summary: Get wallet info & balance
 *     tags: [Wallet]
 *     parameters:
 *       - in: path
 *         name: publicKey
 *         required: true
 *         schema:
 *           type: string
 *         description: secp256k1 public key (hex)
 *     responses:
 *       200:
 *         description: Wallet details.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletInfo'
 *       404:
 *         description: Wallet not found.
 */
router.get('/:publicKey', publicKeyParam, walletController.getWallet);

/**
 * @swagger
 * /api/wallet/{publicKey}/history:
 *   get:
 *     summary: Get transaction history for a wallet
 *     tags: [Transactions]
 *     parameters:
 *       - in: path
 *         name: publicKey
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Number of records per page.
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Pagination offset.
 *     responses:
 *       200:
 *         description: Paginated transaction list.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transactions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Transaction'
 *                 total:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 offset:
 *                   type: integer
 *       404:
 *         description: Wallet not found.
 */
router.get('/:publicKey/history', publicKeyParam, walletController.getHistory);

/**
 * @swagger
 * /api/wallet/transfer:
 *   post:
 *     summary: Initiate a fund transfer
 *     description: |
 *       Signs are verified via ECDSA before any DB write.
 *       For multi-sig wallets the transaction enters **pending** state
 *       until enough co-signers approve via `/approve`.
 *     tags: [Transactions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TransferRequest'
 *     responses:
 *       200:
 *         description: Transfer initiated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TransactionStatus'
 *       401:
 *         description: Invalid signature.
 *       422:
 *         description: Validation error.
 */
router.post('/transfer', transferLimiter, transferRules, walletController.transfer);

/**
 * @swagger
 * /api/wallet/approve:
 *   post:
 *     summary: Approve a pending multi-sig transaction
 *     description: |
 *       The signer's signature is verified against the **original transaction data**
 *       fetched from the database — client-supplied data is never trusted.
 *     tags: [Transactions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ApproveRequest'
 *     responses:
 *       200:
 *         description: Signature recorded. Returns completed or pending status.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TransactionStatus'
 *       400:
 *         description: Duplicate signature / wrong status.
 *       401:
 *         description: Invalid signature.
 */
router.post('/approve', transferLimiter, approveRules, walletController.approve);

/**
 * @swagger
 * /api/wallet/pending/{transactionId}:
 *   get:
 *     summary: Get details of a pending transaction (for co-signers to review)
 *     tags: [Transactions]
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Transaction details with existing signatures.
 *       404:
 *         description: Pending transaction not found.
 */
router.get('/pending/:transactionId', walletController.getPendingTransaction);

module.exports = router;
