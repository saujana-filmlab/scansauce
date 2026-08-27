const SCENES = {
  "01": {
    label: "01",
    alt: "ScanSAUce comparison photograph 01",
  },
  "02": {
    label: "02",
    alt: "ScanSAUce comparison photograph 02",
  },
  "03": {
    label: "03",
    alt: "ScanSAUce comparison photograph 03",
  },
};

const STYLES = {
  classic: {
    label: "CLASSIC",
    alt: "Classic scan style",
  },
  flat: {
    label: "FLAT",
    alt: "Flat scan style",
  },
  "isle-punch": {
    label: "ISLE PUNCH",
    alt: "Isle Punch scan style",
  },
};

const state = {
  scene: "01",
  leftStyle: "classic",
  rightStyle: "isle-punch",
  position: 50,
};

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
const sceneButtons = [...document.querySelectorAll("[data-scene]")];
const styleButtons = [...document.querySelectorAll("[data-side][data-style]")];

let pointerId = null;

function assetPath(scene, style, width, format) {
  return `assets/${style}-2026-08-27-${scene}-${width}.${format}`;
}

function updatePicture(picture, image, scene, style) {
  const source = picture.querySelector("source");
  source.srcset = `${assetPath(scene, style, 900, "webp")} 900w, ${assetPath(scene, style, 1600, "webp")} 1600w`;
  image.src = assetPath(scene, style, 1600, "jpg");
  image.srcset = `${assetPath(scene, style, 900, "jpg")} 900w, ${assetPath(scene, style, 1600, "jpg")} 1600w`;
  image.alt = `${SCENES[scene].alt}, interpreted with the ${style === "isle-punch" ? "Isle Punch" : style[0].toUpperCase() + style.slice(1)} scan style`;
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
    const active = button.dataset.side === side && button.dataset.style === style;
    if (button.dataset.side !== side) return;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  setPosition(state.position);
}

function setScene(scene) {
  state.scene = scene;
  updatePicture(leftPicture, leftImage, scene, state.leftStyle);
  updatePicture(rightPicture, rightImage, scene, state.rightStyle);
  sceneData.textContent = SCENES[scene].label;
  sceneButtons.forEach((button) => {
    const active = button.dataset.scene === scene;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  setPosition(50);
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

sceneButtons.forEach((button) => {
  button.addEventListener("click", () => setScene(button.dataset.scene));
});

styleButtons.forEach((button) => {
  button.addEventListener("click", () => setStyle(button.dataset.side, button.dataset.style));
});

setPosition(50);
