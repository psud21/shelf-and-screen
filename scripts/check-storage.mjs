import assert from "node:assert/strict";
import { blankMedia } from "../lib/media.ts";
import { saveItem } from "../lib/library.ts";
import {
  cleanGitHubSettings,
  createBrowserStore,
  createGitHubStore,
  readCache,
  readConnection,
  writeConnection,
} from "../lib/storage.ts";

const memory = () => {
  const data = new Map();
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => void data.set(key, String(value)),
    removeItem: (key) => void data.delete(key),
  };
};
const title = (name, extra = {}) => ({ ...blankMedia(), title: name, kind: "movie", ...extra });
const add = (item) => (items) => saveItem(items, item);

/* ---------- this browser ---------- */
{
  const storage = memory();
  const store = createBrowserStore(storage);
  assert.deepEqual(await store.load(), []);
  await store.update(add(title("Arrival")), "Save Arrival");
  await store.update(add(title("Past Lives")), "Save Past Lives");
  assert.deepEqual(
    (await createBrowserStore(storage).load()).map((item) => item.title),
    ["Arrival", "Past Lives"],
  );
  // A refused change leaves what is stored untouched.
  await assert.rejects(store.update(add(title("arrival")), "Duplicate"));
  assert.equal((await store.load()).length, 2);
}

/* ---------- remembered connection ---------- */
{
  const storage = memory();
  assert.equal(readConnection(storage), null);
  const github = { owner: "someone", repo: "library", path: "library.json", token: "t0ken" };
  writeConnection(storage, { mode: "github", github });
  assert.deepEqual(readConnection(storage), { mode: "github", github });
  writeConnection(storage, null);
  assert.equal(readConnection(storage), null);
  storage.setItem("shelf-screen-connection", '{"mode":"github","github":{"owner":"x"}}');
  assert.equal(readConnection(storage), null);
  storage.setItem("shelf-screen-connection", "not json");
  assert.equal(readConnection(storage), null);

  assert.deepEqual(
    cleanGitHubSettings({ owner: " someone ", repo: " library ", path: "", token: " abc \n" }),
    { owner: "someone", repo: "library", path: "library.json", token: "abc" },
  );
  assert.deepEqual(
    cleanGitHubSettings({
      owner: "",
      repo: "https://github.com/someone/library.git",
      path: "/data/lib.json",
      token: "abc",
    }),
    { owner: "someone", repo: "library", path: "data/lib.json", token: "abc" },
  );
  assert.deepEqual(
    cleanGitHubSettings({ owner: "someone/library", repo: "", path: "x.json", token: "a" }),
    {
      owner: "someone",
      repo: "library",
      path: "x.json",
      token: "a",
    },
  );
}

/* ---------- a stand-in for the GitHub file API ---------- */
function fakeGitHub({
  repoExists = true,
  tokenOk = true,
  readOnly = false,
  inlineLimit = Infinity,
} = {}) {
  const state = { text: null, version: 0, requests: [], commits: [], failNextWrites: 0 };
  const sha = () => `sha-${state.version}`;
  const reply = (status, body = {}, headers = {}) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json", ...headers },
    });
  const encode = (text) =>
    Buffer.from(text, "utf8")
      .toString("base64")
      .replace(/(.{60})/g, "$1\n");
  state.put = (text) => {
    state.text = text;
    state.version++;
  };
  state.fetch = async (url, init = {}) => {
    const method = init.method || "GET";
    state.requests.push(`${method} ${url}`);
    assert.equal(init.headers.Authorization, "Bearer t0ken");
    assert.equal(init.cache, "no-store");
    if (!tokenOk) return reply(401, { message: "Bad credentials" });
    const path = new URL(url).pathname;
    if (path === "/repos/someone/library") return reply(repoExists ? 200 : 404, {});
    if (path.startsWith("/repos/someone/library/git/blobs/"))
      return reply(200, { content: encode(state.text), encoding: "base64" });
    assert.equal(path, "/repos/someone/library/contents/data/library.json");
    if (method === "GET") {
      if (!repoExists || state.text === null) return reply(404, { message: "Not Found" });
      const inline = state.text.length <= inlineLimit;
      return reply(200, {
        type: "file",
        sha: sha(),
        encoding: inline ? "base64" : "none",
        content: inline ? encode(state.text) : "",
      });
    }
    if (readOnly)
      return reply(403, { message: "Resource not accessible by personal access token" });
    const body = JSON.parse(init.body);
    if (state.failNextWrites > 0) {
      state.failNextWrites--;
      return reply(500, {});
    }
    if (state.text !== null && body.sha !== sha())
      return reply(body.sha ? 409 : 422, { message: "does not match" });
    if (state.text === null && body.sha) return reply(409, { message: "does not match" });
    state.put(Buffer.from(body.content, "base64").toString("utf8"));
    state.commits.push(body.message);
    return reply(state.version === 1 ? 201 : 200, { content: { sha: sha() } });
  };
  return state;
}
const settings = { owner: "someone", repo: "library", path: "data/library.json", token: "t0ken" };
const stored = (github) => JSON.parse(github.text).map((item) => item.title);

