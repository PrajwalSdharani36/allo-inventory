"use client";

import { useEffect, useState } from "react";

interface CountdownTimerProps {
  expiresAt: string;
  onExpire?: () => void;
}

export function CountdownTimer({ expiresAt, onExpire }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState("");
  const [isExpired, setIsExpired] = useState(false);
  const [isCritical, setIsCritical] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const expiry = new Date(expiresAt).getTime();
      const diffMs = expiry - now;

      if (diffMs <= 0) {
        setTimeLeft("Expired");
        setIsExpired(true);
        onExpire?.();
        return;
      }

      const totalSeconds = Math.floor(diffMs / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      setTimeLeft(`${minutes}:${seconds.toString().padStart(2, "0")}`);
      setIsCritical(totalSeconds <= 60);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  if (isExpired) {
    return (
      <span className="font-mono text-lg font-bold text-red-400">
        EXPIRED
      </span>
    );
  }

  return (
    <span
      className={`font-mono text-2xl font-bold tabular-nums transition-colors ${
        isCritical ? "text-red-400 animate-pulse" : "text-amber-400"
      }`}
    >
      {timeLeft}
    </span>
  );
}
