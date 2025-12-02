# 🎰 Slot402 - Yield-Earning Gasless Slot Machine on Base

> let your agents take it for a spin :)

**Live at**: [https://slot402.com](https://slot402.com)

A **fully gasless** on-chain slot machine where the treasury earns yield in DeFi, excess profits buy back and burn the token, and token holders are effectively **the house**.

- **Fully x402 compliant** - Pay with signatures, not gas
- **Provably fair** - Commit-reveal randomness on Base L2
- **Yield-earning treasury** - Idle USDC earns yield in Summer.fi vault
- **Deflationary tokenomics** - Excess profits buy back and burn tokens
- **Live on Base Mainnet**

<img width="1335" height="1188" alt="Slot Machine" src="https://github.com/user-attachments/assets/a1c641ae-91bb-4c15-a051-311df503dd32" />

## Quick Start - Roll via Script

```javascript
// ═══════════════════════════════════════════════════════════════════════════════
// SLOT402 CLIENT - Complete copy/paste example for ethers v6
// Create .env file with PRIVATE_KEY=0x... then run: node slot402.js
// ═══════════════════════════════════════════════════════════════════════════════

import "dotenv/config";
import { ethers } from "ethers";

const CHAIN_ID = 8453;
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const API_URL = "https://api.slot402.com:8000";

if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY not set in .env");
const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1: Request roll → Server returns 402 with payment details
// ─────────────────────────────────────────────────────────────────────────────
const rollResponse = await fetch(`${API_URL}/roll`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ player: wallet.address }),
});
if (rollResponse.status !== 402) throw new Error("Expected 402");
const payment = await rollResponse.json();
console.log(
  `💳 Bet: ${payment.pricing.betSize} + ${payment.pricing.facilitatorFee} fee`
);

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2: Create contract instance using address from 402 response
// ─────────────────────────────────────────────────────────────────────────────
const SLOT402 = payment.accepts[0].payTo; // ← Contract address is here!
const contract = new ethers.Contract(
  SLOT402,
  [
    "function getCommitHash(uint256 secret) view returns (bytes32)",
    "function nonces(address) view returns (uint256)",
  ],
  provider
);

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3: Generate secret and fetch commit data
// ─────────────────────────────────────────────────────────────────────────────
const secret = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString();
const [commitHash, nonce] = await Promise.all([
  contract.getCommitHash(BigInt(secret)),
  contract.nonces(wallet.address),
]);

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4: Sign MetaCommit (EIP-712) and USDC payment (EIP-3009)
// ─────────────────────────────────────────────────────────────────────────────
const deadline = Math.floor(Date.now() / 1000) + 300;

const [metaCommitSig, paymentPayload] = await Promise.all([
  // MetaCommit signature (EIP-712)
  wallet.signTypedData(
    {
      name: "Slot402",
      version: "1",
      chainId: BigInt(CHAIN_ID),
      verifyingContract: SLOT402,
    },
    {
      MetaCommit: [
        { name: "player", type: "address" },
        { name: "commitHash", type: "bytes32" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    { player: wallet.address, commitHash, nonce, deadline: BigInt(deadline) }
  ),
  // USDC payment signature (EIP-3009 transferWithAuthorization)
  (async () => {
    const pm = payment.accepts[0];
    const auth = {
      from: wallet.address,
      to: pm.payTo,
      value: pm.maxAmountRequired,
      validAfter: 0,
      validBefore:
        Math.floor(Date.now() / 1000) + (pm.maxTimeoutSeconds || 600),
      nonce: ethers.hexlify(ethers.randomBytes(32)),
    };
    const signature = await wallet.signTypedData(
      {
        name: pm.extra?.name || "USD Coin",
        version: pm.extra?.version || "2",
        chainId: BigInt(pm.extra?.chainId || CHAIN_ID),
        verifyingContract: pm.asset || USDC_ADDRESS,
      },
      {
        TransferWithAuthorization: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "validAfter", type: "uint256" },
          { name: "validBefore", type: "uint256" },
          { name: "nonce", type: "bytes32" },
        ],
      },
      {
        ...auth,
        value: BigInt(auth.value),
        validAfter: BigInt(auth.validAfter),
        validBefore: BigInt(auth.validBefore),
      }
    );
    return {
      payload: { authorization: auth, signature },
      network: pm.network,
      scheme: pm.scheme,
    };
  })(),
]);

// ─────────────────────────────────────────────────────────────────────────────
// STEP 5: Submit to server and display result
// ─────────────────────────────────────────────────────────────────────────────
const submitRes = await fetch(`${API_URL}/roll/submit`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    requestId: payment.requestId,
    paymentPayload,
    metaCommit: {
      player: wallet.address,
      commitHash,
      nonce: nonce.toString(),
      deadline,
      signature: metaCommitSig,
    },
    secret,
  }),
});
if (!submitRes.ok) throw new Error("Submit failed: " + submitRes.status);

const result = await submitRes.json();
const [s1, s2, s3] = result.roll.symbols;
console.log(`🎰 [ ${s1} ] [ ${s2} ] [ ${s3} ]`);
if (result.roll.won) {
  console.log(`🏆 WON ${result.roll.payout}!`);
  console.log(`✅ https://basescan.org/tx/${result.roll.claimTransaction}`);
}
```

---

## 🏦 DeFi-Powered Treasury

Slot402 isn't just a slot machine - it's a **yield-earning protocol** with built-in tokenomics.

### How The Treasury Works

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SLOT402 TREASURY                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────────┐         ┌─────────────────────────────────────┐  │
│   │  Player Bets    │────────▶│  Contract Balance                   │  │
│   │  $0.05 USDC     │         │  (Immediate liquidity)              │  │
│   └─────────────────┘         └───────────────┬─────────────────────┘  │
│                                               │                         │
│                                               ▼                         │
│                               ┌───────────────────────────────────────┐ │
│                               │  VaultManager → Summer.fi LVUSDC      │ │
│                               │  ═══════════════════════════════════  │ │
│                               │  • Deposits idle USDC into DeFi vault │ │
│                               │  • Earns yield on $15+ reserve        │ │
│                               │  • Auto-withdraws for big payouts     │ │
│                               └───────────────────────────────────────┘ │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │  AUTOMATED TREASURY MANAGEMENT                                   │  │
│   │  ─────────────────────────────────────────────────────────────── │  │
│   │                                                                  │  │
│   │  IF treasury > $16.35 + $1 buffer:                               │  │
│   │     → Swap excess USDC for $SLOT tokens on Uniswap               │  │
│   │     → Burn tokens to 0xdead 🔥                                   │  │
│   │     → Deflationary pressure on token                             │  │
│   │                                                                  │  │
│   │  IF payout > treasury balance:                                   │  │
│   │     → Mint new $SLOT tokens                                      │  │
│   │     → Sell tokens for USDC on Uniswap                            │  │
│   │     → Pay winner in full (guaranteed!)                           │  │
│   │                                                                  │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Treasury Parameters

| Parameter            | Value        | Description                                   |
| -------------------- | ------------ | --------------------------------------------- |
| **Vault Threshold**  | $15 USDC     | Target amount kept earning yield in Summer.fi |
| **Treasury Reserve** | $16.35 USDC  | Minimum reserve to cover expected payouts     |
| **Buyback Buffer**   | $1 USDC      | Excess above reserve triggers buyback & burn  |
| **Max Jackpot**      | $441.95 USDC | 8839x multiplier on $0.05 bet (BASEETH)       |

### Yield Generation

The treasury uses **Summer.fi's FleetCommander vault (LVUSDC)** on Base:

1. **Idle USDC** → Deposited into yield-bearing vault
2. **Vault shares (LVUSDC)** → Appreciate over time as yield accrues
3. **Withdrawals** → Instant when needed for payouts

This means the house is always earning, even when nobody is playing!

---

## 🪙 Token Economics: Be The House

**Slot402Token ($SLOT)** represents ownership in the slot machine itself. When you hold $SLOT, you're essentially **being the house**.

### How Token Value Accrues

```
┌──────────────────────────────────────────────────────────────────┐
│                    $SLOT TOKEN FLYWHEEL                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│    Players Lose                Players Win Big                   │
│         │                            │                           │
│         ▼                            ▼                           │
│  ┌─────────────┐              ┌─────────────┐                   │
│  │ Treasury    │              │ Treasury    │                   │
│  │ Grows       │              │ Shrinks     │                   │
│  └──────┬──────┘              └──────┬──────┘                   │
│         │                            │                           │
│         ▼                            ▼                           │
│  ┌─────────────┐              ┌─────────────┐                   │
│  │ BUYBACK &   │              │ MINT &      │                   │
│  │ BURN 🔥     │              │ SELL        │                   │
│  │             │              │             │                   │
│  │ USDC → SLOT │              │ SLOT → USDC │                   │
│  │ SLOT → 🔥   │              │ Pay winner  │                   │
│  └──────┬──────┘              └──────┬──────┘                   │
│         │                            │                           │
│         ▼                            ▼                           │
│  ┌─────────────┐              ┌─────────────┐                   │
│  │ Supply ↓    │              │ Supply ↑    │                   │
│  │ Price ↑     │              │ Price ↓     │                   │
│  └─────────────┘              └─────────────┘                   │
│                                                                  │
│  Over time: House edge means more buybacks than mints            │
│  Result: Net deflationary pressure on $SLOT                      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Token Distribution

