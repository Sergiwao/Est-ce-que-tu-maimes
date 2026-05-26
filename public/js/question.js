const HINTS = [
  "Le bouton Non a l'air timide…",
  "Essaie encore, il va fuir 😏",
  "Spoiler : seul Oui fonctionne",
  "Tu ne l'attraperas jamais !",
  "Allez, dis oui 💕",
];

const FLEE_RADIUS = 100;
const EDGE_PAD = 10;

const prenomEl = document.getElementById("prenom-display");
const btnYes = document.getElementById("btn-yes");
const btnNo = document.getElementById("btn-no");
const hintEl = document.getElementById("hint");
const questionScreen = document.getElementById("question-screen");
const rdvScreen = document.getElementById("rdv-screen");
const successScreen = document.getElementById("success-screen");
const rdvForm = document.getElementById("rdv-form");
const menuGrid = document.getElementById("menu-grid");
const btnRdvSubmit = document.getElementById("btn-rdv-submit");
const rdvRecap = document.getElementById("rdv-recap");
const mainCard = document.getElementById("main-card");

let hintIndex = 0;
let fleeCount = 0;
let isFleeing = false;
let selectedMenuId = null;
let menusData = {};

function getViewport() {
  const vv = window.visualViewport;
  return {
    left: vv ? vv.offsetLeft : 0,
    top: vv ? vv.offsetTop : 0,
    width: vv ? vv.width : window.innerWidth,
    height: vv ? vv.height : window.innerHeight,
  };
}

function getButtonSize() {
  const rect = btnNo.getBoundingClientRect();
  return { w: rect.width || 90, h: rect.height || 44 };
}

function clampToViewport(x, y) {
  const vp = getViewport();
  const { w, h } = getButtonSize();
  const minX = vp.left + EDGE_PAD;
  const minY = vp.top + EDGE_PAD;
  const maxX = vp.left + vp.width - w - EDGE_PAD;
  const maxY = vp.top + vp.height - h - EDGE_PAD;
  return {
    x: Math.max(minX, Math.min(x, Math.max(minX, maxX))),
    y: Math.max(minY, Math.min(y, Math.max(minY, maxY))),
  };
}

function placeNoButton(x, y) {
  const { x: nx, y: ny } = clampToViewport(x, y);
  btnNo.style.left = `${nx}px`;
  btnNo.style.top = `${ny}px`;
}

function activateFleeing() {
  if (isFleeing) return;
  isFleeing = true;
  const rect = btnNo.getBoundingClientRect();
  btnNo.classList.add("is-fleeing");
  placeNoButton(rect.left, rect.top);
}

function fleePositionAwayFrom(mx, my) {
  const rect = btnNo.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let dx = cx - mx;
  let dy = cy - my;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  const jump = 100 + Math.random() * 80;
  let nx = cx + dx * jump - rect.width / 2;
  let ny = cy + dy * jump - rect.height / 2;
  nx += (Math.random() - 0.5) * 60;
  ny += (Math.random() - 0.5) * 60;
  return clampToViewport(nx, ny);
}

function fleeFromPointer(clientX, clientY) {
  if (!isFleeing) {
    const rect = btnNo.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    if (Math.hypot(clientX - cx, clientY - cy) >= FLEE_RADIUS) return;
    activateFleeing();
  }

  const rect = btnNo.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  if (Math.hypot(clientX - cx, clientY - cy) < FLEE_RADIUS) {
    const pos = fleePositionAwayFrom(clientX, clientY);
    placeNoButton(pos.x, pos.y);
    fleeCount++;
    if (fleeCount % 3 === 0) {
      hintEl.textContent = HINTS[hintIndex % HINTS.length];
      hintIndex++;
    }
  }
}

function hideAllScreens() {
  questionScreen.classList.add("hidden");
  rdvScreen.classList.remove("visible");
  successScreen.classList.remove("visible");
}

function showRdvForm() {
  hideAllScreens();
  btnNo.style.display = "none";
  mainCard.classList.add("card-wide");
  ensureMenus();
  rdvScreen.classList.add("visible");
}

