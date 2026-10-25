const houseApi = "https://saujana-house-api.edue-christian.workers.dev/api/admin/house";
const houseGrid = document.querySelector("#map-grid");
const houseFeedback = document.querySelector("#map-feedback");
const houseEditor = document.querySelector("#map-editor");
const houseForm = document.querySelector("#map-form");
const houseSaveStatus = document.querySelector("#map-save-status");
const houseSearch = document.querySelector("#map-search");
const housePlace = document.querySelector("#map-place");
const houseCategory = document.querySelector("#map-category");
let houseCatalog = null;
let housePreview = false;
let editingHouseId = null;

function houseSafeUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function houseText(tag, value, className = "") {
  const element = document.createElement(tag);
  element.textContent = value || "";
  if (className) element.className = className;
  return element;
}

function houseDetail(label, value) {
  const row = document.createElement("div");
  row.append(houseText("b", label), houseText("span", value || "Not assigned"));
  return row;
}

function houseLink(label, value) {
  const url = houseSafeUrl(value);
  if (!url) return null;
  const link = houseText("a", label);
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}

function renderHouseCard(item) {
  const card = document.createElement("article");
  card.className = "map-item";
  const meta = document.createElement("div");
  meta.className = "map-item-meta";
  meta.append(houseText("span", `${item.place} / ${item.category}`), houseText("span", item.stage));
  const details = document.createElement("div");
  details.className = "map-item-details";
  details.append(
    houseDetail("OWNER", item.owner),
    houseDetail("NEXT", item.nextAction || "Add a next action"),
    houseDetail("CHECKED", item.checkedAt || "Needs checking"),
  );
  const actions = document.createElement("div");
  actions.className = "map-item-actions";
  const open = houseLink("OPEN ↗", item.url);
  const source = houseLink("SOURCE ↗", item.repo);
  if (open) actions.append(open);
  if (source) actions.append(source);
  const edit = houseText("button", "EDIT RECORD");
  edit.type = "button";
  edit.dataset.houseEdit = item.id;
  actions.append(edit);
  card.append(meta, houseText("h3", item.name), houseText("p", item.summary), details, actions);
  return card;
}

function renderHouse() {
  if (!houseCatalog) return;
  const items = houseCatalog.items || [];
  document.querySelector("#map-total").textContent = String(items.length);
  document.querySelector("#map-published").textContent = String(items.filter((item) => item.stage === "Published").length);
  document.querySelector("#map-in-progress").textContent = String(items.filter((item) => ["Base built", "Building", "Planned"].includes(item.stage)).length);
  document.querySelector("#map-to-check").textContent = String(items.filter((item) => !item.checkedAt).length);

  const search = houseSearch.value.trim().toLowerCase();
  const visible = items.filter((item) =>
    (!housePlace.value || item.place === housePlace.value) &&
    (!houseCategory.value || item.category === houseCategory.value) &&
    (!search || [item.name, item.summary, item.stage, item.note, item.nextAction].join(" ").toLowerCase().includes(search))
  ).sort((a, b) => a.category.localeCompare(b.category) || a.place.localeCompare(b.place) || a.name.localeCompare(b.name));
  houseGrid.replaceChildren(...visible.map(renderHouseCard));
  if (!visible.length) houseGrid.append(houseText("p", "No builds match those filters.", "map-empty"));
  houseFeedback.classList.remove("is-error");
  houseFeedback.textContent = `${visible.length} of ${items.length} builds shown${housePreview ? " · local preview, edits stay in this browser" : ""}.`;
}

async function loadHouse(preview) {
  housePreview = preview;
  try {
    if (preview) {
      const saved = localStorage.getItem("sau-house-preview-catalog");
      if (saved) houseCatalog = JSON.parse(saved);
      else houseCatalog = { schemaVersion: 1, revision: 0, updatedAt: null, items: [] };
    } else {
      const passcode = sessionStorage.getItem("saujana-content-passcode") || "";
      const response = await fetch(houseApi, { headers: { Authorization: `Bearer ${passcode}` }, cache: "no-store" });
      if (!response.ok) throw new Error(`The House map is unavailable (${response.status}).`);
      houseCatalog = await response.json();
    }
    renderHouse();
  } catch (error) {
    houseFeedback.classList.add("is-error");
    houseFeedback.textContent = window.location.protocol === "file:"
      ? "Open this build through a local web preview to load The Map. The Kitchen and Library can still be viewed here."
      : error.message;
  }
}

