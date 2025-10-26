"use client";

import { useRef, useState } from "react";
import SlotReel from "./SlotReel";

export default function SlotPage() {
  const [spinTrigger, setSpinTrigger] = useState(0); // Increment to trigger spins
  const [isSpinning, setIsSpinning] = useState(false);
  const [stopCommand1, setStopCommand1] = useState<{ trigger: number; symbolIndex: number } | null>(null);
  const [stopCommand2, setStopCommand2] = useState<{ trigger: number; symbolIndex: number } | null>(null);
  const [stopCommand3, setStopCommand3] = useState<{ trigger: number; symbolIndex: number } | null>(null);
  const reelsStoppedCount = useRef(0);

  // Reel 1: cherries(8) > oranges(7) > stars(6) > bells(5) > diamonds(4) > bars(3) > doublebars(2) > seven(1) = 36 total
  const reel1Symbols = [
    "/slot/bar.png",
    "/slot/diamond.png",
    "/slot/bell.png",
    "/slot/cherries.png",
    "/slot/orange.png",
    "/slot/star.png",
    "/slot/cherries.png",
    "/slot/orange.png",
    "/slot/star.png",
    "/slot/diamond.png",
    "/slot/cherries.png",
    "/slot/bell.png",
    "/slot/orange.png",
    "/slot/star.png",
    "/slot/doublebar.png",
    "/slot/cherries.png",
    "/slot/seven.png", // MOST RARE!
    "/slot/orange.png",
    "/slot/star.png",
    "/slot/bell.png",
    "/slot/cherries.png",
    "/slot/bar.png",
    "/slot/star.png",
    "/slot/diamond.png",
    "/slot/orange.png",
    "/slot/bell.png",
    "/slot/cherries.png",
    "/slot/doublebar.png",
    "/slot/star.png",
    "/slot/diamond.png",
    "/slot/bar.png",
    "/slot/bell.png",
    "/slot/cherries.png",
    "/slot/orange.png",
    "/slot/cherries.png",
    "/slot/orange.png",
  ];

  // Reel 2: cherries(8) > oranges(7) > stars(6) > bells(5) > diamonds(4) > bars(3) > doublebars(2) > seven(1) = 36 total
  const reel2Symbols = [
    "/slot/star.png",
    "/slot/doublebar.png",
    "/slot/diamond.png",
    "/slot/orange.png",
    "/slot/cherries.png",
    "/slot/bell.png",
    "/slot/orange.png",
    "/slot/star.png",
    "/slot/bar.png",
    "/slot/cherries.png",
    "/slot/orange.png",
    "/slot/bell.png",
    "/slot/star.png",
    "/slot/diamond.png",
    "/slot/cherries.png",
    "/slot/orange.png",
    "/slot/bell.png",
    "/slot/star.png",
    "/slot/seven.png", // MOST RARE!
    "/slot/bar.png",
    "/slot/diamond.png",
    "/slot/orange.png",
    "/slot/cherries.png",
    "/slot/star.png",
    "/slot/bell.png",
    "/slot/doublebar.png",
    "/slot/orange.png",
    "/slot/diamond.png",
    "/slot/bar.png",
    "/slot/cherries.png",
    "/slot/star.png",
    "/slot/bell.png",
    "/slot/cherries.png",
    "/slot/orange.png",
    "/slot/cherries.png",
    "/slot/orange.png",
  ];

  // Reel 3: cherries(8) > oranges(7) > stars(6) > bells(5) > diamonds(4) > bars(3) > doublebars(2) > seven(1) = 36 total
  const reel3Symbols = [
    "/slot/bell.png",
    "/slot/bar.png",
    "/slot/star.png",
    "/slot/cherries.png",
    "/slot/orange.png",
    "/slot/diamond.png",
    "/slot/orange.png",
    "/slot/star.png",
    "/slot/orange.png",
    "/slot/bell.png",
    "/slot/cherries.png",
    "/slot/doublebar.png",
    "/slot/star.png",
    "/slot/diamond.png",
    "/slot/orange.png",
    "/slot/bell.png",
    "/slot/cherries.png",
    "/slot/star.png",
    "/slot/bar.png",
    "/slot/diamond.png",
    "/slot/seven.png", // MOST RARE!
    "/slot/orange.png",
    "/slot/cherries.png",
    "/slot/bell.png",
    "/slot/star.png",
    "/slot/doublebar.png",
    "/slot/diamond.png",
    "/slot/orange.png",
    "/slot/star.png",
    "/slot/bar.png",
    "/slot/cherries.png",
    "/slot/bell.png",
    "/slot/cherries.png",
    "/slot/orange.png",
    "/slot/cherries.png",
    "/slot/cherries.png",
  ];

  const handleSpin = () => {
    // Play lever pull sound
    const leverAudio = new Audio(
      "/sounds/316931__timbre__lever-pull-one-armed-bandit-from-freesound-316887-by-ylearkisto.flac",
    );
    leverAudio.volume = 0.8; // Full volume
    leverAudio.play().catch(error => {
      console.log("Error playing lever pull sound:", error);
    });

    setSpinTrigger(prev => prev + 1);
    setIsSpinning(true);
    setStopCommand1(null);
    setStopCommand2(null);
    setStopCommand3(null);
    reelsStoppedCount.current = 0;

    // Stop reel 1 (LEFT) after 500ms - FIRST TO STOP
    setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * reel1Symbols.length);
      const trigger = Date.now();
      setStopCommand1({ trigger, symbolIndex: randomIndex });
    }, 500);

    // Stop reel 2 (MIDDLE) after 1500ms - SECOND TO STOP
    setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * reel2Symbols.length);
      const trigger = Date.now();
      setStopCommand2({ trigger, symbolIndex: randomIndex });
    }, 1750);

    // Stop reel 3 (RIGHT) after 2500ms - LAST TO STOP
    setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * reel3Symbols.length);
      const trigger = Date.now();
      setStopCommand3({ trigger, symbolIndex: randomIndex });
    }, 3000);
  };

  const handleReelStart = () => {
    setIsSpinning(true);
  };

  const handleReelComplete = () => {
    reelsStoppedCount.current += 1;
    // All 3 reels have stopped
    if (reelsStoppedCount.current >= 3) {
      setIsSpinning(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-8">
      <h1 className="text-4xl font-bold">Slot Machine</h1>

      <div className="flex flex-col items-center gap-6">
        {/* Reels */}
        <div className="flex flex-row gap-4">
          <SlotReel
            symbols={reel1Symbols}
            reelNumber={1}
            spinTrigger={spinTrigger}
            stopCommand={stopCommand1}
            onSpinStart={handleReelStart}
            onSpinComplete={handleReelComplete}
          />
          <SlotReel
            symbols={reel2Symbols}
            reelNumber={2}
            spinTrigger={spinTrigger}
            stopCommand={stopCommand2}
            onSpinStart={handleReelStart}
            onSpinComplete={handleReelComplete}
          />
          <SlotReel
            symbols={reel3Symbols}
            reelNumber={3}
            spinTrigger={spinTrigger}
            stopCommand={stopCommand3}
            onSpinStart={handleReelStart}
            onSpinComplete={handleReelComplete}
          />
        </div>

        {/* Spin button */}
        <button onClick={handleSpin} disabled={isSpinning} className="btn btn-primary btn-lg px-12">
          {isSpinning ? "SPINNING..." : "SPIN"}
        </button>
      </div>
    </div>
  );
}