| Allocation           | Amount                   | Purpose                              |
| -------------------- | ------------------------ | ------------------------------------ |
| **Token Sale**       | 20,000 $SLOT             | Sold for $20 USDC (0.001 USDC/token) |
| **Liquidity Pool**   | 3,650 $SLOT + $3.65 USDC | Initial Uniswap V2 pool (18.25%)     |
| **Treasury Reserve** | -                        | Remaining $16.35 USDC (81.75%)       |

### Why Hold $SLOT?

1. **You ARE the house** - Token price reflects house profitability
2. **Deflationary by design** - House edge = more burns than mints
3. **Yield-backed** - Treasury earns DeFi yield even when idle
4. **Transparent** - All buybacks/burns visible on-chain
5. **Liquidity** - Trade anytime on Uniswap

---

## How x402 Works

### The Problem x402 Solves

Traditional on-chain slot machines require players to pay gas for every transaction:

- **Commit transaction**: ~$0.01-0.05 in gas
- **Reveal transaction**: ~$0.01-0.05 in gas
- **Total**: $0.02-0.10 per roll just in gas!

With x402, players pay **ZERO gas**. They only pay 0.06 USDC (0.05 bet + 0.01 facilitator fee).

### The x402 Flow

```
1. Player signs TWO messages (no gas):
   ├─ MetaCommit signature (slot machine authorization)
   └─ EIP-3009 signature (USDC payment authorization)

2. Server receives both signatures
   └─ Forwards to Facilitator

3. Facilitator (has ETH for gas) calls contract:
   └─ Slot402.commitWithMetaTransaction()
       ├─ Verifies MetaCommit signature ✅
       ├─ Calls USDC.transferWithAuthorization() (0.06 USDC)
       ├─ Pays 0.01 USDC to facilitator
       ├─ Deposits excess to yield vault 📈
       └─ Creates commit for player

4. Server polls Slot402.isWinner()
   └─ Returns reel positions

5. If winner, Facilitator auto-claims:
   └─ Calls Slot402.revealAndCollectFor()
       ├─ Withdraws from vault if needed
       └─ Sends USDC directly to player! 💰
```

