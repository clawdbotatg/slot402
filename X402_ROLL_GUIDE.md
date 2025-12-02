# x402 Gasless Roll Implementation Guide

## Overview

The x402 protocol enables **gasless slot machine rolls** where:

- 🎰 Player signs transactions but doesn't pay gas
- 💰 Payment is made via EIP-3009 USDC authorization (no approval needed!)
- 🤖 A facilitator executes the on-chain transaction
- 🎁 Winnings are automatically claimed and sent to the player

## Frontend Implementation (`page.tsx`)

### The `handleX402Roll()` Function

This function orchestrates the entire x402 roll flow:

```typescript
const handleX402Roll = async () => {
  // 1. UI Setup
  setIsX402Rolling(true);
  setX402Error(null);
  setReelPositions(null); // Clear previous positions
  setReelsAnimating(true);

  // 2. Request roll from server (expect 402 Payment Required)
  const rollResponse = await fetch(`${SERVER_URL}/roll`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player: connectedAddress }),
  });

  const paymentRequired = await rollResponse.json();
  // Response includes: x402Version, accepts[], requestId, pricing

  // 3. Check USDC balance (NO APPROVAL NEEDED!)
  const requirements = paymentRequired.accepts[0];
  const amountRequired = BigInt(requirements.maxAmountRequired); // 60000 (0.06 USDC)

  // 4. Generate secret and get contract data
  const secret = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString();
  const commitHash = await contract.getCommitHash(BigInt(secret));
  const playerNonce = await contract.nonces(connectedAddress);
  const expectedCommitId = await contract.commitCount(connectedAddress);

  // 5. Sign EIP-712 MetaCommit
  const metaCommitSignature = await signTypedDataAsync({
    domain: {
      name: "Slot402",
      version: "1",
      chainId: BigInt(targetNetwork.id),
      verifyingContract: contractAddress,
    },
    types: {
      MetaCommit: [
        { name: "player", type: "address" },
        { name: "commitHash", type: "bytes32" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    message: {
      player: connectedAddress,
      commitHash: commitHash,
      nonce: playerNonce,
      deadline: BigInt(deadline),
    },
  });

  // 6. Sign EIP-3009 USDC payment authorization
  const signer = walletClientToSigner(walletClient); // Convert viem to ethers
  const paymentPayload = await processPayment(requirements, signer);
  // This creates the EIP-3009 transferWithAuthorization signature

  // 7. Submit everything to server
  const submitResponse = await fetch(`${SERVER_URL}/roll/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId: paymentRequired.requestId,
      paymentPayload: paymentPayload,
      metaCommit: {
        player: connectedAddress,
        commitHash: commitHash,
        nonce: playerNonce.toString(),
        deadline: deadline,
        signature: metaCommitSignature,
      },
      secret: secret,
    }),
  });

  const result = await submitResponse.json();

  // 8. Display results
  setReelPositions({
    reel1: result.roll.reelPositions.reel1,
    reel2: result.roll.reelPositions.reel2,
    reel3: result.roll.reelPositions.reel3,
  });

  // If won, winnings are automatically sent to player!
  if (result.roll.won && result.roll.claimTransaction) {
    console.log("Winner! Auto-claimed:", result.roll.claimTransaction);
  }
};
```

### Key Features

#### 1. **No USDC Approval Required**

Unlike traditional ERC-20 transfers, EIP-3009 uses signature-based authorization:

```typescript
// ❌ Traditional (requires approval):
await usdc.approve(contract, amount);
await contract.commit(commitHash);

// ✅ x402 (no approval needed):
const signature = await signEIP3009Authorization(...);
// Facilitator submits signature directly
```

#### 2. **Two Signatures Required**

- **MetaCommit Signature**: Authorizes the facilitator to create a commit on your behalf
- **USDC Payment Signature**: Authorizes the USDC transfer (EIP-3009)

#### 3. **Automatic Claim**

The server polls for results and automatically claims winnings, sending USDC directly to the player.

---

## Node.js Example

Here's a complete standalone example for rolling via x402:

```javascript
/**
 * x402 Gasless Roll Example
 *
 * This example shows how to roll the slot machine using x402 payments
 * from a Node.js environment (CLI, backend, etc.)
 */

const { ethers } = require("ethers");
const { processPayment } = require("a2a-x402");

// Configuration
const PRIVATE_KEY = "0x..."; // Your private key
const RPC_URL = "https://mainnet.base.org"; // Base mainnet RPC
const SERVER_URL = "https://api.slot402.com:8000"; // x402 server URL
const RUGSLOT_ADDRESS = "0x..."; // Slot402 contract address

// Initialize wallet
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// Minimal Slot402 ABI
const RUGSLOT_ABI = [
  "function getCommitHash(uint256 _secret) external pure returns (bytes32)",
  "function nonces(address) external view returns (uint256)",
  "function commitCount(address) external view returns (uint256)",
];

