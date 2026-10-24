import { useCallback, useEffect, useState } from "react";
import {
  Search,
  Plus,
  ArrowUpRight,
  LogOut,
  HeartHandshake,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Download,
  X,
  ArrowRight,
} from "lucide-react";
import { api, ApiError, downloadSummary } from "./api";
import Auth from "./Auth";
import ReportForm from "./ReportForm";
import ItemDetail from "./ItemDetail";
import ClaimDialog from "./ClaimDialog";
import { Logo, Modal, Message, ItemCard, Pagination, Status } from "./ui";
import {
  date,
  type User,
  type Meta,
  type Stats,
  type ItemRecord,
  type ClaimRow,
  type Page,
} from "./types";
type View = "board" | "mine" | "claims" | "admin";
const emptyPage = <T,>(): Page<T> => ({
  items: [],
  page: 1,
  pages: 1,
  total: 0,
});
export default function App() {
  const [user, setUser] = useState<User | null>(null),
    [booting, setBooting] = useState(true),
    [bootError, setBootError] = useState(""),
    [bootRetry, setBootRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setBooting(true);
    setBootError("");
    api<{ user: User }>("/auth/me")
      .then((r) => {
        if (active) setUser(r.user);
      })
      .catch((e) => {
        if (active && (!(e instanceof ApiError) || e.status !== 401))
          setBootError(e.message);
      })
      .finally(() => {
        if (active) setBooting(false);
      });
    return () => {
      active = false;
    };
  }, [bootRetry]);
  if (booting)
    return (
      <div className="boot">
        <Logo />
        <p role="status">Finding your place…</p>
      </div>
    );
  if (bootError)
    return (
      <div className="boot">
        <Logo />
        <Message>{bootError}</Message>
        <button className="primary" onClick={() => setBootRetry((v) => v + 1)}>
          Try again
        </button>
      </div>
    );
  return user ? (
    <Workspace user={user} onLogout={() => setUser(null)} />
  ) : (
    <Auth onUser={setUser} />
  );
}
function Workspace({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [view, setView] = useState<View>("board"),
    [meta, setMeta] = useState<Meta | null>(null),
    [stats, setStats] = useState<Stats | null>(null),
    [items, setItems] = useState<Page<ItemRecord>>(emptyPage),
    [claims, setClaims] = useState<Page<ClaimRow>>(emptyPage);
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [kind, setKind] = useState(""),
    [status, setStatus] = useState("Open"),
    [claimStatus, setClaimStatus] = useState(""),
    [claimItem, setClaimItem] = useState(""),
    [page, setPage] = useState(1),
    [refresh, setRefresh] = useState(0),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<string | null>(null),
    [claim, setClaim] = useState<ClaimRow | null>(null),
    [report, setReport] = useState(false),
    [editing, setEditing] = useState<ItemRecord | undefined>(),
    [about, setAbout] = useState(false),
    [exporting, setExporting] = useState(false),
    [loggingOut, setLoggingOut] = useState(false);
  const admin = user.role === "admin",
    claimView = view === "claims" || view === "admin";
  const changed = useCallback(() => setRefresh((n) => n + 1), []);
  useEffect(() => {
    let active = true;
    setBusy(true);
    setError("");
    const q = new URLSearchParams({
      page: String(page),
      limit: claimView ? "10" : "9",
    });
    if (claimView) {
      if (claimStatus) q.set("status", claimStatus);
      if (claimItem) q.set("itemId", claimItem);
    } else {
      q.set("scope", view === "mine" ? "mine" : "all");
      if (search.trim()) q.set("search", search.trim());
      if (category) q.set("category", category);
      if (kind) q.set("kind", kind);
      if (status) q.set("status", status);
    }
    Promise.all([
      api<Meta>("/meta"),
      api<Stats>("/stats"),
      api<Page<ItemRecord> | Page<ClaimRow>>(
        (claimView ? "/claims?" : "/items?") + q,
      ),
    ])
      .then(([m, s, data]) => {
        if (!active) return;
        setMeta(m);
        setStats(s);
        if (claimView) setClaims(data as Page<ClaimRow>);
        else setItems(data as Page<ItemRecord>);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [
    view,
    page,
    search,
    category,
    kind,
    status,
    claimStatus,
    claimItem,
    refresh,
    claimView,
  ]);
  function navigate(next: View) {
    setView(next);
    setPage(1);
    setSearch("");
    setCategory("");
    setKind("");
    setStatus(next === "board" ? "Open" : "");
    setClaimStatus(next === "admin" ? "Pending" : "");
    setClaimItem("");
    setNotice("");
  }
  function clear() {
    setSearch("");
    setCategory("");
    setKind("");
    setStatus(view === "board" ? "Open" : "");
    setPage(1);
  }
  async function logout() {
    setLoggingOut(true);
    setError("");
    try {
      await api("/auth/logout", "POST");
      onLogout();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoggingOut(false);
    }
  }
  async function exportReports() {
    setExporting(true);
    setError("");
    try {
      await downloadSummary();
      setNotice(
        "Report summary downloaded. Private ownership evidence is excluded.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting(false);
    }
  }
  const result = claimView ? claims : items,
    initials = user.name
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0])
      .join("")
      .toUpperCase();
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <button
          className="brand-button"
          aria-label="Reunite home"
          onClick={() => navigate("board")}
        >
          <Logo />
        </button>
        <nav aria-label="Main navigation">
          <button
            className={view === "board" ? "active" : ""}
            onClick={() => navigate("board")}
          >
            The board
          </button>
          <button
            className={view === "mine" ? "active" : ""}
            onClick={() => navigate("mine")}
          >
            My reports
          </button>
          {!admin && (
            <button
              className={view === "claims" ? "active" : ""}
              onClick={() => navigate("claims")}
            >
              My claims
            </button>
          )}
          {admin && (
            <button
              className={view === "admin" ? "active" : ""}
              onClick={() => navigate("admin")}
            >
              Help desk
            </button>
          )}
        </nav>
        <div className="account">
          <span className="avatar">{initials}</span>
          <span className="account-name">
            {user.name}
            <small>{admin ? "Campus administrator" : "Student"}</small>
          </span>
          <button
            className="icon-button"
            aria-label="Sign out"
            disabled={loggingOut}
            onClick={() => void logout()}
          >
            <LogOut size={19} />
          </button>
        </div>
      </header>
      <main id="main" className="workspace">
        <div className="campus-line">
          <span>
            <i />
            SAHRDAYA CAMPUS
          </span>
          <button onClick={() => setAbout(true)}>
            A little help goes a long way <ArrowUpRight size={14} />
          </button>
        </div>
        {view === "board" ? (
          <section className="hero">
            <div className="hero-copy">
              <span className="eyebrow">YOUR CAMPUS LOST & FOUND</span>
              <h1>
                Good things find
                <br />
                their way <em>back.</em>
              </h1>
              <p>
                From the keys in your pocket to the notes you can’t replace.
                <br />
                Let’s bring a little peace of mind back to campus.
              </p>
              <div className="hero-actions">
                <button
                  className="primary"
                  onClick={() => {
                    setEditing(undefined);
                    setReport(true);
                  }}
                >
                  <Plus size={17} />
                  Report an item
                </button>
                <a href="#board">
                  Take a look around <ArrowUpRight size={16} />
                </a>
              </div>
              <div className="community-note">
                <span className="mini-avatar">A</span>
                <span className="mini-avatar">R</span>
                <span className="mini-avatar">S</span>
                <span>A small act. A better day.</span>
              </div>
            </div>
            <div className="hero-art" aria-hidden="true">
              <span className="scribble">
                you might just
                <br />
                make someone’s day ↘
              </span>
              <div className="found-slip">
                <span>REUNITE / CAMPUS DESK</span>
                <b>
                  someone’s
                  <br />
                  little treasure.
                </b>
                <KeyRound size={95} strokeWidth={1.15} />
                <small>
                  FOUND WITH CARE.
                  <br />
                  RETURNED WITH A SMILE.
                </small>
                <i>01</i>
              </div>
              <div className="tiny-slip">
                <HeartHandshake size={24} />
                <span>
                  kind people.
                  <br />
                  <b>happy endings.</b>
                </span>
              </div>
              <span className="hero-spark">✳</span>
            </div>
          </section>
        ) : (
          <section className="page-intro">
            <span className="eyebrow">
              {view === "mine"
                ? "THE THINGS YOU CARE ABOUT"
                : view === "claims"
                  ? "A LITTLE CLOSER TO HOME"
                  : "CARE BEFORE EVERY HANDOVER"}
            </span>
            <h1>
              {view === "mine"
                ? "Your reports, all together."
                : view === "claims"
                  ? "Follow your little reunion."
                  : "A careful pair of hands."}
            </h1>
            <p>
              {view === "mine"
                ? "Keep track of what you’ve reported and what has made its way back."
                : view === "claims"
                  ? "Your ownership evidence and staff updates stay private."
                  : "Compare ownership evidence, record a decision, and help an item find its person."}
            </p>
          </section>
        )}
        <section className="stats" aria-label="Campus report statistics">
          <div>
            <span>Looking for their people</span>
            <strong>{stats?.lost ?? "—"}</strong>
            <small>open lost-item reports</small>
            <Search size={21} />
          </div>
          <div>
            <span>Found, and kept safe</span>
            <strong>{stats?.found ?? "—"}</strong>
            <small>open found-item reports</small>
            <KeyRound size={21} />
          </div>
          <div>
            <span>Back where they belong</span>
            <strong>{stats?.reunited ?? "—"}</strong>
            <small>items recorded as returned</small>
            <HeartHandshake size={23} />
          </div>
        </section>
        {notice && <Message good>{notice}</Message>}
        <section id="board" className="board">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                {claimView
                  ? "PRIVATE OWNERSHIP CLAIMS"
                  : "A PLACE TO START LOOKING"}
              </span>
              <h2>
                {view === "board"
                  ? "Around the campus"
                  : view === "mine"
                    ? "My reports"
                    : view === "claims"
                      ? "My claims"
                      : "Claim review desk"}
                <span className="count">{busy ? "…" : result.total}</span>
              </h2>
            </div>
            {claimView ? (
              admin && (
                <button
                  className="secondary"
                  disabled={exporting}
                  onClick={() => void exportReports()}
                >
                  <Download size={16} />
                  {exporting ? "Preparing…" : "Export report summary"}
                </button>
              )
            ) : (
              <button
                className="secondary"
                onClick={() => {
                  setEditing(undefined);
                  setReport(true);
                }}
              >
                <Plus size={16} />
                Report an item
              </button>
            )}
          </div>
          {claimView ? (
            <div className="claim-filters">
              <label>
                Claim status
                <select
                  value={claimStatus}
                  onChange={(e) => {
                    setClaimStatus(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All statuses</option>
                  {meta?.claimStatuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              {claimItem && (
                <button
                  className="filter-clear"
                  onClick={() => {
                    setClaimItem("");
                    setPage(1);
                  }}
                >
                  Show all items <X size={14} />
                </button>
              )}
              {admin && (
                <small>
                  Summary export includes up to 5,000 latest reports and
                  excludes private evidence.
                </small>
              )}
            </div>
          ) : (
            <div className="filters">
              <div className="kind-filters" aria-label="Report type">
                {[
                  ["", "All items"],
                  ["Lost", "Lost"],
                  ["Found", "Found"],
                ].map(([value, label]) => (
                  <button
                    key={label}
                    aria-pressed={kind === value}
                    onClick={() => {
                      setKind(value);
                      setPage(1);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="sr-label">
                Category
                <select
                  aria-label="Category"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All categories</option>
                  {meta?.categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="sr-label">
                Report status
                <select
                  aria-label="Report status"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All statuses</option>
                  {meta?.statuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <div className="search">
                <Search size={16} />
                <input
                  aria-label="Search reports"
                  maxLength={100}
                  placeholder="Search for a little something…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>
          )}
          {error ? (
            <div className="empty">
              <Message>{error}</Message>
              <button className="secondary" onClick={changed}>
                Try again
              </button>
            </div>
          ) : busy ? (
            <div
              className="loading-grid"
              role="status"
              aria-label="Loading results"
            >
              {[1, 2, 3].map((n) => (
                <div key={n} className="skeleton" />
              ))}
              <span className="visually-hidden">Loading results…</span>
            </div>
          ) : result.total === 0 ? (
            <div className="empty">
              <Sparkles size={37} strokeWidth={1.3} />
              <h3>
                {view === "admin"
                  ? "You’re all caught up."
                  : claimView
                    ? "No claims here yet."
                    : "Nothing found just yet."}
              </h3>
              <p>
                {claimView
                  ? "Ownership claims and their updates will appear here."
                  : "Try another search or leave out a filter."}
              </p>
              {!claimView && (
                <button className="secondary" onClick={clear}>
                  Clear filters
                </button>
              )}
            </div>
          ) : claimView ? (
            <div className="claim-list">
              {claims.items.map((row) => (
                <article key={row.claim.id} className="claim-row">
                  <div className="claim-item">
                    <span className="eyebrow">{row.claim.reference}</span>
                    <h3>{row.item.title}</h3>
                    <span>
                      {admin ? row.claim.student?.name : row.item.location}
                    </span>
                  </div>
                  <div>
                    <Status value={row.claim.status} />
                    <small>
                      {row.item.status === "Returned"
                        ? "Item returned"
                        : date(row.claim.submittedAt)}
                    </small>
                  </div>
                  <button
                    className="secondary"
                    aria-label={
                      (admin ? "Review " : "View ") + row.claim.reference
                    }
                    onClick={() => setClaim(row)}
                  >
                    {admin ? "Review claim" : "View update"}
                    <ArrowUpRight size={14} />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="item-grid">
              {items.items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onOpen={() => setSelected(item.id)}
                />
              ))}
            </div>
          )}
          <Pagination
            page={page}
            pages={result.pages}
            total={result.total}
            busy={busy}
            onPage={setPage}
          />
        </section>
        <section className="kindness-banner">
          <span className="banner-icon">
            <HeartHandshake size={38} strokeWidth={1.3} />
          </span>
          <div>
            <h2>
              Someone’s missing it.
              <br />
              You could make their day.
            </h2>
            <p>Found a little something? Tell the campus about it.</p>
          </div>
          <button
            className="primary"
            onClick={() => {
              setEditing(undefined);
              setReport(true);
            }}
          >
            Post a found item <ArrowRight size={17} />
          </button>
        </section>
      </main>
      <footer>
        <Logo />
        <span>A little care goes a long way.</span>
        <small>Student project · Agnes Joy · 2026</small>
      </footer>
      {selected && (
        <ItemDetail
          id={selected}
          user={user}
          onClose={() => setSelected(null)}
          onChanged={changed}
          onEdit={(item) => {
            setSelected(null);
            setEditing(item);
            setReport(true);
          }}
          onReview={(id) => {
            setSelected(null);
            navigate("admin");
            setClaimItem(id);
            setClaimStatus("");
          }}
        />
      )}{" "}
      {report && meta && (
        <ReportForm
          item={editing}
          categories={meta.categories}
          onClose={() => {
            setReport(false);
            setEditing(undefined);
          }}
          onSaved={() => {
            setReport(false);
            setEditing(undefined);
            changed();
            setNotice(
              editing
                ? "Your report was updated."
                : "Your report is on the board. Thank you for looking out.",
            );
          }}
        />
      )}{" "}
      {claim && (
        <ClaimDialog
          row={claim}
          user={user}
          onClose={() => setClaim(null)}
          onChanged={changed}
          onItem={(id) => {
            setClaim(null);
            setSelected(id);
          }}
        />
      )}{" "}
      {about && (
        <Modal
          title="A little care, a clear process"
          onClose={() => setAbout(false)}
        >
          <div className="form-body about-body">
            <ShieldCheck size={32} />
            <h3>Report. Verify. Reunite.</h3>
            <p>
              Students post lost and found items. An owner can send one private
              claim on a found item they did not report. Only campus
              administrators review that evidence.
            </p>
            <p>
              Approval reserves the item for one claimant and rejects other
              pending claims. Staff record the return after a real-world
              handover. Lost-item reporters can record their own recovery.
            </p>
            <p>
              Reunite records staff decisions; it cannot independently prove
              ownership or physical handover. Keep unique identifying details
              private.
            </p>
            <small>
              This student demonstration uses fictional items and identities.
            </small>
          </div>
        </Modal>
      )}
    </>
  );
}
