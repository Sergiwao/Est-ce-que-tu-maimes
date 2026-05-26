const http = require("http");
const fs = require("fs");
const path = require("path");
const { randomBytes } = require("crypto");

const PORT = process.env.PORT || 3847;
const DATA_FILE = path.join(__dirname, "data.json");
const PUBLIC_DIR = path.join(__dirname, "public");

const MENUS = {
  pizza: { label: "Pizza", emoji: "🍕" },
  asiatique: { label: "Asiatique", emoji: "🍜", hint: "sushi, ramen…" },
  italien: { label: "Italien", emoji: "🍝", hint: "pâtes, risotto…" },
  burger: { label: "Burger & frites", emoji: "🍔" },
  leger: { label: "Plat léger / salade", emoji: "🥗" },
  sucre: { label: "Envie de sucré", emoji: "🧁", hint: "crêpes, gaufres…" },
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
};

function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return { adminSecret: null, yes: null, rendezvous: null };
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function ensureAdminSecret(data) {
  if (!data.adminSecret) {
    data.adminSecret = randomBytes(16).toString("hex");
    writeData(data);
  }
  return data.adminSecret;
}

const sseClients = new Set();

function broadcast(event, payload) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) {
    res.write(msg);
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("invalid json"));
      }
    });
    req.on("error", reject);
  });
}

function serveStatic(filePath, res) {
  const ext = path.extname(filePath);
  const type = MIME[ext] || "application/octet-stream";
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (pathname === "/api/config" && req.method === "GET") {
    const data = readData();
    return sendJson(res, 200, {
      prenom: data.prenom || "",
      dejaOui: Boolean(data.yes),
      rendezvous: data.rendezvous || null,
      menus: MENUS,
    });
  }

  if (pathname === "/api/setup" && req.method === "POST") {
    try {
      const { prenom, secret } = await readBody(req);
      const data = readData();
      const adminSecret = ensureAdminSecret(data);
      if (secret !== adminSecret) {
        return sendJson(res, 403, { error: "Secret invalide" });
      }
      if (prenom && typeof prenom === "string") {
        data.prenom = prenom.trim().slice(0, 40);
        writeData(data);
      }
      return sendJson(res, 200, { ok: true, prenom: data.prenom });
    } catch {
      return sendJson(res, 400, { error: "Requête invalide" });
    }
  }

  if (pathname === "/api/yes" && req.method === "POST") {
    const data = readData();
    if (data.yes) {
      return sendJson(res, 200, {
        ok: true,
        already: true,
        rendezvous: data.rendezvous || null,
        ...data.yes,
      });
    }
    const yes = {
      at: new Date().toISOString(),
      prenom: data.prenom || "Elle",
    };
    data.yes = yes;
    writeData(data);
    broadcast("yes", { yes, rendezvous: data.rendezvous || null });
    return sendJson(res, 200, { ok: true, ...yes });
  }

  if (pathname === "/api/rendezvous" && req.method === "POST") {
    try {
      const { date, heure, lieu, menuId } = await readBody(req);
      const data = readData();

      if (!data.yes) {
        return sendJson(res, 400, { error: "Dis oui d'abord 😊" });
      }
      if (data.rendezvous) {
        return sendJson(res, 200, { ok: true, already: true, ...data.rendezvous });
      }

      if (!date || !heure || !lieu || !menuId) {
        return sendJson(res, 400, { error: "Tous les champs sont requis" });
      }
      const menu = MENUS[menuId];
      if (!menu) {
        return sendJson(res, 400, { error: "Menu invalide" });
      }

      const rendezvous = {
        at: new Date().toISOString(),
        prenom: data.prenom || data.yes.prenom,
        date: String(date).slice(0, 10),
        heure: String(heure).slice(0, 5),
        lieu: String(lieu).trim().slice(0, 120),
        menu: { id: menuId, label: menu.label, emoji: menu.emoji },
      };

      data.rendezvous = rendezvous;
      writeData(data);
      broadcast("rendezvous", rendezvous);
      return sendJson(res, 200, { ok: true, ...rendezvous });
    } catch {
      return sendJson(res, 400, { error: "Requête invalide" });
    }
  }

  if (pathname === "/api/status" && req.method === "GET") {
    const data = readData();
    const secret = url.searchParams.get("secret");
    if (secret !== data.adminSecret) {
      return sendJson(res, 403, { error: "Accès refusé" });
    }
    return sendJson(res, 200, {
      prenom: data.prenom || "",
      yes: data.yes,
      rendezvous: data.rendezvous,
      adminUrl: `/admin.html?secret=${data.adminSecret}`,
    });
  }

  if (pathname === "/api/reset" && req.method === "POST") {
    try {
      const { secret } = await readBody(req);
      const data = readData();
      if (secret !== data.adminSecret) {
        return sendJson(res, 403, { error: "Secret invalide" });
      }
      data.yes = null;
      data.rendezvous = null;
      writeData(data);
      broadcast("reset", {});
      return sendJson(res, 200, { ok: true });
    } catch {
      return sendJson(res, 400, { error: "Requête invalide" });
    }
  }

  if (pathname === "/api/admin-init" && req.method === "GET") {
    const data = readData();
    const secret = ensureAdminSecret(data);
    writeData(data);
    return sendJson(res, 200, { adminSecret: secret });
  }

  if (pathname === "/api/events" && req.method === "GET") {
    const data = readData();
    const secret = url.searchParams.get("secret");
    if (secret !== data.adminSecret) {
      return sendJson(res, 403, { error: "Accès refusé" });
    }
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write(": connected\n\n");
    if (data.yes) {
      res.write(
        `event: yes\ndata: ${JSON.stringify({ yes: data.yes, rendezvous: data.rendezvous })}\n\n`
      );
    }
    if (data.rendezvous) {
      res.write(`event: rendezvous\ndata: ${JSON.stringify(data.rendezvous)}\n\n`);
    }
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
    return;
  }

  let filePath = path.join(PUBLIC_DIR, pathname === "/" ? "index.html" : pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  if (!path.extname(filePath)) {
    filePath += ".html";
  }
  serveStatic(filePath, res);
});

server.listen(PORT, () => {
  const data = readData();
  const secret = ensureAdminSecret(data);
  console.log("");
  console.log("  💕  Est-ce que tu m'aimes ?");
  console.log("");
  console.log(`  Page pour elle :  http://localhost:${PORT}/`);
  console.log(`  Ton dashboard   :  http://localhost:${PORT}/admin.html?secret=${secret}`);
  console.log("");
  console.log("  Garde l'URL admin pour toi seul — c'est ta clé secrète.");
  console.log("");
});
