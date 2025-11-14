interface GameRulesProps {
  betSize: bigint | undefined;
  payoutMultiplier: bigint | undefined;
  expectedPayout: bigint;
}

// Format USDC amount (6 decimals)
const formatUSDC = (amount: bigint): string => {
  const usdcAmount = Number(amount) / 1e6;
  return usdcAmount.toFixed(2);
};

export function GameRules({ betSize, payoutMultiplier, expectedPayout }: GameRulesProps) {
  return (
    <div className="bg-base-200 rounded-lg p-6">
      <h2 className="text-2xl font-semibold mb-4">📜 Rules</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>Bet size: {betSize ? `$${formatUSDC(betSize)} USDC` : "$0.05 USDC"} per roll</li>
        <li>3 slot reels with 45 symbols each</li>
        <li>
          Match all 3 symbols: Win {payoutMultiplier?.toString() || "10"}x your bet
          {expectedPayout > 0n && ` ($${formatUSDC(expectedPayout)} USDC)`}
        </li>
        <li>No match: Lose your bet</li>
        <li>Winnings appear in &quot;Uncollected Winnings&quot; section above</li>
        <li>Must collect within 256 blocks or forfeit</li>
        <li>
          Symbols: 🍒 Cherries (9), 🍊 Oranges (8), 🍉 Watermelon (7), ⭐ Stars (6), 🔔 Bells (5), ▬ Bars (4), ⚏ Double
          Bars (3), 7️⃣ Sevens (2), ⟠ BaseETH (1)
        </li>
      </ul>
    </div>
  );
}
