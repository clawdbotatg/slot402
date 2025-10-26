interface RecoverySectionProps {
  connectedAddress: string | undefined;
  isPolling: boolean;
  isCommitting: boolean;
  rollError: string | null;
  commitId: bigint | null;
  commitCount: bigint | undefined;
  pendingRevealsCount: number;
  onUnjam: () => void;
}

export function RecoverySection({
  connectedAddress,
  isPolling,
  isCommitting,
  rollError,
  commitId,
  commitCount,
  pendingRevealsCount,
  onUnjam,
}: RecoverySectionProps) {
  // Only show if there's something to recover from
  if (!connectedAddress || (!isPolling && !isCommitting && !rollError && commitId === null)) {
    return null;
  }

  return (
    <div className="bg-base-300 rounded-lg p-6 mt-6">
      <h2 className="text-2xl font-semibold mb-4">hit machine with a wrench</h2>
      <p className="mb-4 text-sm opacity-70">
        If the machine is stuck, use this button to clear local storage and reset UI state. This will NOT affect your
        on-chain commit history - your next roll will use commit ID {commitCount?.toString() || "..."} from the
        contract.
      </p>
      {pendingRevealsCount > 0 && (
        <p className="mb-4 text-sm font-semibold text-warning">
          Note: Your {pendingRevealsCount} pending reveal{pendingRevealsCount > 1 ? "s" : ""} will be preserved.
        </p>
      )}
      <button className="btn btn-warning" onClick={onUnjam}>
        🔧 Unjam Machine
      </button>
    </div>
  );
}
