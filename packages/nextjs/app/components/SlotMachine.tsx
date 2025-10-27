import { useEffect, useRef, useState } from "react";
import SlotReel from "./SlotReel";

interface SlotMachineProps {
  onSpinStart: () => void;
  onAllReelsComplete?: () => void; // Called when all 3 reels have fully stopped
  reel1Symbols: string[];
  reel2Symbols: string[];
  reel3Symbols: string[];
  stopPosition1?: number | null;
  stopPosition2?: number | null;
  stopPosition3?: number | null;
  initialPosition1?: number | null; // Initial display position for reel 1
  initialPosition2?: number | null; // Initial display position for reel 2
  initialPosition3?: number | null; // Initial display position for reel 3
  spinCounter: number; // Increment this to trigger a spin
}

export function SlotMachine({
  onSpinStart,
  onAllReelsComplete,
  reel1Symbols,
  reel2Symbols,
  reel3Symbols,
  stopPosition1,
  stopPosition2,
  stopPosition3,
  initialPosition1,
  initialPosition2,
  initialPosition3,
  spinCounter,
}: SlotMachineProps) {
  const [spinTrigger, setSpinTrigger] = useState(0);
  const [stopCommand1, setStopCommand1] = useState<{ trigger: number; symbolIndex: number } | null>(null);
  const [stopCommand2, setStopCommand2] = useState<{ trigger: number; symbolIndex: number } | null>(null);
  const [stopCommand3, setStopCommand3] = useState<{ trigger: number; symbolIndex: number } | null>(null);
  const reelsStoppedCount = useRef(0);
  const lastSpinCounter = useRef(0);
  const hasProcessedStops = useRef(false);

  // When spinCounter changes (increments), start a new spin
  useEffect(() => {
    if (spinCounter > 0 && spinCounter !== lastSpinCounter.current) {
      console.log(`🎰 Spin counter changed: ${lastSpinCounter.current} → ${spinCounter}`);
      lastSpinCounter.current = spinCounter;

      // Reset everything
      setStopCommand1(null);
      setStopCommand2(null);
      setStopCommand3(null);
      reelsStoppedCount.current = 0;
      hasProcessedStops.current = false;

      // Trigger reels to spin
      setSpinTrigger(prev => prev + 1);
      console.log("🎰 Reels starting to spin...");
    }
  }, [spinCounter]);

  // When we have stop positions, issue stop commands with delays
  useEffect(() => {
    if (
      stopPosition1 !== null &&
      stopPosition1 !== undefined &&
      stopPosition2 !== null &&
      stopPosition2 !== undefined &&
      stopPosition3 !== null &&
      stopPosition3 !== undefined &&
      !hasProcessedStops.current &&
      spinTrigger > 0
    ) {
      hasProcessedStops.current = true;
      console.log(`🎰 Got stop positions from contract: ${stopPosition1}, ${stopPosition2}, ${stopPosition3}`);

      // Stop reel 1 INSTANTLY (0ms)
      const trigger1 = Date.now();
      console.log("🎰 Stopping reel 1 INSTANTLY");
      setStopCommand1({ trigger: trigger1, symbolIndex: stopPosition1 });

      // Stop reel 2 after 2 seconds (2000ms)
      setTimeout(() => {
        const trigger = Date.now();
        console.log("🎰 Stopping reel 2");
        setStopCommand2({ trigger, symbolIndex: stopPosition2 });
      }, 2000);

      // Stop reel 3 after 2 more seconds (4000ms total) - LAST TO STOP
      setTimeout(() => {
        const trigger = Date.now();
        console.log("🎰 Stopping reel 3 - LAST REEL");
        setStopCommand3({ trigger, symbolIndex: stopPosition3 });
      }, 4000);
    }
  }, [stopPosition1, stopPosition2, stopPosition3, spinTrigger]);

  const handleReelStart = () => {
    onSpinStart();
  };

  const handleReelComplete = () => {
    reelsStoppedCount.current += 1;
    console.log(`Reel stopped. Total stopped: ${reelsStoppedCount.current}/3`);
    if (reelsStoppedCount.current >= 3) {
      console.log("✅ All reels stopped! Spin complete.");
      if (onAllReelsComplete) {
        onAllReelsComplete();
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Reels */}
      <div className="flex flex-row gap-4">
        <SlotReel
          symbols={reel1Symbols}
          reelNumber={1}
          spinTrigger={spinTrigger}
          stopCommand={stopCommand1}
          initialSymbolIndex={initialPosition1}
          onSpinStart={handleReelStart}
          onSpinComplete={handleReelComplete}
        />
        <SlotReel
          symbols={reel2Symbols}
          reelNumber={2}
          spinTrigger={spinTrigger}
          stopCommand={stopCommand2}
          initialSymbolIndex={initialPosition2}
          onSpinStart={handleReelStart}
          onSpinComplete={handleReelComplete}
        />
        <SlotReel
          symbols={reel3Symbols}
          reelNumber={3}
          spinTrigger={spinTrigger}
          stopCommand={stopCommand3}
          initialSymbolIndex={initialPosition3}
          onSpinStart={handleReelStart}
          onSpinComplete={handleReelComplete}
        />
      </div>
    </div>
  );
}
