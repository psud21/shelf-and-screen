import { useEffect, useState, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, LoaderCircle, Pencil } from "lucide-react";
import { statusNames, type Media } from "../lib/media";
import { localToday } from "../lib/calendar-date.mjs";
import StoryDialog from "./story-dialog";
import "./movie-detail.css";

type Props = {
  externalBusy?: boolean;
  extras?: ReactNode | ((busy: boolean) => ReactNode);
  item: Media;
  poster: ReactNode;
  artwork: string;
  demo: boolean;
  onClose: () => void;
  onEdit: () => void;
  onSave: (item: Media) => Promise<Media>;
  onPrevious?: () => void;
  onNext?: () => void;
};

export default function MovieDetail(props: Props) {
  const { item } = props;
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const isTV = item.kind === "tv",
    locked = busy || !!props.externalBusy;
  useEffect(() => {
    setError("");
    setMessage("");
  }, [item.id]);
  async function markWatched() {
    setBusy(true);
    setError("");
    try {
      await props.onSave({
        ...item,
        status: "finished",
        completedAt: item.completedAt || localToday(),
      });
      setMessage(props.demo ? "Updated in this sample" : "Saved to your library");
    } catch (cause) {
      setError((cause as Error).message || "Unable to save. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <StoryDialog
      label={`${item.title} · ${isTV ? "TV show" : "movie"} details`}
      className="movie-detail-dialog"
      busy={locked}
      onClose={props.onClose}
    >
      <div className="film-hero">
        {props.artwork && (
          <img
            key={props.artwork}
            className="film-backdrop"
            src={props.artwork}
            alt=""
            aria-hidden="true"
            onError={(event) => {
              event.currentTarget.style.visibility = "hidden";
            }}
          />
        )}
        <div className="film-hero-content">
          <div className="film-poster" aria-hidden="true">
            {props.poster}
          </div>
          <div className="film-title">
            <span className="story-kicker">
              {isTV ? "FROM YOUR TV COLLECTION" : "FROM YOUR SCREEN COLLECTION"}
            </span>
            <h2>{item.title}</h2>
            <p className="story-meta">
              {[item.year, item.creator, item.genre].filter(Boolean).join(" · ") ||
                (isTV ? "Your TV collection" : "Your movie collection")}
            </p>
            <div className="film-rating-row">
              <span className={`story-score ${item.score === null ? "is-unrated" : ""}`}>
                {item.score === null ? (
                  "Not rated yet"
                ) : (
                  <>
                    {item.score}
                    <small>/100</small>
                  </>
                )}
              </span>
              <span className="story-status">
                {item.status === "finished" ? "Watched" : statusNames[item.status]}
              </span>
            </div>
            {item.platform && <p className="story-meta film-platform">{item.platform}</p>}
            <div className="film-actions">
              <button className="story-action is-primary" disabled={locked} onClick={props.onEdit}>
                <Pencil size={14} />
                Update rating & notes
              </button>
              {item.status !== "finished" && (
                <button className="story-action" disabled={locked} onClick={markWatched}>
                  {busy ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />}Mark
                  watched
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="film-body">
        <div className="story-note-label">YOUR NOTES</div>
        <p className="story-notes">
          {item.notes || "What stayed with you? Add a note or a reason to watch this next."}
        </p>
        {item.progress && <p className="film-progress">Last watched · {item.progress}</p>}
        {error && (
          <div className="story-error" role="alert">
            {error}
          </div>
        )}
        <p className="film-save-message" role="status" aria-live="polite">
          {message}
        </p>
        {typeof props.extras === "function" ? props.extras(locked) : props.extras}
        <footer className="film-footer">
          <button className="film-all-details" disabled={locked} onClick={props.onEdit}>
            Edit all details
          </button>
          <div>
            <button
              className="film-step"
              aria-label={isTV ? "Previous show" : "Previous movie"}
              disabled={!props.onPrevious || locked}
              onClick={props.onPrevious}
            >
              <ChevronLeft size={17} />
            </button>
            <span>{isTV ? "YOUR NEXT SHOW" : "YOUR NEXT FRAME"}</span>
            <button
              className="film-step"
              aria-label={isTV ? "Next show" : "Next movie"}
              disabled={!props.onNext || locked}
              onClick={props.onNext}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </footer>
      </div>
    </StoryDialog>
  );
}
