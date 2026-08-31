const WORKER_ORIGIN = "https://scansauce-content.saujanalab-bali.workers.dev";
const CONTENT_URL = `${WORKER_ORIGIN}/content/comparisons.json`;
const STYLE_ORDER = ["classic", "isle-punch", "flat"];

const STYLES = {
  classic: { label: "CLASSIC" },
  "isle-punch": { label: "ISLE PUNCH" },
  flat: { label: "FLAT" },
};

const state = {
  scene: null,
  leftStyle: "classic",
  rightStyle: "isle-punch",
  position: 50,
};

const scenes = new Map();
const frame = document.querySelector("#comparison-frame");
const slider = document.querySelector("#slider-control");
const divider = document.querySelector("#divider");
const leftLayer = document.querySelector("#left-layer");
const leftPicture = document.querySelector("#left-picture");
const leftImage = document.querySelector("#left-image");
const rightPicture = document.querySelector("#right-picture");
const rightImage = document.querySelector("#right-image");
const leftLabel = document.querySelector("#left-label");
const rightLabel = document.querySelector("#right-label");
const leftData = document.querySelector("#data-left");
const rightData = document.querySelector("#data-right");
const sceneData = document.querySelector("#data-scene");
const sceneThumbs = document.querySelector("#scene-thumbs");
const scenePrev = document.querySelector("#scene-prev");
const sceneNext = document.querySelector("#scene-next");
const styleButtons = [...document.querySelectorAll("[data-side][data-style]")];

let sceneButtons = [];
let pointerId = null;
let contentVersion = "";

function variant(scene, style, width) {
  return scene.styles?.[style]?.variants?.[String(width)] || null;
}

function versionedUrl(url) {
  if (!url || !contentVersion) return url || "";
  const parsed = new URL(url, window.location.href);
  parsed.searchParams.set("v", contentVersion);
  return parsed.href;
}

function availableUrl(file) {
  return versionedUrl(file?.jpg || file?.webp || "");
}

function srcsetFor(scene, style, format) {
  return [900, 1600]
    .map((width) => {
      const file = variant(scene, style, width);
      const url = versionedUrl(file?.[format] || (format === "jpg" ? file?.webp : null));
      return url ? `${url} ${width}w` : null;
    })
    .filter(Boolean)
    .join(", ");
}

function applyFrameAspect(scene, image = null) {
  let ratio = Number(scene.media?.aspectRatio);
  if ((!Number.isFinite(ratio) || ratio <= 0) && image?.naturalWidth && image?.naturalHeight) {
    ratio = image.naturalWidth / image.naturalHeight;
  }
  if (Number.isFinite(ratio) && ratio > 0) frame.style.aspectRatio = String(ratio);
}

function updatePicture(picture, image, sceneId, style) {
  const scene = scenes.get(sceneId);
  if (!scene || !scene.styles?.[style]) return;

  const source = picture.querySelector("source");
  const webpSrcset = srcsetFor(scene, style, "webp");
  const fallbackSrcset = srcsetFor(scene, style, "jpg");
  const large = variant(scene, style, 1600) || variant(scene, style, 900) || variant(scene, style, 320);
  const syncAspect = () => {
    if (state.scene === sceneId) applyFrameAspect(scene, image);
  };

  image.addEventListener("load", syncAspect, { once: true });

  if (webpSrcset) {
    source.srcset = webpSrcset;
  } else {
    source.removeAttribute("srcset");
  }

  image.src = availableUrl(large);
  image.srcset = fallbackSrcset;
  image.alt = `${scene.alt}, interpreted with the ${STYLES[style].label} scan style`;
  if (image.complete) syncAspect();
}

function setPosition(nextPosition) {
  state.position = Math.max(0, Math.min(100, nextPosition));
  const position = `${state.position}%`;
  leftLayer.style.clipPath = `inset(0 ${100 - state.position}% 0 0)`;
  divider.style.left = position;
  slider.setAttribute("aria-valuenow", String(Math.round(state.position)));
  slider.setAttribute(
    "aria-valuetext",
    `${Math.round(state.position)} percent ${STYLES[state.leftStyle].label}, ${Math.round(100 - state.position)} percent ${STYLES[state.rightStyle].label}`,
  );
}

function positionFromPointer(event) {
  const bounds = frame.getBoundingClientRect();
  return ((event.clientX - bounds.left) / bounds.width) * 100;
}

