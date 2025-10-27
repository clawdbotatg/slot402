# Admin Swap Testing Guide

## Overview

Added two admin-only functions to `ManagedTreasury.sol` for testing swaps in production:

1. `adminSwapETHForTokens()` - Test buying tokens with ETH
2. `adminSwapTokensForETH(uint256)` - Test selling tokens for ETH

## Usage

### Option 1: From the Debug Page (Easiest)

1. Go to `http://localhost:3000/debug` (or your deployed frontend)
2. Find the `RugSlot` contract section
3. Look for `adminSwapETHForTokens` and `adminSwapTokensForETH`
4. Call them as the contract owner

### Option 2: Using Cast

**Test buying tokens with ETH:**

```bash
cast send 0x82ab042f2bf9fb6223a9f75fe76745e7fbebe3b4 \
  "adminSwapETHForTokens()" \
  --value 0.00001ether \
  --rpc-url base \
  --private-key $DEPLOYER_PRIVATE_KEY
```

**Test selling tokens for ETH:**

```bash
# First, check your token balance
cast call 0x96155fb9f14a7ae1837da90002f04c1cabe5a90b \
  "balanceOf(address)(uint256)" \
  0x82ab042f2bf9fb6223a9f75fe76745e7fbebe3b4 \
  --rpc-url base

# Then swap some tokens (example: 0.1 tokens = 100000000000000000 wei)
cast send 0x82ab042f2bf9fb6223a9f75fe76745e7fbebe3b4 \
  "adminSwapTokensForETH(uint256)" \
  100000000000000000 \
  --rpc-url base \
  --private-key $DEPLOYER_PRIVATE_KEY
```

## What to Look For

### If Swap Succeeds ✅

- Transaction succeeds
- Returns amount of tokens/ETH received
- Contract balance changes appropriately

### If Swap Fails ❌

- Transaction reverts
- Check BaseScan for the revert reason
- Could be:
  - "No liquidity pool" - Need to call `addLiquidity()` first
  - Router/Uniswap error - Shows the actual swap failure reason

## Testing Sequence

1. **First, add liquidity** (if not already done):

```bash
cast send 0x82ab042f2bf9fb6223a9f75fe76745e7fbebe3b4 \
  "addLiquidity()" \
  --rpc-url base \
  --private-key $DEPLOYER_PRIVATE_KEY
```

2. **Test buy (ETH → Tokens)**:

```bash
cast send 0x82ab042f2bf9fb6223a9f75fe76745e7fbebe3b4 \
  "adminSwapETHForTokens()" \
  --value 0.00001ether \
  --rpc-url base \
  --private-key $DEPLOYER_PRIVATE_KEY
```

3. **Check transaction on BaseScan** - Look for:

   - Success/failure
   - Events emitted
   - Gas used
   - Any revert reasons

4. **If successful, test sell (Tokens → ETH)**:

```bash
cast send 0x82ab042f2bf9fb6223a9f75fe76745e7fbebe3b4 \
  "adminSwapTokensForETH(uint256)" \
  50000000000000000 \
  --rpc-url base \
  --private-key $DEPLOYER_PRIVATE_KEY
```

## Current Contract Addresses (Base)

- **RugSlot**: `0x82ab042f2bf9fb6223a9f75fe76745e7fbebe3b4`
- **RugSlotToken**: `0x96155fb9f14a7ae1837da90002f04c1cabe5a90b`
- **Uniswap Pair**: `0x0d2E7Bab8CF64d1E49B2F5A3b853cB842A8839C6`

## Important Notes

- These functions are **owner-only**
- They use the same internal swap logic as the automatic buyback/burn
- If these admin swaps work, but automatic swaps fail, the issue is in the trigger logic
- If these admin swaps fail, the issue is in the swap implementation itself
- Remember: The pool has very little liquidity right now (~0.00017 ETH)
