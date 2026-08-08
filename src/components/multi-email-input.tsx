"use client";
import { useState } from "react";
import { X } from "lucide-react";
import styles from "./multi-email-input.module.css";

const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export default function MultiEmailInput({ label, values, onChange, required = false }: { label: string; values: string[]; onChange: (values: string[]) => void; required?: boolean }) {
  const [draft, setDraft] = useState(""); const [invalid, setInvalid] = useState(false);
  const commit = (raw = draft) => { const candidates = raw.split(/[;,\s]+/).map((value) => value.trim().toLowerCase()).filter(Boolean); if (!candidates.length) return; const bad = candidates.some((value) => !validEmail.test(value)); setInvalid(bad); if (bad) return; onChange([...new Set([...values, ...candidates])]); setDraft(""); };
  return <label className={styles.field}><span>{label}{required && <em> REQUIRED</em>}</span><div className={`${styles.input} ${invalid ? styles.invalid : ""}`} onClick={(event) => (event.currentTarget.querySelector("input") as HTMLInputElement)?.focus()}>{values.map((value) => <button type="button" className={styles.chip} key={value} onClick={() => onChange(values.filter((item) => item !== value))}>{value}<X/></button>)}<input value={draft} onChange={(event) => { setDraft(event.target.value); setInvalid(false); }} onBlur={() => commit()} onKeyDown={(event) => { if (["Enter", ",", ";", "Tab"].includes(event.key) && draft.trim()) { event.preventDefault(); commit(); } if (event.key === "Backspace" && !draft && values.length) onChange(values.slice(0, -1)); }} placeholder={values.length ? "Add another…" : "name@company.com"}/></div>{invalid && <small>Enter a valid email address.</small>}</label>;
}

