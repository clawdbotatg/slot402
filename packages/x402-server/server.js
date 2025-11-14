/**
 * x402 Server for Slot402
 *
 * Handles gasless slot machine rolls using x402 payment protocol
 * Server commits on behalf of user, polls for result, returns reel positions
 */

const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");
const dotenv = require("dotenv");
const { createPaymentRequirements, verifyPayment } = require("a2a-x402");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8000;
const USDC_CONTRACT = process.env.USDC_CONTRACT;
const BASE_RPC_URL = process.env.BASE_RPC_URL;
const FACILITATOR_URL = process.env.FACILITATOR_URL || "http://localhost:8001";
const CHAIN_ID = process.env.CHAIN_ID || "31337"; // Default to local fork

// Validate configuration
if (!USDC_CONTRACT || !BASE_RPC_URL) {
  console.error("❌ Missing required environment variables!");
  console.error("   Required: USDC_CONTRACT, BASE_RPC_URL");
  console.error("   Optional: CHAIN_ID (defaults to 31337 for fork)");
  console.error("   Create a .env file based on README instructions");
  process.exit(1);
}

// Load deployed contracts from Foundry broadcast
console.log(`🔍 Loading deployment for chain ID: ${CHAIN_ID}`);

const path = require("path");
const broadcastPath = path.join(
  __dirname,
  "../foundry/broadcast/Deploy.s.sol",
  CHAIN_ID,
  "run-latest.json"
);
console.log(`📂 Loading from: ${broadcastPath}`);

let broadcast;
try {
  broadcast = require(broadcastPath);
  console.log(`✅ Successfully loaded broadcast file for chain ${CHAIN_ID}`);
} catch (error) {
  console.error(`❌ Could not load deployment for chain ${CHAIN_ID}`);
  console.error("   Error:", error.message);
  console.error(`   Absolute path tried: ${broadcastPath}`);
  console.error(`   Deploy to chain ${CHAIN_ID} first: yarn deploy`);

  // Debug: check if file exists
  const fs = require("fs");
  if (fs.existsSync(broadcastPath)) {
    console.error(`   ℹ️  File exists but couldn't be loaded!`);
    console.error(`   This might be a require cache issue.`);
  } else {
    console.error(`   ℹ️  File does not exist at this path.`);
  }

  process.exit(1);
}

// Parse deployed contracts from broadcast transactions
console.log(`🔎 Parsing deployed contracts from transactions...`);
const deployedContracts = {};

if (broadcast.transactions) {
  for (const tx of broadcast.transactions) {
    if (tx.transactionType === "CREATE" && tx.contractName) {
      deployedContracts[tx.contractName] = {
        address: tx.contractAddress,
        name: tx.contractName,
      };
      console.log(`  ✅ Found ${tx.contractName}: ${tx.contractAddress}`);
    }
  }
}

console.log(`📋 Deployed contracts:`, Object.keys(deployedContracts));

// Get Slot402 contract address
if (!deployedContracts.Slot402) {
  console.error(`❌ Slot402 contract not found in deployment`);
  console.error(`   Available contracts:`, Object.keys(deployedContracts));
  console.error(`   Deploy Slot402 first: yarn deploy`);
  process.exit(1);
}

const RUGSLOT_CONTRACT = deployedContracts.Slot402.address;
console.log(
  `✅ Loaded Slot402 contract: ${RUGSLOT_CONTRACT} (chain ${CHAIN_ID})`
);

// Initialize provider
const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);

// Helper wallet for mining blocks on local fork (only used when CHAIN_ID === 31337)
const BLOCK_MINER_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const blockMinerWallet = new ethers.Wallet(BLOCK_MINER_KEY, provider);

console.log(`💼 Server Configuration:
  Slot402 Contract: ${RUGSLOT_CONTRACT}
  Chain ID: ${CHAIN_ID}
  USDC: ${USDC_CONTRACT}
  RPC: ${BASE_RPC_URL}
  Facilitator: ${FACILITATOR_URL}
  Port: ${PORT}
`);