async function rollSlot() {
  console.log("🎰 Starting x402 roll...");
  console.log(`   Player: ${wallet.address}\n`);

  // Step 1: Request roll from server (expect 402)
  console.log("📡 Step 1: Requesting roll from server...");
  const rollResponse = await fetch(`${SERVER_URL}/roll`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player: wallet.address }),
  });

  if (rollResponse.status !== 402) {
    throw new Error(`Expected 402, got ${rollResponse.status}`);
  }

  const paymentRequired = await rollResponse.json();
  console.log("💳 Payment Required:");
  console.log(`   Total: ${paymentRequired.pricing.total}`);
  console.log(`   Request ID: ${paymentRequired.requestId}\n`);

  // Step 2: Check USDC balance
  console.log("💰 Step 2: Checking USDC balance...");
  const requirements = paymentRequired.accepts[0];
  const usdcContract = new ethers.Contract(
    requirements.asset,
    ["function balanceOf(address) view returns (uint256)"],
    provider
  );
  const balance = await usdcContract.balanceOf(wallet.address);
  const balanceFormatted = ethers.formatUnits(balance, 6);
  console.log(`   Balance: ${balanceFormatted} USDC\n`);

  if (balance < BigInt(requirements.maxAmountRequired)) {
    throw new Error("Insufficient USDC balance");
  }

  // Step 3: Generate secret and get commit data
  console.log("🎲 Step 3: Generating secret and commit data...");
  const rugSlotContract = new ethers.Contract(
    RUGSLOT_ADDRESS,
    RUGSLOT_ABI,
    provider
  );

  const secret = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString();
  console.log(`   Secret: ${secret.substring(0, 10)}...`);

  const commitHash = await rugSlotContract.getCommitHash(BigInt(secret));
  console.log(`   Commit hash: ${commitHash}`);

  const playerNonce = await rugSlotContract.nonces(wallet.address);
  console.log(`   Player nonce: ${playerNonce.toString()}`);

  const expectedCommitId = await rugSlotContract.commitCount(wallet.address);
  console.log(`   Expected commit ID: ${expectedCommitId.toString()}\n`);

  // Step 4: Sign EIP-712 MetaCommit
  console.log("✍️  Step 4: Signing MetaCommit (EIP-712)...");
  const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes

  const domain = {
    name: "Slot402",
    version: "1",
    chainId: 8453, // Base mainnet
    verifyingContract: RUGSLOT_ADDRESS,
  };

  const types = {
    MetaCommit: [
      { name: "player", type: "address" },
      { name: "commitHash", type: "bytes32" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  };

  const value = {
    player: wallet.address,
    commitHash: commitHash,
    nonce: playerNonce,
    deadline: deadline,
  };

  const metaCommitSignature = await wallet.signTypedData(domain, types, value);
  console.log(
    `✅ MetaCommit signed: ${metaCommitSignature.substring(0, 20)}...\n`
  );

  // Step 5: Sign EIP-3009 USDC payment authorization
  console.log("✍️  Step 5: Signing payment authorization (EIP-3009)...");
  const paymentPayload = await processPayment(requirements, wallet);
  console.log(`✅ Payment authorization signed\n`);

  // Step 6: Submit everything to server
  console.log("📤 Step 6: Submitting to server...");
  const submitResponse = await fetch(`${SERVER_URL}/roll/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId: paymentRequired.requestId,
      paymentPayload: paymentPayload,
      metaCommit: {
        player: wallet.address,
        commitHash: commitHash,
        nonce: playerNonce.toString(),
        deadline: deadline,
        signature: metaCommitSignature,
      },
      secret: secret,
    }),
  });

  if (!submitResponse.ok) {
    const errorData = await submitResponse.json();
    throw new Error(`Submit failed: ${errorData.error} - ${errorData.reason}`);
  }

  const result = await submitResponse.json();

  // Success!
  console.log("\n🎉 SUCCESS! Slot roll completed!\n");
  console.log("=".repeat(70));
  console.log("SLOT ROLL RESULT");
  console.log("=".repeat(70));

  const symbols = result.roll.symbols || [];
  if (symbols.length === 3) {
    console.log(
      `\n🎰 Result: [ ${symbols[0]} ] [ ${symbols[1]} ] [ ${symbols[2]} ]`
    );
  }

  console.log(
    `\n   Reel Positions: ${result.roll.reelPositions.reel1}, ${result.roll.reelPositions.reel2}, ${result.roll.reelPositions.reel3}`
  );

  if (result.roll.won) {
    console.log(`\n🎉 🎉 🎉 WINNER! 🎉 🎉 🎉`);
    console.log(`   Payout: ${result.roll.payout}`);

    if (result.roll.claimTransaction) {
      console.log(`\n✅ Winnings automatically claimed!`);
      console.log(`   Claim TX: ${result.roll.claimTransaction}`);
      console.log(
        `   View: https://basescan.org/tx/${result.roll.claimTransaction}`
      );
    }
  } else {
    console.log(`\n   Not a winner this time. Try again!`);
  }

  console.log(`\n💳 Payment Transaction: ${result.payment.transaction}`);
  console.log(
    `   View: https://basescan.org/tx/${result.payment.transaction}\n`
  );
  console.log("=".repeat(70) + "\n");

  return result;
}

