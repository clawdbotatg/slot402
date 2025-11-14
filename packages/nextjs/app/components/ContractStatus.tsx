interface ContractStatusProps {
  currentPhase: number | undefined;
  currentBlockNumber: bigint | undefined;
  contractUsdcBalance: bigint | undefined;
  commitCount: bigint | undefined;
}

// Format USDC amount (6 decimals)
const formatUSDC = (amount: bigint): string => {
  const usdcAmount = Number(amount) / 1e6;
  return usdcAmount.toFixed(2);
};

export function ContractStatus({
  currentPhase,
  currentBlockNumber,
  contractUsdcBalance,
  commitCount,
}: ContractStatusProps) {
  const phaseText = currentPhase === 0 ? "SALE" : currentPhase === 1 ? "ACTIVE" : "UNKNOWN";

  return (
    <div className="bg-base-200 rounded-lg p-6 mb-6">
      <h2 className="text-2xl font-semibold mb-4">Contract Status</h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm opacity-70">Phase</p>
          <p className="text-xl font-bold">{phaseText}</p>
        </div>
        <div>
          <p className="text-sm opacity-70">Current Block</p>
          <p className="text-xl font-bold">{currentBlockNumber?.toString() || "Loading..."}</p>
        </div>
        <div>
          <p className="text-sm opacity-70">Contract Balance</p>
          <p className="text-xl font-bold">
            {contractUsdcBalance ? `$${formatUSDC(contractUsdcBalance)} USDC` : "$0.00 USDC"}
          </p>
        </div>
        <div>
          <p className="text-sm opacity-70">Your Commits</p>
          <p className="text-xl font-bold">{commitCount?.toString() || "0"}</p>
        </div>
      </div>
    </div>
  );
}
