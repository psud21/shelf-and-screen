import "./placeholders.css";

// Grey outlines of each screen, shown while the library loads, so the page
// keeps its shape instead of jumping when the titles arrive.

const range = (count: number) => Array.from({ length: count }, (_, index) => index);

export function PosterPlaceholders({ count = 14 }: { count?: number }) {
  return (
    <>
      {range(count).map((index) => (
        <span key={index} className="placeholder-card" aria-hidden="true">
          <span className="placeholder placeholder-poster" />
          <span className="placeholder placeholder-line" />
          <span className="placeholder placeholder-line is-short" />
        </span>
      ))}
      <span className="sr-only" role="status">
        Loading your collection…
      </span>
    </>
  );
}

export function ShelfPlaceholder() {
  // A fixed, natural-looking run of spine heights and widths.
  const spines = [190, 230, 205, 250, 180, 215, 240, 200, 225, 185, 260, 210, 195, 235, 220, 205];
  return (
    <div className="placeholder-shelf" aria-hidden="true">
      {spines.map((height, index) => (
        <span
          key={index}
          className="placeholder placeholder-spine"
          style={{ height, width: 34 + ((index * 7) % 14) }}
        />
      ))}
    </div>
  );
}

export function RowPlaceholders({
  count = 6,
  variant,
}: {
  count?: number;
  variant: "table" | "queue";
}) {
  return (
    <div className={`placeholder-rows is-${variant}`} aria-hidden="true">
      {range(count).map((index) => (
        <div key={index} className="placeholder-row">
          <span className="placeholder placeholder-thumb" />
          <span className="placeholder-row-copy">
            <span className="placeholder placeholder-line" />
            <span className="placeholder placeholder-line is-short" />
          </span>
          <span className="placeholder placeholder-chip" />
        </div>
      ))}
    </div>
  );
}

export function HomePlaceholder() {
  return (
    <div aria-hidden="true">
      <span className="placeholder placeholder-heading" />
      <div className="placeholder-now">
        {range(3).map((index) => (
          <div key={index} className="placeholder-now-card">
            <span className="placeholder placeholder-cover" />
            <span className="placeholder-row-copy">
              <span className="placeholder placeholder-line is-short" />
              <span className="placeholder placeholder-line" />
              <span className="placeholder placeholder-line is-short" />
            </span>
          </div>
        ))}
      </div>
      <span className="placeholder placeholder-heading" />
      <div className="placeholder-strip">
        <PosterPlaceholders count={8} />
      </div>
    </div>
  );
}
