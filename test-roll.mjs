/**
 * End-to-end test for ClawdSlots x402 roll flow
 * Tests: server /roll → sign MetaCommit + USDC auth → /roll/submit → result
 */
import { ethers } from "ethers";

const CHAIN_ID = 8453;
const API_URL = "http://localhost:8000";
const RPC_URL = "http://127.0.0.1:8545";

// Anvil default account #0 (has 1000 USDC from our setup)
const PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

console.log(`🦞 ClawdSlots E2E Test`);
console.log(`   Player: ${wallet.address}`);

// Check USDC balance
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const erc20 = new ethers.Contract(USDC, ["function balanceOf(address) view returns (uint256)"], provider);
const usdcBal = await erc20.balanceOf(wallet.address);
console.log(`   USDC: ${ethers.formatUnits(usdcBal, 6)}`);

// Check CLAWD balance before
const CLAWD = "0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07";
const clawdContract = new ethers.Contract(CLAWD, ["function balanceOf(address) view returns (uint256)"], provider);
const clawdBefore = await clawdContract.balanceOf(wallet.address);
console.log(`   CLAWD before: ${ethers.formatEther(clawdBefore)}`);

// Step 1: Request roll
console.log(`\n📡 Step 1: Request roll...`);
const rollRes = await fetch(`${API_URL}/roll`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ player: wallet.address })
});

if (rollRes.status !== 402) throw new Error(`Expected 402, got ${rollRes.status}`);
const payment = await rollRes.json();
console.log(`   Got 402 — Total: ${payment.pricing.total}, Bet: ${payment.pricing.betSize}`);

// Step 2: Get contract data
const SLOT_CONTRACT = payment.accepts[0].payTo;
console.log(`   Contract: ${SLOT_CONTRACT}`);

const contract = new ethers.Contract(SLOT_CONTRACT, [
  "function getCommitHash(uint256 secret) view returns (bytes32)",
  "function nonces(address) view returns (uint256)"
], provider);

const secret = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString();
const [commitHash, nonce] = await Promise.all([
  contract.getCommitHash(BigInt(secret)),
  contract.nonces(wallet.address)
]);

console.log(`   Secret: ${secret.substring(0, 10)}...`);
console.log(`   CommitHash: ${commitHash.substring(0, 20)}...`);
console.log(`   Nonce: ${nonce}`);

// Step 3: Sign MetaCommit (EIP-712)
console.log(`\n✍️  Step 3: Sign MetaCommit...`);
const deadline = Math.floor(Date.now() / 1000) + 300;

const metaCommitSig = await wallet.signTypedData(
  { name: "ClawdSlots", version: "1", chainId: BigInt(CHAIN_ID), verifyingContract: SLOT_CONTRACT },
  { MetaCommit: [
    { name: "player", type: "address" },
    { name: "commitHash", type: "bytes32" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" }
  ]},
  { player: wallet.address, commitHash, nonce, deadline: BigInt(deadline) }
);
console.log(`   MetaCommit sig: ${metaCommitSig.substring(0, 20)}...`);

// Step 4: Sign USDC payment (EIP-3009)
console.log(`\n✍️  Step 4: Sign USDC payment...`);
const pm = payment.accepts[0];
const auth = {
  from: wallet.address,
  to: pm.payTo,
  value: pm.maxAmountRequired,
  validAfter: 0,
  validBefore: Math.floor(Date.now() / 1000) + 600,
  nonce: ethers.hexlify(ethers.randomBytes(32))
};

const usdcSig = await wallet.signTypedData(
  {
    name: pm.extra?.name || "USD Coin",
    version: pm.extra?.version || "2",
    chainId: BigInt(pm.extra?.chainId || CHAIN_ID),
    verifyingContract: pm.asset
  },
  { TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" }
  ]},
  { ...auth, value: BigInt(auth.value), validAfter: BigInt(auth.validAfter), validBefore: BigInt(auth.validBefore) }
);
console.log(`   USDC sig: ${usdcSig.substring(0, 20)}...`);

// Step 5: Submit roll
console.log(`\n📤 Step 5: Submit roll...`);
const submitRes = await fetch(`${API_URL}/roll/submit`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    requestId: payment.requestId,
    paymentPayload: {
      payload: { authorization: auth, signature: usdcSig },
      network: pm.network,
      scheme: pm.scheme
    },
    metaCommit: {
      player: wallet.address,
      commitHash,
      nonce: nonce.toString(),
      deadline,
      signature: metaCommitSig
    },
    secret
  })
});

const result = await submitRes.json();

if (!result.success) {
  console.error(`❌ Roll failed:`, result);
  process.exit(1);
}

console.log(`\n🎰 RESULT:`);
console.log(`   Symbols: [ ${result.roll.symbols.join(" ] [ ")} ]`);
console.log(`   Won: ${result.roll.won}`);
if (result.roll.won) {
  const payout = Number(result.roll.payout) / 1e18;
  console.log(`   Payout: ${payout.toFixed(4)} CLAWD`);
  console.log(`   Claim TX: ${result.roll.claimTransaction}`);
}

// Check balances after
const usdcAfter = await erc20.balanceOf(wallet.address);
const clawdAfter = await clawdContract.balanceOf(wallet.address);
console.log(`\n💰 Balances after:`);
console.log(`   USDC: ${ethers.formatUnits(usdcAfter, 6)} (spent ${ethers.formatUnits(usdcBal - usdcAfter, 6)})`);
console.log(`   CLAWD: ${ethers.formatEther(clawdAfter)} (gained ${ethers.formatEther(clawdAfter - clawdBefore)})`);

console.log(`\n✅ E2E test complete!`);
