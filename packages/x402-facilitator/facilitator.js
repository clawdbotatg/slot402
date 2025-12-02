/**
 * x402 Payment Facilitator for Slot402
 *
 * This facilitator verifies EIP-712 signatures and settles payments on-chain
 * using EIP-3009 transferWithAuthorization for USDC transfers
 */

const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8001;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const BASE_RPC_URL = process.env.BASE_RPC_URL;
const CHAIN_ID = process.env.CHAIN_ID || "31337";

// Validate configuration
if (!PRIVATE_KEY || !BASE_RPC_URL) {
  console.error("❌ Missing required environment variables!");
  console.error("   Required: PRIVATE_KEY, BASE_RPC_URL");
  console.error("   Optional: CHAIN_ID (defaults to 31337 for fork)");
  process.exit(1);
}

// Initialize provider and wallet
const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// Nonce management for concurrent transactions
let currentNonce = null;
let pendingNonceInit = null;
const playerQueues = new Map(); // player address -> array of pending transactions
const processingPlayers = new Set(); // track which players are being processed
const pendingProcessingTimeouts = new Map(); // player -> timeout ID for debounce
const QUEUE_DEBOUNCE_MS = 100; // Wait 100ms for concurrent requests to arrive

/**
 * Initialize nonce from the network
 */
async function initializeNonce() {
  if (pendingNonceInit) {
    return pendingNonceInit;
  }
  
  pendingNonceInit = (async () => {
    currentNonce = await provider.getTransactionCount(wallet.address, 'pending');
    console.log(`🔢 Initialized nonce: ${currentNonce}`);
    return currentNonce;
  })();
  
  return pendingNonceInit;
}

/**
 * Get next nonce for transaction
 */
function getNextNonce() {
  if (currentNonce === null) {
    throw new Error('Nonce not initialized');
  }
  const nonce = currentNonce;
  currentNonce++;
  return nonce;
}

/**
 * Process transaction queue for a specific player to ensure serial execution
 */
async function processPlayerQueue(playerAddress) {
  // Normalize address to lowercase for consistent mapping
  const player = playerAddress.toLowerCase();
  
  if (processingPlayers.has(player)) {
    return; // Already processing this player
  }
  
  const queue = playerQueues.get(player);
  if (!queue || queue.length === 0) {
    return;
  }
  
  processingPlayers.add(player);
  
  while (queue.length > 0) {
    const { txFunction, resolve, reject } = queue.shift();
    try {
      const result = await txFunction();
      resolve(result);
    } catch (error) {
      reject(error);
    }
  }
  
  // Clean up empty queue
  if (queue.length === 0) {
    playerQueues.delete(player);
  }
  
  processingPlayers.delete(player);
}

/**
 * Queue a transaction for serial execution with per-player nonce ordering
 * Uses debounce to wait for concurrent requests to arrive before processing
 * @param {string} playerAddress - The player's address (for queue separation)
 * @param {number} nonce - The player's nonce (for ordering within queue)
 * @param {function} txFunction - The transaction function to execute
 */
