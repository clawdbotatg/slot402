import { formatEther, parseEther } from "viem";
import { useAccount } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth";

const WETH_ADDRESS = "0x4200000000000000000000000000000000000006"; // Base WETH
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base USDC

export function TokenSalePhase() {
  const { address: connectedAddress } = useAccount();
  const { writeContractAsync: writeBuyTokens } = useScaffoldWriteContract("RugSlot");
  const { writeContractAsync: writeUSDCApprove } = useScaffoldWriteContract("USDC");
  const { writeContractAsync: writeSwap } = useScaffoldWriteContract("UniswapV2Router");

  // Get contract address
  const { data: rugSlotContractInfo } = useDeployedContractInfo("RugSlot");
  const rugSlotAddress = rugSlotContractInfo?.address;

  // Swap ETH for USDC function
  const handleSwapETHForUSDC = async () => {
    try {
      // Swap 0.001 ETH for USDC (should get way more than 1.5 USDC needed)
      const ethAmount = parseEther("0.001");
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes
      const path = [WETH_ADDRESS, USDC_ADDRESS];

      console.log("🔄 Swapping 0.001 ETH for USDC...");
      console.log("Path:", path);
      console.log("Deadline:", deadline);

      await writeSwap({
        functionName: "swapExactETHForTokens",
        args: [BigInt(0), path, connectedAddress as `0x${string}`, BigInt(deadline)],
        value: ethAmount,
      });

      console.log("✅ Swap successful! You should now have USDC.");
    } catch (error: any) {
      console.error("Swap failed:", error);
      alert("Swap failed: " + (error.message || "Unknown error"));
    }
  };

  // Manual approve USDC function
  const handleManualApprove = async () => {
    try {
      const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
      console.log("🔓 Manually approving USDC...");
      console.log("Spender (RugSlot):", rugSlotAddress);
      console.log("Amount:", "MAX_UINT256");

      await writeUSDCApprove({
        functionName: "approve",
        args: [rugSlotAddress as `0x${string}`, MAX_UINT256],
      });
      console.log("✅ USDC approved successfully! You can now buy tokens.");
    } catch (error: any) {
      console.error("Manual approval failed:", error);
      alert("Failed to approve USDC: " + (error.message || "Unknown error"));
    }
  };

  // Read max sale tokens
  const { data: maxSaleTokens } = useScaffoldReadContract({
    contractName: "RugSlot",
    functionName: "maxSaleTokens",
  });

  // Read current total supply from the token contract
  const { data: totalSupply } = useScaffoldReadContract({
    contractName: "RugSlotToken",
    functionName: "totalSupply",
    watch: true,
  });

  // Read USDC allowance and balance
  const { data: usdcAllowance } = useScaffoldReadContract({
    contractName: "USDC",
    functionName: "allowance",
    args: [connectedAddress as `0x${string}`, rugSlotAddress as `0x${string}`],
    watch: true,
  });

  const { data: usdcBalance } = useScaffoldReadContract({
    contractName: "USDC",
    functionName: "balanceOf",
    args: [connectedAddress as `0x${string}`],
    watch: true,
  });

  const handleBuyTokens = async (amount: number) => {
    try {
      // Calculate token amount in wei (18 decimals)
      const tokenAmount = parseEther(amount.toString());

      // Calculate USDC amount needed (1000 USDC units = 0.001 USDC per token with 6 decimals)
      const usdcAmountNeeded = BigInt(amount) * BigInt(1000);

      // Check USDC balance
      if (usdcBalance !== undefined && usdcBalance < usdcAmountNeeded) {
        const usdcNeeded = (Number(usdcAmountNeeded) / 1000000).toFixed(6);
        const usdcCurrent = (Number(usdcBalance) / 1000000).toFixed(6);
        alert(`Insufficient USDC balance. You have $${usdcCurrent} USDC but need $${usdcNeeded} USDC.`);
        return;
      }

      // Check if we need to approve USDC
      if (usdcAllowance === undefined || usdcAllowance < usdcAmountNeeded) {
        console.log("💰 Need to approve USDC spending...");
        console.log("Current allowance:", usdcAllowance?.toString());
        console.log("Amount needed:", usdcAmountNeeded.toString());

        // Use max uint256 for unlimited approval to avoid repeated approvals
        const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

        try {
          await writeUSDCApprove({
            functionName: "approve",
            args: [rugSlotAddress as `0x${string}`, MAX_UINT256],
          });
          console.log("✅ USDC approved! Waiting for confirmation...");

          // Wait for the approval to be reflected on-chain
          // The writeContractAsync should wait for confirmation, but add a small delay to be safe
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (approvalError) {
          console.error("Approval failed:", approvalError);
          alert("Failed to approve USDC spending. Please try again.");
          return;
        }
      }

      console.log("🎰 Buying tokens...");
      await writeBuyTokens({
        functionName: "buyTokens",
        args: [tokenAmount],
      });
      console.log("✅ Tokens purchased successfully!");
    } catch (e: any) {
      console.error("Error buying tokens:", e);

      // Provide more helpful error messages
      if (e.message?.includes("allowance")) {
        alert("USDC approval issue. Please try approving USDC spending first.");
      } else if (e.message?.includes("balance")) {
        alert("Insufficient USDC balance.");
      } else {
        alert("Error buying tokens: " + (e.message || "Unknown error"));
      }
    }
  };

  // Calculate remaining tokens
  const tokensRemaining = maxSaleTokens && totalSupply ? Number(formatEther(maxSaleTokens - totalSupply)) : 1500;
  const tokensSold = totalSupply ? Number(formatEther(totalSupply)) : 0;
  const maxTokens = maxSaleTokens ? Number(formatEther(maxSaleTokens)) : 1500;
  const usdcRemaining = (tokensRemaining * 0.001).toFixed(4);
  const progressPercent = ((tokensSold / maxTokens) * 100).toFixed(1);

  // Format USDC balance and allowance
  const formattedBalance = usdcBalance !== undefined ? (Number(usdcBalance) / 1000000).toFixed(6) : "0";
  const formattedAllowance =
    usdcAllowance !== undefined
      ? usdcAllowance > BigInt(1000000000000)
        ? "Unlimited"
        : (Number(usdcAllowance) / 1000000).toFixed(6)
      : "0";

  return (
    <div className="bg-base-200 rounded-lg p-6 mb-6">
      <h2 className="text-2xl font-semibold mb-4">🛒 Token Sale - Crowdfund the Jackpot!</h2>
      <p className="mb-2">
        Buy tokens at <span className="font-bold">$0.001 USDC</span> each to fund the slot machine bankroll.
      </p>
      <p className="mb-4 text-sm opacity-80">
        Target: {maxTokens.toLocaleString()} tokens ($1.50 USDC) to reach treasury threshold of $1.35 USDC
      </p>

      {/* USDC Info */}
      {connectedAddress && (
        <div className="bg-base-300 rounded-lg p-3 mb-4 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="opacity-70">Your USDC Balance:</span>
            <span className="font-mono font-bold">${formattedBalance} USDC</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-70">USDC Allowance:</span>
            <span className="font-mono font-bold">{formattedAllowance}</span>
          </div>
          {usdcBalance !== undefined && usdcBalance < BigInt(1500000) && (
            <div className="alert alert-warning text-xs p-2 mt-2 space-y-2">
              <div>
                ⚠️ Insufficient USDC. You need ${(1500000 / 1000000).toFixed(2)} USDC to buy all remaining tokens.
              </div>
              <button className="btn btn-primary btn-xs w-full" onClick={handleSwapETHForUSDC}>
                💱 Swap 0.001 ETH for USDC
              </button>
            </div>
          )}
        </div>
      )}

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span>
            {tokensSold.toLocaleString()} / {maxTokens.toLocaleString()} tokens sold
          </span>
          <span className="font-bold">{progressPercent}%</span>
        </div>
        <progress className="progress progress-primary w-full" value={tokensSold} max={maxTokens}></progress>
        <p className="text-xs opacity-70 mt-1">
          Remaining: {tokensRemaining.toLocaleString()} tokens (${usdcRemaining} USDC)
        </p>
      </div>

      {/* Manual Approve Button */}
      {connectedAddress && (usdcAllowance === undefined || usdcAllowance === BigInt(0)) && (
        <button className="btn btn-warning btn-sm mb-3 w-full" onClick={handleManualApprove}>
          🔓 Approve USDC Spending First
        </button>
      )}

      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary btn-sm" onClick={() => handleBuyTokens(1)}>
          Buy 1 for $0.001 USDC
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => handleBuyTokens(10)}>
          Buy 10 for $0.01 USDC
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => handleBuyTokens(100)}>
          Buy 100 for $0.10 USDC
        </button>
        <button
          className="btn btn-accent btn-lg flex-grow"
          onClick={() => handleBuyTokens(tokensRemaining)}
          disabled={tokensRemaining <= 0}
        >
          💰 Buy All Remaining - {tokensRemaining.toLocaleString()} tokens for ${usdcRemaining} USDC
        </button>
      </div>
    </div>
  );
}
