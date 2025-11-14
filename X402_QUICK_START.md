# x402 Quick Start Guide

## What is x402?

**x402 is a gasless payment protocol** that lets users interact with smart contracts without paying gas fees. Instead of sending transactions, users just sign messages, and a facilitator handles the on-chain execution.

For Slot402, this means:

- ✅ **No gas fees** for players
- ✅ **No USDC approval** required (uses EIP-3009)
- ✅ **Automatic result polling** and claiming
- ✅ **Better UX** - just sign and play!

---

## How It Works (Simple Version)

### Traditional Roll:

```
1. You: Approve USDC               [Pay gas 💸]
2. You: Send commit transaction    [Pay gas 💸]
3. You: Wait...
4. You: Manually check result
5. You: Claim winnings (if won)    [Pay gas 💸]
```

### x402 Roll:

```
1. You: Sign MetaCommit            [Free! ✨]
2. You: Sign USDC payment          [Free! ✨]
3. Server: Does everything else    [You pay $0.01 extra, save ~$0.10 in gas]
4. Done! Results and winnings automatically handled
```

---

## Frontend Implementation (React/Next.js)

In `packages/nextjs/app/page.tsx`, the `handleX402Roll()` function:

```typescript
const handleX402Roll = async () => {
  // 1. Request roll (get 402 Payment Required)
  const rollResponse = await fetch(`${SERVER_URL}/roll`, {
    method: "POST",
    body: JSON.stringify({ player: connectedAddress }),
  });
  const paymentRequired = await rollResponse.json();

  // 2. Generate secret and read contract data
  const secret = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString();
  const commitHash = await contract.getCommitHash(BigInt(secret));
  const playerNonce = await contract.nonces(connectedAddress);

  // 3. Sign EIP-712 MetaCommit (authorize facilitator to commit for you)
  const metaCommitSignature = await signTypedDataAsync({
    domain: { name: "Slot402", version: "1", ... },
    types: { MetaCommit: [...] },
    message: { player, commitHash, nonce, deadline }
  });

  // 4. Sign EIP-3009 USDC payment (no approval needed!)
  const signer = walletClientToSigner(walletClient);
  const paymentPayload = await processPayment(requirements, signer);

  // 5. Submit everything to server
  const result = await fetch(`${SERVER_URL}/roll/submit`, {
    method: "POST",
    body: JSON.stringify({
      requestId: paymentRequired.requestId,
      paymentPayload: paymentPayload,
      metaCommit: { player, commitHash, nonce, deadline, signature },
      secret: secret
    })
  });

  // 6. Display results (server handles everything!)
  setReelPositions(result.roll.reelPositions);
};
```

**Key points:**

- No transactions from user! Just 2 signatures
- `processPayment()` from `a2a-x402` library creates the EIP-3009 signature
- `walletClientToSigner()` converts viem WalletClient to ethers Signer
- Server returns complete results including transaction hashes

---

## Node.js Example

Full working example: `examples/x402-roll-example.js`

```javascript
const { ethers } = require("ethers");
const { processPayment } = require("a2a-x402");

async function rollSlot() {
  // 1. Request roll
  const rollResponse = await fetch(`${SERVER_URL}/roll`, {
    method: "POST",
    body: JSON.stringify({ player: wallet.address }),
  });
  const paymentRequired = await rollResponse.json();

  // 2. Get contract data
  const secret = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString();
  const commitHash = await contract.getCommitHash(BigInt(secret));
  const playerNonce = await contract.nonces(wallet.address);

  // 3. Sign MetaCommit
  const metaCommitSig = await wallet.signTypedData(domain, types, {
    player: wallet.address,
    commitHash,
    nonce: playerNonce,
    deadline,
  });

  // 4. Sign USDC payment (EIP-3009)
  const requirements = paymentRequired.accepts[0];
  const paymentPayload = await processPayment(requirements, wallet);

  // 5. Submit
  const result = await fetch(`${SERVER_URL}/roll/submit`, {
    method: "POST",
    body: JSON.stringify({
      requestId: paymentRequired.requestId,
      paymentPayload,
      metaCommit: {
        player: wallet.address,
        commitHash,
        nonce,
        deadline,
        signature: metaCommitSig,
      },
      secret,
    }),
  });

  // 6. Done!
  console.log("Result:", result.roll.symbols);
  console.log("Won:", result.roll.won);
}
```

