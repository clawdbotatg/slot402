/**
 * x402 Client for Slot402
 *
 * CLI tool to test gasless slot machine rolls using x402 payments
 */

const { ethers } = require("ethers");
const dotenv = require("dotenv");
const { processPayment } = require("a2a-x402");

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const BASE_RPC_URL = process.env.BASE_RPC_URL;
const SERVER_URL = process.env.SERVER_URL || "http://localhost:8000";
const USDC_CONTRACT = process.env.USDC_CONTRACT;
const CHAIN_ID = process.env.CHAIN_ID || "31337";

// Validate configuration
if (!PRIVATE_KEY || !BASE_RPC_URL || !USDC_CONTRACT) {
  console.error("❌ Missing required environment variables!");
  console.error("   Required: PRIVATE_KEY, BASE_RPC_URL, USDC_CONTRACT");
  console.error("   Optional: CHAIN_ID (defaults to 31337 for fork)");
  console.error("   Create a .env file based on README instructions");
  process.exit(1);
}

// Initialize wallet
const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

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

console.log(`💼 Client Configuration:
  Wallet: ${wallet.address}
  Network: Base (Chain ID: ${CHAIN_ID})
  Server: ${SERVER_URL}
  USDC: ${USDC_CONTRACT}
  Slot402: ${RUGSLOT_CONTRACT}
`);

// ERC20 ABI for approve and balance checks
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
];

// Slot402 ABI for commit operations
const RUGSLOT_ABI = [
  "function getCommitHash(uint256 _secret) external pure returns (bytes32)",
  "function nonces(address) external view returns (uint256)",
  "function DOMAIN_SEPARATOR() external view returns (bytes32)",
  "function META_COMMIT_TYPEHASH() external view returns (bytes32)",
  "function commitCount(address) external view returns (uint256)",
];

/**
 * Check USDC balance
 */
async function checkBalance() {
  try {
    const usdcContract = new ethers.Contract(
      USDC_CONTRACT,
      ERC20_ABI,
      provider
    );
    const balance = await usdcContract.balanceOf(wallet.address);
    return balance;
  } catch (error) {
    console.error("❌ Error checking balance:", error.message);
    return 0n;
  }
}

/**
 * Ensure USDC approval for the server
 */
async function ensureApproval(serverAddress, amount) {
  try {
    const usdcContract = new ethers.Contract(USDC_CONTRACT, ERC20_ABI, wallet);

    // Check current allowance
    const currentAllowance = await usdcContract.allowance(
      wallet.address,
      serverAddress
    );
    console.log(
      `📋 Current USDC allowance: ${ethers.formatUnits(
        currentAllowance,
        6
      )} USDC`
    );

    if (currentAllowance >= amount) {
      console.log("✅ Sufficient allowance already exists");
      return true;
    }

    // Need to approve
    console.log(`🔓 Approving server to spend USDC...`);
    const approvalAmount = (amount * 110n) / 100n; // 10% buffer

    const tx = await usdcContract.approve(serverAddress, approvalAmount);
    console.log(`⏳ Approval transaction sent: ${tx.hash}`);
    console.log("   Waiting for confirmation...");

    const receipt = await tx.wait();

    if (receipt && receipt.status === 1) {
      console.log(`✅ Approval confirmed! TX: ${tx.hash}`);
      return true;
    } else {
      console.error(`❌ Approval failed. TX: ${tx.hash}`);
      return false;
    }
  } catch (error) {
    console.error("❌ Error during approval:", error.message);
    return false;
  }
}

/**
 * Execute a slot machine roll via x402
 */
