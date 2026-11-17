import { parseLibrary, serializeLibrary } from "./library.ts";
import type { Media } from "./media.ts";

// Where the library lives. Two places are supported: a JSON file in a GitHub
// repository (shared by every device that has the access token), or this browser.

export type GitHubSettings = { owner: string; repo: string; path: string; token: string };
export type Connection = { mode: "github"; github: GitHubSettings } | { mode: "browser" };

export type Change = (items: Media[]) => Media[];
export interface LibraryStore {
  /** Read the current library from where it is stored. */
  load(): Promise<Media[]>;
  /** Apply one change to the latest stored library and save it. Returns the saved list. */
  update(change: Change, summary: string): Promise<Media[]>;
}

/** The parts of the browser's storage this module uses; a plain object works in tests. */
export type KeyValue = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

const CONNECTION_KEY = "shelf-screen-connection";
const BROWSER_LIBRARY_KEY = "shelf-screen-library";
const CACHE_KEY = "shelf-screen-cache";

/** The browser's own storage, or a stand-in that lasts for this visit when it is blocked. */
export function deviceStorage(): KeyValue {
  try {
    const storage = globalThis.localStorage;
    storage.getItem(CONNECTION_KEY);
    return storage;
  } catch {
    const data = new Map<string, string>();
    return {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => void data.set(key, String(value)),
      removeItem: (key) => void data.delete(key),
    };
  }
}

/* ---------- remembered connection ---------- */

export function readConnection(storage: KeyValue): Connection | null {
  try {
    const raw = JSON.parse(storage.getItem(CONNECTION_KEY) || "null") as Connection | null;
    if (raw?.mode === "browser") return { mode: "browser" };
    if (raw?.mode === "github") {
      const { owner, repo, path, token } = raw.github ?? ({} as GitHubSettings);
      if ([owner, repo, path, token].every((value) => typeof value === "string" && value))
        return { mode: "github", github: { owner, repo, path, token } };
    }
  } catch {
    // Unreadable settings are treated as "not connected".
  }
  return null;
}

export function writeConnection(storage: KeyValue, connection: Connection | null) {
  if (connection) storage.setItem(CONNECTION_KEY, JSON.stringify(connection));
  else {
    storage.removeItem(CONNECTION_KEY);
    storage.removeItem(CACHE_KEY);
  }
}

/** Tidy what someone typed or pasted into the connection form. */
export function cleanGitHubSettings(input: GitHubSettings): GitHubSettings {
  let owner = input.owner.trim();
  let repo = input.repo.trim();
  // Accept a pasted repository link or "owner/name" in either field.
  const pasted = /^(?:https?:\/\/github\.com\/)?([^/\s]+)\/([^/\s#?]+?)(?:\.git)?\/?$/i.exec(
    repo.includes("/") ? repo : owner,
  );
  if (pasted) [, owner, repo] = pasted;
  const path = input.path.trim().replace(/^\/+/, "") || "library.json";
  return { owner, repo, path, token: input.token.trim() };
}

/* ---------- last known copy, for when GitHub cannot be reached ---------- */

export function readCache(storage: KeyValue): Media[] | null {
  try {
    const text = storage.getItem(CACHE_KEY);
    return text ? parseLibrary(text) : null;
  } catch {
    return null;
  }
}

function writeCache(storage: KeyValue | undefined, items: Media[]) {
  try {
    storage?.setItem(CACHE_KEY, JSON.stringify(items));
  } catch {
    // A full or unavailable browser store only costs the offline copy.
  }
}

/* ---------- this browser ---------- */

export function createBrowserStore(storage: KeyValue): LibraryStore {
  const read = () => parseLibrary(storage.getItem(BROWSER_LIBRARY_KEY) || "");
  return {
    async load() {
      return read();
    },
    async update(change) {
      const next = change(read());
      try {
        storage.setItem(BROWSER_LIBRARY_KEY, JSON.stringify(next));
      } catch {
        throw new Error(
          "This browser's storage is full or unavailable, so the change was not saved.",
        );
      }
      return next;
    },
  };
}

/* ---------- a file in a GitHub repository ---------- */

export class StorageError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "StorageError";
    this.status = status;
  }
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

