"use client";

import Image from "next/image";

interface PayoutRow {
  symbol: string;
  symbolImage: string;
  multiplier: number;
  description: string;
}

export const PayoutTable = () => {
  const payouts: PayoutRow[] = [
    {
      symbol: "BASEETH",
      symbolImage: "/slot/baseeth.png",
      multiplier: 8839,
      description: "3× Base ETH",
    },
    {
      symbol: "SEVEN",
      symbolImage: "/slot/seven.png",
      multiplier: 1105,
      description: "3× Seven",
    },
    {
      symbol: "DOUBLEBAR",
      symbolImage: "/slot/doublebar.png",
      multiplier: 327,
      description: "3× Double Bar",
    },
    {
      symbol: "BAR",
      symbolImage: "/slot/bar.png",
      multiplier: 138,
      description: "3× Bar",
    },
    {
      symbol: "BELL",
      symbolImage: "/slot/bell.png",
      multiplier: 71,
      description: "3× Bell",
    },
    {
      symbol: "CLAW",
      symbolImage: "/slot/star.png", // Using star.png until lobster claw art is ready
      multiplier: 41,
      description: "3× Claw 🦞",
    },
    {
      symbol: "ANYBAR",
      symbolImage: "/slot/bar.png",
      multiplier: 35,
      description: "Any Bar Combo",
    },
    {
      symbol: "WATERMELON",
      symbolImage: "/slot/watermelon.png",
      multiplier: 26,
      description: "3× Watermelon",
    },
    {
      symbol: "ORANGE",
      symbolImage: "/slot/orange.png",
      multiplier: 17,
      description: "3× Orange",
    },
    {
      symbol: "CHERRIES",
      symbolImage: "/slot/cherries.png",
      multiplier: 12,
      description: "3× Cherries",
    },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto p-6 rounded-lg" style={{ backgroundColor: "#2d5a66" }}>
      <h2
        className="text-2xl font-bold text-center mb-6 text-white"
        style={{ textShadow: "2px 2px 4px rgba(0,0,0,0.5)" }}
      >
        🦞 PAYOUT TABLE — Win CLAWD! 🦞
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ backgroundColor: "#1c3d45" }}>
              <th className="p-3 text-left text-white font-bold border-2 border-black">Combination</th>
              <th className="p-3 text-center text-white font-bold border-2 border-black">Multiplier</th>
              <th className="p-3 text-right text-white font-bold border-2 border-black">Payout</th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((payout, index) => {
              const isSpecial = payout.symbol === "BASEETH" || payout.symbol === "SEVEN";
              const rowColor = index % 2 === 0 ? "#3a6b78" : "#2d5a66";

              return (
                <tr
                  key={payout.symbol}
                  style={{
                    backgroundColor: rowColor,
                    borderLeft: isSpecial ? "4px solid gold" : "none",
                  }}
                  className="hover:brightness-110 transition-all"
                >
                  <td className="p-3 border-2 border-black">
                    <div className="flex items-center gap-3">
                      {payout.symbol === "ANYBAR" ? (
                        <div className="flex gap-1">
                          <Image src="/slot/bar.png" alt="Bar" width={40} height={40} className="object-contain" />
                          <Image
                            src="/slot/doublebar.png"
                            alt="Double Bar"
                            width={40}
                            height={40}
                            className="object-contain"
                          />
                        </div>
                      ) : (
                        <>
                          <Image
                            src={payout.symbolImage}
                            alt={payout.symbol}
                            width={40}
                            height={40}
                            className="object-contain"
                          />
                          <Image
                            src={payout.symbolImage}
                            alt={payout.symbol}
                            width={40}
                            height={40}
                            className="object-contain"
                          />
                          <Image
                            src={payout.symbolImage}
                            alt={payout.symbol}
                            width={40}
                            height={40}
                            className="object-contain"
                          />
                        </>
                      )}
                      <span className="text-white font-semibold">{payout.description}</span>
                    </div>
                  </td>
                  <td className="p-3 text-center border-2 border-black">
                    <span className="text-yellow-300 font-bold text-lg">{payout.multiplier}x</span>
                  </td>
                  <td className="p-3 text-right border-2 border-black">
                    <div className="flex flex-col items-end">
                      <span className="text-green-300 font-bold text-lg">{payout.multiplier}× your CLAWD</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-center text-sm text-gray-300">
        <p>Your USDC buys CLAWD on Uniswap → wins pay in CLAWD</p>
        <p className="mt-1">
          <span className="text-yellow-300">⚡</span> Any Bar Combo = Any mix of BAR and DOUBLE BAR{" "}
          <span className="text-yellow-300">⚡</span>
        </p>
        <p className="mt-1 text-xs opacity-60">
          🔥 Hopper overflow (above 2× jackpot) gets burned to 0xdead — deflationary!
        </p>
      </div>
    </div>
  );
};
