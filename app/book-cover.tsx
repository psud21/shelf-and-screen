import { useState } from "react";
import { type Media } from "../lib/media";
import { spineAppearance } from "../lib/bookshelf.mjs";
import { bookCoverCandidates } from "../lib/book-covers.mjs";
import GeneratedCover from "./generated-cover";

export default function BookCover({ book }: { book: Media }) {
  const [failed, setFailed] = useState<string[]>([]);
  const url = bookCoverCandidates(book).find((candidate) => !failed.includes(candidate));
  const art = spineAppearance(book);
  const reject = () => {
    if (url) setFailed((previous) => (previous.includes(url) ? previous : [...previous, url]));
  };
  return (
    <div className="bs-cover" style={{ background: art.color, color: art.ink }}>
      {url ? (
        <img
          key={url}
          src={url}
          alt={`${book.title} cover`}
          loading="lazy"
          decoding="async"
          onError={reject}
          onLoad={(event) => {
            if (event.currentTarget.naturalWidth < 40 || event.currentTarget.naturalHeight < 60)
              reject();
          }}
        />
      ) : (
        <GeneratedCover item={book} />
      )}
    </div>
  );
}
