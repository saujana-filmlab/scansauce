const WORKER_ORIGIN = "https://scansauce-content.saujanalab-bali.workers.dev";
const API_BASE = `${WORKER_ORIGIN}/api/admin`;
const CONTENT_URL = `${WORKER_ORIGIN}/content/comparisons.json`;
const STYLES = ["classic", "isle-punch", "flat"];
const WIDTHS = [320, 900, 1600];

const gateScreen = document.querySelector("#gate-screen");
const gateForm = document.querySelector("#gate-form");
const gatePasscode = document.querySelector("#gate-passcode");
const gateResult = document.querySelector("#gate-result");
const previewButton = document.querySelector("#preview-button");
const adminShell = document.querySelector("#admin-shell");
const sessionLabel = document.querySelector("#session-label");
const lockButton = document.querySelector("#lock-button");
const form = document.querySelector("#comparison-form");
const dateInput = document.querySelector("#shoot-date");
const labelInput = document.querySelector("#frame-label");
const publishButton = document.querySelector("#publish-button");
const progress = document.querySelector("#upload-progress");
const result = document.querySelector("#form-result");
const list = document.querySelector("#comparison-list");
const statusPanel = document.querySelector("#status-panel");
const statusTitle = document.querySelector("#status-title");
const statusMessage = document.querySelector("#status-message");
const views = [...document.querySelectorAll("[data-view]")];
const viewButtons = [...document.querySelectorAll("[data-open-view]")];

let manifest = { schemaVersion: 1, comparisons: [] };
let adminPasscode = sessionStorage.getItem("saujana-content-passcode") || "";
dateInput.value = localDateValue();

function localDateValue() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function authHeaders() {
  return adminPasscode ? { Authorization: `Bearer ${adminPasscode}` } : {};
}

function setStatus(kind, title, message) {
  statusPanel.classList.toggle("is-connected", kind === "connected");
  statusPanel.classList.toggle("is-error", kind === "error");
  statusTitle.textContent = title;
  statusMessage.textContent = message;
}

function setResult(message, kind = "") {
  result.textContent = message;
  result.className = `form-result${kind ? ` is-${kind}` : ""}`;
}

function showView(name) {
  views.forEach((view) => { view.hidden = view.dataset.view !== name; });
  viewButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.openView === name));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function unlockShell(session = {}, preview = false) {
  gateScreen.hidden = true;
  adminShell.hidden = false;
  sessionLabel.textContent = preview ? "LOCAL PREVIEW" : (session.email || "BACK OF HOUSE");
  setStatus(
    preview ? "error" : "connected",
    preview ? "PREVIEW MODE" : "R2 CONNECTED",
    preview ? "The rooms are visible, but publishing stays locked until the Worker and R2 are connected." : "The Kitchen is ready for authenticated uploads.",
  );
  showView("lobby");
  loadManifest();
}

async function verifyPasscode(passcode) {
  adminPasscode = passcode;
  const response = await fetch(`${API_BASE}/session`, { headers: authHeaders() });
  if (!response.ok) {
    adminPasscode = "";
    throw new Error("Errrr, wrong key. Try again.");
  }
  return response.json();
}

gateForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  gateResult.textContent = "Checking the passcode.";
  const submit = gateForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    const session = await verifyPasscode(gatePasscode.value);
    sessionStorage.setItem("saujana-content-passcode", adminPasscode);
    gatePasscode.value = "";
    gateResult.textContent = "";
    unlockShell(session);
  } catch (error) {
    gateResult.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});

if (window.location.protocol === "file:" || ["127.0.0.1", "localhost"].includes(window.location.hostname)) {
  previewButton.hidden = false;
  previewButton.addEventListener("click", () => unlockShell({}, true));
}

lockButton.addEventListener("click", () => {
  adminPasscode = "";
  sessionStorage.removeItem("saujana-content-passcode");
  adminShell.hidden = true;
  gateScreen.hidden = false;
  gateResult.textContent = "";
  gatePasscode.focus();
});

viewButtons.forEach((button) => button.addEventListener("click", () => showView(button.dataset.openView)));

function imageUrl(comparison) {
  const file = comparison.styles?.classic?.variants?.["320"];
  const source = file?.jpg || file?.webp || "";
  return source ? new URL(source, new URL("../", window.location.href)).href : "";
}