function fromBase64(base64: string): string {
  const binary = atob(base64.replace(/\s/g, ""));
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

export function createGitHubStore(
  settings: GitHubSettings,
  options: { fetch?: Fetch; cache?: KeyValue } = {},
): LibraryStore {
  const request: Fetch = options.fetch ?? ((url, init) => fetch(url, init));
  const repoUrl = `https://api.github.com/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}`;
  const fileUrl = `${repoUrl}/contents/${settings.path.split("/").map(encodeURIComponent).join("/")}`;
  const where = `${settings.owner}/${settings.repo}`;

  // What this device last saw: the file's version id (null = no file yet) and contents.
  let known: { sha: string | null; items: Media[] } | null = null;
  // Saves run one at a time, because each one needs the version id the last one produced.
  let queue: Promise<unknown> = Promise.resolve();

  async function call(url: string, init: RequestInit = {}): Promise<Response> {
    let response: Response;
    try {
      response = await request(url, {
        ...init,
        cache: "no-store",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${settings.token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          ...(init.body ? { "Content-Type": "application/json" } : {}),
        },
      });
    } catch {
      throw new StorageError("GitHub could not be reached. Check your connection and try again.");
    }
    if (response.status === 401)
      throw new StorageError(
        "GitHub did not accept the access token. It may have expired or been revoked; create a new one and reconnect.",
        401,
      );
    if (response.status === 403 || response.status === 429) {
      const limited = response.headers.get("x-ratelimit-remaining") === "0";
      throw new StorageError(
        limited
          ? "GitHub is limiting requests right now. Wait a few minutes and try again."
          : `The access token is not allowed to do this in ${where}. It needs “Contents: Read and write” for that repository.`,
        response.status,
      );
    }
    return response;
  }

  async function fetchLatest(): Promise<{ sha: string | null; items: Media[] }> {
    const response = await call(fileUrl);
    if (response.status === 404) {
      // GitHub answers 404 both for a missing file and for a repository the token
      // cannot see, so ask about the repository to tell the two apart.
      const repository = await call(repoUrl);
      if (!repository.ok)
        throw new StorageError(
          `The repository ${where} was not found, or the access token cannot see it.`,
          404,
        );
      return { sha: null, items: [] };
    }
    if (!response.ok)
      throw new StorageError(
        `GitHub could not open the library file (error ${response.status}).`,
        response.status,
      );
    const file = (await response.json()) as {
      sha?: string;
      content?: string;
      encoding?: string;
      type?: string;
    };
    if (Array.isArray(file) || file.type !== "file" || !file.sha)
      throw new StorageError(`“${settings.path}” in ${where} is not a file.`);
    let encoded = file.encoding === "base64" ? file.content || "" : "";
    if (!encoded.trim()) {
      // Files over 1 MB come back without contents; fetch them by version id instead.
      const blob = await call(`${repoUrl}/git/blobs/${file.sha}`);
      if (!blob.ok)
        throw new StorageError(
          `GitHub could not open the library file (error ${blob.status}).`,
          blob.status,
        );
      encoded = ((await blob.json()) as { content?: string }).content || "";
    }
    return { sha: file.sha, items: parseLibrary(fromBase64(encoded)) };
  }

  async function write(
    items: Media[],
    sha: string | null,
    summary: string,
  ): Promise<string | "stale"> {
    const response = await call(fileUrl, {
      method: "PUT",
      body: JSON.stringify({
        message: summary,
        content: toBase64(serializeLibrary(items)),
        ...(sha ? { sha } : {}),
      }),
    });
    // The file changed since this device last read it (another device saved first).
    if (response.status === 409 || response.status === 422) return "stale";
    if (response.status === 404)
      throw new StorageError(
        `The access token cannot save to ${where}. It needs “Contents: Read and write” for that repository.`,
        404,
      );
    if (!response.ok)
      throw new StorageError(
        `GitHub could not save the library (error ${response.status}).`,
        response.status,
      );
    const saved = (await response.json()) as { content?: { sha?: string } };
    if (!saved.content?.sha)
      throw new StorageError("GitHub saved the library but returned an unexpected reply.");
    return saved.content.sha;
  }

  function remember(state: { sha: string | null; items: Media[] }) {
    known = state;
    writeCache(options.cache, state.items);
    return state.items;
  }

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = queue.then(task, task);
    queue = result.catch(() => undefined);
    return result;
  }

  return {
    load: () => enqueue(async () => remember(await fetchLatest())),
    update: (change, summary) =>
      enqueue(async () => {
        let base = known ?? (await fetchLatest());
        for (let attempt = 0; attempt < 4; attempt++) {
          const next = change(base.items);
          // Nothing to record (for example, an import where every title was already there).
          if (base.sha && serializeLibrary(next) === serializeLibrary(base.items))
            return remember(base);
          const sha = await write(next, base.sha, summary);
          if (sha !== "stale") return remember({ sha, items: next });
          // Start again from the newer version, so the other device's changes are kept.
          const latest = await fetchLatest();
          if (latest.sha === base.sha)
            throw new StorageError("GitHub would not accept this save. Please try again.");
          base = known = latest;
        }
        throw new StorageError(
          "Your library kept changing on another device while saving. Please try again.",
        );
      }),
  };
}

export function createStore(
  connection: Connection,
  storage: KeyValue,
  fetchImpl?: Fetch,
): LibraryStore {
  return connection.mode === "github"
    ? createGitHubStore(connection.github, { fetch: fetchImpl, cache: storage })
    : createBrowserStore(storage);
}