### Player Experience

1. Click "x402 Roll" button
2. Sign two wallet prompts (MetaCommit + USDC payment)
3. Watch reels spin
4. **If winner**: USDC appears in wallet automatically!
5. **Total gas paid**: $0.00

### Economics

| Party           | Pays        | Receives                            |
| --------------- | ----------- | ----------------------------------- |
| **Player**      | 0.06 USDC   | 0.60-441.95 USDC (if win)           |
| **Player**      | $0.00 gas   | -                                   |
| **Facilitator** | ~$0.002 gas | 0.01 USDC per roll                  |
| **Treasury**    | -           | 0.05 USDC per roll (earning yield!) |

**Facilitator profit**: ~$0.008 per roll ($0.01 USDC - $0.002 gas)

---

## Smart Contracts

**Slot402**: `0x7be89683ce922f4da8085796b5527847ff5b2879` (Base)  
**Slot402Token**: `0x0e78151b5fafe87500dfc8a9c979ff1a80523493` (Base)

### Contract Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Slot402.sol                                   │
│  ═══════════════════════════════════════════════════════════════════   │
│  Main slot machine: commit-reveal, payouts, meta-transactions           │
├─────────────────────────────────────────────────────────────────────────┤
│                               │                                         │
│            ┌──────────────────┼──────────────────┐                      │
│            ▼                  ▼                  ▼                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │ SimpleTokenSale │  │ ManagedTreasury │  │  VaultManager   │         │
│  │ ═══════════════ │  │ ═══════════════ │  │ ═══════════════ │         │
│  │ Token sale      │  │ Uniswap swaps   │  │ Summer.fi vault │         │
│  │ phase mgmt      │  │ Buyback & burn  │  │ Yield earning   │         │
│  └────────┬────────┘  │ Emergency mint  │  │ Auto-withdraw   │         │
│           │           └────────┬────────┘  └────────┬────────┘         │
│           ▼                    ▼                    ▼                   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      Slot402Token.sol                            │   │
│  │  ═══════════════════════════════════════════════════════════════ │   │
│  │  ERC20 token with mint capability (controlled by Slot402)        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Functions