---

## Running the Example

```bash
# Install dependencies
npm install ethers@6 a2a-x402 dotenv

# Create .env file
cat > .env << EOF
PRIVATE_KEY=0x...
BASE_RPC_URL=https://mainnet.base.org
X402_SERVER_URL=http://localhost:8000
CHAIN_ID=8453
EOF

# Run it!
node examples/x402-roll-example.js
```

---

## Cost Comparison

| Method          | Player Cost                        | Player Actions                 |
| --------------- | ---------------------------------- | ------------------------------ |
| **Traditional** | $0.05 bet + ~$0.10 gas = **$0.15** | Approve, commit, claim (3 TXs) |
| **x402**        | $0.06 total = **$0.06**            | Sign twice (0 TXs)             |
| **Savings**     | **$0.09 saved!**                   | **3 fewer transactions!**      |

---

## Key Components

### Frontend (`page.tsx`)

- `handleX402Roll()` - Main roll function
- Uses wagmi hooks + `a2a-x402` library
- Converts viem wallet to ethers signer

### Server (`packages/x402-server/`)

- Receives roll requests
- Returns 402 Payment Required
- Verifies signatures via facilitator
- Polls for results
- Auto-claims winnings

### Facilitator (`packages/x402-facilitator/`)

- Verifies EIP-712 and EIP-3009 signatures
- Executes on-chain transactions
- Pays gas fees
- Earns $0.01 fee per roll

### Client (`packages/x402-client/`)

- CLI tool for testing
- Same flow as frontend
- Works with ethers.js directly

---

## Two Signatures Required

### 1. MetaCommit Signature (EIP-712)

**What it does:** Authorizes the facilitator to create a commit on your behalf

```typescript
domain: {
  name: "Slot402",
  version: "1",
  chainId: 8453,
  verifyingContract: RUGSLOT_ADDRESS
}

types: {
  MetaCommit: [
    { name: "player", type: "address" },
    { name: "commitHash", type: "bytes32" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" }
  ]
}
```

### 2. USDC Payment Signature (EIP-3009)

**What it does:** Authorizes USDC transfer without approval

```typescript
domain: {
  name: "USD Coin",
  version: "2",
  chainId: 8453,
  verifyingContract: USDC_ADDRESS
}

types: {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" }
  ]
}
```

---

## Security Features

1. ✅ **Signature Verification** - Both signatures verified before execution
2. ✅ **Nonce Protection** - Prevents replay attacks
3. ✅ **Deadline Enforcement** - Signatures expire after 5 minutes
4. ✅ **Amount Verification** - Exact USDC amount checked
5. ✅ **Address Validation** - Player address must match signer

---

## Troubleshooting

### "Wallet client not available"

- Make sure wallet is connected
- Check that `useWalletClient()` is returning data

### "Insufficient USDC balance"

- Need 0.06 USDC (0.05 bet + 0.01 fee)
- Bridge ETH to Base and swap for USDC

### "Payment verification failed"

- Check CHAIN_ID matches deployment
- Verify RPC_URL is correct
- Ensure using correct chainId in EIP-3009 signature

### "Signature verification failed"

- User signed with wrong account
- ChainId mismatch between signature and verification
- Deadline expired (signatures valid for 5 minutes)

---

## Resources

- 📖 **Full Guide**: `X402_ROLL_GUIDE.md`
- 💻 **Example Code**: `examples/x402-roll-example.js`
- 🌐 **Live Demo**: https://based-slot.vercel.app
- 🔗 **x402 Spec**: https://github.com/standard/x402
- 🔗 **EIP-3009**: https://eips.ethereum.org/EIPS/eip-3009

---

## Next Steps

1. ✅ Read this quick start
2. ✅ Try the example script: `node examples/x402-roll-example.js`
3. ✅ Read the full guide: `X402_ROLL_GUIDE.md`
4. ✅ Check the frontend implementation: `packages/nextjs/app/page.tsx` (line 517)
5. ✅ Deploy and test!

**Happy (gasless) rolling! 🎰✨**
