# x402 Server for Slot402

HTTP server that handles gasless slot machine rolls using the x402 payment protocol.

## Overview

This server:

1. Accepts roll requests and returns 402 Payment Required
2. Verifies and settles x402 payments via the facilitator
3. Executes slot rolls on-chain using meta-transactions
4. Polls for results and returns reel positions to clients

## Setup

1. Install dependencies:

```bash
yarn install
```

2. Create `.env` file:

```bash
# Server wallet address (receives USDC payments)
SERVER_ADDRESS=your_address_here

# Slot402 contract address on Base
RUGSLOT_CONTRACT=0x...

# USDC contract address on Base
USDC_CONTRACT=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

# Base Mainnet RPC URL
BASE_RPC_URL=https://mainnet.base.org

# Facilitator service URL
FACILITATOR_URL=http://localhost:3001

# Server port
PORT=3000

# Server private key (for calling contract)
PRIVATE_KEY=your_private_key_here
```

## Running

Start the server:

```bash
yarn start
```

Or from project root:

```bash
yarn server
```

The server will start on port 3000 and display configuration.

## API Endpoints

### POST /roll

Request a slot machine roll. Returns 402 Payment Required.

**Request:**

```json
{
  "player": "0x..."
}
```

**Response (402):**

```json
{
  "error": "Payment Required",
  "x402Version": 1,
  "accepts": [{
    "asset": "0x833...",
    "maxAmountRequired": "60000",
    "payTo": "0x...",
    "network": "base",
    ...
  }],
  "requestId": "roll_...",
  "pricing": {
    "total": "$0.06 USDC",
    "betSize": "$0.05 USDC",
    "facilitatorFee": "$0.01 USDC"
  }
}
```

### POST /roll/submit

Submit payment and execute slot roll.

**Request:**

```json
{
  "requestId": "roll_...",
  "paymentPayload": {
    "payload": {
      "authorization": {...},
      "signature": "0x..."
    },
    "network": "base"
  }
}
```

**Response (200):**

```json
{
  "success": true,
  "payment": {
    "transaction": "0x...",
    "payer": "0x..."
  },
  "roll": {
    "won": true,
    "reelPositions": {
      "reel1": 3,
      "reel2": 9,
      "reel3": 3
    },
    "payout": "600000",
    "commitId": "0",
    "secret": "123456..."
  }
}
```

### GET /health

Health check endpoint.

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2024-...",
  "checks": {
    "facilitator": "ok",
    "contract": "deployed"
  },
  "pendingRequests": 0
}
```

## How It Works

1. **Client requests roll**: POST /roll with player address
2. **Server returns 402**: Payment requirements for 0.06 USDC
3. **Client signs payment**: Creates EIP-3009 authorization
4. **Client submits**: POST /roll/submit with payment payload
5. **Server verifies**: Calls facilitator /verify endpoint
6. **Server settles**: Calls facilitator /settle endpoint (transfers USDC)
7. **Server commits**: Calls contract.commitWithMetaTransaction
8. **Server polls**: Waits for next block, calls isWinner
9. **Server returns**: Reel positions and win status

## Dependencies

- Express: HTTP server
- ethers.js: Ethereum interaction
- a2a-x402: x402 payment library
- Facilitator service (must be running)

## Environment Variables

| Variable         | Description              | Example                  |
| ---------------- | ------------------------ | ------------------------ |
| SERVER_ADDRESS   | Receives USDC payments   | 0x...                    |
| RUGSLOT_CONTRACT | Slot402 contract address | 0x...                    |
| USDC_CONTRACT    | USDC on Base             | 0x833589...              |
| BASE_RPC_URL     | Base RPC endpoint        | https://mainnet.base.org |
| FACILITATOR_URL  | Facilitator service      | http://localhost:3001    |
| PORT             | Server port              | 3000                     |
| PRIVATE_KEY      | Server wallet key        | 0x...                    |

## Troubleshooting

**"Request not found or expired"**

- RequestId doesn't exist or timeout
- Generate new roll request

**"Payment verification failed"**

- Invalid signature or expired authorization
- Check client clock sync
- Verify USDC allowance

**"Payment settlement failed"**

- Facilitator has no ETH for gas
- Client has insufficient USDC
- Check facilitator logs

**"Timeout waiting for result"**

- Network congestion or RPC issues
- Check Base network status
- Verify RUGSLOT_CONTRACT address

## Production Considerations

- Use Redis/database for pending requests (not in-memory Map)
- Add rate limiting
- Implement request expiration/cleanup
- Monitor server wallet balance
- Add comprehensive error logging
- Use environment-specific RPC URLs
- Consider horizontal scaling for high traffic
