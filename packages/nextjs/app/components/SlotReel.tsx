"use client";

import { memo, useEffect, useRef, useState } from "react";
import Image from "next/image";

interface SlotReelProps {
  symbols: string[];
  reelNumber: number;
  spinTrigger: number; // Changes to this value trigger a spin
  stopCommand?: { trigger: number; symbolIndex: number } | null; // When set, stops on the specified symbol index
  onSpinStart?: () => void;
  onSpinComplete?: () => void;
}

const SlotReel = memo(function SlotReel({
  symbols,
  spinTrigger,
  stopCommand,
  onSpinStart,
  onSpinComplete,
}: SlotReelProps) {
  const symbolHeight = 100;
  const reelLength = symbols.length * symbolHeight;
  const maxSpeed = 45;
  const deceleration = 12.0; // Faster deceleration for snappier stop
  const stoppingDistance = 100;
  const containerCenter = 150;

  // Calculate initial position to center symbol from the SECOND copy
  // This way the first copy is above, ready to scroll into view
  // To center symbol at array index 29 (symbols.length): -2*reelLength + 29*100 + 50 + position = 150
  const initialPosition = containerCenter + 2 * reelLength - reelLength - symbolHeight / 2;

  const [position, setPosition] = useState(initialPosition);
  const [isSpinning, setIsSpinning] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [targetPosition, setTargetPosition] = useState(0);
  const [decelerationStartPosition, setDecelerationStartPosition] = useState<number | null>(null);
  const [isBouncing, setIsBouncing] = useState(false);
  const [bounceOffset, setBounceOffset] = useState(0);

  // Ref to store the spinning sound audio object
  const spinningAudioRef = useRef<HTMLAudioElement | null>(null);
  // Track which spin trigger we've processed to avoid re-spinning
  const lastProcessedSpinTrigger = useRef(0);
  // Track which stop command we've processed
  const lastProcessedStopTrigger = useRef(0);
  // Ref to immediately stop animation when target is reached
  const hasSnappedToTarget = useRef(false);

  // Start spinning when spinTrigger changes
  useEffect(() => {
    if (spinTrigger > 0 && spinTrigger !== lastProcessedSpinTrigger.current && !isSpinning && !isStopping) {
      lastProcessedSpinTrigger.current = spinTrigger;
      hasSnappedToTarget.current = false;
      setIsSpinning(true);
      setCurrentSpeed(maxSpeed);
      setDecelerationStartPosition(null);
      setIsBouncing(false);
      setBounceOffset(0);
      if (onSpinStart) onSpinStart();
    }
  }, [spinTrigger, isSpinning, isStopping, maxSpeed, onSpinStart]);

  // Animation loop using requestAnimationFrame for better performance
  useEffect(() => {
    if (!isSpinning && !isStopping) return;

    let animationFrameId: number;

    const animate = () => {
      // Exit immediately if we've already snapped to target
      if (hasSnappedToTarget.current) {
        return;
      }

      setPosition(prevPosition => {
        let newPosition = prevPosition;

        if (isStopping) {
          const shouldStartDecelerating =
            decelerationStartPosition !== null && prevPosition >= decelerationStartPosition;

          if (shouldStartDecelerating) {
            const distanceToTarget = targetPosition - prevPosition;
            const absDistanceToTarget = Math.abs(distanceToTarget);

            // Snap directly to target when very close for perfect centering
            // Check absolute distance to handle both approaching and overshooting
            if (absDistanceToTarget <= 3) {
              let normalizedTarget = targetPosition % reelLength;
              if (normalizedTarget < 0) normalizedTarget += reelLength;

              hasSnappedToTarget.current = true;
              setIsStopping(false);
              setCurrentSpeed(0);
              setDecelerationStartPosition(null);
              setIsBouncing(true);
              return normalizedTarget;
            } else if (absDistanceToTarget <= 6) {
              // Slow down to crawl speed near target for precision (only last ~6px)
              // If we've overshot (negative distance), snap immediately
              if (distanceToTarget < 0) {
                let normalizedTarget = targetPosition % reelLength;
                if (normalizedTarget < 0) normalizedTarget += reelLength;

                hasSnappedToTarget.current = true;
                setIsStopping(false);
                setCurrentSpeed(0);
                setDecelerationStartPosition(null);
                setIsBouncing(true);
                return normalizedTarget;
              }

              const minSpeed = 1;
              newPosition = prevPosition + minSpeed;
              setCurrentSpeed(minSpeed);
            } else {
              // Fast deceleration
              const newSpeed = Math.max(2, currentSpeed - deceleration);
              setCurrentSpeed(newSpeed);
              newPosition = prevPosition + newSpeed;

              // Safety check: if we would overshoot, slow down to crawling speed
              const nextDistanceToTarget = targetPosition - newPosition;
              if (nextDistanceToTarget < 0 && distanceToTarget > 0) {
                newPosition = prevPosition + 1;
                setCurrentSpeed(1);
              }
            }
          } else {
            newPosition = prevPosition + maxSpeed;
          }
        } else {
          newPosition = prevPosition + maxSpeed;
        }

        // Wrap during normal spinning to keep in range
        // During stopping, don't wrap to preserve distance calculations
        if (!isStopping) {
          while (newPosition >= reelLength) {
            newPosition -= reelLength;
          }
          while (newPosition < 0) {
            newPosition += reelLength;
          }
        }

        return newPosition;
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
  }, [
    isSpinning,
    isStopping,
    currentSpeed,
    targetPosition,
    decelerationStartPosition,
    reelLength,
    maxSpeed,
    deceleration,
  ]);

  // Bounce animation after stopping using requestAnimationFrame
  useEffect(() => {
    if (!isBouncing) return;

    let frame = 0;
    const bounceFrames = 8;
    const maxBounce = 12;
    let animationFrameId: number;

    const animateBounce = () => {
      frame++;

      if (frame >= bounceFrames) {
        setBounceOffset(0);
        setIsBouncing(false);
        if (onSpinComplete) onSpinComplete();
        return;
      }

      const progress = frame / bounceFrames;
      const damping = 1 - progress;
      const downwardBounce = maxBounce * damping;

      setBounceOffset(downwardBounce);
      animationFrameId = requestAnimationFrame(animateBounce);
    };

    animationFrameId = requestAnimationFrame(animateBounce);

    return () => cancelAnimationFrame(animationFrameId);
  }, [isBouncing, onSpinComplete, position]);

  // Control spinning sound
  useEffect(() => {
    if (isSpinning || isStopping) {
      if (!spinningAudioRef.current) {
        const audio = new Audio("/sounds/637769__kyles__printing-press-spinning-wheel.flac");
        audio.loop = true;
        audio.volume = 0.075; // Half of original 0.15 volume (7.5%)
        audio.play().catch(error => {
          console.log("Error playing spinning sound:", error);
        });
        spinningAudioRef.current = audio;
      }
    }

    return () => {
      if (spinningAudioRef.current) {
        spinningAudioRef.current.pause();
        spinningAudioRef.current = null;
      }
    };
  }, [isSpinning, isStopping]);

  // Play clunk sound when stopping
  useEffect(() => {
    if (!isBouncing) return;

    const clunkSounds = [
      "/sounds/570525__fmaudio__clicking-large-stones-together-2.wav",
      "/sounds/570526__fmaudio__clicking-large-stones-together-1.wav",
      "/sounds/570529__fmaudio__clunking-large-stones-together-5.wav",
      "/sounds/570530__fmaudio__clunking-large-stones-together-3.wav",
      "/sounds/570531__fmaudio__clunking-large-stones-together-2.wav",
      "/sounds/570532__fmaudio__clunking-large-stones-together-1.wav",
    ];

    const randomClunk = clunkSounds[Math.floor(Math.random() * clunkSounds.length)];
    const clunkAudio = new Audio(randomClunk);
    clunkAudio.volume = 1.0;
    clunkAudio.play().catch(error => {
      console.log("Error playing clunk sound:", error);
    });

    setTimeout(() => {
      if (spinningAudioRef.current) {
        spinningAudioRef.current.pause();
        spinningAudioRef.current = null;
      }
    }, 600);
  }, [isBouncing]);

  // Store position in a ref so we can access it in callbacks
  const positionRef = useRef(position);
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  const handleStop = (symbolIndex?: number) => {
    if (isStopping || !isSpinning) {
      return;
    }

    // Pick a random symbol if not specified
    const targetSymbolIndex = symbolIndex !== undefined ? symbolIndex : Math.floor(Math.random() * symbols.length);

    setIsStopping(true);
    setIsSpinning(false);
    setCurrentSpeed(maxSpeed);

    // Calculate position needed to center the target symbol
    // With top: -2*reelLength, to center symbol i: -2*reelLength + i*symbolHeight + symbolHeight/2 + position = containerCenter
    const desiredSymbolPosition =
      containerCenter + 2 * reelLength - targetSymbolIndex * symbolHeight - symbolHeight / 2;

    let target = desiredSymbolPosition;
    const currentPos = positionRef.current;

    while (target < currentPos + stoppingDistance + 100) {
      target += reelLength;
    }

    const decelerationStart = target - stoppingDistance;

    setTargetPosition(target);
    setDecelerationStartPosition(decelerationStart);
  };

  // Listen for external stop commands
  useEffect(() => {
    if (stopCommand && stopCommand.trigger !== lastProcessedStopTrigger.current && !isStopping && isSpinning) {
      lastProcessedStopTrigger.current = stopCommand.trigger;
      handleStop(stopCommand.symbolIndex);
    }
  }, [stopCommand, isStopping, isSpinning]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Reel container */}
      <div
        className="relative border-4 border-primary rounded-lg"
        style={{
          width: "200px",
          height: "300px",
          overflow: "hidden",
          perspective: "1000px",
          backgroundColor: "#f7e9d3",
        }}
      >
        {/* Inner reel that slides */}
        <div
          className="absolute w-full"
          style={{
            transform: `translateY(${position + bounceOffset}px)`,
            transition: "none",
            transformStyle: "preserve-3d",
            willChange: "transform",
            zIndex: 1,
            top: `-${reelLength * 2}px`, // Start with TWO copies above so there's always symbols before viewport
          }}
        >
          {[...symbols, ...symbols, ...symbols].map((symbol, index) => {
            // Calculate position with offset to account for starting above
            const symbolTop = index * symbolHeight;
            // Absolute position of symbol center relative to container top
            const symbolAbsoluteTop = -reelLength * 2 + symbolTop + position + bounceOffset;
            const symbolCenter = symbolAbsoluteTop + symbolHeight / 2;
            const distanceFromCenter = Math.abs(symbolCenter - containerCenter);

            // Only render transforms for symbols near the viewport
            const isNearViewport = distanceFromCenter < 400;

            if (!isNearViewport) {
              return (
                <div key={index} className="flex items-center justify-center" style={{ height: "100px" }}>
                  {symbol && (
                    <Image src={symbol} alt="slot symbol" width={120} height={120} className="object-contain" />
                  )}
                </div>
              );
            }

            const normalizedDistance = Math.min(distanceFromCenter / 150, 1);
            const scale = 1 - normalizedDistance * 0.3;

            const rotateDirection = symbolCenter < containerCenter ? 1 : -1;
            const rotateAmount = normalizedDistance * 20 * rotateDirection;

            // Add horizontal pop-out effect only when symbol is near center (within 50 pixels)
            const horizontalOffset = distanceFromCenter < 50 ? -15 * (1 - distanceFromCenter / 50) : 0;

            return (
              <div
                key={index}
                className="flex items-center justify-center"
                style={{
                  height: "100px",
                  transform: `translateX(${horizontalOffset}px) scale(${scale}) rotateX(${rotateAmount}deg)`,
                  transformOrigin: "center center",
                  transformStyle: "preserve-3d",
                  willChange: "transform",
                }}
              >
                {symbol && <Image src={symbol} alt="slot symbol" width={120} height={120} className="object-contain" />}
              </div>
            );
          })}
        </div>

        {/* Cover image overlay */}
        <div
          className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none"
          style={{
            zIndex: 5,
          }}
        >
          <Image
            src="/slot/cover.png"
            alt="slot machine cover"
            fill
            className="object-cover"
            style={{ pointerEvents: "none" }}
          />
        </div>

        {/* Top gradient overlay */}
        <div
          className="absolute top-0 left-0 right-0 pointer-events-none"
          style={{
            height: "120px",
            background: "linear-gradient(to bottom, hsl(var(--b2)) 0%, transparent 100%)",
            zIndex: 10,
          }}
        />

        {/* Bottom gradient overlay */}
        <div
          className="absolute bottom-0 left-0 right-0 pointer-events-none"
          style={{
            height: "120px",
            background: "linear-gradient(to top, hsl(var(--b2)) 0%, transparent 100%)",
            zIndex: 10,
          }}
        />
      </div>
    </div>
  );
});

export default SlotReel;
