# Slot402 Deployment Guide

---

## Local Development (Anvil Fork)

### Quick Start

```bash
cd slot402

# 1. Start Anvil fork of Base (MUST use --chain-id 8453 + --block-time 1)
#    --chain-id 8453: so MetaMask EIP-712 sigs match USDC's domain
#    --block-time 1: so blocks advance for commit-reveal (otherwise reveal never happens)
anvil --fork-url https://base-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY --chain-id 8453 --block-time 1

# 2. Deploy contracts to fork
cd packages/foundry
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast --legacy --ffi
make generate-abis

# 3. Fund the hopper (impersonate the CLAWD multisig whale)
CLAWD=0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07
WHALE=0x90eF2A9211A3E7CE788561E5af54C76B0Fa3aEd0
CONTRACT=<deployed-address-from-step-2>
# Give whale gas
cast send $WHALE --value 1ether --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --rpc-url http://127.0.0.1:8545
cast rpc anvil_impersonateAccount $WHALE --rpc-url http://127.0.0.1:8545
cast send $CLAWD "transfer(address,uint256)" $CONTRACT 500000000000000000000000 --from $WHALE --rpc-url http://127.0.0.1:8545 --unlocked

# 4. Start facilitator + server (separate terminals)
cd packages/x402-facilitator && node facilitator.js
cd packages/x402-server && node server.js

# 5. Start frontend
yarn workspace @se-2/nextjs dev
# → http://localhost:3000
```

### Environment Files (Local Dev)

#### `packages/nextjs/.env.local`
```bash
NEXT_PUBLIC_BASE_RPC_URL=http://127.0.0.1:8545
```
This tells the frontend to use the local fork. When not set, defaults to Alchemy (production).

#### `packages/x402-facilitator/.env`
```bash
PORT=8001
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80  # Anvil account 0
BASE_RPC_URL=http://127.0.0.1:8545
CHAIN_ID=8453
```

#### `packages/x402-server/.env`
```bash
PORT=8000
USDC_CONTRACT=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
BASE_RPC_URL=http://127.0.0.1:8545
FACILITATOR_URL=http://localhost:8001
CHAIN_ID=8453
```

### Why `--chain-id 8453`?

MetaMask enforces that EIP-712 signature domain `chainId` matches the wallet's active chain. Since the forked USDC contract has its domain permanently set to 8453 (Base), Anvil must also report chainId 8453. Otherwise MetaMask rejects the `transferWithAuthorization` signature with:

> "Provided chainId 8453 must match the active chainId 31337"

### Checklist

- [ ] Anvil running with `--chain-id 8453 --block-time 1`
- [ ] Contract deployed and address in `broadcast/Deploy.s.sol/8453/run-latest.json`
- [ ] ABIs generated (`make generate-abis`)
- [ ] Hopper funded with CLAWD (impersonate whale)
- [ ] `.env.local` has `NEXT_PUBLIC_BASE_RPC_URL=http://127.0.0.1:8545`
- [ ] Facilitator `.env` has `CHAIN_ID=8453`
- [ ] Server `.env` has `CHAIN_ID=8453`
- [ ] MetaMask on Base network, unlocked

---

# Production Deployment Guide

## Overview

Three components need to run:

| Component | Port | What it does |
|-----------|------|-------------|
| **x402-facilitator** | 8001 | Hot wallet that pays gas, submits txs to contract |
| **x402-server** | 8000 | API server — handles 402 flow, polls results, claims wins |
| **Frontend (Vercel)** | — | Static Next.js app, talks to x402-server |

## Server Setup

### 1. Clone and install

```bash
git clone https://github.com/clawdbotatg/slot402.git
cd slot402
yarn install
```

### 2. Create facilitator wallet

Generate a fresh wallet for the facilitator. This wallet:
- Pays gas for user rolls (~$0.001 per roll on Base)
- Earns facilitator fee ($0.001 USDC per roll)
- Does NOT hold user funds

```bash
# Generate a new wallet (or use any method)
cast wallet new
# Fund it with ~0.01 ETH on Base (enough for ~100 rolls)
```

### 3. Configure environment files

#### `packages/x402-facilitator/.env`

```bash
PORT=8001
PRIVATE_KEY=0x...          # Facilitator wallet private key (freshly generated)
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
CHAIN_ID=8453
```

#### `packages/x402-server/.env`

```bash
PORT=8000
USDC_CONTRACT=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
FACILITATOR_URL=http://localhost:8001
CHAIN_ID=8453
```

### 4. Start services

```bash
# Terminal 1: Facilitator
cd packages/x402-facilitator
node facilitator.js

# Terminal 2: x402 Server
cd packages/x402-server
node server.js
```

Or with pm2:

```bash
pm2 start packages/x402-facilitator/facilitator.js --name clawd-facilitator
pm2 start packages/x402-server/server.js --name clawd-server
pm2 save
```

### 5. Reverse proxy (nginx)

```nginx
server {
    listen 443 ssl;
    server_name api.slot402.com;

    ssl_certificate /etc/letsencrypt/live/api.slot402.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.slot402.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 6. Health check

```bash
curl https://api.slot402.com/health
# Should return: {"status":"healthy","checks":{"facilitator":"ok","contract":"deployed"}}
```

## Vercel Frontend

### Environment variables

Set these in Vercel project settings:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_ALCHEMY_API_KEY` | Your Alchemy API key |

### Build settings

- **Root Directory**: `packages/nextjs`
- **Framework**: Next.js
- **Build Command**: `next build`
- **Install Command**: `yarn install`

### API URL

The frontend currently has `api.slot402.com:8000` hardcoded in the client code example on the page. The actual x402 flow is initiated by the player's script or wallet — the frontend just displays the UI and connects wallets.

## Contract Details

| | |
|-|-|
| **Contract** | `0x7e34d120d50127D39ed29033E286d5F43Ecd4782` |
| **Chain** | Base (8453) |
| **Owner** | `0xa822155c242B3a307086F1e2787E393d78A0B5AC` (deployer-3) |
| **Bet** | 0.02 USDC (test amounts) |
| **Facilitator fee** | 0.001 USDC |
| **Hopper** | 500K CLAWD |
| **Min hopper** | 490K CLAWD |
| **Burn threshold** | 10M CLAWD |
| **Swap** | USDC →(0.05%)→ WETH →(1%)→ CLAWD via Uniswap V3 |

## Facilitator Economics

The facilitator is self-sustaining:
- **Earns**: $0.001 USDC per roll (facilitator fee)
- **Spends**: ~$0.001 per roll (Base gas)
- **Break even**: ~1 roll (gas ≈ fee)
- **Needs**: Small initial ETH balance (~0.01 ETH = ~$20)

The facilitator accumulates USDC from fees. It never touches the hopper or player funds.
