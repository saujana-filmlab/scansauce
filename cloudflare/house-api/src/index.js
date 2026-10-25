const allowedOrigins = new Set([
  "https://scansauce.saujanalab.com",
  "https://saujana-house.pages.dev",
  "https://house.saujanalab.com",
]);
const places = new Set(["Bali", "KL", "Shared"]);
const categories = new Set(["Operations", "Customer journey", "Content", "Presence", "Projects"]);
const stages = new Set(["Published", "Base built", "Building", "Planned", "Needs review", "Paused", "Archived"]);

function corsHeaders(request) {
  const origin = request.headers.get("Origin");
  return {
    ...(allowedOrigins.has(origin) ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
    "X-Content-Type-Options": "nosniff",
  };
}

function json(request, value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}

function text(value, max) {
  return typeof value === "string" && value.length <= max ? value.trim() : null;
}

function safeUrl(value) {
  if (value === "") return "";
  if (typeof value !== "string" || value.length > 500) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

function validateItem(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const name = text(input.name, 100);
  const summary = text(input.summary, 240);
  const owner = text(input.owner, 100);
  const nextAction = text(input.nextAction, 240);
  const note = text(input.note, 500);
  const url = safeUrl(input.url);
  const repo = safeUrl(input.repo);
  const checkedAt = text(input.checkedAt, 10);
  if (!name || summary === null || owner === null || nextAction === null || note === null || url === null || repo === null || checkedAt === null) return null;
  if (checkedAt && !/^\d{4}-\d{2}-\d{2}$/.test(checkedAt)) return null;
  if (!places.has(input.place) || !categories.has(input.category) || !stages.has(input.stage)) return null;
  return { name, place: input.place, category: input.category, stage: input.stage, summary, url, repo, owner, nextAction, checkedAt, note };
}

async function readCatalog(env) {
  const row = await env.DB.prepare("SELECT revision, body FROM house_catalog WHERE id = 1").first();
  if (!row) throw new Error("House catalog is not initialized");
  return JSON.parse(row.body);
}

async function saveItem(request, env, encodedId) {
  let input;
  try {
    const body = await request.text();
    if (body.length > 12000) return json(request, { error: "Record is too large" }, 413);
    input = JSON.parse(body);
  } catch {
    return json(request, { error: "Request body must be JSON" }, 400);
  }
  const item = validateItem(input.item);
  if (!item || !Number.isSafeInteger(input.revision) || input.revision < 0) {
    return json(request, { error: "House item is incomplete or invalid" }, 400);
  }
  const current = await readCatalog(env);
  if (current.revision !== input.revision) {
    return json(request, { error: "This House map changed. Reload before saving.", manifest: current }, 409);
  }

  if (encodedId === null) {
    current.items.push({ id: crypto.randomUUID(), ...item });
  } else {
    let id;
    try { id = decodeURIComponent(encodedId); } catch { return json(request, { error: "Invalid item ID" }, 400); }
    const index = current.items.findIndex((entry) => entry.id === id);
    if (index < 0) return json(request, { error: "House item not found" }, 404);
    current.items[index] = { id, ...item };
  }

  current.revision += 1;
  current.updatedAt = new Date().toISOString();
  const body = JSON.stringify(current);
  const result = await env.DB.prepare("UPDATE house_catalog SET revision = ?, body = ?, updated_at = ? WHERE id = 1 AND revision = ?")
    .bind(current.revision, body, current.updatedAt, input.revision).run();
  if (result.meta.changes !== 1) {
    return json(request, { error: "This House map changed. Reload before saving.", manifest: await readCatalog(env) }, 409);
  }
  return json(request, { ok: true, manifest: current });
}

async function validateSession(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return false;
  const response = await fetch(`${env.BACKEND_ORIGIN}/api/admin/session`, {
    headers: { Authorization: authorization },
    cache: "no-store",
  });
  return response.ok;
}

async function proxyRequest(request, env) {
  const source = new URL(request.url);
  const upstream = new URL(source.pathname + source.search, env.BACKEND_ORIGIN);
  const response = await fetch(new Request(upstream, request));
  const headers = new Headers(response.headers);
  headers.delete("Access-Control-Allow-Origin");
  headers.delete("Access-Control-Allow-Headers");
  headers.delete("Access-Control-Allow-Methods");
  for (const [key, value] of Object.entries(corsHeaders(request))) headers.set(key, value);
  if (source.pathname.startsWith("/api/admin/")) headers.set("Cache-Control", "private, no-store");
  return new Response(response.body, { status: response.status, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });
    if (url.pathname === "/api/admin/house" || url.pathname.startsWith("/api/admin/house/items")) {
      try {
        if (!await validateSession(request, env)) return json(request, { error: "Unauthorized" }, 401);
      } catch {
        return json(request, { error: "The House key service is unavailable" }, 502);
      }
      if (request.method === "GET" && url.pathname === "/api/admin/house") {
        return json(request, await readCatalog(env));
      }
      if (request.method === "POST" && url.pathname === "/api/admin/house/items") {
        return saveItem(request, env, null);
      }
      if (request.method === "PATCH" && url.pathname.startsWith("/api/admin/house/items/")) {
        return saveItem(request, env, url.pathname.slice("/api/admin/house/items/".length));
      }
      return json(request, { error: "Not found" }, 404);
    }
    if (url.pathname.startsWith("/content/media/") && !/^\/content\/media\/scansauce\/comparisons\/\d{4}-\d{2}-\d{2}-\d{2}\/(?:classic|isle-punch|flat)\/(?:320|900|1600)\.webp$/.test(url.pathname)) {
      return json(request, { error: "Media not found" }, 404);
    }
    if (url.pathname.startsWith("/api/admin/") || ["/content/comparisons.json", "/content/film-library.json"].includes(url.pathname) || url.pathname.startsWith("/content/media/")) {
      try { return await proxyRequest(request, env); }
      catch { return json(request, { error: "The content service is unavailable" }, 502); }
    }
    return json(request, { error: "Not found" }, 404);
  },
};