function formatDateFr(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function showConfirmed(rdv) {
  hideAllScreens();
  btnNo.style.display = "none";
  mainCard.classList.add("card-wide");
  rdvRecap.innerHTML = `
    <p><strong>📅</strong> ${formatDateFr(rdv.date)}</p>
    <p><strong>🕐</strong> ${rdv.heure}</p>
    <p><strong>📍</strong> ${escapeHtml(rdv.lieu)}</p>
    <p><strong>${rdv.menu.emoji}</strong> ${escapeHtml(rdv.menu.label)}</p>
  `;
  successScreen.classList.add("visible");
  launchConfetti();
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function menuCardHtml(id, menu) {
  const hint = menu.hint
    ? `<span class="menu-hint">${menu.hint}</span>`
    : "";
  return `<span class="menu-emoji">${menu.emoji}</span><span>${menu.label}</span>${hint}`;
}

function wireMenuButtons() {
  menuGrid.querySelectorAll(".menu-card").forEach((btn) => {
    if (btn.dataset.wired) return;
    btn.dataset.wired = "1";
    btn.addEventListener("click", () => selectMenu(btn.dataset.id, btn));
  });
}

function buildMenuGrid(menus) {
  menusData = menus;
  menuGrid.innerHTML = "";
  for (const [id, menu] of Object.entries(menus)) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "menu-card";
    btn.dataset.id = id;
    btn.innerHTML = menuCardHtml(id, menu);
    btn.addEventListener("click", () => selectMenu(id, btn));
    menuGrid.appendChild(btn);
  }
}

function ensureMenus() {
  const source = typeof MENUS !== "undefined" ? MENUS : menusData;
  if (menuGrid.querySelectorAll(".menu-card").length === 0) {
    buildMenuGrid(source);
  } else {
    menusData = source;
    wireMenuButtons();
  }
}

function selectMenu(id, btn) {
  selectedMenuId = id;
  menuGrid.querySelectorAll(".menu-card").forEach((el) => el.classList.remove("selected"));
  btn.classList.add("selected");
  btnRdvSubmit.disabled = false;
}

function launchConfetti() {
  const colors = ["#ff6b9d", "#c77dff", "#ffb3d1", "#fff", "#ff9ecd"];
  for (let i = 0; i < 60; i++) {
    const el = document.createElement("div");
    el.className = "confetti";
    el.style.left = `${Math.random() * 100}vw`;
    el.style.top = `${-10 - Math.random() * 20}px`;
    el.style.background = colors[i % colors.length];
    el.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
    el.style.animationDuration = `${1.8 + Math.random() * 1.5}s`;
    el.style.animationDelay = `${Math.random() * 0.5}s`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }
}

function spawnHearts() {
  const container = document.getElementById("hearts-bg");
  const chars = ["💕", "💖", "💗", "♥", "✨"];
  for (let i = 0; i < 18; i++) {
    const el = document.createElement("span");
    el.className = "heart";
    el.textContent = chars[i % chars.length];
    el.style.left = `${Math.random() * 100}%`;
    el.style.animationDuration = `${12 + Math.random() * 18}s`;
    el.style.animationDelay = `${Math.random() * 10}s`;
    el.style.fontSize = `${0.8 + Math.random() * 1.2}rem`;
    container.appendChild(el);
  }
}

function initDateField() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateInput = document.getElementById("rdv-date");
  dateInput.min = new Date().toISOString().slice(0, 10);
  if (!dateInput.value) {
    dateInput.value = tomorrow.toISOString().slice(0, 10);
  }
}

async function loadConfig() {
  ensureMenus();
  initDateField();

  let data = {};
  try {
    const res = await fetch("/api/config");
    data = await res.json();
    if (data.menus && Object.keys(data.menus).length > 0) {
      menusData = data.menus;
    }
  } catch {
    /* hors-ligne ou ancien serveur : les menus HTML suffisent */
  }

  const urlPrenom = new URLSearchParams(location.search).get("prenom");
  prenomEl.textContent = urlPrenom || data.prenom || "toi";

  if (data.rendezvous) showConfirmed(data.rendezvous);
  else if (data.dejaOui) showRdvForm();
}

btnNo.addEventListener("mouseenter", (e) => fleeFromPointer(e.clientX, e.clientY));
btnNo.addEventListener("mousemove", (e) => fleeFromPointer(e.clientX, e.clientY));
btnNo.addEventListener("touchstart", (e) => {
  e.preventDefault();
  fleeFromPointer(e.touches[0].clientX, e.touches[0].clientY);
});
btnNo.addEventListener("click", (e) => {
  e.preventDefault();
  fleeFromPointer(e.clientX, e.clientY);
});
document.addEventListener("mousemove", (e) => fleeFromPointer(e.clientX, e.clientY));

btnYes.addEventListener("click", async () => {
  btnYes.disabled = true;
  btnYes.textContent = "…";
  try {
    const res = await fetch("/api/yes", { method: "POST" });
    const data = await res.json();
    if (data.ok) {
      if (data.rendezvous) showConfirmed(data.rendezvous);
      else showRdvForm();
    }
  } catch {
    btnYes.disabled = false;
    btnYes.textContent = "Oui 💕";
    alert("Petit souci réseau — réessaie !");
  }
});

rdvForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!selectedMenuId) return;

  btnRdvSubmit.disabled = true;
  btnRdvSubmit.textContent = "…";

  const payload = {
    date: document.getElementById("rdv-date").value,
    heure: document.getElementById("rdv-heure").value,
    lieu: document.getElementById("rdv-lieu").value.trim(),
    menuId: selectedMenuId,
  };

  try {
    const res = await fetch("/api/rendezvous", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.ok) showConfirmed(data);
    else {
      alert(data.error || "Erreur");
      btnRdvSubmit.disabled = false;
      btnRdvSubmit.textContent = "Confirmer le rendez-vous 💕";
    }
  } catch {
    alert("Petit souci réseau — réessaie !");
    btnRdvSubmit.disabled = false;
    btnRdvSubmit.textContent = "Confirmer le rendez-vous 💕";
  }
});

window.addEventListener("resize", () => {
  if (isFleeing) {
    const rect = btnNo.getBoundingClientRect();
    placeNoButton(rect.left, rect.top);
  }
});

window.visualViewport?.addEventListener("resize", () => {
  if (isFleeing) {
    const rect = btnNo.getBoundingClientRect();
    placeNoButton(rect.left, rect.top);
  }
});

spawnHearts();
ensureMenus();
loadConfig();