// Minimal Slot402 ABI for the functions we need
const RUGSLOT_ABI = [
  "function commitWithMetaTransaction(address _player, bytes32 _commitHash, uint256 _nonce, uint256 _deadline, bytes _signature, address _facilitatorAddress, tuple(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce) _usdcAuth, bytes _usdcSignature) external returns (uint256)",
  "function getCommitHash(uint256 _secret) external pure returns (bytes32)",
  "function isWinner(address _player, uint256 _commitId, uint256 _secret) external view returns (bool won, uint256 reel1Pos, uint256 reel2Pos, uint256 reel3Pos, uint256 payout)",
  "function commits(address, uint256) external view returns (bytes32 commitHash, uint256 commitBlock, uint256 amountWon, uint256 amountPaid, bool revealed)",
  "function nonces(address) external view returns (uint256)",
  "function DOMAIN_SEPARATOR() external view returns (bytes32)",
  "function META_COMMIT_TYPEHASH() external view returns (bytes32)",
  "function getReel1() external view returns (uint8[45])",
  "function getReel2() external view returns (uint8[45])",
  "function getReel3() external view returns (uint8[45])",
];

// Symbol enum mapping
const SYMBOL_NAMES = [
  "CHERRIES",
  "ORANGE",
  "WATERMELON",
  "STAR",
  "BELL",
  "BAR",
  "DOUBLEBAR",
  "SEVEN",
  "BASEETH",
];

// Store reels in memory (loaded at startup)
let reel1Symbols = [];
let reel2Symbols = [];
let reel3Symbols = [];

// Store pending requests (in production, use Redis or database)
const pendingRequests = new Map();

// Facilitator implementation for x402 library
class SimpleFacilitator {
  constructor(facilitatorUrl) {
    this.facilitatorUrl = facilitatorUrl;
  }

