import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { blankMedia, sameMedia, type Media } from "../lib/media";
import { importItems, removeItem as removeFrom, saveItem as saveInto } from "../lib/library";
import {
  createStore,
  deviceStorage,
  readCache,
  readConnection,
  writeConnection,
  type Connection,
} from "../lib/storage";
import { demoItems } from "../lib/demo";
import { localToday } from "../lib/calendar-date.mjs";
import Bookshelf from "./bookshelf";
import ConnectionDialog from "./connection-dialog";
import ExportPanel from "./export-panel";
import { HubContext } from "./hub-context";
import ImportDialog from "./import-dialog";
import MediaEditor from "./media-editor";
import Modal from "./modal";
import MovieGallery from "./movie-gallery";
import Overview from "./overview";
import Queue from "./queue";
import Home from "./home";
import TVGallery from "./tv-gallery";
import "./collection.css";

type View = "all" | "planned" | "progress" | "finished" | "paused" | "kindle";
type Editing = { item: Media; session: number; identifier: boolean; recommendation: boolean };

const STARTED_KEY = "shelf-screen-started";
const sectionForHash: Record<string, string> = {
  "#home": "home",
  "#overview": "all",
  "#books": "book",
  "#movies": "movie",
  "#tv": "tv",
  "#queue": "queue",
};
const hashForSection: Record<string, string> = {
  home: "home",
  all: "overview",
  book: "books",
  movie: "movies",
  tv: "tv",
  queue: "queue",
};

