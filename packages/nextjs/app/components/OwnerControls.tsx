import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

interface OwnerControlsProps {
  connectedAddress: string | undefined;
}

export function OwnerControls({ connectedAddress }: OwnerControlsProps) {
  const { writeContractAsync: writeAddLiquidity } = useScaffoldWriteContract("RugSlot");
  const { writeContractAsync: writeRemoveLiquidity } = useScaffoldWriteContract("RugSlot");
  const { writeContractAsync: writeRug } = useScaffoldWriteContract("RugSlot");
  const { writeContractAsync: writeRugMint } = useScaffoldWriteContract("RugSlot");

  const handleAddLiquidity = async () => {
    try {
      console.log("Adding liquidity...");
      await writeAddLiquidity({
        functionName: "addLiquidity",
      });
      console.log("Liquidity added successfully! 🎉");
    } catch (e) {
      console.error("Error adding liquidity:", e);
    }
  };

  const handleRemoveLiquidity = async () => {
    try {
      console.log("Removing liquidity...");
      await writeRemoveLiquidity({
        functionName: "removeLiquidity",
      });
      console.log("Liquidity removed successfully! 🎉");
    } catch (e) {
      console.error("Error removing liquidity:", e);
    }
  };

  const handleRug = async () => {
    try {
      console.log("Rugging...");
      await writeRug({
        functionName: "rug",
      });
      console.log("Rug successful! 💰");
    } catch (e) {
      console.error("Error rugging:", e);
    }
  };

  const handleRugMint = async () => {
    try {
      console.log("Rug minting...");
      await writeRugMint({
        functionName: "rugmint",
      });
      console.log("Minted 1 token to owner!");
    } catch (e) {
      console.error("Error rug minting:", e);
    }
  };

  // Only show if connected address is owner
  if (connectedAddress?.toLowerCase() !== "0x05937Df8ca0636505d92Fd769d303A3D461587ed".toLowerCase()) {
    return null;
  }

  return (
    <div className="bg-warning rounded-lg p-6 mt-6">
      <h2 className="text-2xl font-semibold mb-4">👑 Owner Controls</h2>
      <p className="mb-4">You are the owner!</p>
      <div className="flex gap-2 flex-wrap">
        <button className="btn btn-error" onClick={handleAddLiquidity}>
          Add Liquidity (0.00015 ETH + 1.5 tokens)
        </button>
        <button className="btn btn-error" onClick={handleRemoveLiquidity}>
          Remove Liquidity
        </button>
        <button className="btn btn-error" onClick={handleRug}>
          Rug (Withdraw All ETH)
        </button>
        <button className="btn btn-error" onClick={handleRugMint}>
          RugMint (Mint 1 Token to Owner)
        </button>
      </div>
    </div>
  );
}
