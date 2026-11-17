import { useState } from "react";
import { ArrowUpRight, Cloud, HardDrive, LoaderCircle } from "lucide-react";
import type { Media } from "../lib/media";
import {
  cleanGitHubSettings,
  createStore,
  type Connection,
  type GitHubSettings,
} from "../lib/storage";
import Modal from "./modal";
import "./connection-dialog.css";

type Props = {
  current: Connection | null;
  onClose: () => void;
  /** Called once the chosen place has been opened successfully. */
  onConnected: (connection: Connection, items: Media[]) => void;
  onDisconnect: () => void;
};

const tokenPage = "https://github.com/settings/personal-access-tokens/new";

export default function ConnectionDialog({ current, onClose, onConnected, onDisconnect }: Props) {
  const saved = current?.mode === "github" ? current.github : null;
  const [mode, setMode] = useState<Connection["mode"]>(current?.mode ?? "github");
  const [form, setForm] = useState<GitHubSettings>({
    owner: saved?.owner ?? "",
    repo: saved?.repo ?? "",
    path: saved?.path ?? "library.json",
    // The saved token is never shown again; leave the box empty to keep using it.
    token: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (patch: Partial<GitHubSettings>) => setForm({ ...form, ...patch });

  async function connect() {
    setError("");
    let connection: Connection;
    if (mode === "github") {
      const github = cleanGitHubSettings({ ...form, token: form.token || saved?.token || "" });
      if (!github.owner || !github.repo) return setError("Enter the repository’s owner and name.");
      if (!github.token) return setError("Paste an access token for that repository.");
      connection = { mode: "github", github };
    } else connection = { mode: "browser" };
    setBusy(true);
    try {
      // Opening the library is the test: it proves the details and the token work.
      const items = await createStore(connection, window.localStorage).load();
      onConnected(connection, items);
    } catch (cause) {
      setError((cause as Error).message || "The library could not be opened.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Where your library is kept"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          connect();
        }}
      >
        <fieldset className="editor-body connection-body" disabled={busy}>
          {current && (
            <p className="connection-current">
              {current.mode === "github" ? <Cloud size={15} /> : <HardDrive size={15} />}
              <span>
                Currently:{" "}
                <strong>
                  {current.mode === "github"
                    ? `${current.github.owner}/${current.github.repo} · ${current.github.path}`
                    : "this browser only"}
                </strong>
              </span>
            </p>
          )}
          <div className="source-tabs" aria-label="Storage location">
            <button
              type="button"
              aria-pressed={mode === "github"}
              className={mode === "github" ? "selected" : ""}
              onClick={() => setMode("github")}
            >
              GitHub repository
            </button>
            <button
              type="button"
              aria-pressed={mode === "browser"}
              className={mode === "browser" ? "selected" : ""}
              onClick={() => setMode("browser")}
            >
              This browser only
            </button>
          </div>
          {mode === "github" ? (
            <>
              <div className="source-help">
                <strong>One file, on every device.</strong>
                <p>
                  Your library is a single file in a private GitHub repository you own. Each save is
                  recorded there, so you can see and undo past changes.
                </p>
                <p>
                  Create a fine-grained access token limited to that one repository, with the
                  permission “Contents: Read and write”. It is kept only in this browser.
                </p>
                <a href={tokenPage} target="_blank" rel="noreferrer">
                  Create a token on GitHub <ArrowUpRight size={13} />
                </a>
              </div>
              <div className="form-row">
                <label>
                  Owner
                  <input
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={form.owner}
                    placeholder="Your GitHub username"
                    onChange={(event) => set({ owner: event.target.value })}
                  />
                </label>
                <label>
                  Repository
                  <input
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={form.repo}
                    placeholder="e.g. media-library"
                    onChange={(event) => set({ repo: event.target.value })}
                  />
                </label>
              </div>
              <label>
                File <span className="field-note">created on your first save if it’s missing</span>
                <input
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={form.path}
                  placeholder="library.json"
                  onChange={(event) => set({ path: event.target.value })}
                />
              </label>
              <label>
                Access token
                <input
                  type="password"
                  autoComplete="off"
                  required={!saved}
                  value={form.token}
                  placeholder={saved ? "Leave empty to keep the saved token" : "github_pat_…"}
                  onChange={(event) => set({ token: event.target.value })}
                />
              </label>
            </>
          ) : (
            <div className="source-help">
              <strong>Kept on this device.</strong>
              <p>
                Your library is stored in this browser only. Other devices won’t see it, and
                clearing this browser’s site data erases it — download a full backup from Export now
                and then.
              </p>
            </div>
          )}
          {error && (
            <div className="error-box" role="alert">
              {error}
            </div>
          )}
        </fieldset>
        <div className="modal-actions">
          {current && (
            <button
              type="button"
              className="secondary connection-disconnect"
              disabled={busy}
              onClick={onDisconnect}
            >
              Disconnect
            </button>
          )}
          <button type="button" className="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy && <LoaderCircle size={16} className="spin" />}
            {mode === "github" ? "Connect" : "Use this browser"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
