import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const now = new Date();

    const products = await prisma.product.findMany({
      include: {
        stocks: {
          include: {
            warehouse: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // For each stock, calculate available = total - reservedUnits (only count non-expired PENDING)
    // We use lazy expiry: reservedUnits may be stale, so recalculate from live reservations
    const productsWithAvailability = await Promise.all(
      products.map(async (product: any) => {
        const stocksWithAvailability = await Promise.all(
          product.stocks.map(async (stock: any) => {
            // Count only PENDING reservations that haven't expired
            const activeReservations = await prisma.reservation.aggregate({
              where: {
                productId: product.id,
                warehouseId: stock.warehouseId,
                status: "PENDING",
                expiresAt: { gt: now },
              },
              _sum: { quantity: true },
            });
            const activelyReserved = activeReservations._sum.quantity ?? 0;
            const available = Math.max(0, stock.totalUnits - activelyReserved);

            return {
              warehouseId: stock.warehouseId,
              warehouseName: stock.warehouse.name,
              warehouseLocation: stock.warehouse.location,
              totalUnits: stock.totalUnits,
              reservedUnits: activelyReserved,
              availableUnits: available,
            };
          })
        );

        return {
          id: product.id,
          name: product.name,
          sku: product.sku,
          description: product.description,
          imageUrl: product.imageUrl,
          priceInCents: product.priceInCents,
          stocks: stocksWithAvailability,
        };
      })
    );

    return NextResponse.json(productsWithAvailability);
  } catch (error) {
    console.error("[GET /api/products]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
