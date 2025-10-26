// Slot Machine Simulation Script
// Maps reel data from RugSlot.sol and simulates rolls

// ============================================================================
// CONFIGURATION
// ============================================================================
const NUM_SIMULATIONS = 10000000000; // Number of rolls per scenario (increase for more accuracy)
const BET_AMOUNT = 0.00001; // ETH per roll
const HOUSE_EDGE = 3; // Percentage

// ============================================================================
// REEL DATA
// ============================================================================

// Symbol enum mapping
const Symbol = {
  CHERRIES: 0,
  ORANGE: 1,
  STAR: 2,
  BELL: 3,
  DIAMOND: 4,
  BAR: 5,
  DOUBLEBAR: 6,
  SEVEN: 7,
};

// Reverse mapping for display
const SymbolNames = {
  0: "CHERRIES",
  1: "ORANGE",
  2: "STAR",
  3: "BELL",
  4: "DIAMOND",
  5: "BAR",
  6: "DOUBLEBAR",
  7: "SEVEN",
};

// Reel 1: 8 cherries, 7 oranges, 6 stars, 5 bells, 4 diamonds, 3 bars, 2 doublebars, 1 seven
const reel1 = [
  Symbol.BAR,
  Symbol.DIAMOND,
  Symbol.BELL,
  Symbol.CHERRIES,
  Symbol.ORANGE,
  Symbol.STAR,
  Symbol.CHERRIES,
  Symbol.ORANGE,
  Symbol.STAR,
  Symbol.DIAMOND,
  Symbol.CHERRIES,
  Symbol.BELL,
  Symbol.ORANGE,
  Symbol.STAR,
  Symbol.DOUBLEBAR,
  Symbol.CHERRIES,
  Symbol.SEVEN,
  Symbol.ORANGE,
  Symbol.STAR,
  Symbol.BELL,
  Symbol.CHERRIES,
  Symbol.BAR,
  Symbol.STAR,
  Symbol.DIAMOND,
  Symbol.ORANGE,
  Symbol.BELL,
  Symbol.CHERRIES,
  Symbol.DOUBLEBAR,
  Symbol.STAR,
  Symbol.DIAMOND,
  Symbol.BAR,
  Symbol.BELL,
  Symbol.CHERRIES,
  Symbol.ORANGE,
  Symbol.CHERRIES,
  Symbol.ORANGE,
];

// Reel 2: 8 cherries, 7 oranges, 6 stars, 5 bells, 4 diamonds, 3 bars, 2 doublebars, 1 seven
const reel2 = [
  Symbol.STAR,
  Symbol.DOUBLEBAR,
  Symbol.DIAMOND,
  Symbol.ORANGE,
  Symbol.CHERRIES,
  Symbol.BELL,
  Symbol.ORANGE,
  Symbol.STAR,
  Symbol.BAR,
  Symbol.CHERRIES,
  Symbol.ORANGE,
  Symbol.BELL,
  Symbol.STAR,
  Symbol.DIAMOND,
  Symbol.CHERRIES,
  Symbol.ORANGE,
  Symbol.BELL,
  Symbol.STAR,
  Symbol.SEVEN,
  Symbol.BAR,
  Symbol.DIAMOND,
  Symbol.ORANGE,
  Symbol.CHERRIES,
  Symbol.STAR,
  Symbol.BELL,
  Symbol.DOUBLEBAR,
  Symbol.ORANGE,
  Symbol.DIAMOND,
  Symbol.BAR,
  Symbol.CHERRIES,
  Symbol.STAR,
  Symbol.BELL,
  Symbol.CHERRIES,
  Symbol.ORANGE,
  Symbol.CHERRIES,
  Symbol.ORANGE,
];

// Reel 3: 8 cherries, 7 oranges, 6 stars, 5 bells, 4 diamonds, 3 bars, 2 doublebars, 1 seven
const reel3 = [
  Symbol.BELL,
  Symbol.BAR,
  Symbol.STAR,
  Symbol.CHERRIES,
  Symbol.ORANGE,
  Symbol.DIAMOND,
  Symbol.ORANGE,
  Symbol.STAR,
  Symbol.ORANGE,
  Symbol.BELL,
  Symbol.CHERRIES,
  Symbol.DOUBLEBAR,
  Symbol.STAR,
  Symbol.DIAMOND,
  Symbol.ORANGE,
  Symbol.BELL,
  Symbol.CHERRIES,
  Symbol.STAR,
  Symbol.BAR,
  Symbol.DIAMOND,
  Symbol.SEVEN,
  Symbol.ORANGE,
  Symbol.CHERRIES,
  Symbol.BELL,
  Symbol.STAR,
  Symbol.DOUBLEBAR,
  Symbol.DIAMOND,
  Symbol.ORANGE,
  Symbol.STAR,
  Symbol.BAR,
  Symbol.CHERRIES,
  Symbol.BELL,
  Symbol.CHERRIES,
  Symbol.ORANGE,
  Symbol.CHERRIES,
  Symbol.CHERRIES,
];

function getRandomReelPosition() {
  return Math.floor(Math.random() * 36);
}

