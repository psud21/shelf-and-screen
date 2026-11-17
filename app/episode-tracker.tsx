import { useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, LoaderCircle, Plus, Settings2, Tv } from "lucide-react";
import { blankMedia, type Media } from "../lib/media";
import { episodeSummary, toggleEpisode, withEpisodeTracker } from "../lib/episodes.mjs";
import { nextSeasonNumber, splitTVTitle, type TVGroup } from "../lib/tv-guide.mjs";
import StoryDialog from "./story-dialog";
import "./episode-tracker.css";

type Setup = {
  id: string | null;
  season: string;
  total: string;
  already: string;
  allWatched: boolean;
};
type Props = {
  onBusyChange?: (busy: boolean) => void;
  group: TVGroup;
  item: Media;
  disabled: boolean;
  demo: boolean;
  onSave: (item: Media) => Promise<Media>;
  onSelect: (id: string) => void;
};
export default function EpisodeTracker(props: Props) {
  const { group, item } = props;
  const target =
    splitTVTitle(item.title).number !== null || item.episodeTracker
      ? item
      : (
          group.seasons.find(
            (season) => season.item.episodeTracker && season.item.status === "progress",
          ) ||
          [...group.seasons].reverse().find((season) => season.item.episodeTracker) ||
          group.seasons.at(-1)
        )?.item;
  const tracker = target?.episodeTracker,
    summary = target ? episodeSummary(target) : null;
  const [setup, setSetup] = useState<Setup | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [page, setPage] = useState(0);
  useEffect(() => {
    setPage(0);
    setError("");
    setMessage("");
  }, [target?.id]);
  const totalPages = Math.max(1, Math.ceil((tracker?.total || 0) / 24)),
    currentPage = Math.min(page, totalPages - 1);
  function configure(existing?: Media) {
    setError("");
    setSetup({
      id: existing?.id || null,
      season: String(
        existing?.episodeTracker?.season ||
          splitTVTitle(existing?.title || "").number ||
          nextSeasonNumber(group),
      ),
      total: existing?.episodeTracker ? String(existing.episodeTracker.total) : "",
      already: "0",
      allWatched: existing?.status === "finished",
    });
  }
  async function save(next: Media) {
    setPending(true);
    props.onBusyChange?.(true);
    setError("");
    try {
      const saved = await props.onSave(next);
      props.onSelect(saved.id);
      setMessage(props.demo ? "Updated in the sample" : "Progress saved");
      return saved;
    } catch (e) {
      setError((e as Error).message || "Could not save your progress. Try again.");
      return null;
    } finally {
      setPending(false);
      props.onBusyChange?.(false);
    }
  }
  async function saveSetup() {
    if (!setup) return;
    const season = Number(setup.season),
      total = Number(setup.total),
      already = Number(setup.already);
    if (
      !Number.isInteger(season) ||
      season < 1 ||
      season > 1000 ||
      !Number.isInteger(total) ||
      total < 1 ||
      total > 1000
    ) {
      setError("Enter a season and an episode total between 1 and 1,000.");
      return;
    }
    if (!setup.id && group.seasons.some((entry) => entry.number === season)) {
      setError(`Season ${season} is already in your guide. Select it to configure its episodes.`);
      return;
    }
    const existing = group.entries.find((entry) => entry.id === setup.id);
    if (
      !existing?.episodeTracker &&
      !setup.allWatched &&
      (!Number.isInteger(already) || already < 0 || already > total)
    ) {
      setError("Episodes already watched must be between zero and the total.");
      return;
    }
    const base = existing || {
      ...blankMedia(),
      kind: "tv" as const,
      title: `${group.title} - Season ${season}`,
      sourceId: group.sourceId ? `${group.sourceId}_s${season}` : undefined,
    };
    const watched = base.episodeTracker
      ? base.episodeTracker.watched.filter((number) => number <= total)
      : Array.from(
          { length: setup.allWatched ? total : Math.max(0, Math.min(total, already)) },
          (_, index) => index + 1,
        );
    const saved = await save(withEpisodeTracker(base, { season, total, watched }));
    if (saved) setSetup(null);
  }
  return (
    <section className="episode-panel" aria-label={`Episode tracker for ${group.title}`}>
      <div className="episode-heading">
        <div>
          <span className="episode-kicker">ONE EPISODE AT A TIME</span>
          <h3>
            <Tv size={16} />
            Episode tracker
          </h3>
        </div>
        <div className="episode-heading-actions">
          {target && group.seasons.length > 1 && (
            <select
              aria-label="Tracked season"
              value={target.id}
              disabled={pending || props.disabled}
              onChange={(event) => props.onSelect(event.target.value)}
            >
              {group.seasons.map((season) => (
                <option value={season.item.id} key={season.item.id}>
                  Season {season.number}
                </option>
              ))}
            </select>
          )}
          {tracker && (
            <button
              className="episode-icon"
              aria-label="Configure episode total"
              title="Configure episode total"
              disabled={pending || props.disabled}
              onClick={() => configure(target)}
            >
              <Settings2 size={15} />
            </button>
          )}
          <button
            className="episode-add"
            disabled={pending || props.disabled}
            onClick={() => configure()}
          >
            <Plus size={13} />
            Track another season
          </button>
        </div>
      </div>
      {tracker && summary && target ? (
        <>
          <div className="episode-summary">
            <strong>
              Season {tracker.season}{" "}
              <span>
                {summary.count} / {summary.total} watched
              </span>
            </strong>
            <span>
              {summary.complete
                ? "Season complete"
                : summary.next
                  ? `Next unwatched · Episode ${summary.next}`
                  : ""}
            </span>
          </div>
          <div
            className="episode-progress"
            role="progressbar"
            aria-label={`Season ${tracker.season} viewing progress`}
            aria-valuemin={0}
            aria-valuemax={summary.total}
            aria-valuenow={summary.count}
          >
            <span style={{ width: `${summary.percent}%` }} />
          </div>
          <div
            className="episode-markers"
            role="group"
            aria-label={`Season ${tracker.season} episodes`}
          >
            {Array.from({ length: Math.min(24, tracker.total - currentPage * 24) }, (_, index) => {
              const number = currentPage * 24 + index + 1,
                watched = tracker.watched.includes(number);
              return (
                <button
                  key={number}
                  className={`episode-marker ${watched ? "is-watched" : ""}`}
                  aria-pressed={watched}
                  aria-label={`Mark episode ${number} ${watched ? "unwatched" : "watched"}`}
                  disabled={pending || props.disabled}
                  onClick={() => save(toggleEpisode(target, number))}
                >
                  {watched && <Check size={11} />}
                  <span>{number}</span>
                </button>
              );
            })}
          </div>
          <div className="episode-bottom">
            <span>Tick an episode to save your place.</span>
            {totalPages > 1 && (
              <div className="episode-pages">
                <button
                  aria-label="Previous episodes"
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <ChevronLeft size={14} />
                </button>
                <span>
                  {currentPage * 24 + 1}–{Math.min(tracker.total, (currentPage + 1) * 24)} of{" "}
                  {tracker.total}
                </span>
                <button
                  aria-label="Next episodes"
                  disabled={currentPage + 1 >= totalPages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="episode-unconfigured">
          <p>
            {target
              ? `Add the episode count for Season ${splitTVTitle(target.title).number || 1}, then tick off each episode as you watch.`
              : "Choose a season and its episode count to start keeping your place."}
          </p>
          <button
            className="bs-edit"
            disabled={pending || props.disabled}
            onClick={() => configure(target)}
          >
            Set up episode tracking
          </button>
        </div>
      )}
      <div className="episode-feedback" role="status" aria-live="polite">
        {pending ? (
          <>
            <LoaderCircle size={12} className="spin" />
            Saving progress…
          </>
        ) : (
          message
        )}
      </div>
      {error && !setup && (
        <div className="story-error" role="alert">
          {error}
        </div>
      )}
      {setup && (
        <StoryDialog
          label="Set up episode tracking"
          className="episode-setup-dialog"
          busy={pending}
          onClose={() => {
            setSetup(null);
            setError("");
          }}
        >
          <form
            className="episode-setup-form"
            onSubmit={(event) => {
              event.preventDefault();
              saveSetup();
            }}
          >
            <span className="story-kicker">YOUR NEXT EPISODE</span>
            <h2>{group.title}</h2>
            <p className="story-meta">
              Enter this season’s episode count. Each mark is saved to your library.
            </p>
            <div className="episode-setup-fields">
              <label>
                Season
                <input
                  aria-label="Episode tracker season"
                  required
                  type="number"
                  min={1}
                  max={1000}
                  step={1}
                  disabled={pending || !!setup.id}
                  value={setup.season}
                  onChange={(event) => setSetup({ ...setup, season: event.target.value })}
                />
              </label>
              <label>
                Number of episodes
                <input
                  aria-label="Number of episodes"
                  required
                  autoFocus
                  type="number"
                  min={1}
                  max={1000}
                  step={1}
                  disabled={pending}
                  value={setup.total}
                  placeholder="Enter total"
                  onChange={(event) => setSetup({ ...setup, total: event.target.value })}
                />
              </label>
            </div>
            {!group.entries.find((entry) => entry.id === setup.id)?.episodeTracker ? (
              <>
                <label className="episode-setup-check">
                  <input
                    type="checkbox"
                    checked={setup.allWatched}
                    disabled={pending}
                    onChange={(event) => setSetup({ ...setup, allWatched: event.target.checked })}
                  />
                  I’ve finished this season
                </label>
                {!setup.allWatched && (
                  <label>
                    Episodes already watched
                    <input
                      aria-label="Episodes already watched"
                      type="number"
                      min={0}
                      max={Number(setup.total) || 1000}
                      step={1}
                      value={setup.already}
                      disabled={pending}
                      onChange={(event) => setSetup({ ...setup, already: event.target.value })}
                    />
                    <small>Marks episodes 1 through this number as watched.</small>
                  </label>
                )}
              </>
            ) : (
              <p className="story-meta">
                Existing marks within the new episode total will be kept.
              </p>
            )}
            {error && (
              <div className="story-error" role="alert">
                {error}
              </div>
            )}
            <div className="episode-setup-actions">
              <button
                type="button"
                className="story-action"
                disabled={pending}
                onClick={() => {
                  setSetup(null);
                  setError("");
                }}
              >
                Cancel
              </button>
              <button className="story-action is-primary" disabled={pending}>
                {pending ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />}Save
                tracker
              </button>
            </div>
          </form>
        </StoryDialog>
      )}
    </section>
  );
}
