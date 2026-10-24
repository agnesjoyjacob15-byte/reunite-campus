import { useState } from "react";
import { LockKeyhole, Check, X, ArrowUpRight } from "lucide-react";
import { api } from "./api";
import { Modal, Message, Status, ItemArt } from "./ui";
import { dateTime, type ClaimRow, type User } from "./types";
export default function ClaimDialog({
  row,
  user,
  onClose,
  onChanged,
  onItem,
}: {
  row: ClaimRow;
  user: User;
  onClose: () => void;
  onChanged: () => void;
  onItem: (id: string) => void;
}) {
  const { item, claim } = row,
    admin = user.role === "admin";
  const [note, setNote] = useState(""),
    [decision, setDecision] = useState<
      "Approved" | "Rejected" | "Withdrawn" | null
    >(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  function choose(v: "Approved" | "Rejected") {
    if (note.trim().length < 10) {
      setError("Add a review note of at least 10 characters.");
      return;
    }
    setError("");
    setDecision(v);
  }
  async function save() {
    if (!decision) return;
    setBusy(true);
    setError("");
    try {
      if (decision === "Withdrawn")
        await api("/items/" + item.id + "/claims/me", "DELETE");
      else
        await api(
          "/items/" + item.id + "/claims/" + claim.id + "/review",
          "PATCH",
          { decision, note },
        );
      onChanged();
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setDecision(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={admin ? "Review ownership claim" : "Your private claim"}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="form-body stack">
        <div className="claim-item-summary">
          <ItemArt category={item.category} small />
          <div>
            <span className="eyebrow">{item.kind.toUpperCase()} ITEM</span>
            <h3>{item.title}</h3>
            <p>{item.location}</p>
            <button className="text-button" onClick={() => onItem(item.id)}>
              View item <ArrowUpRight size={14} />
            </button>
          </div>
        </div>
        <div className="claim-meta">
          <Status value={claim.status} />
          <span>{claim.reference}</span>
        </div>
        <span className="muted small-text">
          Submitted {dateTime(claim.submittedAt)}
        </span>
        {admin && claim.student && (
          <div className="private-note">
            <b>Claimant</b>
            <p>
              {claim.student.name}
              <br />
              {claim.student.email}
            </p>
          </div>
        )}
        <div className="evidence-box">
          <span className="eyebrow">
            <LockKeyhole size={13} /> PRIVATE OWNERSHIP EVIDENCE
          </span>
          <p>{claim.evidence}</p>
        </div>
        {claim.reviewNote && (
          <div className="private-note">
            <b>Review note</b>
            <p>{claim.reviewNote}</p>
            {claim.reviewedAt && <small>{dateTime(claim.reviewedAt)}</small>}
          </div>
        )}
        {item.status === "Returned" && claim.status === "Approved" && (
          <Message good>The desk has recorded this item as returned.</Message>
        )}
        {claim.status === "Approved" && item.status === "Claimed" && (
          <p className="muted">
            Arrange collection through the campus lost-and-found desk. A
            reference alone is not proof of ownership.
          </p>
        )}
        {admin && claim.status === "Pending" && item.status === "Open" && (
          <>
            <label>
              Private review note
              <textarea
                required
                minLength={10}
                maxLength={500}
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Record the verification result or the reason for rejection."
              />
            </label>
            <small>
              Compare evidence before approving. Approval reserves the item for
              this claimant and rejects other pending claims.
            </small>
            {!decision && (
              <div className="review-actions">
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => choose("Approved")}
                >
                  <Check size={16} />
                  Approve claim
                </button>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => choose("Rejected")}
                >
                  <X size={16} />
                  Reject claim
                </button>
              </div>
            )}
          </>
        )}
        {!admin &&
          claim.status === "Pending" &&
          item.status === "Open" &&
          !decision && (
            <button
              className="secondary"
              onClick={() => setDecision("Withdrawn")}
            >
              Withdraw claim
            </button>
          )}
        {decision && (
          <div className="confirm-box" role="alert">
            <strong>
              {decision === "Approved"
                ? "Approve this ownership claim?"
                : decision === "Rejected"
                  ? "Reject this ownership claim?"
                  : "Withdraw your claim?"}
            </strong>
            <p>
              {decision === "Approved"
                ? "Other pending claims will be rejected in the same operation. Confirm only after checking the ownership evidence."
                : decision === "Rejected"
                  ? "The claimant will see your private review note. This decision is final."
                  : "You cannot submit a second claim for this item."}
            </p>
            <div>
              <button
                className="primary"
                disabled={busy}
                onClick={() => void save()}
              >
                {busy ? "Saving…" : "Confirm decision"}
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => setDecision(null)}
              >
                Go back
              </button>
            </div>
          </div>
        )}
        {error && <Message>{error}</Message>}
      </div>
    </Modal>
  );
}
