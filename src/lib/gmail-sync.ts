import { Buffer } from "node:buffer";
import { encryptPrivateContext, fingerprint } from "@/domain/privacy";
import { scoreRelationship } from "@/domain/relationship";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { gmailAccessToken } from "@/lib/gmail";
import { stopSequencesForReply } from "@/lib/sequence-worker";
import { classifyEmail } from "@/domain/email-classification";

type Header = { name: string; value: string };
type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[] };
type GmailMessage = {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate: string;
  payload?: Part & { headers?: Header[] };
};
type Address = { email: string; name?: string };

const header = (message: GmailMessage, name: string) =>
  message.payload?.headers?.find(
    (item) => item.name.toLowerCase() === name.toLowerCase(),
  )?.value ?? "";
const decode = (value?: string) =>
  value ? Buffer.from(value, "base64url").toString("utf8") : "";
function textBody(part?: Part): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data)
    return decode(part.body.data);
  const plain = part.parts?.map(textBody).find(Boolean);
  if (plain) return plain;
  if (part.mimeType === "text/html" && part.body?.data)
    return decode(part.body.data)
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  return "";
}
export function parseAddresses(value: string): Address[] {
  return value
    .split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const match = entry.match(/^(?:"?([^"<]+)"?\s*)?<([^>]+)>$/);
      const email = (match ? match[2] : entry.replace(/^mailto:/i, ""))
        .trim()
        .toLowerCase();
      return { name: match?.[1]?.trim() || email.split("@")[0], email };
    })
    .filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email));
}
const companyName = (domain: string) =>
  domain
    .split(".")[0]
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
const personalDomains = new Set([
  "gmail.com",
  "outlook.com",
  "hotmail.com",
  "yahoo.com",
  "icloud.com",
  "proton.me",
  "protonmail.com",
]);

