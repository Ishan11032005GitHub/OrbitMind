"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Network, Search, Sparkles } from "lucide-react";
import styles from "./intelligence-panel.module.css";

type InsightData = {
  people: { id: string; name: string; email: string; company: string; role: string; score: number }[];
  commitments: { owner: string; text: string; status: string; dueAt?: string }[];
  actions: {
    contactId: string;
    name: string;
    health: { headline: string; explanation: string };
    decay: { state: string; risk: number };
    next: { action: string; reason: string; priority: number };
  }[];
  paths: { path: string[]; confidence: number }[];
};

type Briefing = {
  summary: string;
  relationshipContext: string;
  openLoops: string[];
  talkingPoints: string[];
  avoid: string[];
};

export default function IntelligencePanel() {
  const [data, setData] = useState<InsightData | null>(null);
  const [query, setQuery] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [status, setStatus] = useState("");

  const load = async (params = "") => {
    setLoading(true);
    try {
      const response = await fetch(`/api/insights${params}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Intelligence could not be loaded");
      setData(body);
      setStatus("");
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "Intelligence could not be loaded");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  const search = () => void load(query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "");
  const paths = () => void load(company.trim() ? `?company=${encodeURIComponent(company.trim())}` : "");

  const generateBriefing = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "briefing" }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Briefing failed");
      setBriefing(body.briefing);
      setStatus(
        body.mode === "ai"
          ? "AI briefing generated from minimized relationship context."
          : "Evidence-based briefing generated; external AI was unavailable.",
      );
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "Briefing failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="intelligence" className={styles.section}>
      <div className={styles.heading}>
        <div><small>RELATIONSHIP INTELLIGENCE</small><h2>Decisions, not unexplained scores</h2></div>
        <button className={styles.brief} onClick={generateBriefing} disabled={loading}>
          {loading ? <LoaderCircle className={styles.spin} /> : <Sparkles />} Generate briefing
        </button>
      </div>
      <div className={styles.grid}>
        <article className={styles.card}>
          <h3>Ask your network</h3>
          <p>Use natural language such as “founders I spoke with last quarter who work in AI”.</p>
          <div className={styles.search}>
            <Search />
            <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && search()} placeholder="Search people in natural language" />
            <button onClick={search}>Search</button>
          </div>
          <div className={styles.results}>
            {data?.people.slice(0, 6).map((person) => (
              <div className={styles.result} key={person.id}>
                <span><b>{person.name}</b><small>{person.company} · {person.role} · {person.email}</small></span>
                <small className={styles.score}>{person.score} relevance</small>
              </div>
            ))}
          </div>
        </article>
        <article className={styles.card}>
          <h3>Who needs attention?</h3>
          <p>Relationship decay and the recommended next move are calculated from real interaction cadence.</p>
          <div className={styles.items}>
            {data?.actions.slice(0, 5).map((action) => (
              <div className={`${styles.item} ${action.decay.state !== "healthy" ? styles.warning : ""}`} key={action.contactId}>
                <strong>{action.name} · {action.decay.state} ({action.decay.risk}%)</strong>
                <b>{action.next.action.replaceAll("_", " ")}</b><small>{action.next.reason}</small>
              </div>
            ))}
          </div>
        </article>
        <article className={styles.card}>
          <h3>Open commitments</h3><p>Promises and requests detected from synchronized conversation history.</p>
          <div className={styles.items}>
            {data?.commitments.length ? data.commitments.slice(0, 6).map((commitment, index) => (
              <div className={`${styles.item} ${commitment.status === "overdue" ? styles.warning : ""}`} key={`${commitment.text}-${index}`}>
                <b>{commitment.text}</b>
                <small>{commitment.owner === "me" ? "Your commitment" : "Contact commitment"} · {commitment.status}{commitment.dueAt ? ` · due ${new Date(commitment.dueAt).toLocaleDateString()}` : ""}</small>
              </div>
            )) : <span className={styles.status}>No open commitments detected yet.</span>}
          </div>
        </article>
        <article className={styles.card}>
          <h3>Find an introduction path</h3><p>Discover the strongest relationship path into a target company.</p>
          <div className={styles.path}>
            <input value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Target company or domain" />
            <button onClick={paths}><Network size={13} /> Find path</button>
          </div>
          <div className={styles.items}>
            {data?.paths.length ? data.paths.slice(0, 5).map((path, index) => (
              <div className={styles.item} key={index}><b>{path.path.join(" → ")}</b><small>{path.confidence}% confidence</small></div>
            )) : company && <span className={styles.status}>No verified path found. More shared-thread evidence may be needed.</span>}
          </div>
        </article>
        {briefing && <article className={`${styles.card} ${styles.briefing}`}>
          <h3>{briefing.summary}</h3><p>{briefing.relationshipContext}</p>
          {briefing.openLoops.length > 0 && <ul>{briefing.openLoops.map((item) => <li key={item}>{item}</li>)}</ul>}
        </article>}
      </div>
      {status && <p className={styles.status}>{status}</p>}
    </section>
  );
}
