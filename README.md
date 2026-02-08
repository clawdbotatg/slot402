# 🦞 ClawdSlots — Gasless Slot Machine on Base

> Every play buys CLAWD. Payouts in CLAWD. Overflow gets burned. 🔥

**Live at**: [https://slot402.com](https://slot402.com)

A **fully gasless** on-chain slot machine where every spin swaps USDC → CLAWD via Uniswap V3, fills the hopper, and pays winners in CLAWD tokens. Hopper overflow above the burn threshold gets sent to the dead address.

- **Fully x402 compliant** — Pay with signatures, not gas
- **Provably fair** — Commit-reveal randomness on Base L2
- **Every play buys CLAWD** — USDC bet is swapped to CLAWD via Uniswap V3
- **Burns excess** — Hopper overflow above threshold burned to 0xdead
- **Live on Base Mainnet**

## How It Works

1. **Player signs two messages** (no gas needed):
   - MetaCommit (EIP-712) — commits to the roll
   - USDC payment (EIP-3009) — authorizes the bet
2. **Facilitator pays gas** and submits both to the contract
3. **Contract swaps USDC → WETH → CLAWD** via Uniswap V3
4. **Commit-reveal randomness** determines the result (3 reels × 45 positions)
5. **Winners get paid in CLAWD** from the hopper (bet × multiplier)
6. **Hopper overflow gets burned** to `0x000000000000000000000000000000000000dEaD`

## Payout Table

| Combination | Multiplier |
|------------|-----------|
| 3× Base ETH | 8839x |
| 3× Seven | 1105x |
| 3× Double Bar | 327x |
| 3× Bar | 138x |
| 3× Bell | 71x |
| 3× Claw 🦞 | 41x |
| Any Bar Combo | 36x |
| 3× Watermelon | 26x |
| 3× Orange | 17x |
| 3× Cherries | 12x |

## Contract

- **Address**: [`0x7e34d120d50127D39ed29033E286d5F43Ecd4782`](https://basescan.org/address/0x7e34d120d50127D39ed29033E286d5F43Ecd4782)
- **Chain**: Base (8453)
- **CLAWD Token**: [`0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07`](https://basescan.org/token/0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07)
- **Swap Route**: USDC →(0.05%)→ WETH →(1%)→ CLAWD (Uniswap V3)

## Quick Start — Roll via Script

```javascript
// ClawdSlots CLIENT — copy/paste example for ethers v6
// Create .env file with PRIVATE_KEY=0x... then run: node roll.js

import "dotenv/config";
import { ethers } from "ethers";

const CHAIN_ID = 8453;
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const API_URL = "https://api.slot402.com:8000";

if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY not set in .env");
const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// STEP 1: Request roll → Server returns 402 with payment details
const rollResponse = await fetch(`${API_URL}/roll`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ player: wallet.address }),
});
if (rollResponse.status !== 402) throw new Error("Expected 402");
const payment = await rollResponse.json();
console.log(`💳 Bet: ${payment.pricing.betSize} + ${payment.pricing.facilitatorFee} fee`);

// STEP 2: Get contract data
const CONTRACT = payment.accepts[0].payTo;
const contract = new ethers.Contract(CONTRACT, [
  "function getCommitHash(uint256 secret) view returns (bytes32)",
  "function nonces(address) view returns (uint256)",
], provider);

const secret = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString();
const [commitHash, nonce] = await Promise.all([
  contract.getCommitHash(BigInt(secret)),
  contract.nonces(wallet.address),
]);

// STEP 3: Sign MetaCommit (EIP-712) + USDC payment (EIP-3009)
const deadline = Math.floor(Date.now() / 1000) + 300;

const metaCommitSig = await wallet.signTypedData(
  { name: "ClawdSlots", version: "1", chainId: BigInt(CHAIN_ID), verifyingContract: CONTRACT },
  { MetaCommit: [
    { name: "player", type: "address" },
    { name: "commitHash", type: "bytes32" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ]},
  { player: wallet.address, commitHash, nonce, deadline: BigInt(deadline) }
);

const pm = payment.accepts[0];
const auth = {
  from: wallet.address, to: pm.payTo,
  value: pm.maxAmountRequired, validAfter: 0,
  validBefore: Math.floor(Date.now() / 1000) + 600,
  nonce: ethers.hexlify(ethers.randomBytes(32)),
};
const usdcSig = await wallet.signTypedData(
  { name: pm.extra?.name || "USD Coin", version: pm.extra?.version || "2",
    chainId: BigInt(pm.extra?.chainId || CHAIN_ID), verifyingContract: pm.asset || USDC_ADDRESS },
  { TransferWithAuthorization: [
    { name: "from", type: "address" }, { name: "to", type: "address" },
    { name: "value", type: "uint256" }, { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" },
  ]},
  { ...auth, value: BigInt(auth.value), validAfter: BigInt(auth.validAfter), validBefore: BigInt(auth.validBefore) }
);

// STEP 4: Submit roll
const result = await fetch(`${API_URL}/roll/submit`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    requestId: payment.requestId,
    paymentPayload: { payload: { authorization: auth, signature: usdcSig }, network: pm.network, scheme: pm.scheme },
    metaCommit: { player: wallet.address, commitHash, nonce: nonce.toString(), deadline, signature: metaCommitSig },
    secret,
  }),
}).then(r => r.json());

if (result.success) {
  console.log(`🎰 [ ${result.roll.symbols.join(" | ")} ]`);
  console.log(result.roll.won ? `🎉 Won ${result.roll.payout} CLAWD!` : "No win this time");
} else {
  console.error("Roll failed:", result.error);
}
```

## API Endpoints

```
POST https://api.slot402.com:8000/roll        — Request a roll (returns 402 Payment Required)
POST https://api.slot402.com:8000/roll/submit  — Submit signed payment and get result
GET  https://api.slot402.com:8000/health       — Health check
```

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐     ┌──────────────┐
│   Frontend   │────▶│  x402-server │────▶│  Facilitator  │────▶│  ClawdSlots  │
│  (Next.js)   │◀────│  (port 8000) │◀────│  (port 8001)  │     │  (Base L2)   │
└─────────────┘     └──────────────┘     └───────────────┘     └──────┬───────┘
                                                                       │
                                                                ┌──────▼───────┐
                                                                │  Uniswap V3  │
                                                                │ USDC→WETH→CLAWD│
                                                                └──────────────┘
```

- **Frontend** (`packages/nextjs`) — Scaffold-ETH 2, connects wallet, shows reels + payout table
- **x402-server** (`packages/x402-server`) — API server, creates 402 responses, polls for results
- **Facilitator** (`packages/x402-facilitator`) — Hot wallet that pays gas, submits txs, claims winnings
- **ClawdSlots** (`packages/foundry`) — Solidity contract with commit-reveal, Uniswap V3 swap, hopper

## Economics

| Per Roll | Amount |
|----------|--------|
| Total cost | $0.021 USDC |
| Bet (→ CLAWD) | $0.020 USDC |
| Facilitator fee | $0.001 USDC |
| House edge | ~5% |

- Every bet swaps USDC to CLAWD via Uniswap V3 and adds to the hopper
- Winners are paid from the hopper (bet × multiplier)
- If hopper exceeds burn threshold → excess CLAWD burned to 0xdead
- If hopper is empty → machine shows "needs servicing"

## Development

```bash
# Clone
git clone https://github.com/clawdbotatg/slot402.git
cd slot402

# Install
yarn install

# Start local Base fork
yarn fork

# Deploy contract to fork
yarn deploy

# Start facilitator (new terminal)
cd packages/x402-facilitator && node facilitator.js

# Start x402 server (new terminal)
cd packages/x402-server && node server.js

# Start frontend (new terminal)
yarn start
# Open http://localhost:3000
```

## Project Structure

```
packages/
├── foundry/              # Solidity contracts + tests
│   ├── contracts/
│   │   └── ClawdSlots.sol    # Main contract (617 lines)
│   ├── test/
│   │   └── ClawdSlots.t.sol  # 20 Foundry tests
│   └── script/
│       └── DeployClawdSlots.s.sol
├── nextjs/               # Frontend (Scaffold-ETH 2)
│   ├── app/
│   │   ├── page.tsx          # Main slot machine UI
│   │   └── components/       # PayoutTable, OwnerControls, etc.
│   ├── hooks/                # useCommitStorage, useCommitPolling
│   └── contracts/            # deployedContracts.ts (auto-generated)
├── x402-server/          # API server (x402 payment flow)
│   └── server.js
└── x402-facilitator/     # Gas-paying facilitator
    └── facilitator.js
```

## Key Tech

- **Scaffold-ETH 2** — React + wagmi + viem frontend
- **Foundry** — Solidity development + testing
- **x402 Protocol** — Gasless payments via EIP-3009
- **EIP-712** — Typed structured data signing
- **Uniswap V3** — On-chain USDC → CLAWD swap
- **Commit-reveal** — Provably fair randomness

## Credits

Fork of [Slot402](https://github.com/austintgriffith/slot402) by Austin Griffith. CLAWD-themed by [Clawd](https://github.com/clawdbotatg).

---

Built with 🦞 by Clawd • [scaffold-eth](https://github.com/scaffold-eth/scaffold-eth-2) • [BuidlGuidl](https://buidlguidl.com)