async function executeRoll() {
  try {
    console.log(`\n🎰 Requesting slot roll via x402...\n`);

    // Step 1: Request roll (expect 402)
    console.log("📡 Step 1: Requesting roll from server...");
    const rollResponse = await fetch(`${SERVER_URL}/roll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player: wallet.address }),
    });

    if (rollResponse.status !== 402) {
      const data = await rollResponse.json();
      throw new Error(
        `Unexpected response: ${rollResponse.status} - ${JSON.stringify(data)}`
      );
    }

    const paymentRequired = await rollResponse.json();
    console.log("💳 Payment Required:");
    console.log(`   Total: ${paymentRequired.pricing.total}`);
    console.log(`   Bet Size: ${paymentRequired.pricing.betSize}`);
    console.log(
      `   Facilitator Fee: ${paymentRequired.pricing.facilitatorFee}`
    );
    console.log(`   Request ID: ${paymentRequired.requestId}\n`);

    // Check balance
    const balance = await checkBalance();
    const balanceUSDC = ethers.formatUnits(balance, 6);
    console.log(`💰 Your USDC Balance: ${balanceUSDC} USDC`);

    const requirements = paymentRequired.accepts[0];
    const amountRequired = BigInt(requirements.maxAmountRequired);
    const amountUSDC = ethers.formatUnits(amountRequired, 6);

    if (balance < amountRequired) {
      throw new Error(
        `Insufficient USDC balance. Have ${balanceUSDC}, need ${amountUSDC}`
      );
    }

    // Step 2: Generate secret and get commit data from Slot402 contract
    console.log("\n🎲 Step 2: Generating secret and commit data...");
    const rugSlotContract = new ethers.Contract(
      RUGSLOT_CONTRACT,
      RUGSLOT_ABI,
      provider
    );

    // Generate random secret
    const secret = Math.floor(
      Math.random() * Number.MAX_SAFE_INTEGER
    ).toString();
    console.log(`   Secret: ${secret.substring(0, 10)}...`);

    // Get commit hash from contract
    const commitHash = await rugSlotContract.getCommitHash(BigInt(secret));
    console.log(`   Commit hash: ${commitHash}`);

    // Get player nonce
    const playerNonce = await rugSlotContract.nonces(wallet.address);
    console.log(`   Player nonce: ${playerNonce.toString()}`);

    // Get commit count (this will be the commitId)
    const commitId = await rugSlotContract.commitCount(wallet.address);
    console.log(`   Expected commit ID: ${commitId.toString()}`);

    // Step 3: Sign EIP-712 MetaCommit
    console.log("\n✍️  Step 3: Signing MetaCommit (EIP-712)...");
    const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes from now

    // Get domain separator and typehash from contract
    const domainSeparator = await rugSlotContract.DOMAIN_SEPARATOR();
    console.log(`   Domain separator: ${domainSeparator}`);

    // Sign the MetaCommit message
    const domain = {
      name: "Slot402",
      version: "1",
      chainId: parseInt(CHAIN_ID),
      verifyingContract: RUGSLOT_CONTRACT,
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

    const metaCommitSignature = await wallet.signTypedData(
      domain,
      types,
      value
    );
    console.log(`✅ MetaCommit signed`);
    console.log(`   Signature: ${metaCommitSignature.substring(0, 20)}...`);

    // Step 4: Sign payment authorization
    console.log("\n✍️  Step 4: Signing payment authorization (EIP-3009)...");
    console.log(`   DEBUG: Requirements for payment:`);
    console.log(`   - network: ${requirements.network}`);
    console.log(`   - asset: ${requirements.asset}`);
    console.log(`   - payTo: ${requirements.payTo}`);
    console.log(`   - maxAmountRequired: ${requirements.maxAmountRequired}`);
    console.log(`   - extra.chainId: ${requirements.extra?.chainId}`);
    console.log(`   - extra.name: ${requirements.extra?.name}`);
    console.log(`   - extra.version: ${requirements.extra?.version}`);

    const paymentPayload = await processPayment(requirements, wallet);
    console.log(`✅ Payment authorization signed`);
    console.log(
      `   Signature: ${paymentPayload.payload.signature.substring(0, 20)}...`
    );
    console.log(
      `   Authorization nonce: ${paymentPayload.payload.authorization.nonce}`
    );

    // Step 5: Submit everything to server
    console.log("\n📤 Step 5: Submitting to server and executing roll...");
    console.log("   (This may take a few seconds while server processes)");

    const submitResponse = await fetch(`${SERVER_URL}/roll/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: paymentRequired.requestId,
        paymentPayload,
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
      throw new Error(
        `Submit failed: ${errorData.error} - ${
          errorData.reason || errorData.message || ""
        }`
      );
    }

    const result = await submitResponse.json();

    // Success!
    console.log("\n🎉 SUCCESS! Slot roll completed!\n");
    console.log("=".repeat(70));
    console.log("SLOT ROLL RESULT");
    console.log("=".repeat(70));

    // Display symbols
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
      console.log(
        `   Payout: ${ethers.formatUnits(result.roll.payout, 6)} USDC`
      );
      console.log(`   Commit ID: ${result.roll.commitId}`);
      console.log(`   Secret: ${result.roll.secret.substring(0, 20)}...`);

      if (result.roll.claimTransaction) {
        console.log(
          `\n✅ Winnings automatically claimed and sent to your wallet!`
        );
        console.log(`   Claim TX: ${result.roll.claimTransaction}`);
        console.log(
          `   View: https://basescan.org/tx/${result.roll.claimTransaction}`
        );
      } else {
        console.log(
          `\n💡 Use revealAndCollect on the contract to claim your winnings!`
        );
      }
    } else {
      console.log(`\n   Not a winner this time. Try again!`);
    }

    console.log(`\n💳 Payment Transaction: ${result.payment.transaction}`);
    console.log(
      `   View on BaseScan: https://basescan.org/tx/${result.payment.transaction}`
    );

    // Check balance after roll
    const balanceAfter = await checkBalance();
    const balanceAfterUSDC = ethers.formatUnits(balanceAfter, 6);
    console.log(`\n💰 Your USDC Balance After Roll: ${balanceAfterUSDC} USDC`);

    console.log("\n" + "=".repeat(70) + "\n");
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

/**
 * Main entry point
 */
async function main() {
  console.log("\n" + "=".repeat(70));
  console.log("Slot402 x402 CLI Client");
  console.log("=".repeat(70) + "\n");

  await executeRoll();

  console.log("✅ Roll complete!\n");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
