"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  Bell,
  Building2,
  ChevronRight,
  Clock3,
  Command,
  LogOut,
  Mail,
  Orbit,
  Plus,
  Search,
  Send,
  Sparkles,
  Users,
  X,
  Zap,
} from "lucide-react";
import styles from "./dashboard.module.css";
import { DEMO_ACCOUNT, demoSequences } from "@/data/demo-client";
import SequenceBuilder, { type CreatedSequence } from "./sequence-builder";
import EmailComposer from "./email-composer";
import InboxPanel from "./inbox-panel";
import IntelligencePanel from "./intelligence-panel";

const seedPeople = [
  {
    name: "Maya Chen",
    mail: "maya@northstar.ai",
    company: "Northstar AI",
    type: "Founder",
    score: 94,
    strength: "Orbit",
    time: "1h 17m ago",
    direction: "Received",
    messages: 65,
    threads: 12,
    hue: "cyan",
  },
  {
    name: "Arjun Mehta",
    mail: "arjun@orbital.so",
    company: "Orbital",
    type: "Investor",
    score: 81,
    strength: "Strong",
    time: "1d 20h ago",
    direction: "Sent",
    messages: 30,
    threads: 7,
    hue: "violet",
  },
  {
    name: "Sarah Williams",
    mail: "sarah@paperplane.design",
    company: "Paperplane",
    type: "Partner",
    score: 73,
    strength: "Growing",
    time: "8d 3h ago",
    direction: "Received",
    messages: 20,
    threads: 5,
    hue: "pink",
  },
  {
    name: "Dev Kapoor",
    mail: "dev@pixelcraft.dev",
    company: "Pixelcraft",
    type: "Client",
    score: 48,
    strength: "Drifting",
    time: "26d 1h ago",
    direction: "Sent",
    messages: 9,
    threads: 3,
    hue: "amber",
  },
];
const showcaseSequences = [
  {
    name: "Founder introductions",
    detail: "Warm network · 3 steps",
    status: "LIVE",
    enrolled: 28,
    replies: 11,
    rate: "39%",
    next: "14 launches today",
    hue: "cyan",
  },
  {
    name: "Investor follow-ups",
    detail: "Seed investors · 4 steps",
    status: "LIVE",
    enrolled: 16,
    replies: 7,
    rate: "44%",
    next: "6 launches tomorrow",
    hue: "violet",
  },
  {
    name: "Revive dormant orbit",
    detail: "No contact in 90 days · AI draft",
    status: "DRAFT",
    enrolled: 42,
    replies: 0,
    rate: "—",
    next: "Awaiting review",
    hue: "pink",
  },
];
type Modal = { title: string; body: string; kind?: "person" | "form" } | null;
type Person = (typeof seedPeople)[number];
export default function Dashboard({
  user,
  initialPeople = [],
  initialSequences = [],
}: {
  user: { name: string | null; email: string; avatarUrl: string | null };
  initialPeople?: Person[];
  initialSequences?: CreatedSequence[];
}) {
  const router = useRouter();
  const isDemo = user.email === DEMO_ACCOUNT.internalEmail;
  const accountEmail = isDemo ? DEMO_ACCOUNT.displayEmail : user.email;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [activeNav, setActiveNav] = useState("people");
  const [modal, setModal] = useState<Modal>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [reclassifying, setReclassifying] = useState(false);
  const [toast, setToast] = useState("");
  const [notifications, setNotifications] = useState(false);
  const [people, setPeople] = useState(
    initialPeople.length ? initialPeople : isDemo ? seedPeople : [],
  );
  const [sequences, setSequences] = useState<CreatedSequence[]>(
    initialSequences.length
      ? initialSequences
      : [...(isDemo ? demoSequences : [])],
  );
  const [metrics, setMetrics] = useState({
    people: initialPeople.length,
    conversations: 0,
    strong: initialPeople.filter((person) => person.score >= 75).length,
    attention: initialPeople.filter((person) => person.score < 45).length,
  });
  const visible = useMemo(
    () =>
      people.filter(
        (p) =>
          (filter === "all" ||
            (filter === "strong" && p.score >= 80) ||
            (filter === "drifting" && p.strength === "Drifting")) &&
          [p.name, p.mail, p.company, p.type]
            .join(" ")
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [people, filter, query],
  );
  const companies = useMemo(
    () =>
      Array.from(new Set(people.map((person) => person.company))).map(
        (name, index) => {
          const contacts = people.filter((person) => person.company === name);
          const signals = contacts.reduce(
            (total, person) => total + person.messages,
            0,
          );
          const score = Math.round(
            contacts.reduce((total, person) => total + person.score, 0) /
              contacts.length,
          );
          return {
            name,
            contacts: contacts.length,
            signals,
            score,
            category: contacts[0].type,
            domain: contacts[0].mail.split("@")[1],
            hue: ["cyan", "violet", "pink", "amber"][index % 4],
          };
        },
      ),
    [people],
  );
  const orbitPeople = people.slice(0, 4);
  const attentionPeople = people
    .filter((person) => person.score < 45)
    .slice(0, 3);
  const strongest = [...people].sort((a, b) => b.score - a.score)[0];
  const notify = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 2400);
  };
  useEffect(() => {
    if (isDemo) return;
    fetch("/api/workspace")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        setPeople(data.people ?? []);
        setSequences(data.sequences ?? []);
        if (data.metrics) setMetrics(data.metrics);
        const syncKey = `orbitmind-auto-sync:${user.email}`;
        if (!sessionStorage.getItem(syncKey)) {
          sessionStorage.setItem(syncKey, "started");
          void syncMailbox();
        }
      })
      .catch(() => notify("Workspace data could not be loaded"));
    // The initial load intentionally owns the one-time mailbox sync trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo, user.email]);
  async function syncMailbox() {
    setSyncing(true);
    try {
      let pageToken: string | undefined;
      let imported = 0;
      let batches = 0;
      do {
        const response = await fetch("/api/gmail/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageToken, batchSize: 50 }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Sync failed");
        imported += data.imported;
        pageToken = data.nextPageToken ?? undefined;
        batches++;
      } while (pageToken && batches < 5);
      const workspace = await fetch("/api/workspace").then((value) =>
        value.json(),
      );
      setPeople(workspace.people ?? []);
      setSequences(workspace.sequences ?? []);
      if (workspace.metrics) setMetrics(workspace.metrics);
      notify(`Gmail synced: ${imported} new messages`);
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "Gmail sync failed");
    } finally {
      setSyncing(false);
    }
  }
  async function logout() {
    sessionStorage.removeItem(`orbitmind-auto-sync:${user.email}`);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  async function addPerson(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name"));
    const mail = String(data.get("email"));
    const company = String(data.get("company") || "Independent");
    if (!name || !mail) return;
    try {
      const response = await fetch("/api/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email: mail, company }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Person could not be added");
      setPeople((v) => [
        {
          name,
          mail,
          company,
          type: "Contact",
          score: 10,
          strength: "New",
          time: "Just now",
          direction: "Manual",
          messages: 0,
          threads: 0,
          hue: "cyan",
        },
        ...v,
      ]);
      setModal(null);
      notify(`${name} added to your universe`);
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : "Person could not be added",
      );
    }
  }
  async function reclassify() {
    setReclassifying(true);
    try {
      const response = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reclassify" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Reclassification failed");
      const workspace = await fetch("/api/workspace").then((value) => value.json());
      setPeople(workspace.people ?? []);
      notify(`${result.updated} relationships reclassified using ${result.mode === "ai" ? "Gemini" : "evidence-based fallback"}`);
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "Reclassification failed");
    } finally {
      setReclassifying(false);
    }
  }
  async function openBriefing() {
    notify("Generating relationship briefing…");
    try {
      const response = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "briefing" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Briefing failed");
      const briefing = result.briefing;
      setModal({
        title: `${result.contact} relationship briefing`,
        body: [briefing.summary, briefing.relationshipContext, ...(briefing.openLoops ?? []).map((item: string) => `Open loop: ${item}`), ...(briefing.talkingPoints ?? []).map((item: string) => `Talking point: ${item}`)].filter(Boolean).join("\n\n"),
      });
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "Briefing failed");
    }
  }
  const initials = (user.name || accountEmail)
    .split(/[ @]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0].toUpperCase())
    .join("");
  return (
    <main className="app">
      <div className="ambient" aria-hidden="true">
        <i />
        <i />
        <i />
        <div className="gridFloor" />
      </div>
      <aside className="rail">
        <div className="logo">
          <span>
            <Orbit size={22} />
          </span>
          <b>ORBITMIND</b>
        </div>
        <nav>
          <a
            className={activeNav === "people" ? "active" : ""}
            href="#people"
            onClick={() => setActiveNav("people")}
          >
            <Users />
            <span>People</span>
            <i />
          </a>
          <a
            className={activeNav === "companies" ? "active" : ""}
            href="#companies"
            onClick={() => setActiveNav("companies")}
          >
            <Building2 />
            <span>Companies</span>
          </a>
          <a
            className={activeNav === "sequences" ? "active" : ""}
            href="#sequences"
            onClick={() => setActiveNav("sequences")}
          >
            <Send />
            <span>Sequences</span>
            <em>{sequences.length}</em>
          </a>
          <button
            className={styles.navButton}
            onClick={() => {
              setActiveNav("pulse");
              setModal({
                title: "Relationship pulse",
                body: isDemo
                  ? "100 InboxIQ demo conversations are mapped across two identities. The personal Gmail relationship is currently strongest."
                  : "Maya and Arjun are accelerating. Dev is drifting after 26 days without contact.",
              });
            }}
          >
            <Activity />
            <span>Pulse</span>
          </button>
        </nav>
        <button
          className={`identity ${styles.identityButton}`}
          onClick={logout}
        >
          <span>{initials}</span>
          <div>
            <b>{user.name || "Explorer"}</b>
            <small>{isDemo ? accountEmail : "Google account"}</small>
          </div>
          <LogOut />
        </button>
      </aside>
      <section className="stage">
        <header className="topbar">
          <label className="search">
            <Search />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your relationship universe…"
            />
            <kbd>
              <Command /> K
            </kbd>
          </label>
          <button className="connect" onClick={() => setComposerOpen(true)}>
            <Mail /> Compose
          </button>
          <button
            className="round"
            onClick={() => setNotifications((v) => !v)}
            aria-label="Notifications"
          >
            <Bell />
            <i />
          </button>
          {isDemo ? (
            <a className="connect" href="/api/auth/google">
              <Zap /> Connect your Gmail
            </a>
          ) : (
            <button
              className="connect"
              onClick={syncMailbox}
              disabled={syncing}
            >
              <Zap /> {syncing ? "Syncing Gmail…" : "Sync Gmail"}
            </button>
          )}
          {notifications && (
            <div className={styles.notifications}>
              <b>Neural alerts</b>
              <p>
                {isDemo
                  ? "35 high-priority messages detected in the demo inbox."
                  : attentionPeople[0]
                    ? `${attentionPeople[0].name} is losing relationship momentum.`
                    : "No critical relationship alerts."}
              </p>
              <p>
                {isDemo
                  ? "30 scheduling threads are ready for follow-up."
                  : sequences[0]
                    ? `${sequences[0].name}: ${sequences[0].rate} reply rate.`
                    : "No active sequence alerts."}
              </p>
            </div>
          )}
        </header>
        <div className="viewport">
          <section className="hero">
            <div className="heroCopy">
              <div className="kicker">
                <Sparkles /> RELATIONSHIP OS · LIVE
              </div>
              <h1>
                Know who matters.
                <br />
                <span>Move at light speed.</span>
              </h1>
              <p>
                AI maps every conversation, reads relationship momentum, and
                orchestrates the perfect next move.
              </p>
              <div className="heroActions">
                <button
                  className="neonButton"
                  onClick={() =>
                    setModal({ title: "Add a person", body: "", kind: "form" })
                  }
                >
                  <Plus /> Add person <span />
                </button>
                <button
                  className="ghostButton"
                  onClick={() =>
                    setModal({
                      title: "Your relationship graph",
                      body: isDemo
                        ? "The original InboxIQ-v2 demo maps 100 messages from two sender identities: a personal Gmail address and an IIIT Guwahati address."
                        : `${people.length} mapped relationships. ${strongest ? `Your strongest relationship is ${strongest.name} at ${strongest.score}/100.` : "Sync Gmail to build your relationship graph."}`,
                    })
                  }
                >
                  <Orbit /> Explore network
                </button>
              </div>
            </div>
            <div className="network">
              <div className="halo h1" />
              <div className="halo h2" />
              <div className="halo h3" />
              <span className="link l1" />
              <span className="link l2" />
              <span className="link l3" />
              <span className="link l4" />
              <div className="core">
                <span>{initials}</span>
                <i />
              </div>
              {orbitPeople.map((person, index) => (
                <div
                  className={`node n${index + 1} ${person.hue}`}
                  key={person.mail}
                >
                  <span>
                    {person.name
                      .split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join("")}
                  </span>
                  <b>{person.name.split(" ")[0]}</b>
                </div>
              ))}
            </div>
          </section>
          <section className="aiBrief glass">
            <div className="briefIcon">
              <Sparkles />
            </div>
            <div>
              <small>NEURAL BRIEFING · UPDATED NOW</small>
              <b>
                {isDemo
                  ? "Your InboxIQ demo history is ready."
                  : attentionPeople.length
                    ? `${attentionPeople.length} relationships need attention.`
                    : "Your relationship graph is healthy."}
              </b>
              <p>
                {isDemo
                  ? "100 messages classified: 48 work, 18 general, 17 notifications, and 17 across other categories."
                  : attentionPeople.length
                    ? `${attentionPeople.map((person) => person.name).join(", ")} ${attentionPeople.length === 1 ? "is" : "are"} losing momentum.`
                    : strongest
                      ? `${strongest.name} is your strongest current relationship.`
                      : "Sync Gmail to generate a briefing."}
              </p>
            </div>
            <button onClick={openBriefing}>
              Open briefing <ArrowUpRight />
            </button>
            <span className="scan" />
          </section>
          <section className="metrics">
            {(isDemo
              ? [
                  ["PEOPLE MAPPED", "2", "2 sender identities"],
                  ["STRONG ORBITS", "1", "1 growing relationship"],
                  ["CONVERSATIONS", "100", "Original InboxIQ-v2 corpus"],
                  ["NEEDS ATTENTION", "35", "35 high priority"],
                ]
              : [
                  ["PEOPLE MAPPED", String(metrics.people), "From your Gmail"],
                  [
                    "STRONG ORBITS",
                    String(metrics.strong),
                    "Score 75 or higher",
                  ],
                  [
                    "CONVERSATIONS",
                    String(metrics.conversations),
                    "Imported messages",
                  ],
                  [
                    "NEEDS ATTENTION",
                    String(metrics.attention),
                    "Relationship score below 45",
                  ],
                ]
            ).map((x) => (
              <article className="glass" key={x[0]}>
                <span>{x[0]}</span>
                <b>{x[1]}</b>
                <small>
                  <i /> {x[2]}
                </small>
              </article>
            ))}
          </section>
          <InboxPanel onCompose={() => setComposerOpen(true)} />
          <IntelligencePanel />
          <section id="people" className="block">
            <div className="sectionTitle">
              <div>
                <small>YOUR UNIVERSE</small>
                <h2>
                  People <span>{visible.length}</span>
                </h2>
              </div>
              <div className="viewTabs">
                {[
                  ["all", "All people"],
                  ["strong", "Strongest"],
                  ["drifting", "Drifting"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    className={filter === id ? "active" : ""}
                    onClick={() => setFilter(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="peopleTable glass">
              <div className="tableHead">
                <span>IDENTITY</span>
                <span>COMPANY</span>
                <span>CONNECTION</span>
                <span>LAST SIGNAL</span>
                <span>VOLUME</span>
                <span />
              </div>
              {visible.map((p, index) => (
                <article
                  className="personRow"
                  key={p.mail}
                  style={
                    { "--delay": `${index * 80}ms` } as React.CSSProperties
                  }
                  onClick={() =>
                    setModal({
                      title: p.name,
                      body: `${p.company} · ${p.type}. Connection health ${p.score}/100 from ${p.messages} messages across ${p.threads} threads.`,
                    })
                  }
                >
                  <div className="person">
                    <div className={`avatar ${p.hue}`}>
                      <span>
                        {p.name
                          .split(" ")
                          .map((x) => x[0])
                          .join("")}
                      </span>
                      <i />
                    </div>
                    <div>
                      <b>{p.name}</b>
                      <small>{p.mail}</small>
                    </div>
                  </div>
                  <div>
                    <b>{p.company}</b>
                    <small className="tag">{p.type}</small>
                  </div>
                  <div className="score">
                    <div
                      className="scoreRing"
                      style={{ "--score": p.score } as React.CSSProperties}
                    >
                      <span>{p.score}</span>
                    </div>
                    <div>
                      <b>{p.strength}</b>
                      <small>Explain score ↗</small>
                    </div>
                  </div>
                  <div>
                    <b>{p.time}</b>
                    <small>{p.direction}</small>
                  </div>
                  <div>
                    <b>{p.messages} signals</b>
                    <small>{p.threads} threads</small>
                  </div>
                  <button className="rowGo">
                    <ChevronRight />
                  </button>
                </article>
              ))}
              {!visible.length && (
                <div className={styles.empty}>
                  No relationships match this search.
                </div>
              )}
            </div>
          </section>
          <section id="companies" className={`block ${styles.companiesBlock}`}>
            <div className="sectionTitle">
              <div>
                <small>ORGANIZATION INTELLIGENCE</small>
                <h2>
                  Companies{" "}
                  <span>{String(companies.length).padStart(2, "0")}</span>
                </h2>
              </div>
              <button
                className="ghostButton"
                onClick={reclassify}
                disabled={reclassifying}
              >
                <Sparkles /> {reclassifying ? "Reclassifying…" : "Reclassify with AI"}
              </button>
            </div>
            <div className={styles.companyGrid}>
              {companies.map((company) => (
                <article
                  className={`glass ${styles.companyCard} ${company.hue}`}
                  key={company.name}
                  onClick={() =>
                    setModal({
                      title: company.name,
                      body: `${company.contacts} mapped ${company.contacts === 1 ? "person" : "people"} · ${company.signals} email signals · ${company.score}/100 average relationship health. Primary classification: ${company.category}.`,
                    })
                  }
                >
                  <div className={styles.companyIcon}>
                    <Building2 />
                  </div>
                  <div className={styles.companyIdentity}>
                    <small>{company.domain}</small>
                    <h3>{company.name}</h3>
                    <span>{company.category}</span>
                  </div>
                  <div className={styles.companyStats}>
                    <span>
                      <b>{company.contacts}</b>
                      <small>PEOPLE</small>
                    </span>
                    <span>
                      <b>{company.signals}</b>
                      <small>SIGNALS</small>
                    </span>
                    <span>
                      <b>{company.score}</b>
                      <small>HEALTH</small>
                    </span>
                  </div>
                  <button
                    className={styles.companyOpen}
                    aria-label={`Open ${company.name}`}
                  >
                    <ArrowUpRight />
                  </button>
                </article>
              ))}
            </div>
          </section>
          <section id="sequences" className="block sequencesBlock">
            <div className="sectionTitle">
              <div>
                <small>AUTONOMOUS FOLLOW-THROUGH</small>
                <h2>
                  Sequences{" "}
                  <span>{String(sequences.length).padStart(2, "0")}</span>
                </h2>
              </div>
              <button
                className="neonButton"
                onClick={() => setBuilderOpen(true)}
              >
                <Plus /> Build sequence <span />
              </button>
            </div>
            <div className="sequenceGrid">
              {sequences.map((s, index) => (
                <article
                  className={`sequenceCard glass ${s.hue}`}
                  key={`${s.name}-${index}`}
                  onClick={() =>
                    setModal({
                      title: s.name,
                      body: `${s.detail}. ${s.enrolled} enrolled, ${s.replies} replies, ${s.rate} reply rate. ${s.next}.`,
                    })
                  }
                >
                  <div className="cardGlow" />
                  <header>
                    <div className="sequenceIcon">
                      <Mail />
                    </div>
                    <em>
                      {s.status}
                      <i />
                    </em>
                    <button aria-label={`More actions for ${s.name}`}>
                      •••
                    </button>
                  </header>
                  <h3>{s.name}</h3>
                  <p>{s.detail}</p>
                  <div className="flow">
                    <span>
                      <Mail />
                    </span>
                    <i />
                    <span>
                      <Clock3 />
                    </span>
                    <i />
                    <span>
                      <Sparkles />
                    </span>
                  </div>
                  <div className="sequenceStats">
                    <span>
                      <b>{s.enrolled}</b>
                      <small>ENROLLED</small>
                    </span>
                    <span>
                      <b>{s.replies}</b>
                      <small>REPLIES</small>
                    </span>
                    <span>
                      <b>{s.rate}</b>
                      <small>REPLY RATE</small>
                    </span>
                  </div>
                  <footer>
                    <Clock3 />
                    {s.next}
                    <ArrowUpRight />
                  </footer>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
      {composerOpen && (
        <EmailComposer
          onClose={() => setComposerOpen(false)}
          onSent={(message) => {
            setComposerOpen(false);
            notify(message);
          }}
        />
      )}
      {builderOpen && (
        <SequenceBuilder
          onClose={() => setBuilderOpen(false)}
          onCreated={(sequence, message) => {
            setSequences((current) => [sequence, ...current]);
            setBuilderOpen(false);
            notify(message);
          }}
        />
      )}
      {modal && (
        <div className={styles.overlay} onMouseDown={() => setModal(null)}>
          <section
            className={styles.modal}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button className={styles.close} onClick={() => setModal(null)}>
              <X />
            </button>
            <small>ORBITMIND INTELLIGENCE</small>
            <h2>{modal.title}</h2>
            {modal.kind === "form" ? (
              <form onSubmit={addPerson}>
                <input name="name" placeholder="Full name" required />
                <input
                  name="email"
                  type="email"
                  placeholder="Email address"
                  required
                />
                <input name="company" placeholder="Company" />
                <button className="neonButton" type="submit">
                  Add to universe
                </button>
              </form>
            ) : (
              <p>{modal.body}</p>
            )}
          </section>
        </div>
      )}
      {toast && (
        <div className={styles.toast}>
          <Zap />
          {toast}
        </div>
      )}
    </main>
  );
}
