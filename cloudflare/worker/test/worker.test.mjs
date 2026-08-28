import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/index.js";

class MemoryR2 {
  constructor() {
    this.objects = new Map();
  }

  async put(key, body, options = {}) {
    const bytes = new Uint8Array(await new Response(body).arrayBuffer());
    this.objects.set(key, { bytes, options });
  }

  async get(key) {
    const entry = this.objects.get(key);
    if (!entry) return null;
    return {
      body: entry.bytes,
      httpEtag: '"test-etag"',
      json: async () => JSON.parse(new TextDecoder().decode(entry.bytes)),
      writeHttpMetadata(headers) {
        const metadata = entry.options.httpMetadata || {};
        if (metadata.contentType) headers.set("Content-Type", metadata.contentType);
        if (metadata.cacheControl) headers.set("Cache-Control", metadata.cacheControl);
      },
    };
  }

  async delete(keys) {
    for (const key of Array.isArray(keys) ? keys : [keys]) this.objects.delete(key);
  }
}

function adminRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", "Bearer test-secret");
  return new Request(`https://scansauce.saujanalab.com${path}`, { ...options, headers });
}

test("uploads a complete comparison and serves its manifest", async () => {
  const env = {
    MEDIA: new MemoryR2(),
    ADMIN_PASSCODE: "test-secret",
    ADMIN_EMAILS: "",
    REQUIRE_ACCESS: "false",
    PUBLIC_MEDIA_BASE_URL: "",
  };

  const session = await worker.fetch(adminRequest("/api/admin/session"), env);
  assert.equal(session.status, 200);

  const styles = {};
  for (const style of ["classic", "isle-punch", "flat"]) {
    const variants = {};
    for (const width of [320, 900, 1600]) {
      const response = await worker.fetch(adminRequest(`/api/admin/assets/2026-08-28-04/${style}/${width}.webp`, {
        method: "PUT",
        headers: { "Content-Type": "image/webp" },
        body: new Uint8Array([82, 73, 70, 70]),
      }), env);
      assert.equal(response.status, 201);
      const upload = await response.json();
      variants[String(width)] = { webp: upload.url };
    }
    styles[style] = { variants };
  }

  const comparison = {
    id: "2026-08-28-04",
    label: "04",
    date: "2026-08-28",
    order: 4,
    published: true,
    alt: "ScanSAUce comparison photograph 04",
    styles,
  };

  const save = await worker.fetch(adminRequest("/api/admin/comparisons", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(comparison),
  }), env);
  assert.equal(save.status, 200);

  const manifestResponse = await worker.fetch(new Request("https://scansauce.saujanalab.com/content/comparisons.json"), env);
  assert.equal(manifestResponse.status, 200);
  const manifest = await manifestResponse.json();
  assert.equal(manifest.comparisons.length, 1);
  assert.equal(manifest.comparisons[0].styles.flat.variants["1600"].webp, "https://scansauce.saujanalab.com/content/media/scansauce/comparisons/2026-08-28-04/flat/1600.webp");

  const remove = await worker.fetch(adminRequest("/api/admin/comparisons/2026-08-28-04", {
    method: "DELETE",
  }), env);
  assert.equal(remove.status, 200);
  const removed = await remove.json();
  assert.equal(removed.manifest.comparisons.length, 0);
  assert.equal(env.MEDIA.objects.has("scansauce/comparisons/2026-08-28-04/flat/1600.webp"), false);

  const deletedManifestResponse = await worker.fetch(new Request("https://scansauce.saujanalab.com/content/comparisons.json"), env);
  const deletedManifest = await deletedManifestResponse.json();
  assert.equal(deletedManifest.comparisons.length, 0);
});
