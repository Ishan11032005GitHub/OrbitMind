"use client";

import { useState } from "react";
import {
  ArrowRight,
  Check,
  LoaderCircle,
  Orbit,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import styles from "./login.module.css";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function openDemo() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/demo", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Demo session could not be created.");
      window.location.assign(result.redirectTo || "/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Demo login failed.");
      setLoading(false);
    }
  }
  return (
    <main className={styles.page}>
      <div className={styles.aurora} />
      <div className={styles.grid} />
      <header>
        <a href="#" className={styles.brand}>
          <span>
            <Orbit />
          </span>
          ORBITMIND
        </a>
        <div className={styles.secure}>
          <ShieldCheck /> Private by design
        </div>
      </header>
      <section className={styles.content}>
        <div className={styles.story}>
          <div className={styles.kicker}>
            <Sparkles /> RELATIONSHIP INTELLIGENCE
          </div>
          <h1>
            Your inbox knows
            <br />
            <span>everyone who matters.</span>
          </h1>
          <p>
            Turn conversations into a living relationship graph. Know who is
            drifting, what you promised, and the perfect moment to follow
            through.
          </p>
          <div className={styles.proof}>
            {[
              "Explainable relationship health",
              "AI briefings grounded in real history",
              "Sequences that stop the moment they reply",
            ].map((text) => (
              <span key={text}>
                <i>
                  <Check />
                </i>
                {text}
              </span>
            ))}
          </div>
          <div className={styles.orbit}>
            <i />
            <i />
            <i />
            <div>
              YOU
              <span />
            </div>
            <b className={styles.n1}>MC</b>
            <b className={styles.n2}>AM</b>
            <b className={styles.n3}>SW</b>
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardGlow} />
          <div className={styles.icon}>
            <Zap />
          </div>
          <small>WELCOME TO ORBITMIND</small>
          <h2>Enter your relationship OS</h2>
          <p>
            Connect Gmail securely or explore the complete experience with
            curated demo data.
          </p>
          <a className={styles.google} href="/api/auth/google">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M21.6 12.23c0-.71-.06-1.4-.18-2.06H12v3.9h5.38a4.6 4.6 0 0 1-2 3.02v2.53h3.24c1.9-1.75 2.98-4.33 2.98-7.39Z"
              />
              <path
                fill="#34A853"
                d="M12 22c2.7 0 4.97-.9 6.62-2.38l-3.24-2.53c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.6-4.12H3.05v2.6A10 10 0 0 0 12 22Z"
              />
              <path
                fill="#FBBC05"
                d="M6.4 13.93A6 6 0 0 1 6.08 12c0-.67.11-1.32.32-1.93v-2.6H3.05A10 10 0 0 0 2 12c0 1.61.38 3.14 1.05 4.53l3.35-2.6Z"
              />
              <path
                fill="#EA4335"
                d="M12 5.95c1.47 0 2.79.5 3.83 1.5l2.87-2.88A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.95 5.47l3.35 2.6c.8-2.36 3-4.12 5.6-4.12Z"
              />
            </svg>
            Continue with Google
            <ArrowRight />
          </a>
          <div className={styles.divider}>
            <span />
            OR
            <span />
          </div>
          <button className={styles.demo} onClick={openDemo} disabled={loading}>
            {loading ? <LoaderCircle className={styles.spinner} /> : <Orbit />}
            {loading ? "Opening demo…" : "Explore demo account"}
          </button>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.privacy}>
            <ShieldCheck />
            <span>
              <b>Your data stays yours.</b> Tokens are encrypted and external AI
              is disabled until you opt in.
            </span>
          </div>
        </div>
      </section>
      <footer>
        © 2026 OrbitMind · Built for relationships, not surveillance.
      </footer>
    </main>
  );
}
