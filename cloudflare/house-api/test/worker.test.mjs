import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/index.js";

class MemoryD1 {
  row = {
    revision: 0,
    body: JSON.stringify({ schemaVersion: 1, revision: 0, updatedAt: null, items: [{
      id: "sau-house", name: "The Sau House", place: "Shared", category: "Content",
      stage: "Published", summary: "Content workspace", url: "", repo: "",
      owner: "", nextAction: "Review the map", checkedAt: "", note: "",
    }] }),
  };
  prepare(sql) {
    return {
      first: async () => this.row,
      bind: (...args) => ({
        run: async () => {
          if (sql.startsWith("UPDATE")) {
            if (!this.row || this.row.revision !== args[3]) return { meta: { changes: 0 } };
            this.row = { revision: args[0], body: args[1] };
          }
          return { meta: { changes: 1 } };
        },
      }),
    };
  }
}

function request(path, passcode = "valid", options = {}) {
  const headers = new Headers(options.headers || {});
  if (passcode) headers.set("Authorization", `Bearer ${passcode}`);
  headers.set("Origin", "https://scansauce.saujanalab.com");
  return new Request(`https://saujana-house-api.example.workers.dev${path}`, { ...options, headers });
}

test("requires the existing House key and saves one shared catalogue", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.pathname === "/api/admin/session") {
      return new Response(null, { status: init?.headers?.Authorization === "Bearer valid" ? 200 : 401 });
    }
    return new Response(JSON.stringify({ proxied: true }), { headers: { "Content-Type": "application/json" } });
  };
  try {
    const env = { DB: new MemoryD1(), BACKEND_ORIGIN: "https://existing-worker.example.workers.dev" };
    assert.equal((await worker.fetch(request("/api/admin/house", ""), env)).status, 401);
    const first = await worker.fetch(request("/api/admin/house"), env);
    assert.equal(first.status, 200);
    assert.equal(first.headers.get("Access-Control-Allow-Origin"), "https://scansauce.saujanalab.com");
    const catalog = await first.json();
    assert.equal(catalog.revision, 0);
    assert.equal(catalog.items.length, 1);
    const item = catalog.items.find((entry) => entry.id === "sau-house");

    const save = await worker.fetch(request("/api/admin/house/items/sau-house", "valid", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revision: 0, item: { ...item, owner: "Saujana team" } }),
    }), env);
    assert.equal(save.status, 200);
    assert.equal((await save.json()).manifest.items.find((entry) => entry.id === "sau-house").owner, "Saujana team");
    assert.equal((await (await worker.fetch(request("/api/admin/house"), env)).json()).revision, 1);

    const stale = await worker.fetch(request("/api/admin/house/items/sau-house", "valid", {
      method: "PATCH", body: JSON.stringify({ revision: 0, item }),
    }), env);
    assert.equal(stale.status, 409);
    const unsafe = await worker.fetch(request("/api/admin/house/items/sau-house", "valid", {
      method: "PATCH", body: JSON.stringify({ revision: 1, item: { ...item, url: "javascript:alert(1)" } }),
    }), env);
    assert.equal(unsafe.status, 400);

    assert.equal((await worker.fetch(request("/content/media/private/secret.json"), env)).status, 404);
    const proxy = await worker.fetch(request("/api/admin/comparisons"), env);
    assert.equal(proxy.status, 200);
    assert.equal((await proxy.json()).proxied, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