**Meta-Transaction (Gasless):**

- `commitWithMetaTransaction()` - Gasless roll via EIP-712 + EIP-3009
- `revealAndCollectFor()` - Anyone can claim for a player (winnings go to player)

**Traditional (Pays Gas):**

- `commit()` - Direct roll (requires USDC approval + gas)
- `revealAndCollect()` - Direct claim (requires gas)

**Treasury Management:**

- `getVaultBalance()` - Current USDC in yield vault
- `getTotalUSDCBalance()` - Total USDC (contract + vault)

**View Functions:**

- `isWinner()` - Check result without revealing
- `getReel1/2/3()` - Get reel configurations
- `getPayouts()` - Get all payout multipliers

### Provably Fair Randomness

The slot machine uses **commit-reveal** for provable fairness:

1. **Commit**: Player commits `keccak256(secret)` before block is mined
2. **Reveal**: Uses `blockhash(commitBlock)` as entropy source
3. **Positions**: `keccak256(blockhash, commitId, secret) % 45` for each reel

- Player's secret ensures house can't manipulate results
- Future blockhash ensures player can't predict results
- All reel configurations are on-chain and verifiable

### Payout Table

| Symbol         | Match       | Multiplier | Payout (0.05 USDC bet) |
| -------------- | ----------- | ---------- | ---------------------- |
| 🍒 CHERRIES    | 3 of a kind | 12x        | 0.60 USDC              |
| 🍊 ORANGE      | 3 of a kind | 17x        | 0.85 USDC              |
| 🍉 WATERMELON  | 3 of a kind | 26x        | 1.30 USDC              |
| 🎰 ANYBAR      | Any BAR mix | 35x        | 1.75 USDC              |
| ⭐ STAR        | 3 of a kind | 41x        | 2.05 USDC              |
| 🔔 BELL        | 3 of a kind | 71x        | 3.55 USDC              |
| 🎰 BAR         | 3 of a kind | 138x       | 6.90 USDC              |
| 🎰🎰 DOUBLEBAR | 3 of a kind | 327x       | 16.35 USDC             |
| 7️⃣ SEVEN       | 3 of a kind | 1105x      | 55.25 USDC             |
| ⚡ BASEETH     | 3 of a kind | 8839x      | 441.95 USDC            |

Each reel has 45 positions with varying symbol distributions (9 cherries, 8 oranges, 7 watermelons... 1 baseeth).

---

## API Documentation

### POST /roll

Request a slot machine roll.

**Request:**

```json
{
  "player": "0x..."
}
```

**Response** (402 Payment Required):

```json
{
  "error": "Payment Required",
  "x402Version": 1,
  "accepts": [
    {
      "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "payTo": "0x7be89683ce922f4da8085796b5527847ff5b2879",
      "maxAmountRequired": 60000,
      "network": "base"
    }
  ],
  "requestId": "roll_...",
  "pricing": {
    "total": "$0.06 USDC",
    "betSize": "$0.05 USDC",
    "facilitatorFee": "$0.01 USDC"
  }
}
```

### POST /roll/submit

Submit payment and execute roll.

**Request:**

