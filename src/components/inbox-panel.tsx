"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Inbox, MailPlus, Search } from "lucide-react";
import styles from "./inbox-panel.module.css";
type InboxMessage = {
  id: string;
  subject: string;
  snippet: string;
  sender: string;
  email: string;
  direction: string;
  occurredAt: string;
  category: string;
  priority: string;
};
const relativeTime = (value: string) => {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 1000),
  );
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};
export default function InboxPanel({ onCompose }: { onCompose: () => void }) {
  const [messages, setMessages] = useState<InboxMessage[]>([]),
    [query, setQuery] = useState(""),
    [direction, setDirection] = useState<"all" | "received" | "sent">("all"),
    [loading, setLoading] = useState(true),
    [selected, setSelected] = useState<InboxMessage | null>(null);
  useEffect(() => {
    fetch("/api/inbox")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => setMessages(data.messages ?? []))
      .finally(() => setLoading(false));
  }, []);
  const visible = useMemo(
    () =>
      messages.filter(
        (message) =>
          (direction === "all" || message.direction === direction) &&
          `${message.sender} ${message.email} ${message.subject} ${message.snippet}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [messages, query, direction],
  );
  const cycle = () =>
    setDirection((value) =>
      value === "all" ? "received" : value === "received" ? "sent" : "all",
    );
  return (
    <section id="inbox" className={styles.section}>
      <div className={styles.heading}>
        <div>
          <small>COMMUNICATION STREAM</small>
          <h2>
            Inbox <span>{String(visible.length).padStart(2, "0")}</span>
          </h2>
        </div>
        <div className={styles.actions}>
          <button className={styles.filter} onClick={cycle}>
            <Inbox />
            {direction === "all"
              ? "All mail"
              : direction === "received"
                ? "Received"
                : "Sent"}
          </button>
          <button className={styles.compose} onClick={onCompose}>
            <MailPlus />
            Compose email
          </button>
        </div>
      </div>
      <div className={styles.panel}>
        <label className={styles.toolbar}>
          <Search />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search senders, subjects, and message previews"
          />
        </label>
        {loading ? (
          <div className={styles.empty}>Loading your inbox…</div>
        ) : (
          visible.map((message) => (
            <button
              className={styles.message}
              key={message.id}
              onClick={() => setSelected(message)}
            >
              <span className={styles.avatar}>
                {message.sender
                  .split(" ")
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")}
              </span>
              <span className={styles.identity}>
                <b>{message.sender}</b>
                <small>{message.email}</small>
              </span>
              <span className={styles.copy}>
                <b>{message.subject}</b>
                <p>{message.snippet}</p>
                <span className={styles.badges}>
                  <span>{message.category}</span>
                  <span>{message.priority}</span>
                </span>
              </span>
              <span className={styles.meta}>
                <b>{relativeTime(message.occurredAt)}</b>
                <small>
                  {message.direction}
                  <ArrowUpRight size={10} />
                </small>
              </span>
            </button>
          ))
        )}
        {!loading && !visible.length && (
          <div className={styles.empty}>No messages match this view.</div>
        )}
      </div>
      {selected && (
        <div className="overlay" onMouseDown={() => setSelected(null)}>
          <section
            className="modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="close" onClick={() => setSelected(null)}>
              ×
            </button>
            <small>
              {selected.direction.toUpperCase()} · {selected.category}
            </small>
            <h2>{selected.subject}</h2>
            <p>
              <b>{selected.sender}</b> · {selected.email}
            </p>
            <p>{selected.snippet}</p>
            <button
              className="neonButton"
              onClick={() => {
                setSelected(null);
                onCompose();
              }}
            >
              Reply or forward
            </button>
          </section>
        </div>
      )}
    </section>
  );
}
