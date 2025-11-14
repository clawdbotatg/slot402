import { useState } from "react";
import { parseEther } from "viem";
import { Address } from "~~/components/scaffold-eth";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

interface OwnerControlsProps {
  connectedAddress: string | undefined;
}

export function OwnerControls({ connectedAddress }: OwnerControlsProps) {
  const { writeContractAsync: writeAddLiquidity } = useScaffoldWriteContract("Slot402");
  const { writeContractAsync: writeRemoveLiquidity } = useScaffoldWriteContract("Slot402");
  const { writeContractAsync: writeRug } = useScaffoldWriteContract("Slot402");
  const { writeContractAsync: writeRugMint } = useScaffoldWriteContract("Slot402");
  const { writeContractAsync: writeAdminSwapUSDCForTokens } = useScaffoldWriteContract("Slot402");
  const { writeContractAsync: writeAdminSwapTokensForUSDC } = useScaffoldWriteContract("Slot402");

  // Read liquidity status from contract
  const { data: liquidityAdded } = useScaffoldReadContract({
    contractName: "Slot402",
    functionName: "liquidityAdded",
  });

  const { data: uniswapPair } = useScaffoldReadContract({
    contractName: "Slot402",
    functionName: "uniswapPair",
  });

  const [swapUsdcAmount, setSwapUsdcAmount] = useState("50");
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

  const handleAdminSwapUSDCForTokens = async () => {
    try {
      // USDC has 6 decimals, so we need to convert the amount
      const usdcAmount = BigInt(Math.floor(parseFloat(swapUsdcAmount) * 1e6));
      console.log(`Swapping ${swapUsdcAmount} USDC for tokens...`);
      await writeAdminSwapUSDCForTokens({
        functionName: "adminSwapUSDCForTokens",
        args: [usdcAmount],
      });
      console.log("Swap successful! Check transaction for token amount received 🎉");
    } catch (e) {
      console.error("Error swapping USDC for tokens:", e);
    }
  };

  const handleAdminSwapTokensForUSDC = async () => {
    try {
      console.log(`Swapping ${swapTokenAmount} tokens for USDC...`);
      await writeAdminSwapTokensForUSDC({
        functionName: "adminSwapTokensForUSDC",
        args: [parseEther(swapTokenAmount)],
      });
      console.log("Swap successful! Check transaction for USDC amount received 🎉");
    } catch (e) {
      console.error("Error swapping tokens for USDC:", e);
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

      {/* Liquidity Status */}
      <div className="mb-4 p-3 bg-base-100 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-semibold">Liquidity Status:</span>
          {liquidityAdded ? (
            <span className="badge badge-success">✅ Added</span>
          ) : (
            <span className="badge badge-error">❌ Not Added (Buyback Disabled!)</span>
          )}
        </div>
        {uniswapPair && uniswapPair !== "0x0000000000000000000000000000000000000000" && (
          <div className="text-sm">
            <span className="opacity-70">Uniswap Pair: </span>
            <Address address={uniswapPair} />
          </div>
        )}
      </div>

      {/* Liquidity Controls */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Liquidity</h3>
        <div className="flex gap-2 flex-wrap">
          <button className="btn btn-error" onClick={handleAddLiquidity}>
            Add Liquidity (0.15 USDC + 150 tokens)
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
          {/* Swap USDC for Tokens */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">USDC Amount (6 decimals)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="50"
                className="input input-bordered w-32"
                value={swapUsdcAmount}
                onChange={e => setSwapUsdcAmount(e.target.value)}
              />
              <button className="btn btn-primary" onClick={handleAdminSwapUSDCForTokens}>
                Swap USDC → Tokens
              </button>
            </div>
          </div>

          {/* Swap Tokens for USDC */}
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
              <button className="btn btn-primary" onClick={handleAdminSwapTokensForUSDC}>
                Swap Tokens → USDC
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
            Rug (Withdraw All USDC)
          </button>
          <button className="btn btn-error" onClick={handleRugMint}>
            RugMint (Mint 1 Token to Owner)
          </button>
        </div>
      </div>
    </div>
  );
}