// First use: no file yet. Loading gives an empty library and the first save creates the file.
{
  const github = fakeGitHub();
  const cache = memory();
  const store = createGitHubStore(settings, { fetch: github.fetch, cache });
  assert.deepEqual(await store.load(), []);
  const saved = await store.update(add(title("Amélie 🎬")), "Save “Amélie”");
  assert.deepEqual(
    saved.map((item) => item.title),
    ["Amélie 🎬"],
  );
  assert.deepEqual(stored(github), ["Amélie 🎬"]);
  assert.deepEqual(github.commits, ["Save “Amélie”"]);
  assert.ok(github.text.endsWith("\n") && github.text.includes('\n  {\n    "id"'));
  assert.deepEqual(
    readCache(cache).map((item) => item.title),
    ["Amélie 🎬"],
  );

  // A second device reads the same file, including non-English text.
  const other = createGitHubStore(settings, { fetch: github.fetch });
  assert.deepEqual(
    (await other.load()).map((item) => item.title),
    ["Amélie 🎬"],
  );

  // Both devices now save without reloading: neither change is lost.
  await store.update(add(title("Arrival")), "Save Arrival");
  const merged = await other.update(add(title("Past Lives")), "Save Past Lives");
  assert.deepEqual(
    merged.map((item) => item.title),
    ["Amélie 🎬", "Arrival", "Past Lives"],
  );
  assert.deepEqual(stored(github), ["Amélie 🎬", "Arrival", "Past Lives"]);

  // The rule is re-checked against the newer version: a title the other device
  // already added is refused rather than duplicated.
  await assert.rejects(
    store.update(add(title("Past Lives")), "Save Past Lives"),
    /already in your library/,
  );
  assert.equal(stored(github).length, 3);

  // Quick successive saves (ticking episodes) are applied in order, none dropped.
  const quick = ["One", "Two", "Three", "Four"].map((name) =>
    store.update(add(title(name)), `Save ${name}`),
  );
  await Promise.all(quick);
  assert.deepEqual(stored(github).slice(3), ["One", "Two", "Three", "Four"]);

  // A failed save reports an error and the next one still works.
  github.failNextWrites = 1;
  await assert.rejects(store.update(add(title("Five")), "Save Five"), /could not save/);
  await store.update(add(title("Six")), "Save Six");
  assert.deepEqual(stored(github).slice(-1), ["Six"]);
}

// Saving without loading first, when another device already created the file.
{
  const github = fakeGitHub();
  github.put(JSON.stringify([title("Existing")]));
  const store = createGitHubStore(settings, { fetch: github.fetch });
  await store.update(add(title("New")), "Save New");
  assert.deepEqual(stored(github), ["Existing", "New"]);
}

// A library file too large to arrive inline is fetched by its version id.
{
  const github = fakeGitHub({ inlineLimit: 10 });
  github.put(JSON.stringify([title("Big library")]));
  const store = createGitHubStore(settings, { fetch: github.fetch });
  assert.deepEqual(
    (await store.load()).map((item) => item.title),
    ["Big library"],
  );
  assert.ok(github.requests.some((request) => request.includes("/git/blobs/sha-1")));
}

// Clear messages for the ways a connection can be wrong.
{
  const load = (options) =>
    createGitHubStore(settings, { fetch: fakeGitHub(options).fetch }).load();
  await assert.rejects(load({ tokenOk: false }), /did not accept the access token/);
  await assert.rejects(load({ repoExists: false }), /someone\/library was not found/);

  const readOnly = fakeGitHub({ readOnly: true });
  readOnly.put("[]");
  await assert.rejects(
    createGitHubStore(settings, { fetch: readOnly.fetch }).update(add(title("X")), "Save X"),
    /Contents: Read and write/,
  );

  const offline = createGitHubStore(settings, {
    fetch: async () => {
      throw new TypeError("Failed to fetch");
    },
  });
  await assert.rejects(offline.load(), /could not be reached/);

  // A damaged file is reported, never replaced by an empty or trimmed library.
  const damaged = fakeGitHub();
  damaged.put(JSON.stringify([title("Fine"), { title: "Broken", score: "high" }]));
  const store = createGitHubStore(settings, { fetch: damaged.fetch });
  await assert.rejects(store.load(), /problem with “Broken”/);
  await assert.rejects(store.update(add(title("X")), "Save X"), /problem with “Broken”/);
  assert.equal(damaged.version, 1);
}

console.log(
  "PASS: browser storage, remembered connection, GitHub file create/read/save, two-device merging, ordered quick saves, large files, and clear connection errors.",
);
