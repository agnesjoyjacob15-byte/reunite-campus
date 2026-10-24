import { useEffect, useState, type FormEvent } from "react";
import {
  MapPin,
  CalendarDays,
  LockKeyhole,
  ArrowRight,
  CheckCircle2,
  Pencil,
  Trash2,
} from "lucide-react";
import { api } from "./api";
import { Modal, Message, ItemArt, Status } from "./ui";
import { dateTime, type ItemRecord, type User } from "./types";
export default function ItemDetail({
  id,
  user,
  onClose,
  onChanged,
  onEdit,
  onReview,
}: {
  id: string;
  user: User;
  onClose: () => void;
  onChanged: () => void;
  onEdit: (item: ItemRecord) => void;
  onReview: (id: string) => void;
}) {
  const [item, setItem] = useState<ItemRecord | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [evidence, setEvidence] = useState(""),
    [success, setSuccess] = useState(""),
    [retry, setRetry] = useState(0),
    [confirm, setConfirm] = useState<
      "withdraw" | "close" | "delete" | "returned" | null
    >(null);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api<{ item: ItemRecord }>("/items/" + id)
      .then((r) => {
        if (active) setItem(r.item);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, retry]);
  async function run(
    path: string,
    method: string,
    body: unknown,
    message: string,
    deleted = false,
  ) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const r = await api<{ item: ItemRecord }>(path, method, body);
      setConfirm(null);
      onChanged();
      if (deleted) {
        onClose();
        return;
      }
      setItem(r.item);
      setSuccess(message);
      setEvidence("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function submitClaim(e: FormEvent) {
    e.preventDefault();
    void run(
      "/items/" + id + "/claims",
      "POST",
      { evidence },
      "Your private claim has been sent to the campus desk.",
    );
  }
  const admin = user.role === "admin",
    owner = item?.isOwner || admin,
    editable = owner && item?.status === "Open" && item.claimCount === 0;
  return (
    <Modal
      title="Item details"
      wide
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      {loading ? (
        <div className="modal-loading" role="status">
          Finding the details…
        </div>
      ) : !item ? (
        <div className="form-body">
          <Message>{error || "This report is unavailable."}</Message>
          <button className="secondary" onClick={() => setRetry((v) => v + 1)}>
            Try again
          </button>
        </div>
      ) : (
        <div className="detail-body">
          <div className="detail-grid">
            <section>
              <ItemArt category={item.category} />
              <div className="detail-labels">
                <span className={"kind-label " + item.kind.toLowerCase()}>
                  {item.kind === "Found" ? "FOUND ITEM" : "LOST ITEM"}
                </span>
                <Status value={item.status} />
              </div>
              <h3 className="detail-title">{item.title}</h3>
              <p className="detail-line">
                <MapPin size={16} />
                {item.location}
              </p>
              <p className="detail-line">
                <CalendarDays size={16} />
                {dateTime(item.happenedAt)}
              </p>
              <h4>A little more about it</h4>
              <p className="description">{item.description}</p>
              {item.isOwner && (
                <span className="owner-note">You posted this report.</span>
              )}
            </section>
            <aside className="claim-panel">
              <span className="eyebrow">THE NEXT LITTLE STEP</span>
              {item.myClaim ? (
                <>
                  <LockKeyhole size={25} />
                  <h3>
                    {item.status === "Returned" &&
                    item.myClaim.status === "Approved"
                      ? "A happy reunion."
                      : item.myClaim.status === "Approved"
                        ? "Your claim is approved."
                        : item.myClaim.status === "Pending"
                          ? "In careful hands."
                          : "Your claim update."}
                  </h3>
                  <Status value={item.myClaim.status} />
                  <p>
                    {item.status === "Returned" &&
                    item.myClaim.status === "Approved"
                      ? "The campus desk has recorded this item as returned."
                      : item.myClaim.status === "Approved"
                        ? "Arrange collection through the campus lost-and-found desk. Bring the requested ownership evidence."
                        : item.myClaim.status === "Pending"
                          ? "Campus staff will review your ownership details. Your evidence is private."
                          : item.myClaim.status === "Withdrawn"
                            ? "You withdrew this claim. Each student can submit one claim per item."
                            : "The desk could not approve this claim. The private review note is below."}
                  </p>
                  <div className="reference">
                    <small>YOUR CLAIM REFERENCE</small>
                    <strong>{item.myClaim.reference}</strong>
                  </div>
                  {item.myClaim.reviewNote && (
                    <div className="private-note">
                      <b>Review note</b>
                      <p>{item.myClaim.reviewNote}</p>
                    </div>
                  )}
                  <details>
                    <summary>Your private evidence</summary>
                    <p className="description">{item.myClaim.evidence}</p>
                  </details>
                  {item.myClaim.status === "Pending" &&
                    item.status === "Open" && (
                      <button
                        className="secondary full"
                        disabled={busy}
                        onClick={() => setConfirm("withdraw")}
                      >
                        Withdraw claim
                      </button>
                    )}
                </>
              ) : item.kind === "Found" &&
                item.status === "Open" &&
                !item.isOwner &&
                !admin ? (
                <>
                  <h3>Think it’s yours?</h3>
                  <p>
                    Describe a detail only the owner would know. Staff will
                    compare your evidence before arranging a handover.
                  </p>
                  <form className="stack" onSubmit={submitClaim}>
                    <label>
                      Private ownership details
                      <textarea
                        required
                        rows={5}
                        minLength={20}
                        maxLength={1500}
                        value={evidence}
                        onChange={(e) => setEvidence(e.target.value)}
                        placeholder="A hidden mark, the contents, or another distinguishing detail…"
                      />
                    </label>
                    <small>
                      Only you and campus administrators can read this. Avoid
                      passwords and ID numbers.
                    </small>
                    <button className="primary full" disabled={busy}>
                      {busy ? "Sending…" : "Send ownership claim"}
                      <ArrowRight size={16} />
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <h3>
                    {item.status === "Returned"
                      ? "Back where it belongs."
                      : item.status === "Claimed"
                        ? "A reunion is on its way."
                        : item.status === "Closed"
                          ? "This report is closed."
                          : item.isOwner
                            ? "Thanks for looking out."
                            : "Keep an eye out."}
                  </h3>
                  <p>
                    {item.status === "Returned"
                      ? "This item has been recorded as returned. New claims are closed."
                      : item.status === "Claimed"
                        ? "Staff have approved an ownership claim and will confirm the handover."
                        : item.status === "Closed"
                          ? "This report is archived and no longer accepts claims."
                          : item.isOwner && item.kind === "Found"
                            ? "Staff review private claims and arrange the return. You cannot claim an item you reported."
                            : item.kind === "Lost"
                              ? "Found something similar? Hand it to the campus desk or post a found-item report."
                              : "Review ownership evidence in the help desk before approving a claim."}
                  </p>
                  {item.status === "Returned" && (
                    <CheckCircle2 size={45} strokeWidth={1.2} />
                  )}
                </>
              )}
              {owner && (
                <div className="management">
                  <span className="eyebrow">
                    {admin ? "CAMPUS DESK" : "YOUR REPORT"}
                  </span>
                  {editable && (
                    <button
                      className="secondary full"
                      disabled={busy}
                      onClick={() => onEdit(item)}
                    >
                      <Pencil size={15} />
                      Edit report
                    </button>
                  )}
                  {admin && item.kind === "Found" && item.claimCount > 0 && (
                    <button
                      className="secondary full"
                      disabled={busy}
                      onClick={() => onReview(item.id)}
                    >
                      Review ownership claims <ArrowRight size={15} />
                    </button>
                  )}
                  {((item.kind === "Lost" && item.status === "Open") ||
                    (admin &&
                      item.kind === "Found" &&
                      item.status === "Claimed")) && (
                    <button
                      className="primary full"
                      disabled={busy}
                      onClick={() => setConfirm("returned")}
                    >
                      Mark as returned <CheckCircle2 size={16} />
                    </button>
                  )}
                  {item.status === "Open" &&
                    (admin || item.claimCount === 0) && (
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => setConfirm("close")}
                      >
                        Close report
                      </button>
                    )}
                  {editable && (
                    <button
                      className="danger-link"
                      disabled={busy}
                      onClick={() => setConfirm("delete")}
                    >
                      <Trash2 size={14} />
                      Delete report
                    </button>
                  )}
                  {item.status === "Open" && item.claimCount > 0 && (
                    <small>
                      Claim history locks editing. Administrators manage claim
                      decisions and handovers.
                    </small>
                  )}
                </div>
              )}
            </aside>
          </div>
          {confirm && (
            <div className="confirm-box" role="alert">
              <strong>
                {confirm === "delete"
                  ? "Delete this report?"
                  : confirm === "withdraw"
                    ? "Withdraw your ownership claim?"
                    : confirm === "returned"
                      ? "Confirm the item has been returned?"
                      : "Close this report?"}
              </strong>
              <p>
                {confirm === "delete"
                  ? "Only reports without claim history can be removed."
                  : confirm === "withdraw"
                    ? "Your evidence stays in your private history. A second claim on this item is not allowed."
                    : confirm === "returned"
                      ? "Record this only after the real-world handover or recovery is complete."
                      : "This ends the report. Any pending ownership claims will be rejected."}
              </p>
              <div>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => {
                    if (confirm === "delete")
                      void run("/items/" + id, "DELETE", undefined, "", true);
                    else if (confirm === "withdraw")
                      void run(
                        "/items/" + id + "/claims/me",
                        "DELETE",
                        undefined,
                        "Your claim was withdrawn.",
                      );
                    else
                      void run(
                        "/items/" + id + "/status",
                        "PATCH",
                        {
                          status:
                            confirm === "returned" ? "Returned" : "Closed",
                        },
                        confirm === "returned"
                          ? "The return has been recorded."
                          : "The report was closed.",
                      );
                  }}
                >
                  {busy ? "Saving…" : "Confirm"}
                </button>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => setConfirm(null)}
                >
                  Go back
                </button>
              </div>
            </div>
          )}
          {error && <Message>{error}</Message>}
          {success && <Message good>{success}</Message>}
        </div>
      )}
    </Modal>
  );
}
