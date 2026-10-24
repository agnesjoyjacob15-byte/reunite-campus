import { useEffect, useRef, type ReactNode } from "react";
import {
  Link2,
  X,
  Headphones,
  BookOpen,
  CreditCard,
  KeyRound,
  Shirt,
  Package,
  MapPin,
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  Check,
} from "lucide-react";
import type { ItemRecord } from "./types";
import { date } from "./types";
export function Logo() {
  return (
    <span className="logo">
      <span className="logo-symbol">
        <Link2 size={25} strokeWidth={2.5} />
      </span>
      reunite<span className="logo-dot">.</span>
    </span>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const old = document.activeElement as HTMLElement | null,
      d = ref.current;
    d?.showModal();
    return () => {
      d?.close();
      old?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={"modal " + (wide ? "wide" : "")}
      aria-labelledby="reunite-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="modal-head">
        <h2 id="reunite-dialog-title">{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Message({
  children,
  good = false,
}: {
  children: ReactNode;
  good?: boolean;
}) {
  return (
    <div
      className={"message " + (good ? "good" : "")}
      role={good ? "status" : "alert"}
    >
      {good && <Check size={16} />}
      <span>{children}</span>
    </div>
  );
}
export function Status({ value }: { value: string }) {
  return (
    <span className={"status " + value.toLowerCase()}>
      {value === "Claimed" ? "Claim approved" : value}
    </span>
  );
}
export function ItemArt({
  category,
  small = false,
}: {
  category: string;
  small?: boolean;
}) {
  const icons = {
    Electronics: Headphones,
    Books: BookOpen,
    "IDs & Cards": CreditCard,
    Keys: KeyRound,
    Clothing: Shirt,
    Other: Package,
  };
  const Icon = icons[category as keyof typeof icons] || Package;
  return (
    <div
      className={
        "item-art " +
        category.toLowerCase().replace(/[^a-z]/g, "") +
        (small ? " small" : "")
      }
      aria-hidden="true"
    >
      <span className="art-circle" />
      <Icon
        className="item-illustration"
        size={small ? 62 : 94}
        strokeWidth={1.25}
      />
      <span className="art-spark">✳</span>
      <span className="art-note">
        a little thing.
        <br />a lot to someone.
      </span>
    </div>
  );
}
export function ItemCard({
  item,
  onOpen,
}: {
  item: ItemRecord;
  onOpen: () => void;
}) {
  return (
    <article className="item-card">
      <button
        className="card-art-button"
        aria-label={"View " + item.title}
        onClick={onOpen}
      >
        <ItemArt category={item.category} />
        <span className={"kind-sticker " + item.kind.toLowerCase()}>
          {item.kind === "Found" ? "FOUND SOMETHING" : "MISSING SOMETHING"}
        </span>
      </button>
      <div className="card-body">
        <div className="card-top">
          <span>{item.category}</span>
          <Status value={item.status} />
        </div>
        <button className="card-title" onClick={onOpen}>
          {item.title}
        </button>
        <p className="location">
          <MapPin size={14} />
          {item.location}
        </p>
        <div className="card-foot">
          <span>{date(item.happenedAt)}</span>
          <button onClick={onOpen}>
            Take a look <ArrowUpRight size={15} />
          </button>
        </div>
        {item.myClaim && (
          <span className="own-claim-note">
            Your claim: {item.myClaim.status.toLowerCase()}
          </span>
        )}
      </div>
    </article>
  );
}
export function Pagination({
  page,
  pages,
  total,
  busy,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  busy: boolean;
  onPage: (page: number) => void;
}) {
  return (
    <div className="pagination">
      <span>
        {total} result{total === 1 ? "" : "s"}
      </span>
      <div>
        <button
          className="icon-button"
          disabled={busy || page <= 1}
          aria-label="Previous page"
          onClick={() => onPage(page - 1)}
        >
          <ArrowLeft size={16} />
        </button>
        <span>
          {page} / {pages}
        </span>
        <button
          className="icon-button"
          disabled={busy || page >= pages}
          aria-label="Next page"
          onClick={() => onPage(page + 1)}
        >
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
