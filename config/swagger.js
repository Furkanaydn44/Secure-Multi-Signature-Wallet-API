const swaggerJSDoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Secure Multi-Sig Wallet API',
            version: '1.0.0',
            description:
                'A Bitcoin-style multi-signature wallet backend. ' +
                'Transactions require M-of-N ECDSA signatures before funds are released.',
            contact: {
                name: 'API Support',
            },
        },
        servers: [
            { url: 'http://localhost:3000', description: 'Local Development' },
        ],
        components: {
            schemas: {
                CreateWalletRequest: {
                    type: 'object',
                    required: ['username'],
                    properties: {
                        username: { type: 'string', example: 'Ahmet' },
                    },
                },
                CreateWalletResponse: {
                    type: 'object',
                    properties: {
                        message:    { type: 'string' },
                        userId:     { type: 'integer' },
                        publicKey:  { type: 'string' },
                        balance:    { type: 'number' },
                        privateKey: { type: 'string', description: 'Returned ONCE — store securely.' },
                    },
                },
                TransferRequest: {
                    type: 'object',
                    required: ['fromAddress', 'toAddress', 'amount', 'signature'],
                    properties: {
                        fromAddress:   { type: 'string' },
                        toAddress:     { type: 'string' },
                        amount:        { type: 'number', example: 100.5 },
                        signature:     { type: 'string', description: 'ECDSA DER-hex signature of {from,to,amount}' },
                        signerAddress: { type: 'string', description: 'Defaults to fromAddress for single-sig wallets.' },
                    },
                },
                ApproveRequest: {
                    type: 'object',
                    required: ['transactionId', 'signerAddress', 'signature'],
                    properties: {
                        transactionId: { type: 'integer' },
                        signerAddress: { type: 'string' },
                        signature:     { type: 'string', description: 'ECDSA signature of the original transaction data' },
                    },
                },
                TransactionStatus: {
                    type: 'object',
                    properties: {
                        transactionId: { type: 'integer' },
                        status:        { type: 'string', enum: ['pending', 'completed', 'rejected'] },
                    },
                },
                WalletInfo: {
                    type: 'object',
                    properties: {
                        id:                  { type: 'integer' },
                        public_key:          { type: 'string' },
                        balance:             { type: 'number' },
                        is_multisig:         { type: 'boolean' },
                        required_signatures: { type: 'integer' },
                    },
                },
                Transaction: {
                    type: 'object',
                    properties: {
                        id:          { type: 'integer' },
                        from_wallet: { type: 'string' },
                        to_wallet:   { type: 'string' },
                        amount:      { type: 'number' },
                        status:      { type: 'string' },
                        created_at:  { type: 'string', format: 'date-time' },
                    },
                },
                ErrorResponse: {
                    type: 'object',
                    properties: {
                        error: { type: 'string' },
                    },
                },
            },
        },
    },
    apis: ['./routes/*.js'],
};

module.exports = swaggerJSDoc(options);