  async verify(payload, requirements) {
    const response = await fetch(`${this.facilitatorUrl}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload, requirements }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.invalidReason || "Verification failed");
    }

    return await response.json();
  }

  async settle(payload, requirements, metaCommit) {
    const response = await fetch(`${this.facilitatorUrl}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload, requirements, metaCommit }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.errorReason || "Settlement failed");
    }

    return await response.json();
  }

  async claim(player, commitId, secret) {
    const response = await fetch(`${this.facilitatorUrl}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player, commitId, secret }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.errorReason || "Claim failed");
    }

    return await response.json();
  }
}

const facilitator = new SimpleFacilitator(FACILITATOR_URL);

/**
 * Load reel configurations from contract at startup
 */
async function loadReels() {
  try {
    console.log("🎰 Loading reel configurations from contract...");
    const contract = new ethers.Contract(
      RUGSLOT_CONTRACT,
      RUGSLOT_ABI,
      provider
    );

    reel1Symbols = await contract.getReel1();
    reel2Symbols = await contract.getReel2();
    reel3Symbols = await contract.getReel3();

    console.log(`✅ Loaded ${reel1Symbols.length} symbols for each reel`);
    console.log(
      `   Reel 1 sample: ${SYMBOL_NAMES[reel1Symbols[0]]}, ${
        SYMBOL_NAMES[reel1Symbols[1]]
      }, ${SYMBOL_NAMES[reel1Symbols[2]]}...`
    );
  } catch (error) {
    console.error("❌ Failed to load reels:", error.message);
    console.error("   Server will continue but symbol display will not work");
  }
}

/**
 * Mine a new block on local fork (only for CHAIN_ID 31337)
 */
async function mineBlockOnLocalFork() {
  if (CHAIN_ID !== "31337") {
    return; // Only mine blocks on local fork
  }

  console.log("⛏️  Mining block on local fork...");

  try {
    // Wait 1 second
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Send a dummy transaction to mine a new block
    const tx = await blockMinerWallet.sendTransaction({
      to: blockMinerWallet.address,
      value: ethers.parseEther("0.001"),
    });

    console.log(`   Sent dummy tx: ${tx.hash}`);
    await tx.wait();
    console.log(`   ✅ Block mined!`);

    // Wait another second
    await new Promise((resolve) => setTimeout(resolve, 1000));
  } catch (error) {
    console.error("   ⚠️  Could not mine block:", error.message);
  }
}

/**
 * Poll contract.isWinner until result is available
 */
async function pollForResult(
  contract,
  player,
  commitId,
  secret,
  maxAttempts = 100
) {
  console.log(
    `🔄 Polling for result... Player: ${player}, CommitID: ${commitId}`
  );

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Wait 250ms between attempts (same as frontend)
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      const result = await contract.isWinner(player, commitId, BigInt(secret));
      const [won, reel1Pos, reel2Pos, reel3Pos, payout] = result;

      // Look up symbols at these positions
      const symbol1 = reel1Symbols[Number(reel1Pos)];
      const symbol2 = reel2Symbols[Number(reel2Pos)];
      const symbol3 = reel3Symbols[Number(reel3Pos)];

      const symbolName1 = SYMBOL_NAMES[symbol1] || "UNKNOWN";
      const symbolName2 = SYMBOL_NAMES[symbol2] || "UNKNOWN";
      const symbolName3 = SYMBOL_NAMES[symbol3] || "UNKNOWN";

      console.log(
        `✅ Result found! [ ${symbolName1} ] [ ${symbolName2} ] [ ${symbolName3} ] - ${
          won ? "WINNER! 🎉" : "Not a winner"
        }`
      );
      console.log(`   Positions: ${reel1Pos}, ${reel2Pos}, ${reel3Pos}`);

      return {
        won,
        reel1: Number(reel1Pos),
        reel2: Number(reel2Pos),
        reel3: Number(reel3Pos),
        payout: payout.toString(),
        symbols: [symbolName1, symbolName2, symbolName3],
      };
    } catch (error) {
      // Still waiting for block or result not ready
      if (attempt % 10 === 0 && attempt > 0) {
        console.log(`   ... attempt ${attempt}/${maxAttempts}`);
      }
    }
  }

  throw new Error("Timeout waiting for result");
}

/**
 * POST /roll
 * Request a slot machine roll (returns 402 payment required)
 */
app.post("/roll", async (req, res) => {
  try {
    const { player } = req.body;

    if (!player || !ethers.isAddress(player)) {
      return res.status(400).json({
        error: "Missing or invalid player address",
      });
    }

    console.log(`\n💰 Roll request from: ${player}`);

    // Generate request ID
    const requestId = `roll_${Date.now()}_${Math.random()
      .toString(36)
      .substring(7)}`;

    // Create payment requirements (payTo will be the Slot402 contract)
    // Note: On fork (CHAIN_ID 31337), we need to use Base mainnet chainId (8453) for USDC domain
    const usdcChainId = CHAIN_ID === "31337" ? "8453" : CHAIN_ID;

    const requirements = await createPaymentRequirements({
      price: 0.06, // $0.06 USDC (0.05 bet + 0.01 facilitator fee)
      payToAddress: RUGSLOT_CONTRACT,
      resource: `/roll/${requestId}`,
      network: "base",
      description: "Slot402 x402 Roll - Gasless slot machine spin",
      mimeType: "application/json",
      scheme: "exact",
      maxTimeoutSeconds: 600,
      extra: {
        name: "USD Coin",
        version: "2",
        chainId: usdcChainId, // Pass correct chainId for USDC domain
        requestId,
        player,
        betSize: "0.05",
        facilitatorFee: "0.01",
      },
    });

    // Store request
    pendingRequests.set(requestId, {
      player,
      requirements,
      createdAt: Date.now(),
    });

    console.log(`📋 Created request ${requestId}`);
    console.log(`   Price: $0.06 USDC`);

    // Return 402 Payment Required
    return res.status(402).json({
      error: "Payment Required",
      x402Version: 1,
      accepts: [requirements],
      requestId,
      pricing: {
        total: "$0.06 USDC",
        betSize: "$0.05 USDC",
        facilitatorFee: "$0.01 USDC",
        atomicUnits: "60000",
      },
    });
  } catch (error) {
    console.error("❌ Error in /roll:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
});

/**
 * POST /roll/submit
 * Submit payment and execute slot roll
 */
app.post("/roll/submit", async (req, res) => {
  try {
    const { requestId, paymentPayload, metaCommit, secret } = req.body;

    if (!requestId || !paymentPayload || !metaCommit || !secret) {
      return res.status(400).json({
        error: "Missing requestId, paymentPayload, metaCommit, or secret",
      });
    }

    // Retrieve pending request
    const request = pendingRequests.get(requestId);
    if (!request) {
      return res.status(404).json({
        error: "Request not found or expired",
        requestId,
      });
    }

    const player = request.player;
    console.log(`\n💳 Payment submission for request ${requestId}`);
    console.log(`   Player: ${player}`);
    console.log(`   MetaCommit nonce: ${metaCommit.nonce}`);
    console.log(`   Secret: ${secret.substring(0, 10)}...`);

    // Verify payment
    console.log("🔍 Verifying payment signature...");
    let verifyResponse;
    try {
      verifyResponse = await verifyPayment(
        paymentPayload,
        request.requirements,
        facilitator
      );

      if (!verifyResponse.isValid) {
        console.error(
          `❌ Payment verification failed: ${verifyResponse.invalidReason}`
        );
        return res.status(400).json({
          error: "Payment verification failed",
          reason: verifyResponse.invalidReason,
        });
      }
    } catch (verifyError) {
      console.error(`❌ Verification error:`, verifyError);
      return res.status(400).json({
        error: "Payment verification failed",
        reason: verifyError.message,
      });
    }

    console.log("✅ Payment signature verified");
    console.log(`   Payer: ${verifyResponse.payer}`);

    // Settle payment on-chain (facilitator will call commitWithMetaTransaction)
    console.log("💸 Settling payment and creating commit on-chain...");

    // Call facilitator directly with metaCommit (bypassing a2a-x402 library)
    const settleResponse = await facilitator.settle(
      paymentPayload,
      request.requirements,
      metaCommit
    );

    if (!settleResponse.success) {
      console.error(
        `❌ Payment settlement failed: ${settleResponse.errorReason}`
      );
      return res.status(400).json({
        error: "Payment settlement failed",
        reason: settleResponse.errorReason,
      });
    }

    console.log("✅ Payment settled and commit created!");
    console.log(`   Transaction: ${settleResponse.transaction}`);
    console.log(`   Commit ID: ${settleResponse.commitId}`);

    // Mine a block on local fork (only if CHAIN_ID === 31337)
    // This ensures we move past the commit block so isWinner() can be called
    await mineBlockOnLocalFork();

    // Now poll for the result
    console.log(`\n🎰 Polling for slot result...`);

    const contract = new ethers.Contract(
      RUGSLOT_CONTRACT,
      RUGSLOT_ABI,
      provider
    );

    const result = await pollForResult(
      contract,
      player,
      settleResponse.commitId,
      secret
    );

    console.log(`\n🎉 Roll complete!`);
    console.log(`   Won: ${result.won}`);
    console.log(
      `   Symbols: [ ${result.symbols[0]} ] [ ${result.symbols[1]} ] [ ${result.symbols[2]} ]`
    );
    console.log(
      `   Positions: ${result.reel1}, ${result.reel2}, ${result.reel3}`
    );
    console.log(`   Payout: ${result.payout}`);

    // If player won, automatically claim their winnings
    let claimTransaction = null;
    if (result.won) {
      console.log(`\n🎁 Player won! Auto-claiming winnings...`);
      try {
        const claimResponse = await facilitator.claim(
          player,
          settleResponse.commitId,
          secret
        );

        if (claimResponse.success) {
          console.log(`✅ Winnings claimed and sent to player!`);
          console.log(`   Claim TX: ${claimResponse.transaction}`);
          claimTransaction = claimResponse.transaction;
        } else {
          console.warn(
            `⚠️  Could not auto-claim: ${claimResponse.errorReason}`
          );
        }
      } catch (claimError) {
        console.warn(`⚠️  Could not auto-claim: ${claimError.message}`);
        console.warn(
          `   Player can manually claim later using revealAndCollect()`
        );
      }
    }

    // Clean up pending request
    pendingRequests.delete(requestId);

    // Return result to client
    return res.status(200).json({
      success: true,
      payment: {
        transaction: settleResponse.transaction,
        payer: player,
      },
      roll: {
        commitId: settleResponse.commitId,
        secret: secret,
        won: result.won,
        reelPositions: {
          reel1: result.reel1,
          reel2: result.reel2,
          reel3: result.reel3,
        },
        symbols: result.symbols,
        payout: result.payout,
        claimTransaction: claimTransaction,
      },
    });
  } catch (error) {
    console.error("❌ Error in /roll/submit:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
});

/**
 * GET /health
 * Health check
 */
app.get("/health", async (req, res) => {
  try {
    // Check facilitator health
    const facilitatorHealth = await fetch(`${FACILITATOR_URL}/health`);
    const facilitatorOk = facilitatorHealth.ok;

    // Check contract exists
    const code = await provider.getCode(RUGSLOT_CONTRACT);
    const contractDeployed = code !== "0x";

    res.json({
      status: contractDeployed && facilitatorOk ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks: {
        facilitator: facilitatorOk ? "ok" : "error",
        contract: contractDeployed ? "deployed" : "not found",
      },
      pendingRequests: pendingRequests.size,
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      error: error.message,
    });
  }
});

// Start server
async function start() {
  // Load reel configurations from contract
  await loadReels();

  app.listen(PORT, () => {
    console.log(`\n🚀 Slot402 x402 Server running!`);
    console.log(`   API: http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log(`\n✅ Ready to process x402 slot rolls!\n`);
  });
}

start().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