function setStyle(side, style) {
  if (!STYLE_ORDER.includes(style) || !state.scene) return;

  if (side === "left") {
    state.leftStyle = style;
    updatePicture(leftPicture, leftImage, state.scene, style);
    leftLabel.textContent = STYLES[style].label;
    leftData.textContent = STYLES[style].label;
  } else {
    state.rightStyle = style;
    updatePicture(rightPicture, rightImage, state.scene, style);
    rightLabel.textContent = STYLES[style].label;
    rightData.textContent = STYLES[style].label;
  }

  styleButtons.forEach((button) => {
    if (button.dataset.side !== side) return;
    const active = button.dataset.style === style;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  setPosition(state.position);
}

function setScene(sceneId) {
  const scene = scenes.get(sceneId);
  if (!scene) return;

  state.scene = sceneId;
  frame.style.removeProperty("aspect-ratio");
  applyFrameAspect(scene);
  updatePicture(leftPicture, leftImage, sceneId, state.leftStyle);
  updatePicture(rightPicture, rightImage, sceneId, state.rightStyle);
  sceneData.textContent = scene.label;
  sceneButtons.forEach((button) => {
    const active = button.dataset.scene === sceneId;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  setPosition(50);
}

function makeSceneButton(scene, index) {
  const button = document.createElement("button");
  const image = document.createElement("img");
  const label = document.createElement("span");
  const thumbnail = variant(scene, "classic", 320);

  button.className = "scene-thumb";
  button.type = "button";
  button.dataset.scene = scene.id;
  button.setAttribute("aria-label", `Show photograph ${scene.label}`);
  button.setAttribute("aria-pressed", "false");

  image.src = availableUrl(thumbnail);
  image.alt = scene.alt;
  image.width = 320;
  image.height = 320;
  if (index > 0) image.loading = "lazy";

  label.textContent = scene.label;
  button.append(image, label);
  button.addEventListener("click", () => setScene(scene.id));
  return button;
}

function updateSceneRailControls() {
  const maxScroll = Math.max(0, sceneThumbs.scrollWidth - sceneThumbs.clientWidth);
  scenePrev.disabled = sceneThumbs.scrollLeft <= 2;
  sceneNext.disabled = sceneThumbs.scrollLeft >= maxScroll - 2;
}

function scrollSceneRail(direction) {
  const distance = Math.max(170, Math.round(sceneThumbs.clientWidth * 0.8));
  sceneThumbs.scrollBy({ left: direction * distance, behavior: "smooth" });
}

function renderScenes(comparisons) {
  scenes.clear();
  comparisons.forEach((scene) => scenes.set(scene.id, scene));
  sceneButtons = comparisons.map(makeSceneButton);
  sceneThumbs.replaceChildren(...sceneButtons);
  setScene(comparisons[0].id);
  requestAnimationFrame(updateSceneRailControls);
}

async function loadContent() {
  const response = await fetch(CONTENT_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`Content request failed with ${response.status}`);

  const manifest = await response.json();
  contentVersion = manifest.updatedAt || String(Date.now());
  const comparisons = (manifest.comparisons || [])
    .filter((comparison) => comparison.published !== false)
    .filter((comparison) => STYLE_ORDER.every((style) => comparison.styles?.[style]))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  if (!comparisons.length) throw new Error("No published ScanSAUce comparisons were found");
  renderScenes(comparisons);
}

slider.addEventListener("pointerdown", (event) => {
  pointerId = event.pointerId;
  slider.setPointerCapture(pointerId);
  frame.classList.add("is-dragging");
  setPosition(positionFromPointer(event));
});

slider.addEventListener("pointermove", (event) => {
  if (event.pointerId !== pointerId) return;
  setPosition(positionFromPointer(event));
});

function endPointer(event) {
  if (event.pointerId !== pointerId) return;
  pointerId = null;
  frame.classList.remove("is-dragging");
}

slider.addEventListener("pointerup", endPointer);
slider.addEventListener("pointercancel", endPointer);

slider.addEventListener("keydown", (event) => {
  const steps = {
    ArrowLeft: -2,
    ArrowDown: -2,
    ArrowRight: 2,
    ArrowUp: 2,
    PageDown: -10,
    PageUp: 10,
  };

  if (event.key === "Home") {
    event.preventDefault();
    setPosition(0);
  } else if (event.key === "End") {
    event.preventDefault();
    setPosition(100);
  } else if (event.key in steps) {
    event.preventDefault();
    setPosition(state.position + steps[event.key]);
  }
});

styleButtons.forEach((button) => {
  button.addEventListener("click", () => setStyle(button.dataset.side, button.dataset.style));
});

scenePrev.addEventListener("click", () => scrollSceneRail(-1));
sceneNext.addEventListener("click", () => scrollSceneRail(1));
sceneThumbs.addEventListener("scroll", updateSceneRailControls, { passive: true });
window.addEventListener("resize", updateSceneRailControls);

setPosition(50);
loadContent().catch((error) => {
  console.error(error);
  sceneThumbs.innerHTML = '<p class="content-error">Comparison photos are temporarily unavailable.</p>';
  updateSceneRailControls();
});
