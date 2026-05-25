import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis, acquireLock, releaseLock } from "@/lib/redis";
import { CreateReservationSchema } from "@/lib/schemas";

const RESERVATION_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateReservationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { productId, warehouseId, quantity } = parsed.data;

    // --- Idempotency ---
    const idempotencyKey = req.headers.get("Idempotency-Key");
    if (idempotencyKey) {
      const cached = await redis.get(`idempotency:${idempotencyKey}`);
      if (cached) {
        return NextResponse.json(cached, {
          status: 200,
          headers: { "X-Idempotent-Replayed": "true" },
        });
      }
    }

    // --- Distributed lock per (product, warehouse) pair ---
    // This ensures only ONE reservation can proceed at a time for this SKU+warehouse.
    const lockKey = `reserve:${productId}:${warehouseId}`;
    const acquired = await acquireLock(lockKey, 8000);
    if (!acquired) {
      return NextResponse.json(
        { error: "Too many concurrent requests, please retry" },
        { status: 429 }
      );
    }

    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + RESERVATION_TTL_MS);

      // Inside lock: use a DB transaction with SELECT FOR UPDATE to be doubly safe
      const reservation = await prisma.$transaction(async (tx: any) => {
        // Lock the stock row at the DB level
        const stock = await tx.$queryRaw<
          Array<{ id: string; totalUnits: number }>
        >`
          SELECT id, "totalUnits"
          FROM "Stock"
          WHERE "productId" = ${productId}
            AND "warehouseId" = ${warehouseId}
          FOR UPDATE
        `;

        if (!stock.length) {
          throw { code: "NO_STOCK", message: "Product not available in this warehouse" };
        }

        // Count active (non-expired) pending reservations
        const activeResult = await tx.reservation.aggregate({
          where: {
            productId,
            warehouseId,
            status: "PENDING",
            expiresAt: { gt: now },
          },
          _sum: { quantity: true },
        });
        const activelyReserved = activeResult._sum.quantity ?? 0;
        const available = stock[0].totalUnits - activelyReserved;

        if (available < quantity) {
          throw {
            code: "INSUFFICIENT_STOCK",
            message: `Only ${available} unit(s) available`,
            available,
          };
        }

        // Create the reservation
        const newReservation = await tx.reservation.create({
          data: {
            productId,
            warehouseId,
            quantity,
            status: "PENDING",
            expiresAt,
            ...(idempotencyKey ? { idempotencyKey } : {}),
          },
          include: {
            product: true,
            warehouse: true,
          },
        });

        return newReservation;
      });

      const responseBody = {
        id: reservation.id,
        productId: reservation.productId,
        productName: reservation.product.name,
        productSku: reservation.product.sku,
        priceInCents: reservation.product.priceInCents,
        warehouseId: reservation.warehouseId,
        warehouseName: reservation.warehouse.name,
        quantity: reservation.quantity,
        status: reservation.status,
        expiresAt: reservation.expiresAt.toISOString(),
        createdAt: reservation.createdAt.toISOString(),
      };

      // Store idempotency response
      if (idempotencyKey) {
        await redis.set(`idempotency:${idempotencyKey}`, responseBody, {
          px: RESERVATION_TTL_MS + 60_000, // keep slightly longer than TTL
        });
      }

      return NextResponse.json(responseBody, { status: 201 });
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string; available?: number };
      if (e?.code === "INSUFFICIENT_STOCK") {
        return NextResponse.json(
          { error: e.message, available: e.available ?? 0 },
          { status: 409 }
        );
      }
      if (e?.code === "NO_STOCK") {
        return NextResponse.json({ error: e.message }, { status: 404 });
      }
      throw err;
    } finally {
      await releaseLock(lockKey);
    }
  } catch (error) {
    console.error("[POST /api/reservations]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