async function gmailJson<T>(token: string, path: string) {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/${path}`,
    { headers: { authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? "GMAIL_RECONNECT_REQUIRED"
        : `GMAIL_API_${response.status}`,
    );
  return response.json() as Promise<T>;
}

async function projectContact(
  userId: string,
  mailboxEmail: string,
  address: Address,
  direction: "sent" | "received",
  threadProviderId: string,
  occurredAt: Date,
) {
  if (address.email === mailboxEmail.toLowerCase()) return;
  const domain = address.email.split("@")[1];
  const company = personalDomains.has(domain)
    ? null
    : await db.company.upsert({
        where: { userId_domain: { userId, domain } },
        update: {},
        create: {
          userId,
          name: companyName(domain),
          domain,
          confidence: 0.82,
          source: "email-domain",
        },
      });
  const existing = await db.contact.findUnique({
    where: { userId_primaryEmail: { userId, primaryEmail: address.email } },
  });
  const sentCount = (existing?.sentCount ?? 0) + (direction === "sent" ? 1 : 0),
    receivedCount =
      (existing?.receivedCount ?? 0) + (direction === "received" ? 1 : 0);
  const threadCount = await db.messageParticipant
    .findMany({
      where: { email: address.email, message: { mailbox: { userId } } },
      select: { message: { select: { threadId: true } } },
    })
    .then(
      (rows) =>
        new Set([...rows.map((row) => row.message.threadId), threadProviderId])
          .size,
    );
  const scored = scoreRelationship({
    sentCount,
    receivedCount,
    threadCount,
    lastInteractionAt: occurredAt,
  });
  return db.contact.upsert({
    where: { userId_primaryEmail: { userId, primaryEmail: address.email } },
    update: {
      displayName:
        address.name || existing?.displayName || address.email.split("@")[0],
      companyId: company?.id,
      sentCount,
      receivedCount,
      threadCount,
      lastSentAt: direction === "sent" ? occurredAt : existing?.lastSentAt,
      lastReceivedAt:
        direction === "received" ? occurredAt : existing?.lastReceivedAt,
      lastInteractionAt:
        occurredAt > (existing?.lastInteractionAt ?? new Date(0))
          ? occurredAt
          : existing?.lastInteractionAt,
      strengthScore: scored.score,
      strengthLabel: scored.label,
      strengthExplanation: scored.factors,
    },
    create: {
      userId,
      primaryEmail: address.email,
      displayName: address.name || address.email.split("@")[0],
      category: company ? "Professional" : "Personal network",
      companyId: company?.id,
      sentCount,
      receivedCount,
      threadCount,
      lastSentAt: direction === "sent" ? occurredAt : undefined,
      lastReceivedAt: direction === "received" ? occurredAt : undefined,
      lastInteractionAt: occurredAt,
      strengthScore: scored.score,
      strengthLabel: scored.label,
      strengthExplanation: scored.factors,
    },
  });
}

export async function syncGmailBatch(
  userId: string,
  pageToken?: string,
  batchSize = 50,
) {
  const { mailbox, token } = await gmailAccessToken(userId);
  await db.mailbox.update({
    where: { id: mailbox.id },
    data: { syncStatus: "syncing" },
  });
  const limit = String(Math.min(100, Math.max(10, batchSize)));
  let nextPageToken: string | undefined;
  let estimatedTotal = 0;
  let latestHistoryId: string | undefined;
  let ids: { id: string }[];
  if (mailbox.historyId) {
    const query = new URLSearchParams({
      startHistoryId: mailbox.historyId,
      historyTypes: "messageAdded",
      maxResults: limit,
    });
    if (pageToken) query.set("pageToken", pageToken);
    try {
      const history = await gmailJson<{
        history?: { messagesAdded?: { message: { id: string } }[] }[];
        nextPageToken?: string;
        historyId?: string;
      }>(token, `history?${query}`);
      ids = [
        ...new Map(
          (history.history ?? [])
            .flatMap((item) => item.messagesAdded ?? [])
            .map((item) => [item.message.id, item.message]),
        ).values(),
      ];
      nextPageToken = history.nextPageToken;
      latestHistoryId = history.historyId;
      estimatedTotal = ids.length;
    } catch (cause) {
      if (!(cause instanceof Error) || cause.message !== "GMAIL_API_404")
        throw cause;
      await db.mailbox.update({
        where: { id: mailbox.id },
        data: { historyId: null },
      });
      return syncGmailBatch(userId, undefined, batchSize);
    }
  } else {
    const query = new URLSearchParams({
      maxResults: limit,
      includeSpamTrash: "false",
    });
    if (pageToken) query.set("pageToken", pageToken);
    const listed = await gmailJson<{
      messages?: { id: string }[];
      nextPageToken?: string;
      resultSizeEstimate?: number;
    }>(token, `messages?${query}`);
    ids = listed.messages ?? [];
    nextPageToken = listed.nextPageToken;
    estimatedTotal = listed.resultSizeEstimate ?? ids.length;
  }
  let imported = 0;
  for (let offset = 0; offset < ids.length; offset += 10) {
    const messages = await Promise.all(
      ids
        .slice(offset, offset + 10)
        .map((item) =>
          gmailJson<GmailMessage>(token, `messages/${item.id}?format=full`),
        ),
    );
    for (const message of messages) {
      const alreadyImported = await db.mailMessage.findUnique({
        where: {
          mailboxId_providerId: {
            mailboxId: mailbox.id,
            providerId: message.id,
          },
        },
        select: { id: true },
      });
      if (alreadyImported) continue;
      const occurredAt = new Date(Number(message.internalDate));
      const from = parseAddresses(header(message, "From"));
      const to = parseAddresses(header(message, "To"));
      const cc = parseAddresses(header(message, "Cc"));
      const bcc = parseAddresses(header(message, "Bcc"));
      const direction: "sent" | "received" =
        from.some((item) => item.email === mailbox.email.toLowerCase()) ||
        message.labelIds?.includes("SENT")
          ? "sent"
          : "received";
      const subject = header(message, "Subject") || "(no subject)";
      const body = textBody(message.payload) || message.snippet || "";
      const classification = classifyEmail(subject, message.snippet || body);
      const thread = await db.mailThread.upsert({
        where: {
          mailboxId_providerId: {
            mailboxId: mailbox.id,
            providerId: message.threadId,
          },
        },
        update: { subject, lastMessageAt: occurredAt },
        create: {
          mailboxId: mailbox.id,
          providerId: message.threadId,
          subject,
          lastMessageAt: occurredAt,
        },
      });
      const stored = await db.mailMessage.upsert({
        where: {
          mailboxId_providerId: {
            mailboxId: mailbox.id,
            providerId: message.id,
          },
        },
        update: {},
        create: {
          mailboxId: mailbox.id,
          threadId: thread.id,
          providerId: message.id,
          internetMessageId: header(message, "Message-ID") || undefined,
          direction,
          subject,
          snippet: (message.snippet || body).slice(0, 240),
          bodyEncrypted: body
            ? encryptPrivateContext(
                { body },
                env().PRIVATE_CONTEXT_ENCRYPTION_KEY,
              )
            : undefined,
          bodyFingerprint: body ? fingerprint(body, userId) : undefined,
          occurredAt,
          category: classification.category,
          priority: message.labelIds?.includes("IMPORTANT") || message.labelIds?.includes("STARRED")
            ? "High"
            : classification.priority,
        },
      });
      const roles = [
        ...from.map((item) => ({ ...item, role: "from" })),
        ...to.map((item) => ({ ...item, role: "to" })),
        ...cc.map((item) => ({ ...item, role: "cc" })),
        ...bcc.map((item) => ({ ...item, role: "bcc" })),
      ];
      await db.messageParticipant.createMany({
        data: roles.map((item) => ({
          messageId: stored.id,
          email: item.email,
          name: item.name,
          role: item.role,
        })),
        skipDuplicates: true,
      });
      const contacts = direction === "sent" ? [...to, ...cc, ...bcc] : from;
      for (const address of contacts) {
        const contact = await projectContact(
          userId,
          mailbox.email,
          address,
          direction,
          thread.id,
          occurredAt,
        );
        if (contact)
          await db.messageParticipant.updateMany({
            where: { messageId: stored.id, email: address.email },
            data: { contactId: contact.id },
          });
      }
      const participantEmails = [...new Set([...from, ...to, ...cc, ...bcc].map((address) => address.email).filter((email) => email !== mailbox.email.toLowerCase()))];
      const linkedContacts = await db.contact.findMany({ where: { userId, primaryEmail: { in: participantEmails } }, select: { id: true, strengthScore: true } });
      for (let left = 0; left < linkedContacts.length; left++) {
        for (let right = left + 1; right < linkedContacts.length; right++) {
          const [fromContact, toContact] = [linkedContacts[left], linkedContacts[right]].sort((a, b) => a.id.localeCompare(b.id));
          const strength = Math.round((fromContact.strengthScore + toContact.strengthScore) / 2);
          await db.relationshipEdge.upsert({
            where: { userId_fromContactId_toContactId: { userId, fromContactId: fromContact.id, toContactId: toContact.id } },
            update: { strength, sharedThreads: { increment: 1 }, lastSeenAt: occurredAt, evidence: { source: "shared-email-thread", threadId: thread.id } },
            create: { userId, fromContactId: fromContact.id, toContactId: toContact.id, strength, sharedThreads: 1, lastSeenAt: occurredAt, evidence: { source: "shared-email-thread", threadId: thread.id } },
          });
        }
      }
      if (direction === "received")
        await stopSequencesForReply(userId, message.threadId, occurredAt);
      imported++;
    }
  }
  const profile =
    !nextPageToken && !latestHistoryId
      ? await gmailJson<{ historyId: string }>(token, "profile")
      : null;
  await db.mailbox.update({
    where: { id: mailbox.id },
    data: {
      syncStatus: nextPageToken ? "partial" : "synced",
      lastSyncedAt: new Date(),
      historyId: latestHistoryId ?? profile?.historyId ?? mailbox.historyId,
    },
  });
  return {
    imported,
    processed: ids.length,
    nextPageToken: nextPageToken ?? null,
    estimatedTotal,
    complete: !nextPageToken,
  };
}

export async function syncGmail(userId: string, maxMessages = 100) {
  let pageToken: string | undefined;
  let imported = 0;
  let processed = 0;
  let complete = false;
  do {
    const batch = await syncGmailBatch(
      userId,
      pageToken,
      Math.min(100, maxMessages - processed),
    );
    imported += batch.imported;
    processed += batch.processed;
    pageToken = batch.nextPageToken ?? undefined;
    complete = batch.complete;
  } while (!complete && pageToken && processed < maxMessages);
  return { imported, processed, nextPageToken: pageToken ?? null, complete };
}
