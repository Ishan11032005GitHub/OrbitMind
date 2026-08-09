"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  Clock3,
  Link2,
  Mail,
  Plus,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import styles from "./sequence-builder.module.css";
import fixStyles from "./sequence-builder-fixes.module.css";
import MultiEmailInput from "./multi-email-input";

type Step = { id: string; subject: string; body: string; scheduledAt: string };
type ThreadOption = {
  id: string;
  subject: string | null;
  lastMessageAt: string;
  snippet?: string | null;
};
const TIMEZONES = [
  "Asia/Kolkata",
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];
export type CreatedSequence = {
  name: string;
  detail: string;
  status: string;
  enrolled: number;
  replies: number;
  rate: string;
  next: string;
  hue: string;
};

const localDateTime = (hoursFromNow: number) => {
  const date = new Date(Date.now() + hoursFromNow * 3_600_000);
  date.setMinutes(Math.ceil(date.getMinutes() / 5) * 5, 0, 0);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};
const makeStep = (hours: number): Step => ({
  id: crypto.randomUUID(),
  subject: "",
  body: "",
  scheduledAt: localDateTime(hours),
});
export default function SequenceBuilder({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (sequence: CreatedSequence, message: string) => void;
}) {
  const [name, setName] = useState("New outreach sequence");
  const [to, setTo] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [bcc, setBcc] = useState<string[]>([]);
  const [threadMode, setThreadMode] = useState<"new" | "existing">("new");
  const [threadId, setThreadId] = useState("");
  const [threads, setThreads] = useState<ThreadOption[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [steps, setSteps] = useState<Step[]>([makeStep(1)]);
  const [saving, setSaving] = useState(false);
  const [aiDrafting, setAiDrafting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [timezone, setTimezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
  );

  const updateStep = (id: string, patch: Partial<Step>) =>
    setSteps((current) =>
      current.map((step) => (step.id === id ? { ...step, ...patch } : step)),
    );
  const addStep = () =>
    setSteps((current) => [
      ...current,
      makeStep(Math.max(1, current.length * 24 + 1)),
    ]);
  const removeStep = (id: string) =>
    setSteps((current) =>
      current.length === 1 ? current : current.filter((step) => step.id !== id),
    );
  const draftStep = async (step: Step) => {
    setAiDrafting(step.id);
    setError("");
    try {
      const response = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal:
            step.body.trim() ||
            `Write step ${steps.findIndex((item) => item.id === step.id) + 1} of ${name}`,
          subject: step.subject,
          context: `Recipients: ${to.length}. This is a ${threadMode} thread.`,
          recipientCount: Math.max(1, to.length),
          recipients: [...to, ...cc, ...bcc],
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI drafting failed.");
      updateStep(step.id, {
        subject: data.draft.subject,
        body: data.draft.body,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI drafting failed.");
    } finally {
      setAiDrafting(null);
    }
  };
  useEffect(() => {
    if (threadMode !== "existing") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThreadsLoading(true);
    fetch(`/api/threads${to[0] ? `?email=${encodeURIComponent(to[0])}` : ""}`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => setThreads(data.threads ?? []))
      .catch(() => setThreads([]))
      .finally(() => setThreadsLoading(false));
  }, [threadMode, to]);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/sequences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          to,
          cc,
          bcc,
          threadMode,
          threadId: threadMode === "existing" ? threadId : undefined,
          timezone,
          steps: steps.map(({ subject, body, scheduledAt }) => ({
            subject,
            body,
            scheduledAt: new Date(scheduledAt).toISOString(),
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Sequence could not be created.");
      const firstDate = new Date(steps[0].scheduledAt);
      const recipientCount = to.length + cc.length + bcc.length;
      onCreated(
        {
          name,
          detail: `${recipientCount} recipients · ${steps.length} ${steps.length === 1 ? "step" : "steps"}`,
          status: data.sendingEnabled ? "LIVE" : "DRAFT",
          enrolled: recipientCount,
          replies: 0,
          rate: "—",
          next: data.sendingEnabled
            ? `First send ${firstDate.toLocaleString()}`
            : "Ready when sending is enabled",
          hue: "cyan",
        },
        data.sendingEnabled
          ? "Sequence scheduled successfully"
          : "Sequence saved. Delivery remains paused until sequence sending is enabled.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Sequence could not be created.",
      );
      setSaving(false);
    }
  }

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Sequence builder"
    >
      <header className={styles.topbar}>
        <button className={styles.back} onClick={onClose}>
          <ArrowLeft /> Back
        </button>
        <div>
          <small>SEQUENCE STUDIO</small>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label="Sequence name"
          />
        </div>
        <button
          className={styles.close}
          onClick={onClose}
          aria-label="Close sequence builder"
        >
          <X />
        </button>
      </header>
      <div className={styles.workspace}>
        <aside className={styles.settings}>
          <div className={styles.settingHeading}>
            <Sparkles />
            <div>
              <small>DELIVERY TARGET</small>
              <h2>Who and where</h2>
            </div>
          </div>
          <div className={styles.recipientFields}>
            <MultiEmailInput label="TO" values={to} onChange={setTo} required />
            <MultiEmailInput label="CC" values={cc} onChange={setCc} />
            <MultiEmailInput label="BCC" values={bcc} onChange={setBcc} />
          </div>
          <fieldset>
            <legend>Conversation thread</legend>
            <button
              className={threadMode === "new" ? styles.selected : ""}
              onClick={() => setThreadMode("new")}
            >
              <Mail />
              <span>
                <b>Create new thread</b>
                <small>The first email starts a fresh conversation.</small>
              </span>
              {threadMode === "new" && <Check />}
            </button>
            <button
              className={threadMode === "existing" ? styles.selected : ""}
              onClick={() => setThreadMode("existing")}
            >
              <Link2 />
              <span>
                <b>Use existing thread</b>
                <small>Continue a Gmail conversation.</small>
              </span>
              {threadMode === "existing" && <Check />}
            </button>
          </fieldset>
          {threadMode === "existing" && (
            <label>
              Gmail thread
              <select
                className={fixStyles.threadSelect}
                value={threadId}
                onChange={(event) => setThreadId(event.target.value)}
                required
              >
                <option value="">
                  {threadsLoading
                    ? "Loading threads…"
                    : "Choose a conversation"}
                </option>
                {threads.map((thread) => (
                  <option value={thread.id} key={thread.id}>
                    {thread.subject || "(no subject)"} ·{" "}
                    {new Date(thread.lastMessageAt).toLocaleDateString()}
                  </option>
                ))}
              </select>
              {!threadsLoading && !threads.length && (
                <small>Sync Gmail first to load existing threads.</small>
              )}
            </label>
          )}
          <label className={`${styles.guardrail} ${styles.timezoneControl}`}>
            <Clock3 />
            <span>
              <b>Your timezone</b>
              <select className={fixStyles.timezoneSelect}
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                aria-label="Sequence timezone"
              >
                {!TIMEZONES.includes(timezone) && (
                  <option value={timezone}>{timezone}</option>
                )}
                {TIMEZONES.map((zone) => (
                  <option value={zone} key={zone}>
                    {zone}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <div className={styles.guardrail}>
            <Send />
            <span>
              <b>Reply protection</b>
              <small>Future steps stop after a reply.</small>
            </span>
          </div>
        </aside>
        <main className={styles.canvas}>
          <div className={styles.canvasHeading}>
            <div>
              <small>SCHEDULED JOURNEY</small>
              <h2>Compose each touch</h2>
              <p>
                Add as many emails as you need. Every step has its own exact
                send date and time.
              </p>
            </div>
            <div className={styles.headingActions}>
              <span>
                {steps.length} {steps.length === 1 ? "EMAIL" : "EMAILS"}
              </span>
              <button onClick={addStep}>
                <Plus /> Add email
              </button>
            </div>
          </div>
          <div className={styles.timeline}>
            {steps.map((step, index) => (
              <article className={styles.step} key={step.id}>
                <div className={styles.stepRail}>
                  <span>{index + 1}</span>
                  <i />
                </div>
                <div className={styles.stepCard}>
                  <header>
                    <div>
                      <Mail />
                      <span>
                        <small>STEP {String(index + 1).padStart(2, "0")}</small>
                        <b>Scheduled email</b>
                      </span>
                    </div>
                    <div className={styles.stepActions}>
                      <button
                        className={styles.aiButton}
                        onClick={() => draftStep(step)}
                        disabled={aiDrafting === step.id}
                      >
                        <Sparkles />
                        {aiDrafting === step.id ? "Drafting…" : "AI draft"}
                      </button>
                      <button
                        onClick={() => removeStep(step.id)}
                        disabled={steps.length === 1}
                        aria-label={`Delete step ${index + 1}`}
                      >
                        <Trash2 />
                      </button>
                    </div>
                  </header>
                  <label>
                    Subject
                    <input
                      value={step.subject}
                      onChange={(event) =>
                        updateStep(step.id, { subject: event.target.value })
                      }
                      placeholder="What should this email be about?"
                    />
                  </label>
                  <label>
                    Message
                    <textarea
                      value={step.body}
                      onChange={(event) =>
                        updateStep(step.id, { body: event.target.value })
                      }
                      placeholder="Write the email that will be sent…"
                      rows={6}
                    />
                  </label>
                  <label className={styles.schedule}>
                    <CalendarClock />
                    <span>
                      <small>SEND DATE & TIME</small>
                      <input
                        type="datetime-local"
                        value={step.scheduledAt}
                        onChange={(event) =>
                          updateStep(step.id, {
                            scheduledAt: event.target.value,
                          })
                        }
                      />
                    </span>
                  </label>
                </div>
              </article>
            ))}
          </div>
          <button className={styles.addStep} onClick={addStep}>
            <Plus />
            <span>
              <b>Add another scheduled email</b>
              <small>Continue building this sequence</small>
            </span>
          </button>
        </main>
        <aside className={styles.summary}>
          <small>SEQUENCE SUMMARY</small>
          <h2>
            {steps.length} scheduled {steps.length === 1 ? "touch" : "touches"}
          </h2>
          <div className={styles.summaryLine}>
            <span>To</span>
            <b>{to.length || "Not set"}</b>
          </div>
          <div className={styles.summaryLine}>
            <span>CC / BCC</span>
            <b>
              {cc.length} / {bcc.length}
            </b>
          </div>
          <div className={styles.summaryLine}>
            <span>Thread</span>
            <b>
              {threadMode === "new"
                ? "New conversation"
                : "Existing conversation"}
            </b>
          </div>
          <div className={styles.summaryLine}>
            <span>First send</span>
            <b>
              {steps[0]?.scheduledAt
                ? new Date(steps[0].scheduledAt).toLocaleString()
                : "Not set"}
            </b>
          </div>
          <div className={styles.summaryLine}>
            <span>Last send</span>
            <b>
              {steps.at(-1)?.scheduledAt
                ? new Date(steps.at(-1)!.scheduledAt).toLocaleString()
                : "Not set"}
            </b>
          </div>
          <div className={styles.safety}>
            <Sparkles />
            <p>
              Every delivery receives an idempotency key, and replies stop
              future steps.
            </p>
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <button className={styles.finish} onClick={save} disabled={saving}>
            <Check />
            {saving ? "Creating sequence…" : "Finish sequence"}
          </button>
          <button className={styles.cancel} onClick={onClose}>
            Save nothing & exit
          </button>
        </aside>
      </div>
    </div>
  );
}