function spin() {
  const pos1 = getRandomReelPosition();
  const pos2 = getRandomReelPosition();
  const pos3 = getRandomReelPosition();

  const symbol1 = reel1[pos1];
  const symbol2 = reel2[pos2];
  const symbol3 = reel3[pos3];

  const isExactMatch = symbol1 === symbol2 && symbol2 === symbol3;

  const isAnyBar =
    !isExactMatch &&
    (symbol1 === Symbol.BAR || symbol1 === Symbol.DOUBLEBAR) &&
    (symbol2 === Symbol.BAR || symbol2 === Symbol.DOUBLEBAR) &&
    (symbol3 === Symbol.BAR || symbol3 === Symbol.DOUBLEBAR);

  return {
    positions: [pos1, pos2, pos3],
    symbols: [symbol1, symbol2, symbol3],
    isWinner: isExactMatch || isAnyBar,
    winType: isExactMatch ? "exact" : isAnyBar ? "anybar" : "none",
  };
}

// Calculate payouts
const symbolCounts = {
  CHERRIES: 8,
  ORANGE: 7,
  STAR: 6,
  BELL: 5,
  DIAMOND: 4,
  BAR: 3,
  DOUBLEBAR: 2,
  SEVEN: 1,
};
const TOTAL_POSITIONS = 36 * 36 * 36;
const payouts = {};

Object.entries(symbolCounts).forEach(([symbol, count]) => {
  const combinations = count * count * count;
  const probability = combinations / TOTAL_POSITIONS;
  payouts[symbol] = { count, probability, combinations };
});

// Add "any bar" combination
const anyBarCount = symbolCounts.BAR + symbolCounts.DOUBLEBAR;
const totalAnyBarCombinations = anyBarCount ** 3;
const exactBarCombinations = symbolCounts.BAR ** 3;
const exactDoubleBarCombinations = symbolCounts.DOUBLEBAR ** 3;
const uniqueAnyBarCombinations =
  totalAnyBarCombinations - exactBarCombinations - exactDoubleBarCombinations;
payouts["ANYBAR"] = {
  count: anyBarCount,
  probability: uniqueAnyBarCombinations / TOTAL_POSITIONS,
  combinations: uniqueAnyBarCombinations,
};

// Calculate adjusted payouts
const rtpTarget = (100 - HOUSE_EDGE) / 100;
const numWinTypes = Object.keys(payouts).length;
const payoutScaleFactor = rtpTarget / numWinTypes;

Object.entries(payouts).forEach(([symbol, data]) => {
  const fairPayout = 1 / data.probability;
  data.adjustedPayout = fairPayout * payoutScaleFactor;
});

// Run simulation
let winners = 0;
const winsBySymbol = {};

for (let i = 0; i < NUM_SIMULATIONS; i++) {
  const result = spin();
  if (result.isWinner) {
    winners++;
    const winSymbol =
      result.winType === "anybar" ? "ANYBAR" : SymbolNames[result.symbols[0]];
    winsBySymbol[winSymbol] = (winsBySymbol[winSymbol] || 0) + 1;
  }
}

const actualWinRate = winners / NUM_SIMULATIONS;

// Calculate max payout
const maxPayout = Math.max(
  ...Object.values(payouts).map((p) => p.adjustedPayout)
);
const targetBankroll = maxPayout * BET_AMOUNT * 2;

// Output
console.log("=".repeat(70));
console.log("SLOT MACHINE CONFIGURATION");
console.log("=".repeat(70));

console.log("\n## PAYOUT MULTIPLIERS:\n");
Object.entries(payouts)
  .sort((a, b) => a[1].adjustedPayout - b[1].adjustedPayout)
  .forEach(([symbol, data]) => {
    console.log(`${symbol.padEnd(12)} ${Math.round(data.adjustedPayout)}x`);
  });

console.log("\n## BANKROLL:\n");
console.log(`Bet Amount:          ${BET_AMOUNT} ETH per roll`);
console.log(
  `Initial Bankroll:    ${targetBankroll.toFixed(8)} ETH  (covers 2 jackpots)`
);
console.log(
  `Token Sale Trigger:  ${(targetBankroll / 2).toFixed(
    8
  )} ETH  (below 1 jackpot)`
);
console.log(
  `Max Jackpot Payout:  ${(maxPayout * BET_AMOUNT).toFixed(
    8
  )} ETH  (SEVEN: ${Math.round(maxPayout)}x)`
);

console.log("\n## SIMULATION RESULTS:\n");
console.log(`Rolls:               ${NUM_SIMULATIONS.toLocaleString()}`);
console.log(`Winners:             ${winners.toLocaleString()}`);
console.log(`Win Rate:            ${(actualWinRate * 100).toFixed(4)}%`);
console.log(`House Edge:          ${HOUSE_EDGE}% (target)`);

console.log("\n## WIN PROBABILITIES:\n");
Object.entries(payouts)
  .sort((a, b) => b[1].probability - a[1].probability)
  .forEach(([symbol, data]) => {
    const actual = winsBySymbol[symbol] || 0;
    const actualPct = ((actual / NUM_SIMULATIONS) * 100).toFixed(4);
    console.log(
      `${symbol.padEnd(12)} ${(data.probability * 100).toFixed(
        4
      )}%  (simulated: ${actualPct}%)`
    );
  });

console.log("\n" + "=".repeat(70));
