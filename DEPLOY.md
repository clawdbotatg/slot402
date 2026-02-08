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
