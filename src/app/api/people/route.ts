import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { z } from "zod";

const createPersonSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  company: z.string().trim().max(120).optional(),
});

export async function GET(request: Request) {
  const user = await currentUser(); if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url); const q = url.searchParams.get("q")?.trim();
  const contacts = await db.contact.findMany({ where: { userId: user.id, ...(q ? { OR: [{ displayName: { contains: q, mode: "insensitive" } }, { primaryEmail: { contains: q, mode: "insensitive" } }, { company: { name: { contains: q, mode: "insensitive" } } }] } : {}) }, include: { company: true }, orderBy: { lastInteractionAt: "desc" }, take: 200 });
  return NextResponse.json({ people: contacts });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = createPersonSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid person" }, { status: 400 });
  const { name, email, company: companyName } = parsed.data;
  const domain = email.split("@")[1];
  const company = companyName ? await db.company.upsert({
    where: { userId_domain: { userId: user.id, domain } },
    update: { name: companyName },
    create: { userId: user.id, name: companyName, domain, confidence: 1, source: "manual" },
  }) : null;
  const person = await db.contact.upsert({
    where: { userId_primaryEmail: { userId: user.id, primaryEmail: email } },
    update: { displayName: name, companyId: company?.id },
    create: { userId: user.id, primaryEmail: email, displayName: name, companyId: company?.id, category: "Contact", strengthScore: 10, strengthLabel: "New" },
    include: { company: true },
  });
  return NextResponse.json({ person }, { status: 201 });
}
