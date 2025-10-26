import { formatEther } from "viem";

interface GameRulesProps {
  betSize: bigint | undefined;
  payoutMultiplier: bigint | undefined;
  expectedPayout: bigint;
}

export function GameRules({ betSize, payoutMultiplier, expectedPayout }: GameRulesProps) {
  return (
    <div className="bg-base-200 rounded-lg p-6">
      <h2 className="text-2xl font-semibold mb-4">📜 Rules</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>Bet size: {betSize ? `${Number(formatEther(betSize)).toFixed(5)} ETH` : "0.00001 ETH"} per roll</li>
        <li>3 slot reels with 36 symbols each</li>
        <li>
          Match all 3 symbols: Win {payoutMultiplier?.toString() || "10"}x your bet
          {expectedPayout > 0n && ` (${Number(formatEther(expectedPayout)).toFixed(5)} ETH)`}
        </li>
        <li>No match: Lose your bet</li>
        <li>Winnings appear in &quot;Uncollected Winnings&quot; section above</li>
        <li>Must collect within 256 blocks or forfeit</li>
        <li>
          Symbols: 🍒 Cherries (8), 🍊 Oranges (7), ⭐ Stars (6), 🔔 Bells (5), 💎 Diamonds (4), ▬ Bars (3), ⚏ Double
          Bars (2), 7️⃣ Sevens (1)
        </li>
      </ul>
    </div>
  );
}
