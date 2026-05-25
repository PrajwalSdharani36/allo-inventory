import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const result = await prisma.reservation.updateMany({
      where: { status: "PENDING", expiresAt: { lt: now } },
      data: { status: "RELEASED" },
    });
    console.log(`[cron/expire] Released ${result.count} expired reservation(s)`);
    return NextResponse.json({ releasedCount: result.count, ranAt: now.toISOString() });
  } catch (error) {
    console.error("[cron/expire]", error);
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}
