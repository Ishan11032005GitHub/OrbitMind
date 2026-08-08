import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

const schema = z.object({ action: z.enum(["activate", "pause", "archive"]) });
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser(); if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const input = schema.safeParse(await request.json().catch(() => null)); if (!input.success) return NextResponse.json({ error: "Invalid sequence action" }, { status: 400 });
  const { id } = await context.params; const sequence = await db.sequence.findFirst({ where: { id, userId: user.id } }); if (!sequence) return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
  if (input.data.action === "activate" && env().ENABLE_SEQUENCE_SENDING !== "true") return NextResponse.json({ error: "Scheduled sending is disabled by the deployment configuration." }, { status: 409 });
  if (input.data.action === "activate") await db.$transaction([db.sequence.update({ where: { id }, data: { status: "ACTIVE" } }), db.enrollment.updateMany({ where: { sequenceId: id, status: "PAUSED" }, data: { status: "ACTIVE" } })]);
  if (input.data.action === "pause") await db.$transaction([db.sequence.update({ where: { id }, data: { status: "PAUSED" } }), db.enrollment.updateMany({ where: { sequenceId: id, status: "ACTIVE" }, data: { status: "PAUSED" } })]);
  if (input.data.action === "archive") await db.$transaction([db.sequence.update({ where: { id }, data: { status: "ARCHIVED" } }), db.enrollment.updateMany({ where: { sequenceId: id, status: { in: ["ACTIVE", "PAUSED"] } }, data: { status: "CANCELLED", nextRunAt: null } }), db.delivery.updateMany({ where: { enrollment: { sequenceId: id }, status: { in: ["PENDING", "CLAIMED"] } }, data: { status: "CANCELLED", error: "Sequence archived" } })]);
  return NextResponse.json({ ok: true, action: input.data.action });
}

