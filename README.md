# 💕 Est-ce que tu m'aimes ?

Page romantique : bouton **Non** qui fuit, **Oui** → formulaire de rendez-vous (date, heure, lieu, envie de manger), dashboard admin pour tout voir en direct.

## Démarrage local

```bash
npm install
node server.js
```

- **Page pour elle :** http://localhost:3847/
- **Ton dashboard :** lien avec `admin.html?secret=...` affiché dans le terminal

> ⚠️ `localhost` ne marche que sur ton PC. Pour lui envoyer le lien sur son téléphone, il faut héberger en ligne (voir ci-dessous).

---

## Hébergement en ligne (obligatoire pour lui envoyer le lien)

Tu as parlé de **Netlify** (pas Netflix 😄) — les deux options marchent **sans Supabase**.

### Option A — Render (le plus simple, recommandé)

1. Crée un compte sur [render.com](https://render.com)
2. Pousse le projet sur **GitHub**
3. **New → Web Service** → connecte le repo
4. Render détecte `render.yaml` et lance `node server.js`
5. Tu obtiens une URL du type `https://est-ce-que-tu-maimes.onrender.com`
6. Ouvre `https://ton-url.onrender.com/api/admin-init` une fois pour récupérer ton secret, ou regarde les logs au premier `node server.js` en local

**Dashboard admin :** `https://ton-url.onrender.com/admin.html?secret=TA_CLE`

### Option B — Netlify (sans Supabase)

Netlify héberge les fichiers + des **Functions** qui stockent les réponses (Netlify Blobs, inclus).

1. Compte sur [netlify.com](https://netlify.com)
2. **Add new site → Import from Git** (GitHub)
3. Build settings :
   - **Publish directory :** `public`
   - **Functions directory :** `netlify/functions`
4. Déploie

**Récupérer ta clé admin :** ouvre une fois  
`https://ton-site.netlify.app/api/admin-init`  
→ copie `adminSecret`  
→ dashboard : `https://ton-site.netlify.app/admin.html?secret=TA_CLE`

Sur Netlify, le dashboard **rafraîchit toutes les 2 secondes** (pas de temps réel SSE, mais tu vois tout pareil).

---

## Ce que tu vois côté admin

1. Elle clique **Oui**
2. Elle remplit date, heure, lieu, et choisit ce qu’elle a envie de manger (6 cartes)
3. Tu vois tout : date, heure, lieu, plat choisi

---

## Personnalisation

- Prénom dans l’URL : `/?prenom=Marie`
- Plats proposés : `public/js/menus.js` et les boutons dans `public/index.html`
