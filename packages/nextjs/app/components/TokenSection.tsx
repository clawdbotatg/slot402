"use client";

import { useEffect, useState } from "react";
import { formatEther } from "viem";
import { usePublicClient } from "wagmi";
import { Address } from "~~/components/scaffold-eth";
import { useDeployedContractInfo, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { useGlobalState } from "~~/services/store/store";

// Uniswap V2 Pair ABI (just the functions we need)
const PAIR_ABI = [
  {
    constant: true,
    inputs: [],
    name: "getReserves",
    outputs: [
      { name: "reserve0", type: "uint112" },
      { name: "reserve1", type: "uint112" },
      { name: "blockTimestampLast", type: "uint32" },
    ],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "token0",
    outputs: [{ name: "", type: "address" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "token1",
    outputs: [{ name: "", type: "address" }],
    type: "function",
  },
] as const;

// Uniswap V2 Router ABI (just getAmountsOut)
const ROUTER_ABI = [
  {
    constant: true,
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "path", type: "address[]" },
    ],
    name: "getAmountsOut",
    outputs: [{ name: "amounts", type: "uint256[]" }],
    type: "function",
  },
] as const;

// Uniswap V2 Router address on Base
const UNISWAP_V2_ROUTER = "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24";

export const TokenSection = () => {
  const publicClient = usePublicClient();
  const [tokenPriceInUsdc, setTokenPriceInUsdc] = useState<string | null>(null);
  const [usdcReserve, setUsdcReserve] = useState<string | null>(null);
  const [tokenReserve, setTokenReserve] = useState<string | null>(null);
  const nativeCurrencyPrice = useGlobalState(state => state.nativeCurrency.price);

  // Get deployed contract info
  const { data: contractInfo } = useDeployedContractInfo("Slot402");

  // Read token address from contract
  const { data: tokenAddress } = useScaffoldReadContract({
    contractName: "Slot402",
    functionName: "token",
  });

  // Read uniswap pair address from contract
  const { data: uniswapPairAddress } = useScaffoldReadContract({
    contractName: "Slot402",
    functionName: "uniswapPair",
  });

  // Read treasury threshold
  const { data: treasuryThreshold } = useScaffoldReadContract({
    contractName: "Slot402",
    functionName: "TREASURY_THRESHOLD",
  });

  // Read USDC balance from vault
  const { data: vaultBalance } = useScaffoldReadContract({
    contractName: "Slot402",
    functionName: "getVaultBalance",
    watch: true,
  });

  // Read USDC balance in contract
  const { data: contractUsdcBalance } = useScaffoldReadContract({
    contractName: "USDC",
    functionName: "balanceOf",
    args: [contractInfo?.address as `0x${string}`],
    watch: true,
  });

  // Calculate total treasury balance (contract + vault)
  const treasuryBalance =
    vaultBalance !== undefined && contractUsdcBalance !== undefined ? vaultBalance + contractUsdcBalance : undefined;

  // Fetch token price from Uniswap pair
  useEffect(() => {
    const fetchTokenPrice = async () => {
      if (!publicClient || !uniswapPairAddress || !tokenAddress) return;

      try {
        // Get reserves from the pair
        const reserves = (await publicClient.readContract({
          address: uniswapPairAddress as `0x${string}`,
          abi: PAIR_ABI,
          functionName: "getReserves",
        })) as [bigint, bigint, number];

        // Get token0 address to determine which reserve is which
        const token0 = (await publicClient.readContract({
          address: uniswapPairAddress as `0x${string}`,
          abi: PAIR_ABI,
          functionName: "token0",
        })) as string;

        const reserve0 = reserves[0];
        const reserve1 = reserves[1];

        // USDC address on Base: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
        const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
        const isToken0USDC = token0.toLowerCase() === USDC.toLowerCase();

        const usdcReserveBigInt = isToken0USDC ? reserve0 : reserve1;
        const tokenReserveBigInt = isToken0USDC ? reserve1 : reserve0;

        // Store reserves for display (USDC has 6 decimals)
        setUsdcReserve((Number(usdcReserveBigInt) / 1e6).toFixed(6));
        setTokenReserve(formatEther(tokenReserveBigInt));

        // Calculate USDC price directly from reserves
        // Price = USDC reserve / Token reserve (adjusted for decimals)
        const priceInUsdc = Number(usdcReserveBigInt) / 1e6 / parseFloat(formatEther(tokenReserveBigInt));
        setTokenPriceInUsdc(priceInUsdc.toFixed(6));

        // Get EXACT price by querying Uniswap Router directly for USDC
        const oneToken = BigInt(1e18); // 1 token with 18 decimals
        const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

        try {
          // Query Uniswap Router for the exact swap amount
          const amounts = (await publicClient.readContract({
            address: UNISWAP_V2_ROUTER as `0x${string}`,
            abi: ROUTER_ABI,
            functionName: "getAmountsOut",
            args: [oneToken, [tokenAddress as `0x${string}`, USDC_ADDRESS as `0x${string}`]],
          })) as bigint[];

          // amounts[0] is the input (1 token), amounts[1] is the output (USDC)
          const usdcReceived = amounts[1];

          // USDC has 6 decimals
          const priceInUsdcExact = (Number(usdcReceived) / 1e6).toFixed(6);
          setTokenPriceInUsdc(priceInUsdcExact);
        } catch (error) {
          console.error("Error fetching USDC price from router:", error);
        }
      } catch (error) {
        console.error("Error fetching token price:", error);
      }
    };

    fetchTokenPrice();
    // Refresh price every 30 seconds
    const interval = setInterval(fetchTokenPrice, 30000);
    return () => clearInterval(interval);
  }, [publicClient, uniswapPairAddress, tokenAddress, nativeCurrencyPrice]);

  if (!tokenAddress) return null;

  const blockExplorerUrl = `https://basescan.org/token/${tokenAddress}`;
  const uniswapUrl = `https://app.uniswap.org/explore/tokens/base/${tokenAddress}`;

  return (
    <div className="w-full max-w-4xl mx-auto p-6 rounded-lg" style={{ backgroundColor: "#2d5a66" }}>
      <div className="space-y-6">
        {/* BIG TOKEN PRICE IN USDC */}
        {tokenPriceInUsdc && (
          <div className="p-8 rounded-lg border-4 border-black text-center" style={{ backgroundColor: "#1c3d45" }}>
            <div className="text-sm text-gray-400 mb-2 uppercase tracking-wider">$S402 Token Price</div>
            <div className="text-6xl font-bold text-green-400 mb-2">${parseFloat(tokenPriceInUsdc).toFixed(6)}</div>
            <div className="text-xl text-gray-300">USDC per token</div>
          </div>
        )}

        {/* Token Address */}
        <div className="p-4 rounded-lg border-2 border-black" style={{ backgroundColor: "#1c3d45" }}>
          <div className="font-semibold text-white mb-2">Token Address:</div>
          <div className="flex flex-wrap items-center gap-2">
            <Address address={tokenAddress} />
            <a
              href={blockExplorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm"
              style={{ backgroundColor: "#3a6b78", color: "white", border: "2px solid black" }}
            >
              📊 View on BaseScan
            </a>
            <a
              href={uniswapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm"
              style={{ backgroundColor: "#FF007A", color: "white", border: "2px solid black" }}
            >
              🦄 Trade on Uniswap
            </a>
          </div>
        </div>

        {/* Liquidity Pool Info */}
        {uniswapPairAddress && (
          <div className="p-4 rounded-lg border-2 border-black" style={{ backgroundColor: "#3a6b78" }}>
            <div className="font-semibold text-white mb-3">Uniswap V2 Pool:</div>
            <div className="mb-3">
              <Address address={uniswapPairAddress} />
            </div>

            {/* Reserves */}
            {usdcReserve && tokenReserve && (
              <div className="grid grid-cols-2 gap-3 text-sm mt-4">
                <div className="p-2 rounded" style={{ backgroundColor: "#2d5a66" }}>
                  <div className="text-gray-300 mb-1">USDC Reserve:</div>
                  <div className="text-white font-bold">${parseFloat(usdcReserve).toFixed(6)} USDC</div>
                </div>
                <div className="p-2 rounded" style={{ backgroundColor: "#2d5a66" }}>
                  <div className="text-gray-300 mb-1">S402 Reserve:</div>
                  <div className="text-white font-bold">{parseFloat(tokenReserve).toFixed(2)} S402</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Treasury Progress Bar */}
        {treasuryBalance !== null && treasuryThreshold && (
          <div className="p-4 rounded-lg border-2 border-black" style={{ backgroundColor: "#1c3d45" }}>
            <div className="font-semibold text-white mb-3">Treasury Status:</div>

            <div className="space-y-2">
              {/* Total Balance Display */}
              <div className="flex justify-between text-sm text-gray-300">
                <span>Total Balance:</span>
                <span className="font-bold text-white">${(Number(treasuryBalance) / 1e6).toFixed(6)} USDC</span>
              </div>

              {/* Breakdown */}
              <div className="flex justify-between text-xs text-gray-400 pl-4">
                <span>├─ In Contract:</span>
                <span className="font-mono">
                  ${contractUsdcBalance ? (Number(contractUsdcBalance) / 1e6).toFixed(6) : "0.000000"} USDC
                </span>
              </div>
              <div className="flex justify-between text-xs text-gray-400 pl-4 mb-2">
                <span>└─ In Vault (earning yield):</span>
                <span className="font-mono text-green-400">
                  ${vaultBalance ? (Number(vaultBalance) / 1e6).toFixed(6) : "0.000000"} USDC
                </span>
              </div>

              {/* Progress Bar */}
              <div className="relative h-8 bg-gray-700 rounded-lg border-2 border-black overflow-hidden">
                {/* Calculate percentage - threshold appears at 90% of the bar */}
                {(() => {
                  const thresholdValue = Number(treasuryThreshold) / 1e6; // USDC has 6 decimals
                  const balanceValue = Number(treasuryBalance) / 1e6; // USDC has 6 decimals
                  const vaultValue = vaultBalance ? Number(vaultBalance) / 1e6 : 0;
                  const buybackBuffer = 1.0; // $1 USDC buffer
                  const buybackTrigger = thresholdValue + buybackBuffer; // $17.35

                  // Show range from 0 to ~1.11x threshold (so threshold is at 90%)
                  const maxDisplay = thresholdValue / 0.9;
                  const percentage = Math.min((balanceValue / maxDisplay) * 100, 100);
                  const thresholdPosition = 90; // Threshold is at 90% of the display
                  const vaultPosition = Math.min((vaultValue / maxDisplay) * 100, 100);
                  const buybackPosition = Math.min((buybackTrigger / maxDisplay) * 100, 100);

                  const isAboveThreshold = balanceValue >= thresholdValue;
                  const isInBuybackMode = balanceValue >= buybackTrigger;
                  const barColor = isAboveThreshold ? "#10b981" : "#ef4444"; // green if above, red if below

                  return (
                    <>
                      {/* Fill bar */}
                      <div
                        className="absolute top-0 left-0 h-full transition-all duration-300"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: barColor,
                        }}
                      />

                      {/* Vault position marker (cyan line) */}
                      {vaultValue > 0 && (
                        <div
                          className="absolute top-0 h-full w-1 bg-cyan-400 z-10"
                          style={{
                            left: `${vaultPosition}%`,
                            boxShadow: "0 0 8px rgba(34, 211, 238, 0.6)",
                          }}
                          title={`Vault: $${vaultValue.toFixed(2)}`}
                        />
                      )}

                      {/* Threshold marker line (yellow) */}
                      <div
                        className="absolute top-0 h-full w-1 bg-yellow-400 z-10"
                        style={{
                          left: `${thresholdPosition}%`,
                          boxShadow: "0 0 10px rgba(250, 204, 21, 0.8)",
                        }}
                      />

                      {/* Buyback trigger marker (orange) */}
                      <div
                        className="absolute top-0 h-full w-1 bg-orange-500 z-10"
                        style={{
                          left: `${buybackPosition}%`,
                          boxShadow: "0 0 8px rgba(249, 115, 22, 0.6)",
                        }}
                      />

                      {/* Labels */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-bold text-white drop-shadow-lg z-20">
                          {isInBuybackMode ? "🔥 BUYBACK MODE" : isAboveThreshold ? "✅ HEALTHY" : "⚠️ DEFICIT"}
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-3 text-xs text-gray-400 mt-2 justify-center">
                <span className="text-cyan-400">
                  <span className="inline-block w-3 h-3 bg-cyan-400 rounded-sm mr-1"></span>
                  Vault: ${vaultBalance ? (Number(vaultBalance) / 1e6).toFixed(2) : "0.00"}
                </span>
                <span className="text-yellow-300 font-bold">
                  <span className="inline-block w-3 h-3 bg-yellow-400 rounded-sm mr-1"></span>⭐ Threshold: $
                  {(Number(treasuryThreshold) / 1e6).toFixed(2)}
                </span>
                <span className="text-orange-400 font-bold">
                  <span className="inline-block w-3 h-3 bg-orange-500 rounded-sm mr-1"></span>
                  🔥 Buyback: ${(Number(treasuryThreshold) / 1e6 + 1).toFixed(2)}
                </span>
              </div>

              {/* Status description */}
              <div className="text-xs text-gray-300 mt-2 p-2 rounded" style={{ backgroundColor: "#2d5a66" }}>
                {(() => {
                  const thresholdValue = Number(treasuryThreshold) / 1e6; // USDC has 6 decimals
                  const balanceValue = Number(treasuryBalance) / 1e6; // USDC has 6 decimals
                  const hasLiquidity =
                    uniswapPairAddress && uniswapPairAddress !== "0x0000000000000000000000000000000000000000";

                  const buybackBuffer = 1.0; // $1 USDC buffer

                  if (balanceValue >= thresholdValue + buybackBuffer) {
                    const excess = balanceValue - thresholdValue;
                    return (
                      <>
                        💰 <span className="text-green-300 font-bold">Surplus:</span> Treasury has{" "}
                        <span className="text-green-300 font-bold">${excess.toFixed(6)} USDC</span> above threshold.
                        {hasLiquidity ? (
                          <> Contract will buyback & burn ${buybackBuffer.toFixed(2)} USDC worth of tokens! 🔥</>
                        ) : (
                          <>
                            {" "}
                            <span className="text-red-300 font-bold">
                              ⚠️ Buyback disabled - Liquidity not added yet!
                            </span>
                          </>
                        )}
                      </>
                    );
                  } else if (balanceValue >= thresholdValue) {
                    const excess = balanceValue - thresholdValue;
                    return (
                      <>
                        ✅ <span className="text-green-300 font-bold">Healthy:</span> Treasury has{" "}
                        <span className="text-green-300 font-bold">${excess.toFixed(6)} USDC</span> above threshold.{" "}
                        (Need ${buybackBuffer.toFixed(2)} USDC more to trigger buyback)
                      </>
                    );
                  } else {
                    const deficit = thresholdValue - balanceValue;
                    return (
                      <>
                        ⚠️ <span className="text-red-300 font-bold">Deficit:</span> Treasury needs{" "}
                        <span className="text-red-300 font-bold">${deficit.toFixed(4)} USDC</span> to reach threshold.
                        Contract will mint & sell tokens if needed for payouts.
                      </>
                    );
                  }
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Tokenomics Explanation */}
        <div className="p-4 rounded-lg border-2 border-black" style={{ backgroundColor: "#1c3d45" }}>
          <div className="space-y-4">
            <div className="p-4 rounded-lg border-2 border-black" style={{ backgroundColor: "#2d5a66" }}>
              <div className="flex items-start gap-3">
                <div className="text-3xl">✅</div>
                <div>
                  <div className="font-bold text-green-300 mb-1">
                    Treasury Surplus ({">"} ${(Number(treasuryThreshold || 16350000) / 1e6 + 1).toFixed(2)} USDC)
                  </div>
                  <div className="text-sm text-gray-300">
                    Contract buys $S402 from Uniswap and burns it, reducing supply.
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg border-2 border-black" style={{ backgroundColor: "#2d5a66" }}>
              <div className="flex items-start gap-3">
                <div className="text-3xl">⚠️</div>
                <div>
                  <div className="font-bold text-yellow-300 mb-1">Treasury Deficit (Not enough for payouts)</div>
                  <div className="text-sm text-gray-300">
                    Contract mints $S402 and sells it on Uniswap to raise funds.
                  </div>
                </div>
              </div>
            </div>

            <div className="text-sm text-gray-300 mt-4 p-3 rounded" style={{ backgroundColor: "#3a6b78" }}>
              💡 <span className="font-bold">How It Works:</span> $15 USDC earns yield in the vault. The{" "}
              <span className="text-yellow-300 font-bold">
                ${treasuryThreshold ? (Number(treasuryThreshold) / 1e6).toFixed(2) : "16.35"} treasury threshold
              </span>{" "}
              acts as a reserve. When total funds exceed ${(Number(treasuryThreshold || 16350000) / 1e6 + 1).toFixed(2)}{" "}
              (${treasuryThreshold ? (Number(treasuryThreshold) / 1e6).toFixed(2) : "16.35"} + $1 buffer), the surplus
              triggers buybacks.
            </div>

            <div className="text-sm text-gray-300 mt-3 p-3 rounded" style={{ backgroundColor: "#3a6b78" }}>
              🎰 <span className="font-bold text-blue-300">Own the House:</span> Buy $S402 to become part owner. Earn
              from the house edge profits AND vault yield on locked USDC. Both flow back through buyback & burn during
              surplus periods.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
