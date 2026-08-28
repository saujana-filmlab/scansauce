const MANIFEST_KEY = "content/scansauce/comparisons.json";
const FILM_LIBRARY_KEY = "content/film-library/films.json";
const STYLE_KEYS = new Set(["classic", "isle-punch", "flat"]);
const IMAGE_NAMES = new Set(["320.webp", "900.webp", "1600.webp"]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: commonHeaders() });
    }

    if (request.method === "GET" && url.pathname === "/content/comparisons.json") {
      return serveJsonObject(env, MANIFEST_KEY);
    }

    if (request.method === "GET" && url.pathname === "/content/film-library.json") {
      return serveJsonObject(env, FILM_LIBRARY_KEY);
    }

    if (request.method === "GET" && url.pathname.startsWith("/content/media/")) {
      const key = decodeURIComponent(url.pathname.slice("/content/media/".length));
      return serveObject(env, key);
    }

    if (url.pathname.startsWith("/api/admin/")) {
      const identity = await authorize(request, env);
      if (!identity) return json({ error: "Unauthorized" }, 401);

      if (request.method === "GET" && url.pathname === "/api/admin/session") {
        return json({ ok: true, email: identity.email || null });
      }

      if (request.method === "PUT" && url.pathname.startsWith("/api/admin/assets/")) {
        return uploadAsset(request, env, url);
      }

      if (request.method === "POST" && url.pathname === "/api/admin/comparisons") {
        return saveComparison(request, env);
      }
    }

    return json({ error: "Not found" }, 404);
  },
};

function commonHeaders() {
  return {
    "Access-Control-Allow-Origin": "https://scansauce.saujanalab.com",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "X-Content-Type-Options": "nosniff",
  };
}

function json(value, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...commonHeaders(), "Content-Type": "application/json; charset=utf-8", ...extraHeaders },
  });
}

async function authorize(request, env) {
  const accessEmail = request.headers.get("Cf-Access-Authenticated-User-Email");
  const accessAssertion = request.headers.get("Cf-Access-Jwt-Assertion");
  const allowedEmails = (env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (env.REQUIRE_ACCESS === "true" && (!accessEmail || !accessAssertion)) return null;
  if (accessEmail && allowedEmails.length && !allowedEmails.includes(accessEmail.toLowerCase())) {
    return null;
  }

  const authorization = request.headers.get("Authorization") || "";
  const suppliedPasscode = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (env.ADMIN_PASSCODE && suppliedPasscode && await safeEqual(suppliedPasscode, env.ADMIN_PASSCODE)) {
    return { email: accessEmail || null, method: accessEmail ? "access-and-passcode" : "passcode" };
  }

  return null;
}

async function safeEqual(left, right) {
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const a = new Uint8Array(leftHash);
  const b = new Uint8Array(rightHash);
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

async function loadManifest(env) {
  const object = await env.MEDIA.get(MANIFEST_KEY);
  if (!object) return { schemaVersion: 1, updatedAt: new Date().toISOString(), comparisons: [] };
  return object.json();
}

async function serveJsonObject(env, key) {
  const object = await env.MEDIA.get(key);
  if (!object) return json({ error: "Content manifest not found" }, 404);

  const headers = new Headers(commonHeaders());
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  headers.set("Cache-Control", "no-cache, max-age=0");
  return new Response(object.body, { headers });
}

async function serveObject(env, key) {
  if (!key || key.includes("..")) return json({ error: "Invalid media path" }, 400);
  const object = await env.MEDIA.get(key);
  if (!object) return json({ error: "Media not found" }, 404);

  const headers = new Headers(commonHeaders());
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
}

async function uploadAsset(request, env, url) {
  if (request.headers.get("Content-Type") !== "image/webp") {
    return json({ error: "Only processed WebP uploads are accepted" }, 415);
  }

  const parts = url.pathname.slice("/api/admin/assets/".length).split("/").map(decodeURIComponent);
  if (parts.length !== 3) return json({ error: "Invalid upload path" }, 400);
  const [id, style, filename] = parts;
  if (!/^\d{4}-\d{2}-\d{2}-\d{2}$/.test(id) || !STYLE_KEYS.has(style) || !IMAGE_NAMES.has(filename)) {
    return json({ error: "Invalid comparison ID, style, or image size" }, 400);
  }

  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > 25 * 1024 * 1024) return json({ error: "Processed image exceeds 25 MB" }, 413);

  const key = `scansauce/comparisons/${id}/${style}/${filename}`;
  await env.MEDIA.put(key, request.body, {
    httpMetadata: {
      contentType: "image/webp",
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: { comparisonId: id, style },
  });

  const base = (env.PUBLIC_MEDIA_BASE_URL || `${url.origin}/content/media`).replace(/\/$/, "");
  return json({ ok: true, key, url: `${base}/${key}` }, 201);
}

function validComparison(comparison) {
  if (!comparison || typeof comparison !== "object") return false;
  if (!/^\d{4}-\d{2}-\d{2}-\d{2}$/.test(comparison.id || "")) return false;
  if (!/^\d{2}$/.test(comparison.label || "")) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(comparison.date || "")) return false;
  return [...STYLE_KEYS].every((style) => {
    const variants = comparison.styles?.[style]?.variants;
    return ["320", "900", "1600"].every((width) => typeof variants?.[width]?.webp === "string");
  });
}

async function saveComparison(request, env) {
  let comparison;
  try {
    comparison = await request.json();
  } catch {
    return json({ error: "Request body must be JSON" }, 400);
  }
  if (!validComparison(comparison)) return json({ error: "Comparison data is incomplete or invalid" }, 400);

  const manifest = await loadManifest(env);
  const index = manifest.comparisons.findIndex((item) => item.id === comparison.id);
  if (index >= 0) manifest.comparisons[index] = comparison;
  else manifest.comparisons.push(comparison);
  manifest.comparisons.sort((a, b) => (a.order || 0) - (b.order || 0));
  manifest.updatedAt = new Date().toISOString();

  await env.MEDIA.put(MANIFEST_KEY, JSON.stringify(manifest, null, 2), {
    httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: "no-cache, max-age=0" },
  });
  return json({ ok: true, manifest });
}
