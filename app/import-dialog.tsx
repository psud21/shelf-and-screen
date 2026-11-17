import { useState } from "react";
import { ArrowRight, ArrowUpRight, LoaderCircle, Upload } from "lucide-react";
import {
  guessMapping,
  importFields,
  importRows,
  parseCSV,
  sameMedia,
  statusNames,
  typeNames,
  type Media,
} from "../lib/media";
import { parseLibrary } from "../lib/library";
import { ConnectButton } from "./hub-context";
import Modal from "./modal";

export default function ImportDialog({
  demo,
  connected,
  existing,
  onClose,
  onImport,
  onStartLibrary,
}: {
  onStartLibrary: () => void;
  demo: boolean;
  connected: boolean;
  existing: Media[];
  onClose: () => void;
  onImport: (items: Media[]) => Promise<void>;
}) {
  const [source, setSource] = useState("Goodreads"),
    [kind, setKind] = useState<Media["kind"]>("book"),
    [scale, setScale] = useState(5),
    [rows, setRows] = useState<string[][]>([]),
    [mapping, setMapping] = useState<Record<string, string>>({}),
    [backup, setBackup] = useState<Media[] | null>(null),
    [filename, setFilename] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<{
      items: Media[];
      errors: string[];
      duplicates: number;
    } | null>(null);
  function changeSource(s: string) {
    setSource(s);
    setScale(s === "Goodreads" ? 5 : 100);
    setKind(s === "Goodreads" || s === "Kindle list" ? "book" : "movie");
    setPreview(null);
  }
  async function fileRead(file: File) {
    setError("");
    setPreview(null);
    setRows([]);
    setBackup(null);
    setFilename(file.name);
    try {
      if (file.size > 15 * 1024 * 1024) throw new Error("Please use a file smaller than 15 MB.");
      const text = await file.text();
      if (file.name.toLowerCase().endsWith(".json")) {
        setBackup(parseLibrary(text));
      } else {
        const parsed = parseCSV(text);
        if (parsed.length > 10001) throw new Error("Import up to 10,000 titles at a time.");
        setRows(parsed);
        setMapping(guessMapping(parsed[0] || []));
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function makePreview() {
    setError("");
    try {
      const parsed = backup
        ? { items: backup, errors: [] }
        : importRows(rows, { source, kind, ratingScale: scale, mapping });
      const unique: Media[] = [];
      let duplicates = 0;
      for (let item of parsed.items) {
        if (source === "Kindle list" && !backup)
          item = { ...item, owned: true, platform: "Kindle" };
        if (existing.some((e) => sameMedia(e, item)) || unique.some((e) => sameMedia(e, item))) {
          duplicates++;
          continue;
        }
        unique.push(item);
      }
      setPreview({ ...parsed, items: unique, duplicates });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function commit() {
    if (!preview) return;
    setBusy(true);
    setError("");
    try {
      await onImport(preview.items);
      onClose();
    } catch (e) {
      setError(`${(e as Error).message} Nothing was imported; preview again to retry.`);
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Bring your stories together"
      wide
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <fieldset className="editor-body import-body" disabled={busy}>
        <p className="body-copy">
          Import your lists and ratings, then keep everything here. Imports add new titles and skip
          duplicates; your existing ratings stay as they are.
        </p>
        {demo && (
          <div className="import-warning">
            You’re in the sample library. Imports here stay in the demo.{" "}
            {connected && (
              <button type="button" onClick={onStartLibrary}>
                Use my library instead <ArrowRight size={12} />
              </button>
            )}
            {!connected && (
              <>
                {" "}
                <ConnectButton /> to save.
              </>
            )}
          </div>
        )}
        <div className="source-tabs">
          {["Goodreads", "Criticker", "Kindle list", "Other / backup"].map((s) => (
            <button
              key={s}
              className={source === s ? "selected" : ""}
              onClick={() => changeSource(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="source-help">
          {source === "Goodreads" ? (
            <>
              <strong>Your shelves and ratings, together.</strong>
              <p>
                In Goodreads, open My Books → Import/Export → Export Library. Upload that CSV below.
                Want-to-read and currently-reading shelves are recognized. Unrated books stay
                unrated; stars convert at 20 points each.
              </p>
              <a href="https://www.goodreads.com/review/import" target="_blank" rel="noreferrer">
                Open Goodreads Import/Export <ArrowUpRight size={13} />
              </a>
            </>
          ) : source === "Criticker" ? (
            <>
              <strong>Keep your 100-point ratings.</strong>
              <p>
                Upload a CSV of your Criticker ratings or watchlist. Check the column mapping below.
                If TV shows are not identified in the file, import them separately with “TV show”
                selected.
              </p>
              <a href="https://www.criticker.com/" target="_blank" rel="noreferrer">
                Open Criticker <ArrowUpRight size={13} />
              </a>
            </>
          ) : source === "Kindle list" ? (
            <>
              <strong>A shelf for the books you already own.</strong>
              <p>
                Add Kindle books manually, or upload a CSV with Title and Author columns. Imported
                books are marked as owned on Kindle. Goodreads formats don’t confirm Kindle
                ownership: mark books you own here. This tracks your book list; it doesn’t access
                your Kindle device or import ebook files.
              </p>
            </>
          ) : (
            <>
              <strong>Your data, your way.</strong>
              <p>
                Upload a CSV and match its columns, or restore a Shelf & Screen JSON backup. Choose
                the scale used in the original file. Everything appears on a 100-point scale here.
              </p>
            </>
          )}
        </div>
        <label className="upload-area">
          <Upload size={25} />
          <strong>{filename || "Choose a CSV or JSON file"}</strong>
          <span>CSV, TSV or Shelf & Screen backup · up to 15 MB</span>
          <input
            type="file"
            accept=".csv,.tsv,.json,text/csv,application/json"
            onChange={(e) => {
              if (e.target.files?.[0]) fileRead(e.target.files[0]);
            }}
          />
        </label>
        {rows.length > 0 && !backup && (
          <>
            <div className="form-row">
              <label>
                Default media type
                <select
                  value={kind}
                  onChange={(e) => {
                    setKind(e.target.value as Media["kind"]);
                    setPreview(null);
                  }}
                >
                  <option value="book">Book</option>
                  <option value="movie">Movie</option>
                  <option value="tv">TV show</option>
                </select>
              </label>
              <label>
                Original rating scale
                <select
                  value={scale}
                  onChange={(e) => {
                    setScale(Number(e.target.value));
                    setPreview(null);
                  }}
                >
                  <option value={5}>0–5 (stars)</option>
                  <option value={10}>0–10</option>
                  <option value={100}>0–100</option>
                </select>
              </label>
            </div>
            <details className="mapping" open={!mapping.title}>
              <summary>
                Match columns <span>{rows.length - 1} rows detected</span>
              </summary>
              <div className="mapping-grid">
                {importFields.map((f) => (
                  <label key={f}>
                    {(
                      {
                        creator: "Author / creator",
                        score: "Rating",
                        kind: "Media type",
                        completedAt: "Date finished",
                        sourceRating: "Original rating",
                        episodeTracker: "Episode tracking",
                        recommendedBy: "Recommended by",
                        recommendationNote: "Recommendation note",
                        priority: "Priority",
                        coverUrl: "Cover or poster link",
                      } as Record<string, string>
                    )[f] || f}
                    <select
                      value={mapping[f] || ""}
                      onChange={(e) => {
                        setMapping({ ...mapping, [f]: e.target.value });
                        setPreview(null);
                      }}
                    >
                      <option value="">
                        {f === "title" ? "Choose a column (required)" : "Not included"}
                      </option>
                      {rows[0].map((h, i) => (
                        <option key={i} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </details>
          </>
        )}
        {preview && (
          <div className="import-preview">
            <h3>{preview.items.length} new titles ready to add</h3>
            <p>
              {preview.duplicates} duplicates skipped · {preview.errors.length} rows need attention
            </p>
            {preview.errors.length > 0 && (
              <details>
                <summary>Review skipped rows</summary>
                {preview.errors.slice(0, 30).map((e, i) => (
                  <p key={i} className="row-error">
                    {e}
                  </p>
                ))}
              </details>
            )}
            <div className="preview-table">
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Type</th>
                    <th>Shelf</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.items.slice(0, 8).map((i) => (
                    <tr key={i.id}>
                      <td>{i.title}</td>
                      <td>{typeNames[i.kind]}</td>
                      <td>{statusNames[i.status]}</td>
                      <td>{i.score ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.items.length > 8 && <small>Showing the first 8 titles.</small>}
          </div>
        )}
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
      </fieldset>
      <div className="modal-actions">
        <button className="secondary" disabled={busy} onClick={onClose}>
          Cancel
        </button>
        {preview ? (
          <button
            className="primary"
            disabled={busy || preview.items.length === 0}
            onClick={commit}
          >
            {busy ? <LoaderCircle size={16} className="spin" /> : <Upload size={16} />}Import{" "}
            {preview.items.length} titles
          </button>
        ) : (
          <button className="primary" disabled={!rows.length && !backup} onClick={makePreview}>
            Preview import <ArrowRight size={15} />
          </button>
        )}
      </div>
    </Modal>
  );
}
