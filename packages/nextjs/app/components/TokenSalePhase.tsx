import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

export function TokenSalePhase() {
  const { writeContractAsync: writeBuyTokens } = useScaffoldWriteContract("RugSlot");

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

  return (
    <div className="bg-base-200 rounded-lg p-6 mb-6">
      <h2 className="text-2xl font-semibold mb-4">Token Sale</h2>
      <p className="mb-4">Buy tokens at 0.0001 ETH each. Max 530 tokens available.</p>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" onClick={() => handleBuyTokens(1)}>
          Buy 1 Token (0.0001 ETH)
        </button>
        <button className="btn btn-primary" onClick={() => handleBuyTokens(10)}>
          Buy 10 Tokens (0.001 ETH)
        </button>
        <button className="btn btn-primary" onClick={() => handleBuyTokens(100)}>
          Buy 100 Tokens (0.01 ETH)
        </button>
        <button className="btn btn-primary btn-accent" onClick={() => handleBuyTokens(530)}>
          Buy All 530 Tokens (0.053 ETH)
        </button>
      </div>
    </div>
  );
}
