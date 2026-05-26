const { getStore } = require("@netlify/blobs");
const { randomBytes } = require("crypto");

const MENUS = {
  pizza: { label: "Pizza", emoji: "🍕" },
  asiatique: { label: "Asiatique", emoji: "🍜", hint: "sushi, ramen…" },
  italien: { label: "Italien", emoji: "🍝", hint: "pâtes, risotto…" },
  burger: { label: "Burger & frites", emoji: "🍔" },
  leger: { label: "Plat léger / salade", emoji: "🥗" },
  sucre: { label: "Envie de sucré", emoji: "🧁", hint: "crêpes, gaufres…" },
};

const STORE_KEY = "app-state";

async function readData() {
  const store = getStore("est-ce-que-tu-maimes");
  const data = await store.get(STORE_KEY, { type: "json" });
  return data || { adminSecret: null, yes: null, rendezvous: null, prenom: "" };
}

async function writeData(data) {
  const store = getStore("est-ce-que-tu-maimes");
  await store.setJSON(STORE_KEY, data);
}

function ensureAdminSecret(data) {
  if (!data.adminSecret) {
    data.adminSecret = randomBytes(16).toString("hex");
  }
  return data.adminSecret;
}

function json(status, body) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  };
}

function routePath(event) {
  const p = event.path || "";
  if (p.startsWith("/api/")) return p;
  if (p.includes("/api/")) return p.slice(p.indexOf("/api/"));
  return p;
}

exports.handler = async (event) => {
  const pathname = routePath(event);
  const method = event.httpMethod;

  try {
    if (pathname === "/api/config" && method === "GET") {
      const data = await readData();
      return json(200, {
        prenom: data.prenom || "",
        dejaOui: Boolean(data.yes),
        rendezvous: data.rendezvous || null,
        menus: MENUS,
      });
    }

    if (pathname === "/api/setup" && method === "POST") {
      const { prenom, secret } = JSON.parse(event.body || "{}");
      const data = await readData();
      if (secret !== data.adminSecret) return json(403, { error: "Secret invalide" });
      if (prenom) data.prenom = String(prenom).trim().slice(0, 40);
      ensureAdminSecret(data);
      await writeData(data);
      return json(200, { ok: true, prenom: data.prenom });
    }

    if (pathname === "/api/yes" && method === "POST") {
      const data = await readData();
      ensureAdminSecret(data);
      if (data.yes) {
        await writeData(data);
        return json(200, { ok: true, already: true, rendezvous: data.rendezvous, ...data.yes });
      }
      data.yes = { at: new Date().toISOString(), prenom: data.prenom || "Elle" };
      await writeData(data);
      return json(200, { ok: true, ...data.yes });
    }

    if (pathname === "/api/rendezvous" && method === "POST") {
      const { date, heure, lieu, menuId } = JSON.parse(event.body || "{}");
      const data = await readData();
      if (!data.yes) return json(400, { error: "Dis oui d'abord 😊" });
      if (data.rendezvous) return json(200, { ok: true, already: true, ...data.rendezvous });

      const menu = MENUS[menuId];
      if (!date || !heure || !lieu || !menu) {
        return json(400, { error: "Tous les champs sont requis" });
      }

      data.rendezvous = {
        at: new Date().toISOString(),
        prenom: data.prenom || data.yes.prenom,
        date: String(date).slice(0, 10),
        heure: String(heure).slice(0, 5),
        lieu: String(lieu).trim().slice(0, 120),
        menu: { id: menuId, label: menu.label, emoji: menu.emoji },
      };
      await writeData(data);
      return json(200, { ok: true, ...data.rendezvous });
    }

    if (pathname === "/api/status" && method === "GET") {
      const secret = event.queryStringParameters?.secret;
      const data = await readData();
      if (secret !== data.adminSecret) return json(403, { error: "Accès refusé" });
      return json(200, {
        prenom: data.prenom || "",
        yes: data.yes,
        rendezvous: data.rendezvous,
      });
    }

    if (pathname === "/api/reset" && method === "POST") {
      const { secret } = JSON.parse(event.body || "{}");
      const data = await readData();
      if (secret !== data.adminSecret) return json(403, { error: "Secret invalide" });
      data.yes = null;
      data.rendezvous = null;
      await writeData(data);
      return json(200, { ok: true });
    }

    if (pathname === "/api/admin-init" && method === "GET") {
      const data = await readData();
      const secret = ensureAdminSecret(data);
      await writeData(data);
      return json(200, { adminSecret: secret });
    }

    return json(404, { error: "Not found" });
  } catch (err) {
    console.error(err);
    return json(500, { error: "Erreur serveur" });
  }
};
