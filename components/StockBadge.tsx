import { cn } from "@/lib/utils";

interface StockBadgeProps {
  available: number;
  className?: string;
}

export function StockBadge({ available, className }: StockBadgeProps) {
  const isOut = available === 0;
  const isLow = available > 0 && available <= 3;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold",
        isOut && "bg-red-500/15 text-red-400 border border-red-500/30",
        isLow && "bg-amber-500/15 text-amber-400 border border-amber-500/30",
        !isOut && !isLow && "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
        className
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          isOut && "bg-red-400",
          isLow && "bg-amber-400 animate-pulse",
          !isOut && !isLow && "bg-emerald-400"
        )}
      />
      {isOut ? "Out of stock" : isLow ? `${available} left` : `${available} available`}
    </span>
  );
}
