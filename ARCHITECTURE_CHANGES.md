# Slot402 Architecture Changes - Two Contract System

## Summary

Successfully split the monolithic Slot402 contract into two separate contracts to solve the Uniswap V2 "INVALID_TO" error.

## The Problem

When Slot402 inherited from ERC20, it WAS the token contract. This meant:

- The Uniswap pair was: **Slot402/WETH**
- When trying to swap tokens, the output couldn't be sent to `address(this)` because Uniswap V2 blocks sending swap outputs to either token in the pair
- This caused "UniswapV2: INVALID_TO" errors when winners tried to collect payouts that required minting and selling tokens

## The Solution

Split into two contracts:

1. **Slot402Token** (`packages/foundry/contracts/Slot402Token.sol`)

   - Simple ERC20 token
   - Owned by the Slot402 contract
   - Only the owner can mint tokens

2. **Slot402** (`packages/foundry/contracts/Slot402.sol`)
   - Slot machine contract
   - Owns the Slot402Token
   - Manages all game logic, treasury, and Uniswap operations
   - Can now freely receive tokens from swaps!

## Why This Works

Now the Uniswap pair is: **Slot402Token/WETH**

- Slot402 contract is NOT in the pair
- Slot402 can receive tokens from swaps without restriction
- When minting tokens to sell, Slot402 mints to itself, approves router, swaps, and receives WETH
- No more "INVALID_TO" errors!

## Changes Made

### New Files

- `packages/foundry/contracts/Slot402Token.sol` - ERC20 token with owner-controlled minting

### Modified Files

- `packages/foundry/contracts/Slot402.sol`

  - Removed ERC20 inheritance
  - Added Slot402Token reference
  - All token operations now go through the token contract
  - Updated Uniswap paths to use `address(token)` instead of `address(this)`

- `packages/foundry/script/DeploySlot402.s.sol`

  - Now deploys Slot402Token first
  - Then deploys Slot402 with token address
  - Transfers token ownership to Slot402

- `packages/foundry/test/Slot402.t.sol`

  - Updated setUp to deploy both contracts
  - All token balance checks now use `token.balanceOf()` instead of `slot.balanceOf()`

- `packages/nextjs/contracts/deployedContracts.ts`
  - Auto-generated with updated ABIs

## Build & Test Results

✅ **All 24 tests passing**
✅ **No compilation errors**
✅ **No linter errors**

## What You Need To Do

### For Live Deployment on Arbitrum:

1. **Deploy both contracts** (in this order):

   ```bash
   cd packages/foundry
   forge script script/DeploySlot402.s.sol --rpc-url arbitrum --broadcast --verify
   ```

2. **The deployment will**:

   - Deploy Slot402Token
   - Deploy Slot402 with token address
   - Transfer token ownership to Slot402
   - Log both addresses

3. **Update your frontend** if needed:
   - After deployment, run `yarn generate` to update ABIs
   - Most of your frontend should work as-is since Slot402 functions are unchanged
   - If you display token balances directly, you may need to read from Slot402Token contract

### Architecture Overview

```
User (0x0593...)
  ↓ owns
Slot402 Contract
  ↓ owns
Slot402Token Contract
  ↓ forms pair with
WETH (Uniswap V2)
```

### Token Flow Examples

**Buying Tokens (Sale Phase)**:

1. User sends ETH to `Slot402.buyTokens()`
2. Slot402 calls `token.mint(user, amount)`
3. User receives tokens

**Winning & Collecting (Active Phase)**:

1. User commits and wins
2. If treasury needs refilling:
   - Slot402 calls `token.mint(address(this), 1 ether)`
   - Slot402 approves router
   - Slot402 swaps tokens for WETH via Uniswap
   - Receives WETH, unwraps to ETH
   - **No INVALID_TO error!** ✅
3. Slot402 pays winner in ETH

**Buyback & Burn (Excess Treasury)**:

1. Slot402 wraps ETH to WETH
2. Swaps WETH for Slot402Token
3. Receives tokens to `address(this)` ✅
4. Transfers tokens to burn address

## Key Implementation Details

### Ownership Chain

- **User** → owns Slot402 contract (can call `rug()`, `rugmint()`, etc.)
- **Slot402** → owns Slot402Token contract (can mint tokens)
- **Slot402Token** → controls minting (only owner can mint)

### Token Approvals

When Slot402 needs to swap its tokens:

```solidity
token.approve(UNISWAP_V2_ROUTER, amount);  // Approve router
// Router swaps tokens and sends output back to address(this)
```

### Uniswap Pair

- Pair: **Slot402Token/WETH** (NOT Slot402/WETH)
- Slot402 contract can freely receive tokens from swaps
- All liquidity operations use `address(token)` in paths

## Testing Locally

To test the new architecture locally:

```bash
# Terminal 1: Start local chain
yarn chain

# Terminal 2: Deploy contracts
yarn deploy

# Terminal 3: Start frontend
yarn start
```

## Next Steps

1. ✅ Review the changes (DONE)
2. ⏳ Deploy to Arbitrum when ready
3. ⏳ Test the full flow on live network
4. ⏳ Update frontend if token address is needed anywhere

**The contracts are ready to deploy!** 🚀
