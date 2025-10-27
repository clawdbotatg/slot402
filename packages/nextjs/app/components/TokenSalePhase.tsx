import { formatEther } from "viem";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useGlobalState } from "~~/services/store/store";

export function TokenSalePhase() {
  const { writeContractAsync: writeBuyTokens } = useScaffoldWriteContract("RugSlot");
  const nativeCurrencyPrice = useGlobalState(state => state.nativeCurrency.price);

  // Read max sale tokens
  const { data: maxSaleTokens } = useScaffoldReadContract({
    contractName: "RugSlot",
    functionName: "maxSaleTokens",
  });

  // Read token address
  // const { data: tokenAddress } = useScaffoldReadContract({
  //   contractName: "RugSlot",
  //   functionName: "sellableToken",
  // });

  // Read current total supply from the token contract
  const { data: totalSupply } = useScaffoldReadContract({
    contractName: "RugSlotToken",
    functionName: "totalSupply",
    watch: true,
  });

  const handleBuyTokens = async (amount: number) => {
    try {
      // Calculate value using BigInt to avoid floating point precision issues
      // Token price is 0.0001 ETH = 100000000000000 wei (10^14)
      const tokenPriceWei = BigInt("100000000000000"); // 0.0001 ETH in wei
      const totalValue = tokenPriceWei * BigInt(amount);

      await writeBuyTokens({
        functionName: "buyTokens",
        value: totalValue,
      });
    } catch (e) {
      console.error("Error buying tokens:", e);
    }
  };

  // Calculate remaining tokens
  const tokensRemaining = maxSaleTokens && totalSupply ? Number(formatEther(maxSaleTokens - totalSupply)) : 150;
  const tokensSold = totalSupply ? Number(formatEther(totalSupply)) : 0;
  const maxTokens = maxSaleTokens ? Number(formatEther(maxSaleTokens)) : 150;
  const ethRemaining = (tokensRemaining * 0.0001).toFixed(4);
  const progressPercent = ((tokensSold / maxTokens) * 100).toFixed(1);

  return (
    <div className="bg-base-200 rounded-lg p-6 mb-6">
      <h2 className="text-2xl font-semibold mb-4">🛒 Token Sale - Crowdfund the Jackpot!</h2>
      <p className="mb-2">
        Buy tokens at <span className="font-bold">0.0001 ETH</span>
        {nativeCurrencyPrice > 0 && (
          <span className="text-sm opacity-70"> (${(0.0001 * nativeCurrencyPrice).toFixed(4)} USD)</span>
        )}{" "}
        each to fund the slot machine bankroll.
      </p>
      <p className="mb-4 text-sm opacity-80">
        Target: {maxTokens.toLocaleString()} tokens (0.015 ETH
        {nativeCurrencyPrice > 0 && <> / ${(0.015 * nativeCurrencyPrice).toFixed(2)} USD</>}) to reach treasury
        threshold of 0.0135 ETH (TESTING: 1/10 scale)
      </p>

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
          Remaining: {tokensRemaining.toLocaleString()} tokens ({ethRemaining} ETH
          {nativeCurrencyPrice > 0 && <> / ${(parseFloat(ethRemaining) * nativeCurrencyPrice).toFixed(4)} USD</>})
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary btn-sm" onClick={() => handleBuyTokens(1)}>
          Buy 1 for 0.0001 ETH{nativeCurrencyPrice > 0 && <> (${(0.0001 * nativeCurrencyPrice).toFixed(4)} USD)</>}
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => handleBuyTokens(3)}>
          Buy 3 for 0.0003 ETH{nativeCurrencyPrice > 0 && <> (${(0.0003 * nativeCurrencyPrice).toFixed(4)} USD)</>}
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => handleBuyTokens(5)}>
          Buy 5 for 0.0005 ETH{nativeCurrencyPrice > 0 && <> (${(0.0005 * nativeCurrencyPrice).toFixed(4)} USD)</>}
        </button>
        <button
          className="btn btn-accent btn-lg flex-grow"
          onClick={() => handleBuyTokens(tokensRemaining)}
          disabled={tokensRemaining <= 0}
        >
          💰 Buy All Remaining - {tokensRemaining.toLocaleString()} tokens for {ethRemaining} ETH
          {nativeCurrencyPrice > 0 && <> (${(parseFloat(ethRemaining) * nativeCurrencyPrice).toFixed(4)} USD)</>}
        </button>
      </div>
    </div>
  );
}
