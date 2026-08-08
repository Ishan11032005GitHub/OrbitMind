"use client";
import { useState } from "react";
import {
  Link2,
  LoaderCircle,
  Mail,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import MultiEmailInput from "./multi-email-input";
import styles from "./email-composer.module.css";

export default function EmailComposer({
  onClose,
  onSent,
}: {
  onClose: () => void;
  onSent: (message: string) => void;
}) {
  const [to, setTo] = useState<string[]>([]),
    [cc, setCc] = useState<string[]>([]),
    [bcc, setBcc] = useState<string[]>([]);
  const [subject, setSubject] = useState(""),
    [body, setBody] = useState(""),
    [threadId, setThreadId] = useState(""),
    [showThread, setShowThread] = useState(false),
    [sending, setSending] = useState(false),
    [aiLoading, setAiLoading] = useState(false),
    [error, setError] = useState("");
  async function generateDraft() {
    if (!body.trim() && !subject.trim())
      return setError("Describe what you want the email to say first.");
    setAiLoading(true);
    setError("");
    try {
      const response = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: body || subject,
          subject,
          context: "",
          recipientCount: to.length + cc.length + bcc.length || 1,
          recipients: [...to, ...cc, ...bcc],
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI drafting failed.");
      setSubject(data.draft.subject);
      setBody(data.draft.body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI drafting failed.");
    } finally {
      setAiLoading(false);
    }
  }
  async function send() {
    setError("");
    if (!to.length) return setError("Add at least one To recipient.");
    setSending(true);
    try {
      const response = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          cc,
          bcc,
          subject,
          body,
          threadId: threadId || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Email could not be sent.");
      onSent(
        data.message ||
          `Email sent to ${to.length + cc.length + bcc.length} recipient${to.length + cc.length + bcc.length === 1 ? "" : "s"}.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Email could not be sent.",
      );
      setSending(false);
    }
  }
  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Compose email"
    >
      <section className={styles.composer}>
        <header>
          <div>
            <span>
              <Mail />
            </span>
            <div>
              <small>GMAIL COMPOSER</small>
              <h2>New message</h2>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close composer">
            <X />
          </button>
        </header>
        <div className={styles.recipients}>
          <MultiEmailInput label="TO" values={to} onChange={setTo} required />
          <MultiEmailInput label="CC" values={cc} onChange={setCc} />
          <MultiEmailInput label="BCC" values={bcc} onChange={setBcc} />
        </div>
        <label className={styles.subject}>
          <span>SUBJECT</span>
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Write a clear subject"
          />
        </label>
        <label className={styles.message}>
          <span>MESSAGE</span>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write your email…"
            autoFocus
          />
        </label>
        {showThread && (
          <label className={styles.thread}>
            <Link2 />
            <span>
              <small>GMAIL THREAD ID</small>
              <input
                value={threadId}
                onChange={(event) => setThreadId(event.target.value)}
                placeholder="Optional existing thread ID"
              />
            </span>
          </label>
        )}
        {error && <p className={styles.error}>{error}</p>}
        <footer>
          <button
            className={styles.aiButton}
            onClick={generateDraft}
            disabled={aiLoading}
          >
            {aiLoading ? (
              <LoaderCircle className={styles.spin} />
            ) : (
              <Sparkles />
            )}
            {aiLoading ? "Drafting…" : "AI draft"}
          </button>
          <button
            className={styles.threadButton}
            onClick={() => setShowThread((value) => !value)}
          >
            <Link2 />
            {showThread ? "Hide thread" : "Reply in thread"}
          </button>
          <div className={styles.private}>
            <ShieldCheck />
            Sent securely through your Gmail
          </div>
          <button
            className={styles.send}
            onClick={send}
            disabled={sending || !to.length || !subject.trim() || !body.trim()}
          >
            {sending ? <LoaderCircle className={styles.spin} /> : <Send />}
            {sending ? "Sending…" : "Send email"}
          </button>
        </footer>
      </section>
    </div>
  );
}
