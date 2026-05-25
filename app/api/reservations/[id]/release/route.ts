import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const updated = await prisma.$transaction(async (tx: any) => {
      const reservation = await tx.reservation.findUnique({ where: { id } });

      if (!reservation) throw { code: "NOT_FOUND" };
      if (reservation.status === "CONFIRMED") throw { code: "ALREADY_CONFIRMED" };
      if (reservation.status === "RELEASED") {
        // Idempotent: releasing an already-released reservation is fine
        return reservation;
      }

      return tx.reservation.update({
        where: { id },
        data: { status: "RELEASED" },
      });
    });

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      releasedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e?.code === "NOT_FOUND") {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }
    if (e?.code === "ALREADY_CONFIRMED") {
      return NextResponse.json({ error: "Cannot release a confirmed reservation" }, { status: 409 });
    }
    console.error("[POST /api/reservations/:id/release]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
