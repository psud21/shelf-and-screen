import {
  BookOpen,
  Clapperboard,
  Cloud,
  HardDrive,
  House,
  LibraryBig,
  Link2,
  ListOrdered,
  Rows3,
  Tv,
} from "lucide-react";
import type { MouseEvent } from "react";
import { useHub } from "./hub-context";
import "./connection-dialog.css";

const sections = [
  { id: "home", label: "Home", short: "Home", hash: "home", Icon: House },
  { id: "book", label: "Books", short: "Books", hash: "books", Icon: BookOpen },
  { id: "movie", label: "Movies", short: "Movies", hash: "movies", Icon: Clapperboard },
  { id: "tv", label: "TV", short: "TV", hash: "tv", Icon: Tv },
  { id: "queue", label: "Queue", short: "Queue", hash: "queue", Icon: ListOrdered },
  { id: "all", label: "All titles", short: "All", hash: "overview", Icon: Rows3 },
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
        <nav className="bs-topnav" aria-label="Media sections">
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
      {/* On phones the sections move to a tab bar along the bottom edge. */}
      <nav className="bs-tabbar" aria-label="Sections">
        {sections.map(({ id, short, hash, Icon }) => (
          <a
            key={id}
            href={`#${hash}`}
            aria-current={id === current ? "page" : undefined}
            onClick={go(id)}
          >
            <Icon size={19} strokeWidth={1.6} />
            <span>{short}</span>
          </a>
        ))}
      </nav>
    </header>
  );
}