function closeHouseEditor() {
  houseEditor.hidden = true;
  document.body.classList.remove("has-map-editor");
  editingHouseId = null;
  houseSaveStatus.textContent = "";
}

function openHouseEditor(id = null) {
  if (!houseCatalog) return;
  editingHouseId = id;
  const item = id ? houseCatalog.items.find((entry) => entry.id === id) : null;
  if (id && !item) return;
  houseForm.reset();
  for (const name of ["name", "place", "category", "stage", "summary", "url", "repo", "owner", "nextAction", "checkedAt", "note"]) {
    const field = houseForm.elements.namedItem(name);
    if (field && item) field.value = item[name] || "";
  }
  if (!item) {
    houseForm.elements.namedItem("place").value = "Shared";
    houseForm.elements.namedItem("category").value = "Projects";
    houseForm.elements.namedItem("stage").value = "Needs review";
  }
  document.querySelector("#map-editor-title").textContent = item ? "EDIT BUILD" : "ADD A BUILD";
  houseSaveStatus.textContent = housePreview ? "Preview edits stay in this browser." : "";
  houseEditor.hidden = false;
  document.body.classList.add("has-map-editor");
  houseForm.elements.namedItem("name").focus();
}

async function saveHouse(event) {
  event.preventDefault();
  if (!houseCatalog) return;
  const fields = new FormData(houseForm);
  const item = {};
  for (const name of ["name", "place", "category", "stage", "summary", "url", "repo", "owner", "nextAction", "checkedAt", "note"]) {
    item[name] = String(fields.get(name) || "").trim();
  }
  if ([item.url, item.repo].some((url) => url && !houseSafeUrl(url))) {
    houseSaveStatus.textContent = "Use full https:// links.";
    houseSaveStatus.classList.add("is-error");
    return;
  }

  const button = houseForm.querySelector('button[type="submit"]');
  button.disabled = true;
  houseSaveStatus.classList.remove("is-error");
  houseSaveStatus.textContent = "Saving the record…";
  try {
    if (housePreview) {
      if (editingHouseId) {
        const index = houseCatalog.items.findIndex((entry) => entry.id === editingHouseId);
        houseCatalog.items[index] = { id: editingHouseId, ...item };
      } else {
        houseCatalog.items.push({ id: crypto.randomUUID(), ...item });
      }
      houseCatalog.revision += 1;
      houseCatalog.updatedAt = new Date().toISOString();
      localStorage.setItem("sau-house-preview-catalog", JSON.stringify(houseCatalog));
    } else {
      const path = editingHouseId ? `/items/${encodeURIComponent(editingHouseId)}` : "/items";
      const response = await fetch(`${houseApi}${path}`, {
        method: editingHouseId ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem("saujana-content-passcode") || ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ revision: houseCatalog.revision, item }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409 && result.manifest) {
          houseCatalog = result.manifest;
          renderHouse();
        }
        throw new Error(result.error || `Save failed (${response.status}).`);
      }
      houseCatalog = result.manifest;
    }
    renderHouse();
    closeHouseEditor();
  } catch (error) {
    houseSaveStatus.classList.add("is-error");
    houseSaveStatus.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

document.addEventListener("sau-house:unlocked", (event) => loadHouse(event.detail.preview));
document.addEventListener("sau-house:locked", () => { closeHouseEditor(); houseCatalog = null; houseGrid.replaceChildren(); });
houseSearch.addEventListener("input", renderHouse);
housePlace.addEventListener("change", renderHouse);
houseCategory.addEventListener("change", renderHouse);
document.querySelector("#map-add").addEventListener("click", () => openHouseEditor());
document.querySelector("#map-editor-close").addEventListener("click", closeHouseEditor);
houseForm.addEventListener("submit", saveHouse);
houseGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-house-edit]");
  if (button) openHouseEditor(button.dataset.houseEdit);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !houseEditor.hidden) closeHouseEditor();
});
