import { NextResponse } from "next/server";
import { z } from "zod";
import { assessMessageRisk, detectCommitments, optimizeSequence, parsePeopleQuery, relationshipDecay } from "@/domain/intelligence";
import { currentUser } from "@/lib/auth/session";

const requestSchema = z.discriminatedUnion("feature", [
  z.object({ feature:z.literal("decay"), contact:z.object({ id:z.string(),name:z.string(),emails:z.array(z.string().email()),company:z.string().optional(),companyDomain:z.string().optional(),role:z.string().optional(),topics:z.array(z.string()),lastInteractionAt:z.coerce.date(),firstInteractionAt:z.coerce.date().optional(),sentCount:z.number().nonnegative(),receivedCount:z.number().nonnegative(),threadCount:z.number().nonnegative(),replyRate:z.number().min(0).max(1).optional(),medianReplyMinutes:z.number().optional(),typicalHour:z.number().optional(),timezone:z.string().optional(),strengthScore:z.number().min(0).max(100),previousStrengthScore:z.number().optional() }) }),
  z.object({ feature:z.literal("people-search"), query:z.string().min(2).max(500) }),
  z.object({ feature:z.literal("commitments"), messages:z.array(z.object({ id:z.string(),threadId:z.string(),from:z.string(),to:z.array(z.string()),subject:z.string(),body:z.string().max(50_000),occurredAt:z.coerce.date(),direction:z.enum(["sent","received"]) })).max(100) }),
  z.object({ feature:z.literal("risk"), text:z.string().max(50_000), previousUnanswered:z.number().int().nonnegative().optional() }),
  z.object({ feature:z.literal("sequence-optimization"), replyHours:z.array(z.number().int().min(0).max(23)).max(10_000),timezone:z.string().optional(),stepReplyRates:z.array(z.number().min(0).max(1)),currentDelaysHours:z.array(z.number().positive()) }),
]);

export async function POST(request:Request){
  const user=await currentUser();if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
  const parsed=requestSchema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({error:"Invalid intelligence request",issues:parsed.error.flatten()},{status:400});
  const input=parsed.data;
  switch(input.feature){
    case "decay":return NextResponse.json(relationshipDecay(input.contact));
    case "people-search":return NextResponse.json(parsePeopleQuery(input.query));
    case "commitments":return NextResponse.json({commitments:detectCommitments(input.messages)});
    case "risk":return NextResponse.json(assessMessageRisk(input.text,{previousUnanswered:input.previousUnanswered}));
    case "sequence-optimization":return NextResponse.json(optimizeSequence(input));
  }
}
