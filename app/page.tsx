"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { StockBadge } from "@/components/StockBadge";
import { formatPrice } from "@/lib/utils";

interface StockInfo {
  warehouseId: string;
  warehouseName: string;
  warehouseLocation: string;
  totalUnits: number;
  reservedUnits: number;
  availableUnits: number;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  imageUrl: string | null;
  priceInCents: number;
  stocks: StockInfo[];
}

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reserving, setReserving] = useState<string | null>(null);
  const [reserveError, setReserveError] = useState<{ [key: string]: string }>({});

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to fetch products");
      const data = await res.json();
      setProducts(data);
    } catch {
      setError("Could not load products. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    const interval = setInterval(fetchProducts, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, [fetchProducts]);

  const handleReserve = async (productId: string, warehouseId: string) => {
    const key = `${productId}-${warehouseId}`;
    setReserving(key);
    setReserveError((prev) => ({ ...prev, [key]: "" }));

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `${key}-${Date.now()}`,
        },
        body: JSON.stringify({ productId, warehouseId, quantity: 1 }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setReserveError((prev) => ({
          ...prev,
          [key]: `Not enough stock — ${data.available ?? 0} unit(s) available`,
        }));
        return;
      }

      if (!res.ok) {
        setReserveError((prev) => ({
          ...prev,
          [key]: data.error ?? "Reservation failed",
        }));
        return;
      }

      router.push(`/reservation/${data.id}`);
    } finally {
      setReserving(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-10">
          <div className="h-8 w-48 skeleton rounded mb-3" />
          <div className="h-4 w-72 skeleton rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl border border-white/5 overflow-hidden">
              <div className="h-48 skeleton" />
              <div className="p-5 space-y-3">
                <div className="h-5 w-3/4 skeleton rounded" />
                <div className="h-4 w-1/2 skeleton rounded" />
                <div className="h-10 skeleton rounded-lg mt-4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-24 text-center">
        <p className="text-red-400 text-lg">{error}</p>
        <button
          onClick={fetchProducts}
          className="mt-4 px-4 py-2 bg-amber-400 text-black rounded-lg font-semibold text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Page header */}
      <div className="mb-10 flex items-end justify-between">
        <div>
          <p className="text-white/30 font-mono text-xs uppercase tracking-widest mb-2">
            catalog
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Products
          </h1>
          <p className="text-white/40 mt-1 text-sm">
            Live stock across all warehouses. Reserve holds for 10 minutes.
          </p>
        </div>
        <div className="text-right">
          <p className="text-white/20 font-mono text-xs">{products.length} products</p>
        </div>
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => {
          const totalAvailable = product.stocks.reduce((s, st) => s + st.availableUnits, 0);

          return (
            <div
              key={product.id}
              className="group rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden hover:border-white/15 hover:bg-white/[0.04] transition-all duration-300"
            >
              {/* Image */}
              <div className="relative h-52 bg-white/5 overflow-hidden">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/10 text-5xl">
                    □
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f]/80 to-transparent" />
                <div className="absolute bottom-3 left-3">
                  <span className="font-mono text-xs text-white/40 bg-black/50 px-2 py-0.5 rounded">
                    {product.sku}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <h2 className="font-semibold text-base leading-snug">{product.name}</h2>
                  <span className="text-amber-400 font-bold font-mono text-sm whitespace-nowrap">
                    {formatPrice(product.priceInCents)}
                  </span>
                </div>

                {product.description && (
                  <p className="text-white/35 text-xs mb-4 leading-relaxed line-clamp-2">
                    {product.description}
                  </p>
                )}

                {/* Per-warehouse stock */}
                <div className="space-y-2 mb-4">
                  {product.stocks
                    .sort((a, b) => b.availableUnits - a.availableUnits)
                    .map((stock) => {
                      const key = `${product.id}-${stock.warehouseId}`;
                      const isLoading = reserving === key;
                      const err = reserveError[key];

                      return (
                        <div key={stock.warehouseId}>
                          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.03] border border-white/5">
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-white/70 truncate">
                                {stock.warehouseName}
                              </p>
                              <p className="text-[10px] text-white/25 font-mono truncate">
                                {stock.warehouseLocation}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              <StockBadge available={stock.availableUnits} />
                              <button
                                disabled={stock.availableUnits === 0 || isLoading}
                                onClick={() => handleReserve(product.id, stock.warehouseId)}
                                className="px-3 py-1 text-xs font-semibold rounded-md bg-amber-400 text-black hover:bg-amber-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                              >
                                {isLoading ? "…" : "Reserve"}
                              </button>
                            </div>
                          </div>
                          {err && (
                            <p className="text-red-400 text-[10px] font-mono mt-1 px-1">
                              ⚠ {err}
                            </p>
                          )}
                        </div>
                      );
                    })}
                </div>

                {/* Total availability footer */}
                <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                  <span className="text-white/20 text-[10px] font-mono uppercase tracking-widest">
                    Total
                  </span>
                  <span className="text-white/40 text-xs font-mono">
                    {totalAvailable} unit{totalAvailable !== 1 ? "s" : ""} across{" "}
                    {product.stocks.filter((s) => s.availableUnits > 0).length} warehouse
                    {product.stocks.filter((s) => s.availableUnits > 0).length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
