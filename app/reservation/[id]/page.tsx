"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { CountdownTimer } from "@/components/CountdownTimer";
import { formatPrice } from "@/lib/utils";

interface ReservationDetails {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  priceInCents: number;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  status: "PENDING" | "CONFIRMED" | "RELEASED";
  expiresAt: string;
  createdAt: string;
}

type UIState = "loading" | "active" | "confirmed" | "released" | "expired" | "error";

export default function ReservationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [reservation, setReservation] = useState<ReservationDetails | null>(null);
  const [uiState, setUiState] = useState<UIState>("loading");
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchReservation = useCallback(async () => {
    try {
      // We derive state from the products API — instead, let's build a simple
      // GET endpoint. For now, we store the reservation in state from creation
      // and only refresh on confirm/release actions.
      // The reservation detail was passed via router state; re-fetch via a dedicated GET.
      const res = await fetch(`/api/reservations/${id}`);
      if (!res.ok) {
        setUiState("error");
        setErrorMsg("Reservation not found");
        return;
      }
      const data: ReservationDetails = await res.json();
      setReservation(data);

      if (data.status === "CONFIRMED") setUiState("confirmed");
      else if (data.status === "RELEASED") setUiState("released");
      else if (new Date(data.expiresAt) < new Date()) setUiState("expired");
      else setUiState("active");
    } catch {
      setUiState("error");
      setErrorMsg("Failed to load reservation");
    }
  }, [id]);

  useEffect(() => {
    fetchReservation();
  }, [fetchReservation]);

  const handleConfirm = async () => {
    setActionLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/reservations/${id}/confirm`, {
        method: "POST",
        headers: { "Idempotency-Key": `confirm-${id}` },
      });
      const data = await res.json();

      if (res.status === 410) {
        setUiState("expired");
        setErrorMsg("Your reservation expired before payment was confirmed.");
        return;
      }
      if (!res.ok) {
        setErrorMsg(data.error ?? "Confirmation failed. Please try again.");
        return;
      }
      setUiState("confirmed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    setActionLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/reservations/${id}/release`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        setErrorMsg(data.error ?? "Cancellation failed.");
        return;
      }
      setUiState("released");
    } finally {
      setActionLoading(false);
    }
  };

  if (uiState === "loading") {
    return (
      <div className="max-w-lg mx-auto px-6 py-20 space-y-4">
        <div className="h-6 w-40 skeleton rounded mb-6" />
        <div className="h-48 skeleton rounded-xl" />
        <div className="h-12 skeleton rounded-lg" />
      </div>
    );
  }

  if (uiState === "error") {
    return (
      <div className="max-w-lg mx-auto px-6 py-20 text-center">
        <p className="text-red-400 text-lg mb-4">{errorMsg}</p>
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 bg-white/10 text-white rounded-lg text-sm"
        >
          ← Back to products
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-6 py-12">
      {/* Breadcrumb */}
      <button
        onClick={() => router.push("/")}
        className="text-white/30 text-xs font-mono mb-8 hover:text-white/60 transition-colors flex items-center gap-1.5"
      >
        ← products
      </button>

      {/* Status states */}
      {uiState === "confirmed" && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center mb-6">
          <div className="text-4xl mb-3">✓</div>
          <h2 className="text-xl font-bold text-emerald-400 mb-1">Order Confirmed!</h2>
          <p className="text-white/50 text-sm">
            Your purchase was successful. A confirmation has been recorded.
          </p>
          <button
            onClick={() => router.push("/")}
            className="mt-4 px-4 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-sm font-medium hover:bg-emerald-500/30 transition-colors"
          >
            Continue shopping
          </button>
        </div>
      )}

      {(uiState === "released") && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center mb-6">
          <div className="text-4xl mb-3">✕</div>
          <h2 className="text-xl font-bold text-white/60 mb-1">Reservation Cancelled</h2>
          <p className="text-white/40 text-sm">
            The hold has been released. Units are available again.
          </p>
          <button
            onClick={() => router.push("/")}
            className="mt-4 px-4 py-2 bg-white/10 rounded-lg text-sm text-white/60 hover:bg-white/15 transition-colors"
          >
            Back to products
          </button>
        </div>
      )}

      {uiState === "expired" && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center mb-6">
          <div className="text-4xl mb-3">⏱</div>
          <h2 className="text-xl font-bold text-red-400 mb-1">Reservation Expired</h2>
          <p className="text-white/50 text-sm">
            {errorMsg || "Your 10-minute hold has lapsed. Units have been released."}
          </p>
          <button
            onClick={() => router.push("/")}
            className="mt-4 px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {/* Main reservation card — shown for active state */}
      {reservation && uiState === "active" && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
          {/* Header */}
          <div className="p-5 border-b border-white/5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-white/30 font-mono text-[10px] uppercase tracking-widest">
                Reservation
              </p>
              <span className="text-white/20 font-mono text-[10px]">
                {reservation.id.slice(0, 8)}…
              </span>
            </div>
            <h1 className="text-xl font-bold">{reservation.productName}</h1>
            <p className="text-white/40 text-xs font-mono mt-0.5">{reservation.productSku}</p>
          </div>

          {/* Details */}
          <div className="p-5 space-y-4">
            {/* Timer */}
            <div className="rounded-lg bg-amber-400/5 border border-amber-400/20 p-4 flex items-center justify-between">
              <div>
                <p className="text-white/40 text-xs mb-1">Hold expires in</p>
                <CountdownTimer
                  expiresAt={reservation.expiresAt}
                  onExpire={() => setUiState("expired")}
                />
              </div>
              <div className="text-right">
                <p className="text-white/30 text-[10px] font-mono">PENDING</p>
                <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse ml-auto mt-1" />
              </div>
            </div>

            {/* Order summary */}
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-white/50">
                <span>Warehouse</span>
                <span className="text-white/70">{reservation.warehouseName}</span>
              </div>
              <div className="flex justify-between text-white/50">
                <span>Quantity</span>
                <span className="text-white/70">{reservation.quantity}</span>
              </div>
              <div className="flex justify-between text-white/50">
                <span>Unit price</span>
                <span className="text-white/70">{formatPrice(reservation.priceInCents)}</span>
              </div>
              <div className="border-t border-white/5 pt-2.5 flex justify-between font-semibold">
                <span>Total</span>
                <span className="text-amber-400">
                  {formatPrice(reservation.priceInCents * reservation.quantity)}
                </span>
              </div>
            </div>

            {/* Error message */}
            {errorMsg && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3">
                <p className="text-red-400 text-xs">{errorMsg}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={handleCancel}
                disabled={actionLoading}
                className="flex-1 py-2.5 text-sm font-medium rounded-lg border border-white/10 text-white/50 hover:bg-white/5 hover:text-white/70 disabled:opacity-40 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={actionLoading}
                className="flex-2 flex-grow py-2.5 text-sm font-semibold rounded-lg bg-amber-400 text-black hover:bg-amber-300 disabled:opacity-50 transition-all active:scale-[0.98]"
              >
                {actionLoading ? "Processing…" : "Confirm purchase"}
              </button>
            </div>

            <p className="text-white/20 text-[10px] text-center font-mono">
              Completing purchase will permanently decrement warehouse stock
            </p>
          </div>
        </div>
      )}

      {/* Show minimal card for non-active states too */}
      {reservation && uiState !== "active" && uiState !== ("loading" as UIState) && uiState !== ("error" as UIState) && (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
          <p className="text-white/30 text-xs font-mono uppercase tracking-widest mb-3">Order summary</p>
          <div className="space-y-2 text-sm text-white/50">
            <div className="flex justify-between">
              <span>{reservation.productName}</span>
              <span>{formatPrice(reservation.priceInCents * reservation.quantity)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>From {reservation.warehouseName}</span>
              <span>× {reservation.quantity}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
