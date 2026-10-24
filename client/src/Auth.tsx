import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  KeyRound,
  ShieldCheck,
  HeartHandshake,
} from "lucide-react";
import { api } from "./api";
import { Logo, Message } from "./ui";
import type { User } from "./types";
export default function Auth({ onUser }: { onUser: (user: User) => void }) {
  const [join, setJoin] = useState(false),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (new TextEncoder().encode(password).length > 72)
        throw Error("Use no more than 72 UTF-8 bytes for your password.");
      const r = await api<{ user: User }>(
        join ? "/auth/register" : "/auth/login",
        "POST",
        { ...(join ? { name } : {}), email: email.trim(), password },
      );
      onUser(r.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth">
      <section className="auth-story">
        <Logo />
        <div className="auth-story-content">
          <span className="eyebrow">A CAMPUS THAT LOOKS OUT FOR YOU</span>
          <h1>
            Little things.
            <br />
            Lovely reunions.
          </h1>
          <p>
            Lost somewhere on campus?
            <br />
            Let’s help it find its way back.
          </p>
          <div className="auth-illustration" aria-hidden="true">
            <div className="paper-lost">
              LOST?<span>there’s still hope.</span>
            </div>
            <div className="paper-found">
              <KeyRound size={80} strokeWidth={1.2} />
              <b>FOUND!</b>
              <span>good people. good endings.</span>
            </div>
            <span className="floating-star">✳</span>
          </div>
        </div>
        <span className="auth-college">
          Sahrdaya College of Engineering and Technology
        </span>
      </section>
      <section className="auth-form">
        <div>
          <span className="eyebrow">WELCOME TO REUNITE</span>
          <h2>{join ? "You belong here." : "Back to the good things."}</h2>
          <p>
            {join
              ? "Join your campus lost-and-found community."
              : "Sign in to report an item or follow a claim."}
          </p>
          <form onSubmit={submit}>
            {join && (
              <label>
                Full name
                <input
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
            )}
            <label>
              Email address
              <input
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete={join ? "new-password" : "current-password"}
                required
                minLength={join ? 12 : 1}
                maxLength={72}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {join && (
              <small>
                Use 12–72 characters and no more than 72 UTF-8 bytes.
              </small>
            )}
            {error && <Message>{error}</Message>}
            <button className="primary full" disabled={busy}>
              {busy ? "Please wait…" : join ? "Create account" : "Sign in"}
              <ArrowRight size={17} />
            </button>
          </form>
          <p className="auth-switch">
            {join ? "Already part of the community?" : "New to Reunite?"}{" "}
            <button
              disabled={busy}
              onClick={() => {
                setJoin(!join);
                setError("");
                setPassword("");
              }}
            >
              {join ? "Sign in" : "Create an account"}
            </button>
          </p>
          <div className="auth-promises">
            <span>
              <ShieldCheck size={16} />
              Ownership clues stay private.
            </span>
            <span>
              <HeartHandshake size={16} />
              Campus staff review every claim.
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
