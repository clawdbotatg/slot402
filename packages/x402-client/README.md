# x402 Client for RugSlot

CLI tool to test gasless slot machine rolls using the x402 payment protocol.

## Overview

This client demonstrates the complete x402 payment flow:
1. Requests a roll from the server (receives 402)
2. Checks USDC balance and approves spending
3. Signs payment authorization (EIP-3009)
4. Submits payment and receives roll result

## Setup

1. Install dependencies:
```bash
yarn install
```

2. Create `.env` file:
```bash
# Your wallet private key (needs USDC on Base)
PRIVATE_KEY=your_private_key_here

# Base Mainnet RPC URL
BASE_RPC_URL=https://mainnet.base.org

# x402 Server URL
SERVER_URL=http://localhost:3000

# USDC contract on Base
USDC_CONTRACT=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

3. Fund your wallet:
   - You need **at least 0.06 USDC** on Base Mainnet
   - Get USDC: https://app.uniswap.org/ (swap ETH for USDC on Base)
   - Bridge from Ethereum: https://bridge.base.org/

## Running

Execute a roll:
```bash
yarn start
```

Or from project root:
```bash
yarn client
```

## What It Does

The client will:
1. Display your wallet address and USDC balance
2. Request a roll from the x402 server
3. Show payment details (0.06 USDC: 0.05 bet + 0.01 fee)
4. Approve USDC spending if needed
5. Sign payment authorization
6. Submit payment and wait for roll result
7. Display reel positions and win status

## Example Output

```
💼 Client Configuration:
  Wallet: 0x1234...
  Network: Base Mainnet
  Server: http://localhost:3000
  USDC: 0x833589...

🎰 Requesting slot roll via x402...

📡 Step 1: Requesting roll from server...
💳 Payment Required:
   Total: $0.06 USDC
   Bet Size: $0.05 USDC
   Facilitator Fee: $0.01 USDC
   Request ID: roll_...

💰 Your USDC Balance: 1.00 USDC

💸 Step 2: Preparing payment of 0.06 USDC...
✅ Sufficient allowance already exists

✍️  Step 3: Signing payment authorization...
✅ Payment signed

📤 Step 4: Submitting payment and executing roll...

🎉 SUCCESS! Slot roll completed!

======================================================================
SLOT ROLL RESULT
======================================================================

🎰 Reel Positions:
   Reel 1: 3
   Reel 2: 9
   Reel 3: 3

🎉 🎉 🎉 WINNER! 🎉 🎉 🎉
   Payout: 0.60 USDC
   Commit ID: 0
   Secret: 123456...

💡 Use revealAndCollect on the contract to claim your winnings!

💳 Payment Transaction: 0xabc...
   View on BaseScan: https://basescan.org/tx/0xabc...

======================================================================
```

## Requirements

### USDC Balance
- Minimum: **0.06 USDC** per roll
- Recommended: **1.00 USDC** for multiple rolls

### Services Running
- Facilitator: `yarn facilitator` (port 3001)
- Server: `yarn server` (port 3000)

## Troubleshooting

**"Insufficient USDC balance"**
- Buy USDC on Base: https://app.uniswap.org/
- Bridge from Ethereum: https://bridge.base.org/
- Faucet (testnet only): Not available on Base Mainnet

**"Failed to approve USDC spending"**
- Check you have ETH for gas (even a small amount like 0.001 ETH)
- Verify you're on Base Mainnet, not another network

**"Payment verification failed"**
- Check server is running: `yarn server`
- Check facilitator is running: `yarn facilitator`
- Verify .env configuration

**"Request not found or expired"**
- Request timeout (10 minutes)
- Generate new request by running client again

**"Server connection refused"**
- Start the server: `yarn server`
- Check SERVER_URL in .env (default: http://localhost:3000)

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| PRIVATE_KEY | Your wallet private key | 0x... |
| BASE_RPC_URL | Base RPC endpoint | https://mainnet.base.org |
| SERVER_URL | x402 server | http://localhost:3000 |
| USDC_CONTRACT | USDC on Base | 0x833589... |

## Security Notes

- Never commit your .env file
- Use a test wallet, not your main wallet
- Keep private keys secure
- The client signs transactions but doesn't broadcast them directly
- USDC approvals are limited (10% buffer over required amount)

## Integration Example

This client demonstrates how to integrate x402 payments in your application:

```javascript
// 1. Request resource (get 402)
const response = await fetch('/roll', { ... });
const { accepts, requestId } = await response.json();

// 2. Process payment (sign)
const paymentPayload = await processPayment(accepts[0], wallet);

// 3. Submit payment (get resource)
const result = await fetch('/roll/submit', {
  body: JSON.stringify({ requestId, paymentPayload })
});
```

See `client.js` for complete implementation.

