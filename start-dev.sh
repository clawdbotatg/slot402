#!/bin/bash
# Slot402 Local Dev Stack - Start all services
# Usage: ./start-dev.sh

SLOT402_DIR="$(cd "$(dirname "$0")" && pwd)"
FOUNDRY_BIN="$HOME/.foundry/bin"
ALCHEMY_KEY="${ALCHEMY_KEY:?Set ALCHEMY_KEY env var}"

echo "🦞 Starting Slot402 Dev Stack..."

# Kill any existing processes
pkill -f "anvil.*--chain-id 8453" 2>/dev/null
pkill -f "node facilitator.js" 2>/dev/null
pkill -f "node server.js" 2>/dev/null
# Don't kill next - user might want to manage that separately
sleep 1

# 1. Start Anvil
echo "⛏️  Starting Anvil (Base fork, chainId 8453)..."
$FOUNDRY_BIN/anvil --fork-url "https://base-mainnet.g.alchemy.com/v2/$ALCHEMY_KEY" --chain-id 8453 --block-time 1 > /tmp/anvil.log 2>&1 &
ANVIL_PID=$!
echo "   PID: $ANVIL_PID"
sleep 3

# Verify Anvil
if ! curl -s -X POST http://127.0.0.1:8545 -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' | grep -q "0x2105"; then
  echo "❌ Anvil failed to start!"
  exit 1
fi
echo "   ✅ Anvil running"

# 2. Deploy contracts
echo "📦 Deploying contracts..."
export PATH="$FOUNDRY_BIN:$PATH"
cd "$SLOT402_DIR/packages/foundry"
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast --legacy --ffi > /tmp/slot402-deploy.log 2>&1

CONTRACT=$(python3 -c "
import json
with open('broadcast/Deploy.s.sol/8453/run-latest.json') as f:
    data = json.load(f)
for tx in data.get('transactions', []):
    if tx.get('transactionType') == 'CREATE':
        print(tx.get('contractAddress'))
" 2>/dev/null)
echo "   Contract: $CONTRACT"
make generate-abis > /dev/null 2>&1
echo "   ✅ Deployed and ABIs generated"

# 3. Fund hopper + burner
echo "💰 Funding hopper and burner wallet..."
CLAWD=0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
WHALE=0x90eF2A9211A3E7CE788561E5af54C76B0Fa3aEd0
USDC_WHALE=0x3304E22DDaa22bCdC5fCa2269b418046aE7b566A
BURNER=0xE734C395D197A64f73C54BE2486A42C0E9F0a172
ANVIL_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
RPC=http://127.0.0.1:8545

cast send $WHALE --value 1ether --private-key $ANVIL_KEY --rpc-url $RPC > /dev/null 2>&1
cast rpc anvil_impersonateAccount $WHALE --rpc-url $RPC > /dev/null 2>&1
cast send $CLAWD "transfer(address,uint256)" $CONTRACT 100000000000000000000000000 --from $WHALE --rpc-url $RPC --unlocked > /dev/null 2>&1
cast send $BURNER --value 1ether --private-key $ANVIL_KEY --rpc-url $RPC > /dev/null 2>&1
cast send $USDC_WHALE --value 0.01ether --private-key $ANVIL_KEY --rpc-url $RPC > /dev/null 2>&1
cast rpc anvil_impersonateAccount $USDC_WHALE --rpc-url $RPC > /dev/null 2>&1
cast send $USDC "transfer(address,uint256)" $BURNER 100000000 --from $USDC_WHALE --rpc-url $RPC --unlocked > /dev/null 2>&1
echo "   ✅ Hopper: 100M CLAWD, Burner: 1 ETH + 100 USDC"

# 4. Start facilitator
echo "🤖 Starting facilitator..."
cd "$SLOT402_DIR/packages/x402-facilitator"
node facilitator.js > /tmp/facilitator.log 2>&1 &
echo "   PID: $!"

# 5. Start server
echo "🎰 Starting x402 server..."
cd "$SLOT402_DIR/packages/x402-server"
node server.js > /tmp/server.log 2>&1 &
echo "   PID: $!"

sleep 2

# 6. Start frontend
echo "🌐 Starting Next.js dev server..."
cd "$SLOT402_DIR"
yarn workspace @se-2/nextjs dev > /tmp/slot402-nextjs.log 2>&1 &
echo "   PID: $!"

echo ""
echo "🦞 ClawdSlots Dev Stack Ready!"
echo "   Anvil:       http://127.0.0.1:8545 (chainId 8453)"
echo "   Facilitator: http://localhost:8001"
echo "   Server:      http://localhost:8000"
echo "   Frontend:    http://localhost:3000"
echo "   Contract:    $CONTRACT"
echo ""
echo "   Logs: /tmp/anvil.log, /tmp/facilitator.log, /tmp/server.log, /tmp/slot402-nextjs.log"
echo "   Stop: pkill -f anvil; pkill -f 'node facilitator'; pkill -f 'node server'; pkill -f next-server"