function renderList() {
  const comparisons = [...(manifest.comparisons || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  if (!comparisons.length) {
    list.innerHTML = '<p class="empty-state">No comparisons have been published yet.</p>';
    return;
  }

  list.replaceChildren(
    ...comparisons.map((comparison) => {
      const item = document.createElement("div");
      const copy = document.createElement("div");
      const title = document.createElement("strong");
      const meta = document.createElement("span");
      const image = document.createElement("img");
      const actions = document.createElement("div");
      const remove = document.createElement("button");
      item.className = "comparison-item";
      actions.className = "comparison-item-actions";
      title.textContent = `FRAME ${comparison.label}`;
      meta.textContent = `${comparison.date} / ${comparison.published === false ? "HIDDEN" : "LIVE"}`;
      image.src = imageUrl(comparison);
      image.alt = "";
      image.loading = "lazy";
      remove.className = "comparison-remove";
      remove.type = "button";
      remove.textContent = "REMOVE";
      remove.dataset.removeId = comparison.id;
      remove.dataset.removeLabel = comparison.label;
      remove.setAttribute("aria-label", `Remove frame ${comparison.label}`);
      remove.disabled = !adminPasscode;
      copy.append(title, meta);
      actions.append(image, remove);
      item.append(copy, actions);
      return item;
    }),
  );
}

async function removeComparison(id, label, button) {
  if (!adminPasscode) {
    setResult("Enter the production passcode before removing a frame.", "error");
    return;
  }

  const confirmed = window.confirm(`Remove frame ${label}? Its processed photos will also be deleted from R2.`);
  if (!confirmed) return;

  button.disabled = true;
  button.textContent = "REMOVING";
  setResult(`Removing frame ${label}.`);
  try {
    const response = await fetch(`${API_BASE}/comparisons/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!response.ok) throw new Error(await response.text() || `Removal failed (${response.status})`);
    const saved = await response.json();
    manifest = saved.manifest;
    renderList();
    setResult(`Frame ${label} and its processed photos have been removed.`, "success");
  } catch (error) {
    button.disabled = false;
    button.textContent = "REMOVE";
    setResult(error.message, "error");
  }
}

list.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-id]");
  if (!button) return;
  removeComparison(button.dataset.removeId, button.dataset.removeLabel, button);
});

async function loadManifest() {
  try {
    const response = await fetch(CONTENT_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load the content manifest (${response.status})`);
    manifest = await response.json();
    renderList();
  } catch (error) {
    list.innerHTML = `<p class="empty-state">${error.message}</p>`;
  }
}

function nextLabel() {
  const highest = (manifest.comparisons || []).reduce((value, item) => Math.max(value, Number(item.label) || 0), 0);
  return String(highest + 1).padStart(2, "0");
}

function previewFile(input) {
  const card = input.closest(".upload-card");
  const preview = card.querySelector(".upload-preview");
  const file = input.files?.[0];
  if (!file) return;
  const image = document.createElement("img");
  image.src = URL.createObjectURL(file);
  image.alt = "Selected upload preview";
  image.addEventListener("load", () => URL.revokeObjectURL(image.src), { once: true });
  preview.replaceChildren(image);
  card.classList.add("has-file");
}

function assignDroppedFile(input, file) {
  if (!file?.type.startsWith("image/")) {
    setResult("Drop a JPEG, PNG, or WebP image into the upload tile.", "error");
    return;
  }

  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  previewFile(input);
  setResult(`${file.name} is ready.`);
}

document.querySelectorAll(".upload-card").forEach((card) => {
  const input = card.querySelector('input[type="file"]');

  card.addEventListener("dragenter", (event) => {
    event.preventDefault();
    card.classList.add("is-dragging");
  });

  card.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    card.classList.add("is-dragging");
  });

  card.addEventListener("dragleave", (event) => {
    if (!card.contains(event.relatedTarget)) card.classList.remove("is-dragging");
  });

  card.addEventListener("drop", (event) => {
    event.preventDefault();
    card.classList.remove("is-dragging");
    assignDroppedFile(input, event.dataTransfer?.files?.[0]);
  });
});

