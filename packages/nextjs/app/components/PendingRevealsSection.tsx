import { formatEther } from "viem";
import { PendingReveal } from "~~/hooks/usePendingReveals";

interface PendingRevealsSectionProps {
  pendingReveals: PendingReveal[];
  currentBlockNumber: bigint | undefined;
  onCollect: (commitId: string, secret: string) => void;
}

export function PendingRevealsSection({ pendingReveals, currentBlockNumber, onCollect }: PendingRevealsSectionProps) {
  if (pendingReveals.length === 0) return null;

  return (
    <div className="bg-warning text-warning-content rounded-lg p-6 mb-6">
      <h2 className="text-2xl font-semibold mb-4">💰 Uncollected Winnings ({pendingReveals.length})</h2>
      <p className="mb-4 text-sm opacity-90">
        You have {pendingReveals.length} winning reveal{pendingReveals.length > 1 ? "s" : ""} waiting to be collected!
      </p>
      <div className="space-y-3">
        {pendingReveals.map(reveal => {
          const blocksRemaining =
            currentBlockNumber && reveal.commitBlock ? 256n - (currentBlockNumber - reveal.commitBlock) : 256n;
          const isExpiringSoon = blocksRemaining < 50n;
          const isExpired = blocksRemaining <= 0n;
          const amountRemaining = reveal.amountWon - reveal.amountPaid;

          return (
            <div
              key={reveal.commitId}
              className={`p-4 rounded ${isExpired ? "bg-error text-error-content" : isExpiringSoon ? "bg-orange-500 text-white" : "bg-base-100 text-base-content"}`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold">Commit #{reveal.commitId}</p>
                  <p className="text-sm opacity-90">Remaining: {Number(formatEther(amountRemaining)).toFixed(5)} ETH</p>
                  {reveal.amountPaid > 0n && (
                    <p className="text-xs opacity-75">
                      Already paid: {Number(formatEther(reveal.amountPaid)).toFixed(5)} ETH
                    </p>
                  )}
                  <p className={`text-xs mt-1 ${isExpired ? "font-bold" : ""}`}>
                    {isExpired ? "⚠️ EXPIRED - Cannot collect" : `${blocksRemaining.toString()} blocks remaining`}
                  </p>
                </div>
                <button
                  className={`btn ${isExpired ? "btn-disabled" : "btn-success"}`}
                  onClick={() => onCollect(reveal.commitId, reveal.secret)}
                  disabled={isExpired}
                >
                  {isExpired ? "Expired" : "Collect"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
