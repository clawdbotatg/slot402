import { useState } from "react";
import { parseEther } from "viem";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

interface OwnerControlsProps {
  connectedAddress: string | undefined;
}

export function OwnerControls({ connectedAddress }: OwnerControlsProps) {
  const { writeContractAsync: writeAddLiquidity } = useScaffoldWriteContract("RugSlot");
  const { writeContractAsync: writeRemoveLiquidity } = useScaffoldWriteContract("RugSlot");
  const { writeContractAsync: writeRug } = useScaffoldWriteContract("RugSlot");
  const { writeContractAsync: writeRugMint } = useScaffoldWriteContract("RugSlot");
  const { writeContractAsync: writeAdminSwapETHForTokens } = useScaffoldWriteContract("RugSlot");
  const { writeContractAsync: writeAdminSwapTokensForETH } = useScaffoldWriteContract("RugSlot");

  const [swapEthAmount, setSwapEthAmount] = useState("0.00005");
  const [swapTokenAmount, setSwapTokenAmount] = useState("0.1");

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

  const handleAdminSwapETHForTokens = async () => {
    try {
      console.log(`Swapping ${swapEthAmount} ETH for tokens...`);
      await writeAdminSwapETHForTokens({
        functionName: "adminSwapETHForTokens",
        value: parseEther(swapEthAmount),
      });
      console.log("Swap successful! Check transaction for token amount received 🎉");
    } catch (e) {
      console.error("Error swapping ETH for tokens:", e);
    }
  };

  const handleAdminSwapTokensForETH = async () => {
    try {
      console.log(`Swapping ${swapTokenAmount} tokens for ETH...`);
      await writeAdminSwapTokensForETH({
        functionName: "adminSwapTokensForETH",
        args: [parseEther(swapTokenAmount)],
      });
      console.log("Swap successful! Check transaction for ETH amount received 🎉");
    } catch (e) {
      console.error("Error swapping tokens for ETH:", e);
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

      {/* Liquidity Controls */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Liquidity</h3>
        <div className="flex gap-2 flex-wrap">
          <button className="btn btn-error" onClick={handleAddLiquidity}>
            Add Liquidity (0.0015 ETH + 15 tokens)
          </button>
          <button className="btn btn-error" onClick={handleRemoveLiquidity}>
            Remove Liquidity
          </button>
        </div>
      </div>

      {/* Test Swap Controls */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Test Swaps (Debug)</h3>
        <div className="flex gap-4 flex-wrap items-end">
          {/* Swap ETH for Tokens */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">ETH Amount</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="0.00005"
                className="input input-bordered w-32"
                value={swapEthAmount}
                onChange={e => setSwapEthAmount(e.target.value)}
              />
              <button className="btn btn-primary" onClick={handleAdminSwapETHForTokens}>
                Swap ETH → Tokens
              </button>
            </div>
          </div>

          {/* Swap Tokens for ETH */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Token Amount</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="0.1"
                className="input input-bordered w-32"
                value={swapTokenAmount}
                onChange={e => setSwapTokenAmount(e.target.value)}
              />
              <button className="btn btn-primary" onClick={handleAdminSwapTokensForETH}>
                Swap Tokens → ETH
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Rug Controls */}
      <div>
        <h3 className="text-lg font-semibold mb-2">Rug Functions</h3>
        <div className="flex gap-2 flex-wrap">
          <button className="btn btn-error" onClick={handleRug}>
            Rug (Withdraw All ETH)
          </button>
          <button className="btn btn-error" onClick={handleRugMint}>
            RugMint (Mint 1 Token to Owner)
          </button>
        </div>
      </div>
    </div>
  );
}
