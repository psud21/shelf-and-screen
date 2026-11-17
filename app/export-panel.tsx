import { useState } from "react";
import { ArrowUpRight, Download } from "lucide-react";
import { exportCSV, type Media } from "../lib/media";
import { critickerExport, goodreadsExport, type ExportIssue } from "../lib/service-exports";
import { localToday } from "../lib/calendar-date.mjs";
import "./export-panel.css";

type Props = {
  items: Media[];
  demo: boolean;
  onEdit: (item: Media) => void;
  onDownloaded: (message: string) => void;
};

export default function ExportPanel({ items, demo, onEdit, onDownloaded }: Props) {
  const [tab, setTab] = useState("goodreads");
  const [bookNotes, setBookNotes] = useState(false),
    [screenNotes, setScreenNotes] = useState(false);
  const books = goodreadsExport(items, bookNotes),
    screen = critickerExport(items, screenNotes);
  function download(contents: string, name: string, format = "csv") {
    const url = URL.createObjectURL(
      new Blob([contents], {
        type: format === "json" ? "application/json" : "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `shelf-and-screen-${name}${demo ? "-sample" : ""}-${localToday()}.${format}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    onDownloaded(`${demo ? "Sample file" : "File"} downloaded`);
  }
  function issues(list: ExportIssue[]) {
    return (
      list.length > 0 && (
        <details className="export-issues">
          <summary>
            {list.length} {list.length === 1 ? "title needs" : "titles need"} attention
          </summary>
          <ul>
            {list.map(({ item, reason }) => (
              <li key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <p>{reason}</p>
                </div>
                <button
                  className="secondary"
                  aria-label={`Edit identifiers for ${item.title}`}
                  onClick={() => onEdit(item)}
                >
                  Edit
                </button>
              </li>
            ))}
          </ul>
        </details>
      )
    );
  }
  return (
    <div className="editor-body service-export">
      <p className="body-copy">
        Download a file, then upload it on the service’s import page. Your library here stays
        unchanged.
      </p>
      {demo && <p className="import-warning">You’re exporting the sample library.</p>}
      <div className="source-tabs" aria-label="Export destination">
        {[
          ["goodreads", "Goodreads"],
          ["criticker", "Criticker"],
          ["backup", "Backups"],
        ].map(([id, label]) => (
          <button
            key={id}
            aria-pressed={tab === id}
            className={tab === id ? "selected" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "goodreads" ? (
        <>
          <div className="export-intro">
            <span className="export-count">{books.count}</span>
            <div>
              <h3>Books ready for Goodreads</h3>
              <p>Of {books.total} books · ratings, shelves and reading dates</p>
            </div>
          </div>
          <div className="source-help">
            <strong>Quarter-star ratings for Goodreads.</strong>
            <p>
              Scores round to the nearest quarter star, with a minimum of 1 star. For example, 70 →
              3.5★, 85 → 4.25★ and 90 → 4.5★. Unrated stays unrated. Your exact 100-point scores
              stay here.
            </p>
            <p>Up next → to-read · In progress → currently-reading · Finished → read.</p>
            {books.adjustedShelves > 0 && (
              <p>
                On hold uses currently-reading + on-hold; Stopped uses to-read + did-not-finish.
                These extra tags preserve the distinction.
              </p>
            )}
          </div>
          {issues(books.issues)}
          {books.issues.length > 0 && (
            <p className="export-footnote">
              Books without an ISBN are left out of this CSV. They’re still in your hub and full
              backup.
            </p>
          )}
          <label className="export-notes">
            <input
              type="checkbox"
              checked={bookNotes}
              onChange={(event) => setBookNotes(event.target.checked)}
            />
            <span>
              Include my notes as reviews<small>Reviews may be public on Goodreads.</small>
            </span>
          </label>
          <p className="export-footnote">
            Goodreads may replace existing ratings when you import. Check its import results for
            unmatched books.
          </p>
          {books.files.length > 1 && (
            <p className="export-footnote">
              Split into {books.files.length} files, each with fewer than 500 books as Goodreads
              recommends. Upload each file separately.
            </p>
          )}
          {books.files.length ? (
            books.files.map((file, index) => (
              <button
                className="primary export-download"
                key={index}
                onClick={() =>
                  download(
                    file.csv,
                    `goodreads${books.files.length > 1 ? `-part-${index + 1}` : ""}`,
                  )
                }
              >
                <Download size={16} />
                Download Goodreads CSV{books.files.length > 1 ? ` · part ${index + 1}` : ""}
              </button>
            ))
          ) : (
            <button className="primary export-download" disabled>
              No books ready to export
            </button>
          )}
          <a
            className="export-import-link"
            href="https://www.goodreads.com/review/import"
            target="_blank"
            rel="noreferrer"
          >
            Open Goodreads Import/Export <ArrowUpRight size={14} />
          </a>
        </>
      ) : tab === "criticker" ? (
        <>
          <div className="export-intro">
            <span className="export-count">{screen.count}</span>
            <div>
              <h3>Ratings for Criticker</h3>
              <p>Movies and TV · exact 0–100 scores</p>
            </div>
          </div>
          <div className="source-help">
            <strong>Existing Criticker ratings are skipped.</strong>
            <p>This adds new ratings. To change a rating already on Criticker, edit it there.</p>
            <p>
              IMDb ID → rating → watched date (YYYY-MM-DD) → minireview. Season IDs are preserved,
              including _s2.
            </p>
          </div>
          {screen.unrated > 0 && (
            <p className="export-footnote">
              {screen.unrated} unrated {screen.unrated === 1 ? "title is" : "titles are"} left out.
              Criticker’s ratings importer doesn’t import your watchlist.
            </p>
          )}
          {issues(screen.issues)}
          <label className="export-notes">
            <input
              type="checkbox"
              checked={screenNotes}
              onChange={(event) => setScreenNotes(event.target.checked)}
            />
            <span>
              Include my notes as minireviews<small>Minireviews may be public on Criticker.</small>
            </span>
          </label>
          {screen.files.length > 1 && (
            <p className="export-footnote">
              Split into {screen.files.length} files to stay within Criticker’s 5,000-line limit.
              Upload each file separately.
            </p>
          )}
          {screen.files.length ? (
            screen.files.map((file, index) => (
              <button
                className="primary export-download"
                key={index}
                onClick={() =>
                  download(
                    file.csv,
                    `criticker${screen.files.length > 1 ? `-part-${index + 1}` : ""}`,
                  )
                }
              >
                <Download size={16} />
                Download Criticker CSV{screen.files.length > 1 ? ` · part ${index + 1}` : ""}
              </button>
            ))
          ) : (
            <button className="primary export-download" disabled>
              No ratings ready to export
            </button>
          )}
          <a
            className="export-import-link"
            href="https://www.criticker.com/import/"
            target="_blank"
            rel="noreferrer"
          >
            Open Criticker → Import from CSV <ArrowUpRight size={14} />
          </a>
        </>
      ) : (
        <>
          <p className="body-copy">
            Keep a copy of all {items.length} titles. These are Shelf & Screen backups; use the
            other tabs for service imports.
          </p>
          <button className="export-choice" onClick={() => download(exportCSV(items), "library")}>
            <Download size={20} />
            <span>
              <strong>Download library CSV</strong>
              <small>For spreadsheets · includes your exact scores and notes</small>
            </span>
          </button>
          <button
            className="export-choice"
            onClick={() => download(JSON.stringify(items, null, 2), "backup", "json")}
          >
            <Download size={20} />
            <span>
              <strong>Download full backup</strong>
              <small>JSON · every detail · restore from the import window</small>
            </span>
          </button>
        </>
      )}
    </div>
  );
}
