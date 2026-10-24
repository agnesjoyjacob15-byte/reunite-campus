import { useState, type FormEvent } from "react";
import { Save } from "lucide-react";
import { api } from "./api";
import { Modal, Message } from "./ui";
import { localInput, type ItemRecord, type ItemInput } from "./types";
export default function ReportForm({
  item,
  categories,
  onClose,
  onSaved,
}: {
  item?: ItemRecord;
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [value, setValue] = useState({
      kind: item?.kind || "Found",
      title: item?.title || "",
      category: item?.category || categories[0],
      location: item?.location || "",
      happenedAt: localInput(item?.happenedAt || new Date()),
      description: item?.description || "",
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const set = (key: keyof typeof value, v: string) =>
    setValue((old) => ({ ...old, [key]: v }));
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const when = new Date(value.happenedAt);
      if (!Number.isFinite(when.getTime()))
        throw Error("Choose a valid date and time.");
      const body: ItemInput = {
        ...value,
        kind: value.kind as "Lost" | "Found",
        happenedAt: when.toISOString(),
      };
      await api(
        item ? "/items/" + item.id : "/items",
        item ? "PATCH" : "POST",
        body,
      );
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={item ? "Edit your report" : "Report an item"}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form className="stack form-body" onSubmit={submit}>
        <p className="muted">
          A few helpful details can make all the difference.
        </p>
        <div className="form-grid">
          <label>
            I want to report
            <select
              value={value.kind}
              onChange={(e) => set("kind", e.target.value)}
            >
              <option>Found</option>
              <option>Lost</option>
            </select>
          </label>
          <label>
            Category
            <select
              value={value.category}
              onChange={(e) => set("category", e.target.value)}
            >
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Item title
          <input
            required
            minLength={5}
            maxLength={100}
            placeholder="e.g. A pair of wireless headphones"
            value={value.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </label>
        <label>
          Campus location
          <input
            required
            minLength={2}
            maxLength={100}
            placeholder="e.g. Library · second floor"
            value={value.location}
            onChange={(e) => set("location", e.target.value)}
          />
        </label>
        <label>
          {value.kind === "Found"
            ? "When was it found?"
            : "When did you last see it?"}
          <input
            type="datetime-local"
            required
            min="2000-01-01T00:00"
            max={localInput(new Date(Date.now() + 300000))}
            value={value.happenedAt}
            onChange={(e) => set("happenedAt", e.target.value)}
          />
        </label>
        <label>
          Public description
          <textarea
            required
            minLength={20}
            maxLength={2000}
            rows={4}
            placeholder="Describe the item and where it was seen. Keep unique ownership clues private."
            value={value.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </label>
        <small>
          Keep passwords, ID numbers and private contact details out of the
          public description.
        </small>
        {error && <Message>{error}</Message>}
        <div className="form-actions">
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : item ? "Save changes" : "Post report"}
            <Save size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