// Run it
rollSlot()
  .then(() => {
    console.log("✅ Roll complete!\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  });
```

---

## How to Use

### Install Dependencies

```bash
npm install ethers@6 a2a-x402
```

### Set Up Environment Variables

```bash
export PRIVATE_KEY="0x..."
export RPC_URL="https://mainnet.base.org"
export SERVER_URL="https://api.slot402.com:8000"
export RUGSLOT_ADDRESS="0x..."
```

### Run the Script

```bash
node roll-x402.js
```

---

## Comparison: Traditional vs x402

| Feature             | Traditional Roll      | x402 Roll                          |
| ------------------- | --------------------- | ---------------------------------- |
| **Gas Cost**        | Player pays (~$0.10)  | Facilitator pays                   |
| **USDC Approval**   | Required              | NOT required!                      |
| **User Signatures** | 1 (commit)            | 2 (commit + payment)               |
| **Fee**             | $0.05 USDC            | $0.06 USDC ($0.01 facilitator fee) |
| **Result Wait**     | Manual poll           | Auto-returned                      |
| **Claim Winnings**  | Manual transaction    | Automatic!                         |
| **User Experience** | Multiple transactions | Single flow                        |

---

## Key Differences from Traditional Roll

### Traditional Flow:

```
1. User: approve(Slot402, amount)     [TX + gas]
2. User: commit(commitHash)           [TX + gas]
3. Wait for block confirmation
4. User: Check isWinner()
5. User: revealAndCollect()           [TX + gas]
   Total: 3 transactions + gas fees
```

### x402 Flow:

```
1. User: Sign MetaCommit (EIP-712)    [signature only]
2. User: Sign USDC payment (EIP-3009) [signature only]
3. Facilitator: commitWithMetaTransaction() [pays gas]
4. Server: Auto-poll for result
5. Facilitator: Auto-claim winnings (if won) [pays gas]
   Total: 0 transactions from user, 0 gas fees!
```

---

## Error Handling

Common errors and solutions:

```javascript
try {
  await rollSlot();
} catch (error) {
  if (error.message.includes("Insufficient USDC")) {
    console.error("You need at least 0.06 USDC to roll");
  } else if (error.message.includes("Payment verification failed")) {
    console.error("Signature verification failed - check chainId");
  } else if (error.message.includes("Invalid nonce")) {
    console.error("MetaCommit nonce mismatch - try again");
  } else {
    console.error("Unknown error:", error);
  }
}
```

---

## Architecture

```
┌─────────┐         ┌─────────┐         ┌──────────────┐
│  Client │         │  Server │         │  Facilitator │
│ (Browser│  ◄─────►│  (x402) │  ◄─────►│   (Backend)  │
│ /Node.js│         │         │         │              │
└─────────┘         └─────────┘         └──────────────┘
     │                   │                       │
     │ 1. POST /roll     │                       │
     ├──────────────────►│                       │
     │                   │                       │
     │ 2. 402 Payment    │                       │
     │◄──────────────────┤                       │
     │    Required       │                       │
     │                   │                       │
     │ 3. Sign MetaCommit│                       │
     │    + USDC Auth    │                       │
     │                   │                       │
     │ 4. POST /submit   │                       │
     ├──────────────────►│                       │
     │                   │                       │
     │                   │ 5. /verify            │
     │                   ├──────────────────────►│
     │                   │                       │
     │                   │ 6. /settle            │
     │                   ├──────────────────────►│
     │                   │                       │ 7. TX to chain
     │                   │                       ├──────────►
     │                   │                       │
     │                   │ 8. Poll isWinner()    │
     │                   ├──────────────────────►│
     │                   │                       │
     │                   │ 9. /claim (if won)    │
     │                   ├──────────────────────►│
     │                   │                       │
     │ 10. Result        │                       │
     │◄──────────────────┤                       │
     │                   │                       │
```

---

## Security Considerations

1. **Signature Validation**: Both MetaCommit and USDC authorization signatures are verified before execution
2. **Nonce Protection**: Prevents replay attacks using both contract nonces and USDC nonces
3. **Deadline Enforcement**: Signatures expire after 5 minutes
4. **Amount Verification**: Server verifies exact USDC amount matches requirements
5. **Player Validation**: Server ensures player address matches signature signer

---

## Resources

- **Live Demo**: https://based-slot.vercel.app
- **x402 Spec**: https://github.com/standard/x402
- **EIP-3009**: https://eips.ethereum.org/EIPS/eip-3009
- **Contract**: See `packages/foundry/contracts/Slot402.sol`
- **Server**: See `packages/x402-server/server.js`
- **Facilitator**: See `packages/x402-facilitator/facilitator.js`