```json
{
  "requestId": "roll_...",
  "paymentPayload": {
    "network": "base",
    "payload": {
      "authorization": {
        "from": "0x...",
        "to": "0x...",
        "value": 60000,
        "validAfter": 0,
        "validBefore": 1234567890,
        "nonce": "0x..."
      },
      "signature": "0x..."
    }
  },
  "metaCommit": {
    "player": "0x...",
    "commitHash": "0x...",
    "nonce": "0",
    "deadline": 1234567890,
    "signature": "0x..."
  },
  "secret": "1234567890..."
}
```

**Response:**

```json
{
  "success": true,
  "payment": {
    "transaction": "0x...",
    "payer": "0x..."
  },
  "roll": {
    "commitId": "0",
    "secret": "1234567890...",
    "won": true,
    "reelPositions": { "reel1": 3, "reel2": 9, "reel3": 3 },
    "symbols": ["CHERRIES", "CHERRIES", "CHERRIES"],
    "payout": "600000",
    "claimTransaction": "0x..."
  }
}
```

### GET /health

Health check.

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2025-11-14T18:00:00.000Z",
  "checks": {
    "facilitator": "ok",
    "contract": "deployed"
  }
}
```

---

## Architecture

### System Components

```
┌─────────────────────┐
│  Player (Browser)   │
│  - Signs 2 messages │
│  - Pays 0 gas       │
└──────────┬──────────┘
           │ HTTP + Signatures
           ▼
┌─────────────────────┐      ┌──────────────────────┐
│  x402 Server        │─────→│  x402 Facilitator    │
│  - Receives sigs    │      │  - Has ETH for gas   │
│  - Polls results    │      │  - Earns 0.01 USDC   │
│  - Port 8000        │      │  - Port 8001         │
└─────────────────────┘      └──────────┬───────────┘
                                        │ On-chain TX
                                        ▼
                             ┌─────────────────────────┐
                             │  Slot402 Contract       │
                             │  - Verifies signatures  │
                             │  - Transfers USDC       │
                             │  - Deposits to vault    │
                             │  - Pays out winners     │
                             │  - Buyback & burn       │
                             └────────────┬────────────┘
                                          │
                                          ▼
                             ┌─────────────────────────┐
                             │  Summer.fi Vault        │
                             │  - Earns yield on USDC  │
                             │  - LVUSDC shares        │
                             └─────────────────────────┘
```

### Tech Stack

- **Smart Contracts**: Solidity 0.8.20, Foundry
- **Frontend**: Next.js 14, RainbowKit, Wagmi, Viem, TypeScript
- **Backend**: Node.js, Express, ethers.js
- **Payment**: x402 protocol, EIP-3009, EIP-712
- **DeFi**: Summer.fi FleetCommander (LVUSDC), Uniswap V2
- **Chain**: Base L2 (Ethereum L2, ~$0.002 gas/tx)

### Package Structure

```
packages/
├── foundry/          # Smart contracts
│   ├── contracts/
│   │   ├── Slot402.sol           # Main slot machine
│   │   ├── Slot402Token.sol      # ERC20 token
│   │   ├── VaultManager.sol      # Summer.fi integration
│   │   ├── ManagedTreasury.sol   # Uniswap buyback/burn
│   │   └── SimpleTokenSale.sol   # Token sale
│   └── script/
│       └── Deploy.s.sol          # Deployment script
│
├── nextjs/           # Frontend
│   └── app/
│       └── page.tsx              # Slot machine UI
│
├── x402-facilitator/ # Payment facilitator
│   └── facilitator.js            # Express server
│
├── x402-server/      # Roll server
│   └── server.js                 # Express server
│
└── x402-client/      # CLI client
    └── client.js                 # Testing tool
```

---

## Running Your Own Slot402

### Prerequisites

- Node.js 18+
- Yarn
- Foundry
- Base RPC URL (Alchemy/Infura)
- Two wallets:
  - **Facilitator**: 0.01+ ETH on Base
  - **Player**: 0.06+ USDC on Base

### Installation

```bash
git clone https://github.com/scaffold-eth/based-slot.git
cd based-slot
yarn install
```

### Deploy to Base

```bash
# Deploy contracts
yarn deploy --network base

