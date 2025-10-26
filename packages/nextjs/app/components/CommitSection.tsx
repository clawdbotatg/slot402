interface CommitSectionProps {
  onCommit: () => void;
  isCommitting: boolean;
  isPolling: boolean;
  connectedAddress: string | undefined;
  commitCount: bigint | undefined;
  commitId: bigint | null;
  secret: string;
  dataRestored: boolean;
  rollError: string | null;
}

export function CommitSection({
  onCommit,
  isCommitting,
  isPolling,
  connectedAddress,
  commitCount,
  commitId,
  secret,
  dataRestored,
  rollError,
}: CommitSectionProps) {
  return (
    <div className="bg-base-200 rounded-lg p-6 mb-6">
      <h2 className="text-2xl font-semibold mb-4">1. Commit</h2>
      <p className="mb-4 text-sm opacity-70">
        Click to generate a random secret and commit your bet on-chain. Bet: 0.00001 ETH
      </p>

      {/* Error Display */}
      {rollError && (
        <div className="alert alert-error mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="stroke-current shrink-0 h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{rollError}</span>
        </div>
      )}

      <div className="flex gap-2">
        <button
          className="btn btn-primary btn-lg flex-grow"
          onClick={onCommit}
          disabled={isCommitting || isPolling || !connectedAddress || commitCount === undefined}
        >
          {isCommitting || isPolling ? "🎲 Rolling..." : "🎲 Roll & Commit (0.00001 ETH)"}
        </button>
      </div>
      {commitId !== null && (
        <div className="mt-4 p-3 bg-base-300 rounded">
          {dataRestored && (
            <div className="mb-2 p-2 bg-info text-info-content rounded text-xs">
              💾 Previous roll data restored from local storage
            </div>
          )}
          <p className="text-sm">
            <span className="font-semibold">Commit ID:</span> {commitId.toString()}
          </p>
          {secret && (
            <p className="text-sm mt-1">
              <span className="font-semibold">Secret:</span> <span className="font-mono text-xs">{secret}</span>
              <span className="text-xs opacity-60 ml-2">(saved automatically)</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
