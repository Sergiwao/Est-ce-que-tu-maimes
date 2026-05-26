const params = new URLSearchParams(location.search);
const secret = params.get("secret");

const prenomInput = document.getElementById("prenom-input");
const setupForm = document.getElementById("setup-form");
const shareLink = document.getElementById("share-link");
const statusWaiting = document.getElementById("status-waiting");
const statusYes = document.getElementById("status-yes");
const statusRdv = document.getElementById("status-rdv");
const yesMessage = document.getElementById("yes-message");
const statusSub = document.getElementById("status-sub");
const rdvDetails = document.getElementById("rdv-details");
const btnReset = document.getElementById("btn-reset");

let lastYes = null;

if (!secret) {
  document.querySelector(".card").innerHTML =
    "<h1>Accès refusé</h1><p>Ouvre cette page depuis le lien affiché dans le terminal au démarrage du serveur.</p>";
} else {
  init();
}

function spawnHearts() {
  const container = document.getElementById("hearts-bg");
  const chars = ["💕", "💖", "💗", "♥"];
  for (let i = 0; i < 12; i++) {
    const el = document.createElement("span");
    el.className = "heart";
    el.textContent = chars[i % chars.length];
    el.style.left = `${Math.random() * 100}%`;
    el.style.animationDuration = `${14 + Math.random() * 12}s`;
    el.style.animationDelay = `${Math.random() * 8}s`;
    container.appendChild(el);
  }
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateFr(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function renderRdvDetails(rdv) {
  rdvDetails.innerHTML = `
    <dt>📅 Date</dt><dd>${formatDateFr(rdv.date)}</dd>
    <dt>🕐 Heure</dt><dd>${rdv.heure}</dd>
    <dt>📍 Lieu</dt><dd>${escapeHtml(rdv.lieu)}</dd>
    <dt>🍽️ Menu</dt><dd>${rdv.menu.emoji} ${escapeHtml(rdv.menu.label)}</dd>
    <dt>✅ Confirmé le</dt><dd>${formatDateTime(rdv.at)}</dd>
  `;
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function showYes(yes) {
  lastYes = yes;
  statusWaiting.style.display = "none";
  statusYes.classList.add("visible");
  yesMessage.textContent = `${yes.prenom} a cliqué sur Oui le ${formatDateTime(yes.at)} 💕`;
}

function showRdv(rdv, yes) {
  showYes(yes || { prenom: rdv.prenom, at: rdv.at });
  statusSub.style.display = "none";
  statusRdv.classList.add("visible");
  renderRdvDetails(rdv);
  launchConfetti();
}

function launchConfetti() {
  const colors = ["#ff6b9d", "#c77dff", "#ffb3d1", "#fff"];
  for (let i = 0; i < 50; i++) {
    const el = document.createElement("div");
    el.className = "confetti";
    el.style.left = `${Math.random() * 100}vw`;
    el.style.top = "0";
    el.style.background = colors[i % colors.length];
    el.style.animationDuration = `${2 + Math.random()}s`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }
}

function resetUI() {
  lastYes = null;
  statusWaiting.style.display = "block";
  statusYes.classList.remove("visible");
  statusRdv.classList.remove("visible");
  statusSub.style.display = "block";
  rdvDetails.innerHTML = "";
}

async function loadStatus() {
  const res = await fetch(`/api/status?secret=${encodeURIComponent(secret)}`);
  if (!res.ok) {
    document.querySelector(".card").innerHTML =
      "<h1>Clé invalide</h1><p>Relance le serveur et utilise le nouveau lien admin.</p>";
    return;
  }
  const data = await res.json();
  prenomInput.value = data.prenom || "";
  const base = location.origin;
  const q = data.prenom ? `?prenom=${encodeURIComponent(data.prenom)}` : "";
  shareLink.textContent = `${base}/${q}`;

  if (data.rendezvous) {
    lastRdvAt = data.rendezvous.at;
    showRdv(data.rendezvous, data.yes);
  } else if (data.yes) {
    lastYesAt = data.yes.at;
    showYes(data.yes);
  }
}

let pollTimer = null;
let lastRdvAt = null;
let lastYesAt = null;

function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(pollForUpdates, 2500);
}

async function pollForUpdates() {
  try {
    const res = await fetch(`/api/status?secret=${encodeURIComponent(secret)}`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.yes && data.yes.at !== lastYesAt) {
      lastYesAt = data.yes.at;
      showYes(data.yes);
      notify("💕 Elle a dit OUI !", `${data.yes.prenom} vient de cliquer sur Oui`);
    }
    if (data.rendezvous && data.rendezvous.at !== lastRdvAt) {
      lastRdvAt = data.rendezvous.at;
      showRdv(data.rendezvous, data.yes);
      const r = data.rendezvous;
      notify(
        "📅 Rendez-vous confirmé !",
        `${r.date} à ${r.heure} — ${r.lieu} — ${r.menu.emoji} ${r.menu.label}`
      );
    }
    if (!data.yes && !data.rendezvous && lastYesAt) resetUI();
  } catch {
    /* réseau */
  }
}

function connectSSE() {
  const es = new EventSource(`/api/events?secret=${encodeURIComponent(secret)}`);
  es.addEventListener("yes", (e) => {
    const payload = JSON.parse(e.data);
    lastYesAt = payload.yes.at;
    showYes(payload.yes);
    notify("💕 Elle a dit OUI !", `${payload.yes.prenom} vient de cliquer sur Oui`);
  });
  es.addEventListener("rendezvous", (e) => {
    const rdv = JSON.parse(e.data);
    lastRdvAt = rdv.at;
    showRdv(rdv, lastYes);
    notify(
      "📅 Rendez-vous confirmé !",
      `${rdv.date} à ${rdv.heure} — ${rdv.lieu} — ${rdv.menu.emoji} ${rdv.menu.label}`
    );
  });
  es.addEventListener("reset", () => {
    lastYesAt = null;
    lastRdvAt = null;
    resetUI();
  });
  es.onerror = () => {
    es.close();
    startPolling();
  };
}

function notify(title, body) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body });
  }
}

setupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const prenom = prenomInput.value.trim();
  if (!prenom) return;
  await fetch("/api/setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prenom, secret }),
  });
  await loadStatus();
  alert(`Prénom enregistré : ${prenom}. Envoie-lui le lien affiché ci-dessous !`);
});

btnReset.addEventListener("click", async () => {
  if (!confirm("Effacer toute la réponse et recommencer ?")) return;
  await fetch("/api/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret }),
  });
  lastYesAt = null;
  lastRdvAt = null;
  resetUI();
});

async function init() {
  spawnHearts();
  await loadStatus();
  connectSSE();
  startPolling();
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}