# Note the deployed Slot402 contract address
```

### Activate Slot Machine

1. Open http://localhost:3000/debug
2. Connect with owner wallet (`0x05937Df8ca0636505d92Fd769d303A3D461587ed`)
3. Find Slot402 contract
4. Call `closeTokenSale()` to activate slot machine
5. Call `addLiquidity()` to create Uniswap pool

### Configure Services

**Frontend** (`packages/nextjs/.env.local`):

```bash
# x402 Server URL (production)
NEXT_PUBLIC_X402_SERVER_URL=https://api.slot402.com:8000
# Or for local development:
# NEXT_PUBLIC_X402_SERVER_URL=http://localhost:8000
```

**Facilitator** (`packages/x402-facilitator/.env`):

```bash
PRIVATE_KEY=0x...
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
CHAIN_ID=8453
PORT=8001
```

**Server** (`packages/x402-server/.env`):

```bash
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
USDC_CONTRACT=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
FACILITATOR_URL=http://localhost:8001
CHAIN_ID=8453
PORT=8000
```

### Start Services

```bash
# Terminal 1 - Facilitator
yarn facilitator

# Terminal 2 - Server
yarn server

# Terminal 3 - Frontend
yarn start

# Terminal 4 - Test CLI
yarn client
```

---

## Security

### No Frontrunning

- **Commit-reveal** prevents result prediction
- **`revealAndCollectFor()`** sends to player address (not `msg.sender`)
- Even if claim is frontrun, player still receives winnings

### Replay Protection

- **Nonces** for MetaCommit signatures
- **Random nonces** for EIP-3009 signatures
- **USDC tracks** authorization state on-chain

### Provable Fairness

- **Blockhash** provides unbiased randomness
- **Player's secret** prevents house manipulation
- **Open source** - verify reel configurations on-chain
- **No admin override** - results are deterministic

---

## Development

### Local Testing

```bash
# Start local chain
yarn chain

# Deploy contracts
yarn deploy

# Start frontend
yarn start
```

Visit: http://localhost:3000

### Testing with Base Fork

```bash
# Fork Base mainnet
yarn fork --network base

# Deploy to fork
yarn deploy

# Close token sale via /debug page

# Run x402 services
yarn facilitator
yarn server
yarn client
```

### Running Tests

```bash
# Foundry tests
yarn foundry:test

# Test specific contract
cd packages/foundry
forge test --match-contract Slot402Test -vvv
```

---

## Troubleshooting

### "Insufficient USDC balance"

Player needs at least 0.06 USDC. Get USDC on Base:

- Swap ETH → USDC on Uniswap
- Bridge from Ethereum mainnet via Base bridge
- Use frontend's "Swap ETH for USDC" button

### "Facilitator has no ETH for gas"

Facilitator wallet needs ETH:

```bash
# Send ETH to facilitator
cast send FACILITATOR_ADDRESS --value 0.01ether \
  --private-key YOUR_KEY --rpc-url base
```

### "FiatTokenV2: invalid signature"

Common causes:

- **Wrong chainId**: USDC on Base uses chainId 8453
- **Expired signature**: Check `validBefore` timestamp
- **Nonce already used**: Each EIP-3009 nonce is single-use
- **Wrong domain**: Ensure using "USD Coin" version "2"

---

## Resources

- **x402 Protocol**: https://x402.gitbook.io/x402
- **EIP-3009**: https://eips.ethereum.org/EIPS/eip-3009
- **EIP-712**: https://eips.ethereum.org/EIPS/eip-712
- **Summer.fi**: https://summer.fi
- **Base Network**: https://base.org
- **Scaffold-ETH**: https://scaffoldeth.io

---

## Built with Scaffold-ETH 2

<h4 align="center">
  <a href="https://docs.scaffoldeth.io">Documentation</a> |
  <a href="https://scaffoldeth.io">Website</a>
</h4>

This project is built with Scaffold-ETH 2, an open-source toolkit for building dApps on Ethereum.

---

## Warnings

⚠️ **THIS IS A PROTOTYPE FOR EDUCATIONAL PURPOSES**

- Contract owner can call `rug()` to withdraw all USDC
- Contract can mint unlimited tokens for treasury
- House edge favors the contract over time
- **DO NOT USE WITH REAL MONEY YOU CAN'T AFFORD TO LOSE**

This is an educational project showcasing:

- x402 gasless payment protocol
- EIP-3009 meta-transactions
- On-chain commit-reveal randomness
- DeFi yield integration (Summer.fi)
- Automated treasury management with Uniswap
- Deflationary tokenomics via buyback & burn

**Play responsibly and understand the risks!**
