#!/bin/bash
# Start all ClawdSlots dev services
set -e

export PATH="$HOME/.foundry/bin:$PATH"
cd "$(dirname "$0")"

echo "🦞 Starting ClawdSlots dev stack..."

# Kill old processes
pkill -f "facilitator.js" 2>/dev/null || true
pkill -f "x402-server.*server.js" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
sleep 1

# Start facilitator
cd packages/x402-facilitator
nohup node facilitator.js > /tmp/facilitator.log 2>&1 &
echo "  Facilitator PID: $!"
cd ../..

sleep 2

# Start x402 server
cd packages/x402-server
nohup node server.js > /tmp/x402-server.log 2>&1 &
echo "  Server PID: $!"
cd ../..

sleep 2

# Start Next.js
NODE_OPTIONS="--max-old-space-size=4096" nohup yarn start > /tmp/nextjs.log 2>&1 &
echo "  NextJS PID: $!"

echo ""
echo "🦞 All services started. Check:"
echo "  Anvil:       http://127.0.0.1:8545"
echo "  Facilitator: http://localhost:8001/health"
echo "  Server:      http://localhost:8000/health"
echo "  Frontend:    http://localhost:3000"
