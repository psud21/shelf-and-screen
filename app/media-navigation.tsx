import { Cloud, HardDrive, LibraryBig, Link2 } from "lucide-react";
import type { MouseEvent } from "react";
import { useHub } from "./hub-context";
import "./connection-dialog.css";

const sections = [
  { id: "home", label: "Home", hash: "home" },
  { id: "book", label: "Books", hash: "books" },
  { id: "movie", label: "Movies", hash: "movies" },
  { id: "tv", label: "TV", hash: "tv" },
  { id: "queue", label: "Queue", hash: "queue" },
  { id: "all", label: "All titles", hash: "overview" },
];
const storageNames = { github: "GitHub", browser: "This browser", none: "Connect library" };
const storageIcons = { github: Cloud, browser: HardDrive, none: Link2 };

export default function MediaNavigation({
  current,
  onNavigate,
}: {
  current: string;
  onNavigate: (kind: string) => void;
}) {
  const { storage, openStorage } = useHub();
  const StorageIcon = storageIcons[storage];
  // Let the browser handle modified clicks (new tab, new window) on its own.
  const go = (id: string) => (event: MouseEvent) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    onNavigate(id);
  };
  return (
    <header className="bs-header">
      <div className="bs-header-inner">
        <a className="bs-brand" href="#home" onClick={go("home")}>
          <span className="brand-emblem" aria-hidden="true">
            <LibraryBig size={16} strokeWidth={1.5} />
          </span>
          <span className="brand-wordmark">
            Shelf <span>&</span> Screen
          </span>
        </a>
        <nav aria-label="Media sections">
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.hash}`}
              aria-current={section.id === current ? "page" : undefined}
              onClick={go(section.id)}
            >
              {section.label}
            </a>
          ))}
        </nav>
        <button
          type="button"
          className={`bs-storage ${storage === "none" ? "needs-setup" : ""}`}
          aria-label={`Library storage: ${storageNames[storage]}`}
          title="Where your library is kept"
          onClick={openStorage}
        >
          <StorageIcon size={14} />
          {storageNames[storage]}
        </button>
      </div>
    </header>
  );
}