function queueTransaction(playerAddress, nonce, txFunction) {
  return new Promise((resolve, reject) => {
    // Normalize address to lowercase for consistent mapping
    const player = playerAddress.toLowerCase();
    
    // Get or create queue for this player
    if (!playerQueues.has(player)) {
      playerQueues.set(player, []);
    }
    const queue = playerQueues.get(player);
    
    // Add transaction to player's queue
    queue.push({ nonce, txFunction, resolve, reject });
    
    // Sort queue by nonce (ascending) to ensure sequential processing
    queue.sort((a, b) => a.nonce - b.nonce);
    
    // Debounce: Cancel any pending processing timeout for this player
    if (pendingProcessingTimeouts.has(player)) {
      clearTimeout(pendingProcessingTimeouts.get(player));
    }
    
    // Schedule processing after debounce delay
    // This allows concurrent requests to arrive and get sorted before any start processing
    const timeoutId = setTimeout(() => {
      pendingProcessingTimeouts.delete(player);
      processPlayerQueue(player);
    }, QUEUE_DEBOUNCE_MS);
    
    pendingProcessingTimeouts.set(player, timeoutId);
  });
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

console.log(`💼 Facilitator Configuration:
  Wallet: ${wallet.address}
  Network: Base (Chain ID: ${CHAIN_ID})
  Slot402 Contract: ${RUGSLOT_CONTRACT}
  Port: ${PORT}
`);

// EIP-3009 TransferWithAuthorization function
const TRANSFER_WITH_AUTHORIZATION_ABI = [
  "function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, bytes signature) external",
  "function authorizationState(address authorizer, bytes32 nonce) external view returns (bool)",
];

// Slot402 contract ABI
const RUGSLOT_ABI = [
  "function commitWithMetaTransaction(address _player, bytes32 _commitHash, uint256 _nonce, uint256 _deadline, bytes _signature, address _facilitatorAddress, tuple(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce) _usdcAuth, bytes _usdcSignature) external returns (uint256)",
  "function commitCount(address) external view returns (uint256)",
  "function revealAndCollectFor(address _player, uint256 _commitId, uint256 _secret) external",
  "function commits(address, uint256) external view returns (bytes32 commitHash, uint256 commitBlock, uint256 amountWon, uint256 amountPaid, bool revealed)",
];

// Uniswap V2 Router ABI (for swapping USDC to ETH)
const UNISWAP_V2_ROUTER_ABI = [
  "function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external returns (uint256[] memory amounts)",
  "function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts)",
];

// Base network addresses
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006"; // Base WETH
const UNISWAP_V2_ROUTER = "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24"; // Base Uniswap V2 Router

// ETH threshold for auto-refill (0.001 ETH)
const ETH_REFILL_THRESHOLD = ethers.parseEther("0.001");

// Check facilitator balance on startup
async function checkBalance() {
  try {
    // Check ETH balance
    const balance = await provider.getBalance(wallet.address);
    const ethBalance = ethers.formatEther(balance);

    // Check USDC balance
    const ERC20_ABI = ["function balanceOf(address) view returns (uint256)"];
    const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);
    const usdcBalance = await usdcContract.balanceOf(wallet.address);
    const usdcBalanceFormatted = ethers.formatUnits(usdcBalance, 6);

    if (balance === 0n) {
      console.error("\n" + "=".repeat(70));
      console.error("❌ ❌ ❌  FACILITATOR HAS NO ETH FOR GAS! ❌ ❌ ❌");
      console.error("=".repeat(70));
      console.error(`Wallet: ${wallet.address}`);
      console.error(`Balance: ${ethBalance} ETH`);
      console.error(`\n→ Send at least 0.001 ETH (~$2.50) to this address!`);
      console.error(`→ Base L2 is cheap - 0.001 ETH covers many transactions`);
      console.error(`→ Without ETH, ALL payment settlements will FAIL!`);
      console.error(`→ Check: https://basescan.org/address/${wallet.address}`);
      console.error("=".repeat(70) + "\n");
      process.exit(1);
    } else if (parseFloat(ethBalance) < 0.0001) {
      console.warn(
        `⚠️  Low facilitator balance: ${ethBalance} ETH (consider refilling)`
      );
    } else {
      console.log(`💰 Facilitator ETH balance: ${ethBalance} ETH`);
    }

    console.log(
      `💵 Facilitator USDC balance: ${usdcBalanceFormatted} USDC (fees earned)`
    );
  } catch (error) {
    console.error("❌ Could not check facilitator balance:", error.message);
    process.exit(1);
  }
}

/**
 * Swap all USDC to ETH if ETH balance is below threshold
 * This uses the facilitator's earned USDC fees to refill ETH for gas
 */
