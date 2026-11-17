import { useState } from "react";
import { PenLine } from "lucide-react";
import type { Media } from "../lib/media";
import "./story-text.css";

/**
 * The words on a detail panel: what the title is about (with its source), then
 * your own notes. Nothing is shown in place of a missing summary, and missing
 * notes become one quiet invitation instead of placeholder text.
 */
export default function StoryText({
  item,
  disabled = false,
  onAddNote,
}: {
  item: Media;
  disabled?: boolean;
  onAddNote: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const long = (item.summary?.length ?? 0) > 420;
  return (
    <div className="story-text">
      {item.summary && (
        <section aria-label="About">
          <p className={`story-summary ${long && !expanded ? "is-clamped" : ""}`}>{item.summary}</p>
          <p className="story-credit">
            {long && (
              <button type="button" onClick={() => setExpanded(!expanded)}>
                {expanded ? "Show less" : "Read more"}
              </button>
            )}
            {item.summarySource &&
              (item.summaryUrl && /^https:\/\//i.test(item.summaryUrl) ? (
                <a href={item.summaryUrl} target="_blank" rel="noreferrer">
                  From {item.summarySource}
                </a>
              ) : (
                <span>From {item.summarySource}</span>
              ))}
          </p>
        </section>
      )}
      {item.notes ? (
        <section aria-label="Your notes" className="story-own-notes">
          <div className="story-note-label">Your notes</div>
          <p className="story-notes">{item.notes}</p>
        </section>
      ) : (
        <button type="button" className="story-add-note" disabled={disabled} onClick={onAddNote}>
          <PenLine size={14} />
          Add your notes
        </button>
      )}
    </div>
  );
}
