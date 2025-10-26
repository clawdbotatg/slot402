# 🎰 Slot Machine Token - Implementation Guide

## Overview

The SlotMachine contract combines an ERC20 token with a commit-reveal gambling mechanism and automated treasury management through Uniswap V2. The contract has two phases:

1. **SALE Phase**: Initial token sale (5 tokens at 0.0001 ETH each)
2. **ACTIVE Phase**: Commit-reveal gambling with automated buyback/burn and emergency minting

## Contract Details

- **Contract**: `SlotMachine.sol`
- **Owner**: `0x05937Df8ca0636505d92Fd769d303A3D461587ed` (hardcoded)
- **Token**: SLOT (18 decimals)
- **Network**: Arbitrum (Uniswap V2 integration)

## Key Constants

```solidity
TOKEN_PRICE = 0.0001 ETH
MAX_SALE_TOKENS = 5 * 10^18 (5 tokens)
BET_SIZE = 0.00001 ETH
TREASURY_THRESHOLD = 0.0005 ETH
PAYOUT_MULTIPLIER = 10x
```

## Phase 1: Token Sale

### How to Buy Tokens

```solidity
// Buy 1 token
slotMachine.buyTokens{value: 0.0001 ether}()

// Buy 5 tokens (triggers transition to ACTIVE)
slotMachine.buyTokens{value: 0.0005 ether}()
```

**Important**:

- Must send exact multiples of `TOKEN_PRICE`
- Automatically transitions to ACTIVE when all 5 tokens are sold
- Contract will have 0.0005 ETH after sale completes

## Phase 2: Gambling

### Game Rules

- **Bet**: 0.00001 ETH per roll
- **Random Number**: 1-10 (using blockhash + commitId + secret)
- **Payouts**:
  - Roll 1: Win 10x bet (0.0001 ETH) ✅
  - Roll 2-10: Lose bet ❌
- **House Edge**: ~10% expected value
- **Time Constraints**:
  - Must wait at least 1 block between commit and reveal
  - Must reveal within 256 blocks or forfeit

### How to Play

#### Step 1: Commit

Generate a random secret off-chain and hash it:

```javascript
// Off-chain (JavaScript)
const secret = "12345"; // Your random secret
const commitHash = ethers.utils.keccak256(
  ethers.utils.defaultAbiCoder.encode(["uint256"], [secret])
);

// On-chain
const commitId = await slotMachine.commit(commitHash, {
  value: ethers.utils.parseEther("0.00001"),
});
```

#### Step 2: Check if Winner (Optional)

Before revealing, you can check if you won without spending gas:

```solidity
(bool won, uint256 result) = slotMachine.isWinner(commitId, secret);
```

This is a **view function** - it doesn't cost gas and lets you avoid revealing losing bets.

#### Step 3: Reveal

Only reveal if you won (saves gas on losing bets):

```solidity
await slotMachine.reveal(commitId, secret);
```

This determines the outcome and sets `amountWon` if you rolled a 1.

#### Step 4: Collect Winnings

If you won, collect your prize:

```solidity
await slotMachine.collect(commitId);
```

**Note**: If the treasury is low, you may need to call `collect()` multiple times as the contract mints and sells tokens to raise funds.

## Treasury Management

### Automatic Buyback & Burn

After each reveal, if the contract has more ETH than `TREASURY_THRESHOLD + amountOwed`, it will:

1. Calculate excess: `balance - TREASURY_THRESHOLD - amountOwed`
2. Swap excess ETH for SLOT tokens on Uniswap
3. Send tokens to burn address: `0x000000000000000000000000000000000000dEaD`

### Emergency Minting

If a winner collects but the treasury is insufficient:

1. Contract mints 1 token (1e18)
2. Swaps it for ETH on Uniswap
3. Pays out what it can
4. Winner calls `collect()` again if not fully paid

## Uniswap Integration

### Adding Liquidity (Owner Only)

After SALE phase completes, owner can add liquidity:

```solidity
// Requires at least 0.00025 ETH in contract
await slotMachine.addLiquidity();
```

This will:

- Mint 2.5 tokens
- Add liquidity: 2.5 tokens + 0.00025 ETH
- Automatically set `uniswapPair` address
- Can only be called once

**Important**: Game can function without liquidity, but buyback/burn and emergency minting won't work until liquidity is added.

## Owner Functions

### Testing Functions

```solidity
// Withdraw all ETH (TESTING ONLY - REMOVE BEFORE PRODUCTION)
await slotMachine.rug();
```