async function checkAndRefillETH() {
  try {
    // Check current ETH balance
    const ethBalance = await provider.getBalance(wallet.address);

    if (ethBalance >= ETH_REFILL_THRESHOLD) {
      // ETH balance is fine, no need to refill
      return;
    }

    console.log(`\n⚠️  ETH balance low: ${ethers.formatEther(ethBalance)} ETH`);
    console.log(`🔄 Attempting to swap USDC to ETH...`);

    // Check USDC balance
    const ERC20_ABI = [
      "function balanceOf(address) view returns (uint256)",
      "function approve(address spender, uint256 amount) external returns (bool)",
    ];
    const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, wallet);
    const usdcBalance = await usdcContract.balanceOf(wallet.address);

    if (usdcBalance === 0n) {
      console.warn(
        `⚠️  No USDC to swap for ETH! Facilitator needs manual ETH refill.`
      );
      return;
    }

    console.log(
      `💵 Swapping ${ethers.formatUnits(usdcBalance, 6)} USDC to ETH...`
    );

    // Queue transactions to ensure serial execution with proper nonce
    // Use facilitator address with timestamp as synthetic nonce for internal operations
    const { receipt, txHash } = await queueTransaction(
      wallet.address,
      Date.now(), // Use timestamp as synthetic nonce for facilitator operations
      async () => {
        // Approve Uniswap router to spend USDC
        console.log(`   Approving Uniswap router...`);
        const approveNonce = getNextNonce();
        const approveTx = await usdcContract.approve(
          UNISWAP_V2_ROUTER,
          usdcBalance,
          {
            nonce: approveNonce,
          }
        );
        await approveTx.wait();
        console.log(`   ✅ Approval confirmed`);

        // Prepare swap path: USDC -> WETH
        const path = [USDC_ADDRESS, WETH_ADDRESS];

        // Get expected output amount
        const routerContract = new ethers.Contract(
          UNISWAP_V2_ROUTER,
          UNISWAP_V2_ROUTER_ABI,
          wallet
        );

        const amountsOut = await routerContract.getAmountsOut(usdcBalance, path);
        const expectedETH = amountsOut[1];
        console.log(
          `   Expected to receive: ${ethers.formatEther(expectedETH)} ETH`
        );

        // Execute swap with 5% slippage tolerance
        const minAmountOut = (expectedETH * 95n) / 100n;
        const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes

        console.log(`   Executing swap...`);
        const swapNonce = getNextNonce();
        const swapTx = await routerContract.swapExactTokensForETH(
          usdcBalance,
          minAmountOut,
          path,
          wallet.address,
          deadline,
          {
            gasLimit: 300000,
            nonce: swapNonce,
          }
        );

        console.log(`   Transaction sent: ${swapTx.hash}`);
        const receipt = await swapTx.wait();
        
        return { receipt, txHash: swapTx.hash };
      }
    );

    if (receipt.status === 1) {
      const newEthBalance = await provider.getBalance(wallet.address);
      console.log(`✅ Swap successful!`);
      console.log(`   Transaction: ${txHash}`);
      console.log(
        `   New ETH balance: ${ethers.formatEther(newEthBalance)} ETH`
      );
    } else {
      console.error(`❌ Swap transaction failed`);
    }
  } catch (error) {
    console.error(`❌ Error during ETH refill:`, error.message);
    // Don't throw - just warn and continue. The transaction might still work.
  }
}

/**
 * POST /verify
 * Verify EIP-712 signature for EIP-3009 authorization
 */
