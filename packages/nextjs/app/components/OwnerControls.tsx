import { useState } from "react";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

interface OwnerControlsProps {
  connectedAddress: string | undefined;
}

export function OwnerControls({ connectedAddress }: OwnerControlsProps) {
  const { writeContractAsync: writeTransferOwnership } = useScaffoldWriteContract("ClawdSlots");
  const { writeContractAsync: writeRenounceOwnership } = useScaffoldWriteContract("ClawdSlots");

  // Read owner from contract
  const { data: contractOwner } = useScaffoldReadContract({
    contractName: "ClawdSlots",
    functionName: "owner",
  });

  // Read hopper balance
  const { data: hopperBalance } = useScaffoldReadContract({
    contractName: "ClawdSlots",
    functionName: "getHopperBalance",
    watch: true,
  });

  const [newOwner, setNewOwner] = useState("");

  // Only show if connected address is the owner
  if (!connectedAddress || !contractOwner || connectedAddress.toLowerCase() !== contractOwner.toLowerCase()) {
    return null;
  }

  return (
    <div className="bg-warning rounded-lg p-6 mt-6">
      <h2 className="text-2xl font-semibold mb-4">🦞 Owner Controls</h2>
      <p className="mb-4">You are the owner of ClawdSlots!</p>

      {/* Hopper Info */}
      <div className="mb-4 p-3 bg-base-100 rounded-lg">
        <div className="flex items-center gap-2">
          <span className="font-semibold">Hopper Balance:</span>
          <span className="text-green-600 font-bold">
            {hopperBalance ? (Number(hopperBalance) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 }) : "0"} CLAWD
          </span>
        </div>
      </div>

      {/* Transfer Ownership */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">Transfer Ownership</h3>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="0x... new owner address"
            className="input input-bordered flex-1"
            value={newOwner}
            onChange={e => setNewOwner(e.target.value)}
          />
          <button
            className="btn btn-primary"
            onClick={async () => {
              try {
                await writeTransferOwnership({
                  functionName: "transferOwnership",
                  args: [newOwner as `0x${string}`],
                });
                console.log("Ownership transferred!");
              } catch (e) {
                console.error("Error:", e);
              }
            }}
          >
            Transfer
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="mt-4 p-3 bg-error bg-opacity-20 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">⚠️ Danger Zone</h3>
        <div className="flex gap-2 flex-wrap">
          <button
            className="btn btn-error btn-sm"
            onClick={async () => {
              if (!confirm("Are you sure? This will renounce ownership permanently!")) return;
              try {
                await writeRenounceOwnership({ functionName: "renounceOwnership" });
                console.log("Ownership renounced!");
              } catch (e) {
                console.error("Error:", e);
              }
            }}
          >
            Renounce Ownership
          </button>
        </div>
      </div>
    </div>
  );
}
