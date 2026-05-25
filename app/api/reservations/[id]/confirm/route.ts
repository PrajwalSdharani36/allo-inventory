import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idempotencyKey = req.headers.get("Idempotency-Key");

    // Idempotency check
    if (idempotencyKey) {
      const cached = await redis.get(`idempotency:confirm:${idempotencyKey}`);
      if (cached) {
        return NextResponse.json(cached, {
          status: 200,
          headers: { "X-Idempotent-Replayed": "true" },
        });
      }
    }

    const now = new Date();

    const updated = await prisma.$transaction(async (tx: any) => {
      const reservation = await tx.reservation.findUnique({ where: { id } });

      if (!reservation) {
        throw { code: "NOT_FOUND" };
      }
      if (reservation.status === "CONFIRMED") {
        throw { code: "ALREADY_CONFIRMED" };
      }
      if (reservation.status === "RELEASED") {
        throw { code: "ALREADY_RELEASED" };
      }
      if (reservation.expiresAt < now) {
        // Auto-release expired reservation
        await tx.reservation.update({
          where: { id },
          data: { status: "RELEASED" },
        });
        throw { code: "EXPIRED" };
      }

      // Confirm: decrement stock permanently and update status
      await tx.stock.updateMany({
        where: {
          productId: reservation.productId,
          warehouseId: reservation.warehouseId,
        },
        data: {
          totalUnits: { decrement: reservation.quantity },
        },
      });

      return tx.reservation.update({
        where: { id },
        data: { status: "CONFIRMED" },
        include: { product: true, warehouse: true },
      });
    });

    const responseBody = {
      id: updated.id,
      status: updated.status,
      productName: updated.product.name,
      warehouseName: updated.warehouse.name,
      quantity: updated.quantity,
      confirmedAt: new Date().toISOString(),
    };

    if (idempotencyKey) {
      await redis.set(`idempotency:confirm:${idempotencyKey}`, responseBody, {
        ex: 3600,
      });
    }

    return NextResponse.json(responseBody);
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e?.code === "NOT_FOUND") {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }
    if (e?.code === "EXPIRED") {
      return NextResponse.json({ error: "Reservation has expired" }, { status: 410 });
    }
    if (e?.code === "ALREADY_CONFIRMED") {
      return NextResponse.json({ error: "Reservation already confirmed" }, { status: 409 });
    }
    if (e?.code === "ALREADY_RELEASED") {
      return NextResponse.json({ error: "Reservation was released or cancelled" }, { status: 409 });
    }
    console.error("[POST /api/reservations/:id/confirm]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