app.post("/verify", async (req, res) => {
  try {
    const { payload, requirements } = req.body;

    console.log("🔍 Verifying EIP-712 signature...");

    if (!payload || !requirements) {
      return res.status(400).json({
        isValid: false,
        invalidReason: "Missing payload or requirements",
      });
    }

    const auth = payload.payload.authorization;
    const signature = payload.payload.signature;

    // Basic validation
    if (!auth || !signature) {
      return res.status(400).json({
        isValid: false,
        invalidReason: "Missing authorization or signature",
      });
    }

    // Verify amounts match
    if (auth.value !== requirements.maxAmountRequired) {
      return res.status(400).json({
        isValid: false,
        invalidReason: `Amount mismatch: ${auth.value} vs ${requirements.maxAmountRequired}`,
      });
    }

    // Verify recipient matches
    if (auth.to.toLowerCase() !== requirements.payTo.toLowerCase()) {
      return res.status(400).json({
        isValid: false,
        invalidReason: `Recipient mismatch: ${auth.to} vs ${requirements.payTo}`,
      });
    }

    // Verify network matches
    if (payload.network !== requirements.network) {
      return res.status(400).json({
        isValid: false,
        invalidReason: `Network mismatch: ${payload.network} vs ${requirements.network}`,
      });
    }

    // Build EIP-712 domain
    // Use chainId from requirements.extra if provided (for fork compatibility)
    const usdcChainId = requirements.extra?.chainId
      ? parseInt(requirements.extra.chainId)
      : 8453;

    const domain = {
      name: requirements.extra?.name || "USD Coin",
      version: requirements.extra?.version || "2",
      chainId: usdcChainId, // Use provided chainId or default to Base mainnet
      verifyingContract: requirements.asset,
    };

    // Build EIP-712 types
    const types = {
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    };

    // Build message
    const message = {
      from: auth.from,
      to: auth.to,
      value: auth.value,
      validAfter: auth.validAfter,
      validBefore: auth.validBefore,
      nonce: auth.nonce,
    };

    // Verify signature
    const recoveredAddress = ethers.verifyTypedData(
      domain,
      types,
      message,
      signature
    );

    console.log(`📝 Signature recovered address: ${recoveredAddress}`);
    console.log(`👤 Expected sender: ${auth.from}`);

    if (recoveredAddress.toLowerCase() !== auth.from.toLowerCase()) {
      return res.status(400).json({
        isValid: false,
        invalidReason: `Signature verification failed: recovered ${recoveredAddress}, expected ${auth.from}`,
      });
    }

    // Check if nonce was already used
    try {
      const usdcContract = new ethers.Contract(
        requirements.asset,
        TRANSFER_WITH_AUTHORIZATION_ABI,
        provider
      );

      const isUsed = await usdcContract.authorizationState(
        auth.from,
        auth.nonce
      );
      if (isUsed) {
        return res.status(400).json({
          isValid: false,
          invalidReason: "Nonce already used",
        });
      }
    } catch (error) {
      console.warn("⚠️  Could not check nonce state:", error.message);
      // Continue anyway - might be unsupported on this token
    }

    // Check validity time window
    const now = Math.floor(Date.now() / 1000);
    if (now < auth.validAfter) {
      return res.status(400).json({
        isValid: false,
        invalidReason: `Authorization not yet valid (validAfter: ${auth.validAfter}, now: ${now})`,
      });
    }
    if (now > auth.validBefore) {
      return res.status(400).json({
        isValid: false,
        invalidReason: `Authorization expired (validBefore: ${auth.validBefore}, now: ${now})`,
      });
    }

    console.log("✅ Signature verified!");

    return res.status(200).json({
      isValid: true,
      payer: auth.from,
    });
  } catch (error) {
    console.error("❌ Verification error:", error);
    return res.status(400).json({
      isValid: false,
      invalidReason: error.message,
    });
  }
});

/**
 * POST /settle
 * Settle payment on-chain by calling Slot402.commitWithMetaTransaction
 */
