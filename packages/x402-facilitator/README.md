# x402 Facilitator

Payment facilitator service for Slot402 x402 integration. This service verifies EIP-712 signatures and settles USDC payments on-chain using EIP-3009.

## Setup

1. Install dependencies:

```bash
yarn install
```

2. Create `.env` file with your configuration:

```bash
# Facilitator Private Key (needs ETH for gas on Base Mainnet)
PRIVATE_KEY=your_private_key_here

# Base Mainnet RPC URL
BASE_RPC_URL=https://mainnet.base.org

# Port for facilitator server
PORT=3001
```

3. Fund your facilitator wallet:
   - The facilitator pays gas fees for settling transactions
   - Send at least **0.01 ETH** to your wallet address on Base Mainnet
   - Check balance: `https://basescan.org/address/YOUR_ADDRESS`

## Running

Start the facilitator server:

```bash
yarn start
```

Or from the project root:

```bash
yarn facilitator
```

The service will:

- Check your ETH balance on startup (exits if insufficient)
- Start HTTP server on port 3001
- Listen for `/verify` and `/settle` requests

## API Endpoints

### POST /verify

Verifies EIP-712 signature for payment authorization.

**Request:**

```json
{
  "payload": {
    "payload": {
      "authorization": {...},
      "signature": "0x..."
    },
    "network": "base"
  },
  "requirements": {
    "asset": "0x833...",
    "payTo": "0x...",
    "maxAmountRequired": "60000",
    ...
  }
}
```

**Response:**

```json
{
  "isValid": true,
  "payer": "0x..."
}
```

### POST /settle

Settles payment on-chain via EIP-3009 transferWithAuthorization.

**Request:** Same as `/verify`

**Response:**

```json
{
  "success": true,
  "transaction": "0x...",
  "network": "base",
  "payer": "0x...",
  "blockNumber": 12345,
  "gasUsed": "123456"
}
```

### GET /health

Health check endpoint.

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2024-...",
  "wallet": "0x..."
}
```

## Gas Costs

On Base (L2), typical transaction costs:

- USDC transferWithAuthorization: ~$0.001-0.05
- Much cheaper than Ethereum mainnet
- The 0.01 USDC facilitator fee covers gas costs

## Troubleshooting

**"Facilitator has no ETH for gas"**

- Send ETH to your facilitator wallet on Base Mainnet
- Check balance: https://basescan.org/address/YOUR_ADDRESS

**"Authorization already used"**

- Nonce was already consumed
- Client needs to generate new authorization with fresh nonce

**"Client has insufficient USDC balance"**

- Client doesn't have enough USDC
- Check their balance and ensure approval

## Security Notes

- Keep your private key secure
- Never commit `.env` to version control
- Use a dedicated wallet for facilitator (not your main wallet)
- Monitor ETH balance to ensure uninterrupted service