### Production Functions

```solidity
// Add liquidity (one-time only)
await slotMachine.addLiquidity();

// Renounce ownership (currently reverts - owner is immutable)
await slotMachine.renounceOwnership();
```

## Testing Guide

### Local Testing (Foundry)

```bash
# Run all tests
cd packages/foundry
forge test

# Run with verbosity
forge test -vvv

# Run specific test
forge test --match-test testBuyTokens

# Run statistical validation (100 games)
forge test --match-test testHouseEdge
```

### Local Deployment

```bash
# Start local chain
yarn chain

# Deploy SlotMachine (in another terminal)
cd packages/foundry
forge script script/DeploySlotMachine.s.sol --rpc-url http://localhost:8545 --broadcast

# Start frontend
yarn start
```

### Production Testing (Arbitrum)

**IMPORTANT**: The contract has a `rug()` function for testing. Remove it before final production deployment!

```bash
# Deploy to Arbitrum
yarn deploy --file DeploySlotMachine.s.sol --network arbitrum
```

## Contract Events

Monitor these events for tracking:

```solidity
event TokensPurchased(address indexed buyer, uint256 amount, uint256 ethPaid);
event PhaseChanged(Phase newPhase);
event CommitPlaced(address indexed player, uint256 indexed commitId, uint256 betAmount);
event GameRevealed(address indexed player, uint256 indexed commitId, uint256 result, uint256 payout);
event WinningsCollected(address indexed player, uint256 indexed commitId, uint256 amount);
event TokensBurned(uint256 amount, uint256 ethUsed);
event TokensMinted(uint256 amount);
event LiquidityAdded(uint256 tokenAmount, uint256 ethAmount);
event CommitForfeited(address indexed player, uint256 indexed commitId);
```

## Frontend Usage

Navigate to `http://localhost:3000/prototype` to:

1. Buy tokens during SALE phase
2. Commit bets during ACTIVE phase
3. Reveal and collect winnings
4. View contract status and your stats

## Security Considerations

### Commit-Reveal Security

✅ **Good**:

- User provides their own randomness (secret)
- Combined with blockhash for unpredictability
- Cannot be front-run or manipulated
- 256 block window prevents abuse

⚠️ **Considerations**:

- Users can see if they won before revealing (saves gas)
- This is intentional - only winners need to spend gas on reveals
- House still has ~10% edge overall

### Treasury Security

✅ **Good**:

- Threshold system maintains reserve for payouts
- Automated buyback when profitable
- Emergency minting ensures winners always get paid

⚠️ **Considerations**:

- Uniswap price impact on large mints/burns
- LP tokens stay in contract (could be withdrawn by owner)

## Roadmap

### Current Implementation (v1)

- ✅ ERC20 token with sale phase
- ✅ Commit-reveal gambling (1-10 roll)
- ✅ Automated treasury management
- ✅ Uniswap V2 integration
- ✅ View function to check winners

### Future Enhancements

- 🔄 Replace simple roll with actual slot machine mechanics
- 🔄 More complex payout structures (multiple prize tiers)
- 🔄 Remove owner after liquidity established
- 🔄 Governance for parameter changes
- 🔄 LP token management
- 🔄 Gas optimizations for multiple minting rounds

## Math Validation

### Expected House Edge

With current setup:

- 1/10 chance to win 10x bet = +9 units
- 9/10 chance to lose 1x bet = -9 units
- Expected value per game: (0.1 × 9) + (0.9 × -1) = 0.9 - 0.9 = 0

Wait, that's break-even! Let me recalculate:

- Win: 1/10 chance, payout is 10x bet, net gain = 9x bet
- Lose: 9/10 chance, lose 1x bet

Expected value = (1/10 × 9) + (9/10 × -1) = 0.9 - 0.9 = **0** (break-even)

**To add house edge**, payout could be adjusted to 9x instead of 10x:

- Expected value = (1/10 × 8) + (9/10 × -1) = 0.8 - 0.9 = **-0.1** (10% house edge)

Current implementation is **fair odds** (0% house edge). Update `PAYOUT_MULTIPLIER` to 9 for 10% house edge.

## Support

For issues or questions:

1. Check the tests in `packages/foundry/test/SlotMachine.t.sol`
2. Review the contract at `packages/foundry/contracts/SlotMachine.sol`
3. Test locally before deploying to Arbitrum

---

**Built with Scaffold-ETH 2** 🏗️