app.post("/settle", async (req, res) => {
  try {
    // Check and refill ETH if needed before processing
    await checkAndRefillETH();

    const { payload, requirements, metaCommit } = req.body;

    console.log("💸 Settling payment and creating commit on-chain...");

    if (!payload || !requirements || !metaCommit) {
      return res.status(400).json({
        success: false,
        errorReason: "Missing payload, requirements, or metaCommit",
      });
    }

    const auth = payload.payload.authorization;
    const usdcSignature = payload.payload.signature;

    console.log(
      `📡 Calling Slot402.commitWithMetaTransaction on ${RUGSLOT_CONTRACT}...`
    );
    console.log(`   Player: ${metaCommit.player}`);
    console.log(`   Commit hash: ${metaCommit.commitHash}`);
    console.log(`   Nonce: ${metaCommit.nonce}`);
    console.log(`   Deadline: ${metaCommit.deadline}`);
    console.log(`   USDC from: ${auth.from}`);
    console.log(`   USDC to: ${auth.to}`);
    console.log(`   USDC value: ${auth.value}`);

    // Check client USDC balance before attempting
    const ERC20_ABI = [
      "function balanceOf(address account) view returns (uint256)",
    ];
    const usdcContract = new ethers.Contract(
      requirements.asset,
      ERC20_ABI,
      provider
    );
    const clientBalance = await usdcContract.balanceOf(auth.from);
    console.log(`   💰 Client USDC balance: ${clientBalance.toString()}`);

    if (clientBalance < BigInt(auth.value)) {
      throw new Error(
        `Client has insufficient USDC: ${clientBalance.toString()} < ${
          auth.value
        }`
      );
    }

    // Create contract instance (we'll get the actual commit ID after transaction succeeds)
    const rugSlotContract = new ethers.Contract(
      RUGSLOT_CONTRACT,
      RUGSLOT_ABI,
      wallet
    );

    // Prepare USDC authorization struct
    const usdcAuth = {
      from: auth.from,
      to: auth.to,
      value: auth.value,
      validAfter: auth.validAfter,
      validBefore: auth.validBefore,
      nonce: auth.nonce,
    };

    // Execute commitWithMetaTransaction with proper nonce management
    console.log(`\n🔄 Queueing transaction for serial execution...`);
    console.log(`   DEBUG: Parameters being sent:`);
    console.log(`   - player: ${metaCommit.player}`);
    console.log(`   - commitHash: ${metaCommit.commitHash}`);
    console.log(`   - nonce: ${metaCommit.nonce}`);
    console.log(`   - deadline: ${metaCommit.deadline}`);
    console.log(`   - signature length: ${metaCommit.signature.length}`);
    console.log(`   - facilitator: ${wallet.address}`);
    console.log(`   - usdcAuth.from: ${usdcAuth.from}`);
    console.log(`   - usdcAuth.to: ${usdcAuth.to}`);
    console.log(`   - usdcAuth.value: ${usdcAuth.value}`);
    console.log(`   - usdcAuth.validAfter: ${usdcAuth.validAfter}`);
    console.log(`   - usdcAuth.validBefore: ${usdcAuth.validBefore}`);
    console.log(`   - usdcAuth.nonce: ${usdcAuth.nonce}`);
    console.log(`   - usdcSignature length: ${usdcSignature.length}`);

    // Queue transaction to ensure serial execution with proper nonce ordering per player
    const { tx, receipt } = await queueTransaction(
      metaCommit.player,
      metaCommit.nonce,
      async () => {
        const txNonce = getNextNonce();
        console.log(`   🔢 Using facilitator nonce: ${txNonce}`);
        
        const tx = await rugSlotContract.commitWithMetaTransaction(
          metaCommit.player,
          metaCommit.commitHash,
          BigInt(metaCommit.nonce),
          BigInt(metaCommit.deadline),
          metaCommit.signature,
          wallet.address, // facilitator address
          usdcAuth,
          usdcSignature,
          {
            gasLimit: 5000000, // High limit to handle vault/DeFi interactions (can use up to 3M gas)
            nonce: txNonce, // Manually specify nonce
          }
        );

        console.log(`⏳ Transaction sent: ${tx.hash}`);
        console.log(`   Waiting for confirmation...`);

        const receipt = await tx.wait();
        
        return { tx, receipt };
      }
    );

    if (receipt.status === 1) {
      // Get the actual commit ID after transaction succeeds
      // The new commit ID is commitCount - 1 (since commitCount was just incremented)
      const actualCommitCount = await rugSlotContract.commitCount(
        metaCommit.player
      );
      const actualCommitId = actualCommitCount - 1n;
      
      console.log(`✅ Payment settled and commit created!`);
      console.log(`   Transaction: ${tx.hash}`);
      console.log(`   Block: ${receipt.blockNumber}`);
      console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
      console.log(`   Commit ID: ${actualCommitId.toString()}`);

      return res.status(200).json({
        success: true,
        transaction: tx.hash,
        network: requirements.network,
        payer: auth.from,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        commitId: actualCommitId.toString(),
      });
    } else {
      console.error(`❌ Transaction failed: ${tx.hash}`);
      return res.status(400).json({
        success: false,
        transaction: tx.hash,
        network: requirements.network,
        errorReason: "Transaction reverted",
      });
    }
  } catch (error) {
    console.error("❌ Settlement error:", error);

    let errorReason = error.message;

    // Parse common errors
    if (
      error.code === "INSUFFICIENT_FUNDS" ||
      error.message.includes("insufficient funds for gas")
    ) {
      errorReason = `Facilitator wallet (${wallet.address}) has no ETH for gas! Fund it with at least 0.01 ETH on Base.`;
    } else if (error.message.includes("authorization is used")) {
      errorReason = "USDC authorization already used (duplicate nonce)";
    } else if (error.message.includes("authorization is expired")) {
      errorReason = "USDC authorization expired";
    } else if (error.message.includes("Invalid nonce")) {
      errorReason = "Invalid MetaCommit nonce";
    } else if (error.message.includes("Signature expired")) {
      errorReason = "MetaCommit signature expired";
    } else if (error.message.includes("Invalid signature")) {
      errorReason = "Invalid MetaCommit signature";
    } else if (error.message.includes("insufficient balance")) {
      errorReason = "Client has insufficient USDC balance";
    }

    return res.status(400).json({
      success: false,
      network: req.body.requirements?.network || "base",
      errorReason,
    });
  }
});