async function makeWebp(file, maxWidth) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false, colorSpace: "srgb" });
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not process an image")), "image/webp", 0.95);
  });
}

async function imageDimensions(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const dimensions = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return dimensions;
}

async function uploadVariant(id, style, width, blob) {
  const response = await fetch(`${API_BASE}/assets/${id}/${style}/${width}.webp`, {
    method: "PUT",
    headers: { ...authHeaders(), "Content-Type": "image/webp" },
    body: blob,
  });
  if (!response.ok) throw new Error(await response.text() || `Upload failed (${response.status})`);
  return response.json();
}

async function prepareStyle(id, style, file, onStep) {
  const variants = {};
  for (const width of WIDTHS) {
    const blob = await makeWebp(file, width);
    const upload = await uploadVariant(id, style, width, blob);
    variants[String(width)] = { webp: upload.url };
    onStep();
  }
  return { variants };
}

async function saveComparison(comparison) {
  const response = await fetch(`${API_BASE}/comparisons`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(comparison),
  });
  if (!response.ok) throw new Error(await response.text() || `Publishing failed (${response.status})`);
  return response.json();
}

form.addEventListener("change", (event) => {
  if (event.target.matches('input[type="file"]')) previewFile(event.target);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!adminPasscode) {
    setResult("Lock the room, then enter the production passcode before uploading.", "error");
    return;
  }

  const data = new FormData(form);
  const label = (labelInput.value.trim() || nextLabel()).padStart(2, "0");
  const date = dateInput.value;
  const id = `${date}-${label}`;
  const totalSteps = STYLES.length * WIDTHS.length;
  let completedSteps = 0;

  if ((manifest.comparisons || []).some((item) => item.id === id)) {
    setResult(`A comparison with the ID ${id} already exists.`, "error");
    return;
  }

  publishButton.disabled = true;
  progress.hidden = false;
  progress.value = 0;
  setResult("Preparing the three scans for R2.");

  try {
    const styles = {};
    const sourceFiles = {};
    const onStep = () => {
      completedSteps += 1;
      progress.value = Math.round((completedSteps / totalSteps) * 100);
      setResult(`Uploaded ${completedSteps} of ${totalSteps} web image variants.`);
    };

    for (const style of STYLES) {
      const file = data.get(style);
      if (!(file instanceof File) || !file.size) throw new Error(`Choose the ${style} scan first.`);
      sourceFiles[style] = file;
    }

    const dimensions = await Promise.all(STYLES.map((style) => imageDimensions(sourceFiles[style])));
    const [reference] = dimensions;
    const referenceRatio = reference.width / reference.height;
    if (dimensions.some(({ width, height }) => Math.abs((width / height) - referenceRatio) > 0.02)) {
      throw new Error("The three scan styles need to use the same frame shape.");
    }

    for (const style of STYLES) {
      styles[style] = await prepareStyle(id, style, sourceFiles[style], onStep);
    }

    const comparison = {
      id,
      label,
      date,
      order: Math.max(0, ...(manifest.comparisons || []).map((item) => item.order || 0)) + 1,
      published: document.querySelector("#published").checked,
      alt: `ScanSAUce comparison photograph ${label}`,
      media: {
        width: reference.width,
        height: reference.height,
        aspectRatio: Number(referenceRatio.toFixed(5)),
        orientation: reference.width > reference.height ? "landscape" : reference.width < reference.height ? "portrait" : "square",
      },
      styles,
    };

    const saved = await saveComparison(comparison);
    manifest = saved.manifest;
    renderList();
    form.reset();
    dateInput.value = localDateValue();
    document.querySelectorAll(".upload-card").forEach((card) => card.classList.remove("has-file"));
    document.querySelectorAll(".upload-preview").forEach((preview) => { preview.innerHTML = "<span>CHOOSE OR DROP PHOTO</span>"; });
    progress.value = 100;
    setResult(`Frame ${label} is ${comparison.published ? "live" : "saved as hidden"}.`, "success");
  } catch (error) {
    setResult(error.message, "error");
  } finally {
    publishButton.disabled = false;
  }
});

if (adminPasscode) {
  verifyPasscode(adminPasscode)
    .then((session) => unlockShell(session))
    .catch(() => {
      adminPasscode = "";
      sessionStorage.removeItem("saujana-content-passcode");
    });
}
