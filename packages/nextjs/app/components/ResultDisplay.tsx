interface ResultDisplayProps {
  commitId: bigint | null;
  isPolling: boolean;
  isWinner: boolean | null;
  rollResult: number | null;
  expectedPayout: bigint;
  payoutMultiplier: bigint | undefined;
}

// Format USDC amount (6 decimals)
const formatUSDC = (amount: bigint): string => {
  const usdcAmount = Number(amount) / 1e6;
  return usdcAmount.toFixed(2);
};

export function ResultDisplay({
  commitId,
  isPolling,
  isWinner,
  rollResult,
  expectedPayout,
  payoutMultiplier,
}: ResultDisplayProps) {
  if (commitId === null) return null;

  return (
    <div className="bg-base-200 rounded-lg p-6 mb-6">
      <h2 className="text-2xl font-semibold mb-4">2. Result</h2>

      {/* Polling indicator */}
      {isPolling && (
        <div className="mb-4 p-4 bg-info text-info-content rounded-lg">
          <div className="flex items-center gap-3">
            <span className="loading loading-spinner loading-lg"></span>
            <div>
              <p className="font-bold text-lg">🎲 Rolling the dice...</p>
              <p className="text-sm opacity-90">Checking for results...</p>
            </div>
          </div>
        </div>
      )}

      {/* Show result when available */}
      {!isPolling && isWinner !== null && rollResult !== null && (
        <div className={`p-6 rounded-lg ${isWinner ? "bg-success text-success-content" : "bg-base-300"}`}>
          <p className="text-2xl font-bold mb-2">You rolled: {rollResult}</p>
          <p className="text-xl">{isWinner ? "🎉 WINNER! 🎉" : "Not a winner this time"}</p>
          {isWinner && expectedPayout > 0n && (
            <p className="text-sm mt-3 opacity-90">
              Your {payoutMultiplier?.toString()}x payout (${formatUSDC(expectedPayout)} USDC) has been added to
              Uncollected Winnings below. Scroll down to collect!
            </p>
          )}
        </div>
      )}
    </div>
  );
}