/**
 * POST /claim
 * Claim winnings on behalf of a player
 * Will automatically retry multiple times if partial payments occur
 */
app.post("/claim", async (req, res) => {
  try {
    // Check and refill ETH if needed before processing
    await checkAndRefillETH();

    const { player, commitId, secret } = req.body;

    console.log(`\n💰 Claiming winnings for player ${player}...`);
    console.log(`   Commit ID: ${commitId}`);
    console.log(`   Secret: ${secret.substring(0, 10)}...`);

    if (!player || commitId === undefined || !secret) {
      return res.status(400).json({
        success: false,
        errorReason: "Missing player, commitId, or secret",
      });
    }

    // Connect to Slot402 contract
    const rugSlotContract = new ethers.Contract(
      RUGSLOT_CONTRACT,
      RUGSLOT_ABI,
      wallet
    );

    const transactions = [];
    let attempt = 0;
    const maxAttempts = 10; // Safety limit to prevent infinite loops
    let totalGasUsed = 0n;

    console.log(`📡 Starting claim process on ${RUGSLOT_CONTRACT}...`);

    // Keep trying to claim until fully paid or error
    while (attempt < maxAttempts) {
      attempt++;

      try {
        console.log(`\n🔄 Claim attempt ${attempt}/${maxAttempts}...`);

        // Queue transaction to ensure serial execution with proper nonce ordering per player
        const { tx, receipt } = await queueTransaction(
          player,
          commitId, // Use commitId as ordering nonce for claims
          async () => {
            const txNonce = getNextNonce();
            console.log(`   🔢 Using facilitator nonce: ${txNonce}`);
            
            // Call revealAndCollectFor
            const tx = await rugSlotContract.revealAndCollectFor(
              player,
              BigInt(commitId),
              BigInt(secret),
              {
                gasLimit: 5000000, // High limit to handle vault withdrawals and mint/sell operations
                nonce: txNonce, // Manually specify nonce
              }
            );

            console.log(`⏳ Transaction sent: ${tx.hash}`);
            console.log(`   Waiting for confirmation...`);

            const receipt = await tx.wait();
            
            return { tx, receipt };
          }
        );

        if (receipt.status === 1) {
          console.log(`✅ Claim transaction successful!`);
          console.log(`   Transaction: ${tx.hash}`);
          console.log(`   Block: ${receipt.blockNumber}`);
          console.log(`   Gas used: ${receipt.gasUsed.toString()}`);

          totalGasUsed += receipt.gasUsed;
          transactions.push({
            hash: tx.hash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString(),
          });

          // Check if payment is complete
          const commitData = await rugSlotContract.commits(
            player,
            BigInt(commitId)
          );
          const [, , amountWon, amountPaid] = commitData;

          console.log(`   Amount won: ${amountWon.toString()}`);
          console.log(`   Amount paid: ${amountPaid.toString()}`);

          if (amountPaid >= amountWon) {
            console.log(`✅ All winnings fully paid!`);
            break;
          }

          // Wait 1 second before next attempt (to allow mint/sell to process)
          if (attempt < maxAttempts) {
            console.log(
              `⏸️  More to claim - waiting 1 second before next attempt...`
            );
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        } else {
          console.error(`❌ Claim transaction failed: ${tx.hash}`);
          break;
        }
      } catch (error) {
        // Check if the error indicates we're done
        if (error.message.includes("No winnings")) {
          console.log(`ℹ️  No more winnings to claim (all paid out)`);
          break;
        } else if (error.message.includes("Already fully paid")) {
          console.log(`✅ All winnings fully paid!`);
          break;
        } else if (error.message.includes("Commit does not exist")) {
          console.error(`❌ Commit does not exist`);
          throw error;
        } else if (error.message.includes("Invalid secret")) {
          console.error(`❌ Invalid secret`);
          throw error;
        } else {
          // Unknown error - re-throw
          console.error(
            `❌ Unexpected error on attempt ${attempt}:`,
            error.message
          );
          throw error;
        }
      }
    }

    if (transactions.length === 0) {
      return res.status(400).json({
        success: false,
        errorReason: "No claim transactions were successful",
      });
    }

    console.log(`\n🎉 Claim process complete!`);
    console.log(`   Total attempts: ${attempt}`);
    console.log(`   Successful transactions: ${transactions.length}`);
    console.log(`   Total gas used: ${totalGasUsed.toString()}`);

    return res.status(200).json({
      success: true,
      player: player,
      attempts: attempt,
      transactions: transactions,
      totalGasUsed: totalGasUsed.toString(),
    });
  } catch (error) {
    console.error("❌ Claim error:", error);

    let errorReason = error.message;

    // Parse common errors
    if (
      error.code === "INSUFFICIENT_FUNDS" ||
      error.message.includes("insufficient funds for gas")
    ) {
      errorReason = `Facilitator wallet (${wallet.address}) has no ETH for gas!`;
    } else if (error.message.includes("Commit does not exist")) {
      errorReason = "Commit does not exist";
    } else if (error.message.includes("Invalid secret")) {
      errorReason = "Invalid secret";
    } else if (error.message.includes("No winnings")) {
      errorReason = "No winnings to claim";
    } else if (error.message.includes("Already fully paid")) {
      errorReason = "Winnings already claimed";
    }

    return res.status(400).json({
      success: false,
      errorReason,
    });
  }
});

/**
 * GET /health
 * Health check endpoint
 */
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    wallet: wallet.address,
  });
});

// Start server
async function start() {
  await checkBalance();
  await initializeNonce();

  app.listen(PORT, () => {
    console.log(`\n🚀 x402 Facilitator running!`);
    console.log(`   Endpoints:`);
    console.log(`     POST http://localhost:${PORT}/verify`);
    console.log(`     POST http://localhost:${PORT}/settle`);
    console.log(`     POST http://localhost:${PORT}/claim`);
    console.log(`     GET  http://localhost:${PORT}/health`);
    console.log(
      `\n✅ Ready to facilitate x402 payments and auto-claim winnings!\n`
    );
  });
}

start().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