export default function Hub() {
  const storage = useMemo(deviceStorage, []);
  const [connection, setConnection] = useState<Connection | null>(() => readConnection(storage));
  const store = useMemo(
    () => (connection ? createStore(connection, storage) : null),
    [connection, storage],
  );
  const [real, setReal] = useState<Media[]>([]),
    [samples, setSamples] = useState(demoItems),
    [demo, setDemo] = useState(true),
    [loading, setLoading] = useState(!!connection),
    [loadError, setLoadError] = useState("");
  const [view, setView] = useState<View>("all"),
    [kind, setKind] = useState("home"),
    [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Editing | null>(null),
    [busy, setBusy] = useState(false),
    [formError, setFormError] = useState("");
  const [importOpen, setImportOpen] = useState(false),
    [exportOpen, setExportOpen] = useState(false),
    [storageOpen, setStorageOpen] = useState(false),
    [toast, setToast] = useState("");
  const items = demo ? samples : real;
  const connected = !!connection;
  const loadRun = useRef(0);
  const editSession = useRef(0);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  async function load() {
    const run = ++loadRun.current;
    if (!store) {
      setReal([]);
      setDemo(true);
      setLoadError("");
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    try {
      const loaded = await store.load();
      if (run !== loadRun.current) return;
      setReal(loaded);
      setDemo(loaded.length === 0 && storage.getItem(STARTED_KEY) !== "1");
    } catch (cause) {
      if (run !== loadRun.current) return;
      const message = (cause as Error).message || "Unable to load your library.";
      // Keep the library readable from the copy saved on this device.
      const cached = connection?.mode === "github" ? readCache(storage) : null;
      if (cached) {
        setReal(cached);
        setDemo(false);
        setLoadError(
          `${message} Showing the copy saved on this device; changes are paused until it reloads.`,
        );
      } else setLoadError(message);
    } finally {
      if (run === loadRun.current) setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // Reload only when the place the library is kept changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  useEffect(() => {
    const readSection = () => {
      setKind(sectionForHash[window.location.hash] || "home");
      setView("all");
      setQuery("");
    };
    readSection();
    window.addEventListener("hashchange", readSection);
    window.addEventListener("popstate", readSection);
    return () => {
      window.removeEventListener("hashchange", readSection);
      window.removeEventListener("popstate", readSection);
    };
  }, []);

  function navigateSection(next: string) {
    setKind(next);
    setView("all");
    setQuery("");
    const hash = `#${hashForSection[next] || "home"}`;
    if (window.location.hash !== hash) window.history.pushState(null, "", hash);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function openEditor(item?: Media, identifier = false, recommendation = false) {
    setFormError("");
    setEditing({
      item: item ? { ...item } : blankMedia(),
      session: ++editSession.current,
      identifier,
      recommendation,
    });
  }

  /** Save one title to wherever the open library is kept, and return the stored copy. */
  async function persistItem(item: Media): Promise<Media> {
    if (demo) {
      if (samples.some((sample) => sample.id !== item.id && sameMedia(sample, item)))
        throw new Error("This title already exists in the sample library.");
      setSamples((previous) =>
        previous.some((sample) => sample.id === item.id)
          ? previous.map((sample) => (sample.id === item.id ? item : sample))
          : [item, ...previous],
      );
      return item;
    }
    if (!store) throw new Error("Connect your library before making changes.");
    if (loadError) throw new Error("Reload your library before making changes.");
    const saved = await store.update((list) => saveInto(list, item), `Save “${item.title}”`);
    setReal(saved);
    const stored = saved.find((entry) => entry.id === item.id);
    if (!stored) throw new Error("Saved entry could not be found. Please reload your library.");
    return stored;
  }

  async function saveFromEditor(draft: Media) {
    const before = items.find((item) => item.id === draft.id);
    // Finishing a title stamps today's date unless one was entered.
    const item =
      draft.status === "finished" && before?.status !== "finished"
        ? { ...draft, completedAt: draft.completedAt || localToday() }
        : draft;
    setBusy(true);
    setFormError("");
    try {
      await persistItem(item);
      setEditing(null);
      setToast(demo ? "Updated in the sample library" : "Saved to your library");
    } catch (cause) {
      setFormError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeEdited() {
    if (!editing) return;
    const { id, title } = editing.item;
    setBusy(true);
    try {
      if (demo) setSamples((previous) => previous.filter((sample) => sample.id !== id));
      else {
        if (!store || loadError) throw new Error("Reload your library before making changes.");
        setReal(await store.update((list) => removeFrom(list, id), `Remove “${title}”`));
      }
      setEditing(null);
      setToast("Title removed");
    } catch (cause) {
      setFormError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function importTitles(incoming: Media[]) {
    if (demo) {
      setSamples((previous) => [...previous, ...incoming]);
      setToast(`${incoming.length} titles added to the sample library`);
      return;
    }
    if (!store || loadError) throw new Error("Reload your library before importing.");
    let added = 0;
    const saved = await store.update(
      (list) => {
        const result = importItems(list, incoming);
        added = result.added;
        return result.items;
      },
      `Import ${incoming.length} ${incoming.length === 1 ? "title" : "titles"}`,
    );
    setReal(saved);
    setToast(`${added} ${added === 1 ? "title" : "titles"} imported to your library`);
  }

  function startLibrary() {
    storage.setItem(STARTED_KEY, "1");
    setDemo(false);
    navigateSection("home");
    setToast("Your library is ready. Add a title or import a list.");
  }

  function connectTo(next: Connection, loaded: Media[]) {
    writeConnection(storage, next);
    storage.setItem(STARTED_KEY, "1");
    setConnection(next);
    setReal(loaded);
    setDemo(false);
    setStorageOpen(false);
    setToast(
      loaded.length
        ? `Library connected · ${loaded.length} ${loaded.length === 1 ? "title" : "titles"}`
        : "Library connected. Add a title or import a list.",
    );
  }

  function disconnect() {
    writeConnection(storage, null);
    setConnection(null);
    setStorageOpen(false);
    setToast("Disconnected. Your saved library was not changed.");
  }

  const hub = useMemo(
    () => ({
      storage: connection?.mode ?? ("none" as const),
      openStorage: () => setStorageOpen(true),
    }),
    [connection],
  );
  const shared = {
    loading,
    error: loadError,
    demo,
    connected,
    onNavigate: navigateSection,
    onExport: () => setExportOpen(true),
    onStart: startLibrary,
    onRetry: load,
  };
  const openImport = () => setImportOpen(true);

  return (
    <HubContext.Provider value={hub}>
      <div className="app-shell bookshelf-mode">
        {kind === "home" ? (
          <Home
            {...shared}
            items={items}
            onEdit={openEditor}
            onSave={persistItem}
            onImport={openImport}
            onSample={() => setDemo(true)}
          />
        ) : kind === "queue" ? (
          <Queue
            {...shared}
            items={items}
            onEdit={(item) => openEditor(item, false, true)}
            onSave={persistItem}
            onNotice={setToast}
          />
        ) : kind === "book" ? (
          <Bookshelf
            {...shared}
            books={items.filter((item) => item.kind === "book")}
            query={query}
            shelf={view}
            onQuery={setQuery}
            onShelf={setView}
            onEdit={openEditor}
            onImport={openImport}
            onSample={() => setDemo(true)}
          />
        ) : kind === "movie" ? (
          <MovieGallery
            {...shared}
            items={items}
            onEdit={openEditor}
            onSave={persistItem}
            onImport={openImport}
          />
        ) : kind === "tv" ? (
          <TVGallery
            {...shared}
            items={items}
            onEdit={openEditor}
            onSave={persistItem}
            onImport={openImport}
          />
        ) : (
          <Overview
            {...shared}
            items={items}
            onEdit={openEditor}
            onImport={openImport}
            onSample={() => setDemo(true)}
          />
        )}
        {editing && (
          <MediaEditor
            key={editing.session}
            initial={editing.item}
            focusIdentifier={editing.identifier}
            focusRecommendation={editing.recommendation}
            existing={items.some((item) => item.id === editing.item.id)}
            demo={demo}
            busy={busy}
            error={formError}
            onClose={() => {
              if (!busy) setEditing(null);
            }}
            onRemove={removeEdited}
            onSave={saveFromEditor}
          />
        )}
        {importOpen && (
          <ImportDialog
            onStartLibrary={startLibrary}
            demo={demo}
            connected={connected}
            existing={items}
            onClose={() => setImportOpen(false)}
            onImport={importTitles}
          />
        )}
        {exportOpen && (
          <Modal title="Export your collection" onClose={() => setExportOpen(false)}>
            <ExportPanel
              items={items}
              demo={demo}
              onDownloaded={setToast}
              onEdit={(item) => {
                setExportOpen(false);
                openEditor(item, true);
              }}
            />
          </Modal>
        )}
        {storageOpen && (
          <ConnectionDialog
            current={connection}
            onClose={() => setStorageOpen(false)}
            onConnected={connectTo}
            onDisconnect={disconnect}
          />
        )}
        {toast && (
          <div className="toast" role="status">
            <CheckCircle2 size={17} />
            {toast}
          </div>
        )}
      </div>
    </HubContext.Provider>
  );
}
