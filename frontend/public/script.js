const REFRESH_MS = 5000;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const COLORS = ["#36E2F5", "#FF3E9A", "#FFE45C"];

const els = {
  title: document.getElementById("title"),
  canvas: document.getElementById("bg"),
  fxCanvas: document.getElementById("fx"),
  card: document.getElementById("card"),
  form: document.getElementById("form"),
  url: document.getElementById("url"),
  alias: document.getElementById("alias"),
  shortenBtn: document.getElementById("shorten-btn"),
  message: document.getElementById("message"),
  status: document.getElementById("status"),
  statusText: document.getElementById("status-text"),
  statLinks: document.getElementById("stat-links"),
  statClicks: document.getElementById("stat-clicks"),
  statTop: document.getElementById("stat-top"),
  result: document.getElementById("result"),
  resultLink: document.getElementById("result-link"),
  resultCopy: document.getElementById("result-copy"),
  table: document.getElementById("table"),
  links: document.getElementById("links"),
  empty: document.getElementById("empty"),
};

/* =========================================================
   Fond animé : une constellation de liens qui réagit à la souris
   ========================================================= */
const bg = {
  ctx: els.canvas.getContext("2d"),
  fx: els.fxCanvas.getContext("2d"),
  width: 0,
  height: 0,
  nodes: [],
  sparks: [],
  mouse: { x: -9999, y: -9999 },
  warp: 0,
};

function resizeBackground() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  bg.width = window.innerWidth;
  bg.height = window.innerHeight;
  for (const canvas of [els.canvas, els.fxCanvas]) {
    canvas.width = bg.width * dpr;
    canvas.height = bg.height * dpr;
  }
  bg.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  bg.fx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const count = Math.min(110, Math.round((bg.width * bg.height) / 16000));
  bg.nodes = Array.from({ length: count }, () => ({
    x: Math.random() * bg.width,
    y: Math.random() * bg.height,
    vx: (Math.random() - 0.5) * 0.4,
    vy: (Math.random() - 0.5) * 0.4,
    r: 1 + Math.random() * 1.8,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }));
}

function moveNodes() {
  const cx = bg.width / 2;
  const cy = bg.height / 2;

  for (const n of bg.nodes) {
    // Effet "hyperespace" : les points sont projetés depuis le centre
    if (bg.warp > 0.01) {
      const dx = n.x - cx;
      const dy = n.y - cy;
      const d = Math.hypot(dx, dy) || 1;
      n.vx += (dx / d) * bg.warp * 0.9;
      n.vy += (dy / d) * bg.warp * 0.9;
    }

    // Attraction douce vers la souris
    const mdx = bg.mouse.x - n.x;
    const mdy = bg.mouse.y - n.y;
    const md = Math.hypot(mdx, mdy);
    if (md < 180 && md > 1) {
      n.vx += (mdx / md) * 0.02;
      n.vy += (mdy / md) * 0.02;
    }

    // Freinage pour revenir à une vitesse calme
    if (Math.hypot(n.vx, n.vy) > 0.6) {
      n.vx *= 0.96;
      n.vy *= 0.96;
    }

    n.x += n.vx;
    n.y += n.vy;

    if (n.x < -20) n.x = bg.width + 20;
    else if (n.x > bg.width + 20) n.x = -20;
    if (n.y < -20) n.y = bg.height + 20;
    else if (n.y > bg.height + 20) n.y = -20;
  }
  bg.warp *= 0.93;
}

function drawBackground() {
  const { ctx } = bg;
  const maxDist = 130;
  ctx.clearRect(0, 0, bg.width, bg.height);

  // Les liens entre les points proches
  ctx.lineWidth = 1;
  for (let i = 0; i < bg.nodes.length; i++) {
    const a = bg.nodes[i];
    for (let j = i + 1; j < bg.nodes.length; j++) {
      const b = bg.nodes[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      if (Math.abs(dx) > maxDist || Math.abs(dy) > maxDist) continue;
      const d = Math.hypot(dx, dy);
      if (d < maxDist) {
        const alpha = (1 - d / maxDist) * 0.35;
        ctx.strokeStyle = i % 2 ? `rgba(255, 62, 154, ${alpha})` : `rgba(54, 226, 245, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }

  // Les points, étirés en traînées pendant l'hyperespace
  for (const n of bg.nodes) {
    if (bg.warp > 0.05) {
      ctx.strokeStyle = n.color;
      ctx.lineWidth = n.r;
      ctx.beginPath();
      ctx.moveTo(n.x - n.vx * 6, n.y - n.vy * 6);
      ctx.lineTo(n.x, n.y);
      ctx.stroke();
    } else {
      ctx.fillStyle = n.color;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Halo sous la souris
  if (bg.mouse.x > -1000) {
    const glow = ctx.createRadialGradient(bg.mouse.x, bg.mouse.y, 0, bg.mouse.x, bg.mouse.y, 220);
    glow.addColorStop(0, "rgba(255, 62, 154, 0.12)");
    glow.addColorStop(1, "rgba(255, 62, 154, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(bg.mouse.x - 220, bg.mouse.y - 220, 440, 440);
  }

}

// Étincelles de célébration, dessinées au premier plan par-dessus la page
function drawSparks() {
  const { fx } = bg;
  fx.clearRect(0, 0, bg.width, bg.height);
  bg.sparks = bg.sparks.filter((s) => s.life > 0);
  for (const s of bg.sparks) {
    s.vy += 0.12;
    s.vx *= 0.99;
    s.x += s.vx;
    s.y += s.vy;
    s.life -= 1;
    fx.globalAlpha = s.life / s.maxLife;
    fx.fillStyle = s.color;
    fx.fillRect(s.x, s.y, s.size, s.size * 0.6);
  }
  fx.globalAlpha = 1;
}

function loop() {
  moveNodes();
  drawBackground();
  drawSparks();
  requestAnimationFrame(loop);
}

function triggerWarp() {
  if (!reduceMotion) bg.warp = 1;
}

function spawnSparks(x, y) {
  if (reduceMotion) return;
  for (let i = 0; i < 70; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 7;
    const life = 50 + Math.random() * 40;
    bg.sparks.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      size: 3 + Math.random() * 4,
      color: COLORS[i % COLORS.length],
      life,
      maxLife: life,
    });
  }
}

/* =========================================================
   Effets d'interface
   ========================================================= */
function restartAnimation(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth; // force le navigateur à rejouer l'animation
  el.classList.add(cls);
}

// Le titre "se raccourcit" au chargement, chaque lettre devient élastique
function splitTitle() {
  const text = els.title.textContent;
  els.title.setAttribute("aria-label", text);
  els.title.textContent = "";
  // Les lettres sont regroupées par mot pour que la ligne ne se coupe qu'entre deux mots
  text.split(" ").forEach((word, index) => {
    if (index > 0) els.title.append(" ");
    const wordSpan = document.createElement("span");
    wordSpan.className = "word";
    wordSpan.setAttribute("aria-hidden", "true");
    for (const ch of word) {
      const span = document.createElement("span");
      span.className = "char";
      span.textContent = ch;
      wordSpan.appendChild(span);
    }
    els.title.appendChild(wordSpan);
  });
  if (!reduceMotion) els.title.classList.add("intro");
}

// La carte s'incline en 3D et un projecteur suit la souris
function setupCard() {
  els.card.addEventListener("pointermove", (e) => {
    const r = els.card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    els.card.style.setProperty("--mx", `${px * 100}%`);
    els.card.style.setProperty("--my", `${py * 100}%`);
    if (!reduceMotion) {
      els.card.style.setProperty("--ry", `${(px - 0.5) * 5}deg`);
      els.card.style.setProperty("--rx", `${(0.5 - py) * 5}deg`);
    }
  });
  els.card.addEventListener("pointerleave", () => {
    els.card.style.setProperty("--rx", "0deg");
    els.card.style.setProperty("--ry", "0deg");
  });
}

// Les boutons principaux sont attirés par le curseur
function setupMagnetic() {
  if (reduceMotion) return;
  document.querySelectorAll(".magnetic").forEach((btn) => {
    btn.addEventListener("pointermove", (e) => {
      const r = btn.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      btn.style.transform = `translate(${dx * 0.25}px, ${dy * 0.35}px)`;
    });
    btn.addEventListener("pointerleave", () => {
      btn.style.transform = "";
    });
  });
}

// Les compteurs défilent jusqu'à leur nouvelle valeur
function animateNumber(el, target) {
  const from = Number(el.dataset.value || 0);
  if (from === target) return;
  el.dataset.value = String(target);
  if (reduceMotion) {
    el.textContent = target;
    return;
  }
  restartAnimation(el, "bump");
  const start = performance.now();
  const duration = 700;
  const tick = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(from + (target - from) * eased);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// Le lien court apparaît en se "décodant"
const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz0123456789/:.-_";
let scrambleRun = 0;

function scrambleTo(el, finalText) {
  if (reduceMotion) {
    el.textContent = finalText;
    return;
  }
  const run = ++scrambleRun;
  const totalFrames = 40;
  let frame = 0;
  const tick = () => {
    if (run !== scrambleRun) return;
    const revealed = Math.floor((frame / totalFrames) * finalText.length);
    let out = finalText.slice(0, revealed);
    for (let i = revealed; i < finalText.length; i++) {
      out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
    }
    el.textContent = out;
    frame++;
    if (frame <= totalFrames) requestAnimationFrame(tick);
    else el.textContent = finalText;
  };
  tick();
}

// Double onde de choc autour du bouton
function shockwave(x, y) {
  if (reduceMotion) return;
  ["ring", "ring late"].forEach((cls) => {
    const ring = document.createElement("div");
    ring.className = cls;
    ring.style.left = `${x}px`;
    ring.style.top = `${y}px`;
    ring.setAttribute("aria-hidden", "true");
    ring.addEventListener("animationend", () => ring.remove());
    document.body.appendChild(ring);
  });
}

function celebrate() {
  const r = els.shortenBtn.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  shockwave(x, y);
  spawnSparks(x, y);
  triggerWarp();
}

async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    const label = button.textContent;
    button.textContent = "Copié !";
    setTimeout(() => { button.textContent = label; }, 1500);
  } catch {
    setMessage("Copie impossible : sélectionnez le lien et copiez-le à la main.");
  }
}

/* =========================================================
   Dialogue avec l'API
   ========================================================= */
async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    let detail = data && data.detail;
    if (Array.isArray(detail)) detail = "URL invalide : elle doit commencer par http:// ou https://";
    throw new Error(detail || `Erreur ${res.status}`);
  }
  return data;
}

function setMessage(text, kind = "error") {
  els.message.textContent = text;
  els.message.className = `message ${kind}`;
  els.message.hidden = !text;
}

function setStatus(online) {
  els.statusText.textContent = online ? "Backend en ligne" : "Backend injoignable";
  els.status.className = `status ${online ? "online" : "offline"}`;
}

function renderStats(stats) {
  animateNumber(els.statLinks, stats.total_links);
  animateNumber(els.statClicks, stats.total_clicks);
  const top = stats.top[0];
  const label = top && top.clicks > 0 ? `/${top.code} (${top.clicks})` : "—";
  if (els.statTop.textContent !== label) {
    els.statTop.textContent = label;
    if (!reduceMotion) restartAnimation(els.statTop, "bump");
  }
}

// Nombre de clics connu par lien, pour animer les nouveautés
let knownClicks = null;

function renderLinks(links) {
  const firstRender = knownClicks === null;
  const previous = knownClicks || new Map();

  els.links.replaceChildren();
  els.table.hidden = links.length === 0;
  els.empty.hidden = links.length !== 0;

  links.forEach((link, index) => {
    const shortUrl = `${location.origin}/${link.code}`;
    const row = document.createElement("tr");

    const linkCell = document.createElement("td");
    const anchor = document.createElement("a");
    anchor.href = shortUrl;
    anchor.target = "_blank";
    anchor.rel = "noopener";
    anchor.textContent = `${location.host}/${link.code}`;
    linkCell.appendChild(anchor);

    const destCell = document.createElement("td");
    destCell.className = "dest";
    destCell.textContent = link.url;
    destCell.title = link.url;

    const clicksCell = document.createElement("td");
    clicksCell.className = "clicks";
    clicksCell.textContent = link.clicks;

    const actionsCell = document.createElement("td");
    actionsCell.className = "actions";

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "btn btn-ghost";
    copyBtn.textContent = "Copier";
    copyBtn.addEventListener("click", () => copyText(shortUrl, copyBtn));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn btn-ghost btn-danger";
    deleteBtn.textContent = "Supprimer";
    deleteBtn.addEventListener("click", async () => {
      if (!confirm(`Supprimer le lien /${link.code} ?`)) return;
      try {
        await api(`/api/links/${encodeURIComponent(link.code)}`, { method: "DELETE" });
        setMessage(`Lien /${link.code} supprimé.`, "success");
        if (reduceMotion) {
          refresh();
          return;
        }
        row.classList.add("row-out");
        row.addEventListener("animationend", () => refresh(), { once: true });
      } catch (err) {
        setMessage(err.message);
      }
    });

    actionsCell.append(copyBtn, deleteBtn);
    row.append(linkCell, destCell, clicksCell, actionsCell);

    if (firstRender) {
      row.classList.add("row-in");
      row.style.setProperty("--i", index);
    } else if (!previous.has(link.code)) {
      row.classList.add("row-in");
    } else if (previous.get(link.code) !== link.clicks) {
      clicksCell.classList.add("flash");
    }

    els.links.appendChild(row);
  });

  knownClicks = new Map(links.map((l) => [l.code, l.clicks]));
}

async function refresh() {
  try {
    await api("/health");
    setStatus(true);
  } catch {
    setStatus(false);
    return;
  }
  try {
    const [stats, links] = await Promise.all([api("/api/stats"), api("/api/links")]);
    renderStats(stats);
    renderLinks(links);
  } catch (err) {
    setMessage(err.message);
  }
}

els.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("");

  const url = els.url.value.trim();
  const alias = els.alias.value.trim();
  if (!url) {
    setMessage("Collez une URL pour commencer.");
    restartAnimation(els.form, "shake");
    return;
  }

  els.shortenBtn.disabled = true;
  try {
    const link = await api("/api/links", {
      method: "POST",
      body: JSON.stringify({ url, alias: alias || null }),
    });
    const fullUrl = `${location.origin}/${link.code}`;
    els.result.hidden = false;
    restartAnimation(els.result, "pop");
    els.resultLink.href = fullUrl;
    scrambleTo(els.resultLink, fullUrl);
    celebrate();
    els.url.value = "";
    els.alias.value = "";
    refresh();
  } catch (err) {
    setMessage(err.message);
    restartAnimation(els.form, "shake");
  } finally {
    els.shortenBtn.disabled = false;
  }
});

els.resultCopy.addEventListener("click", () => copyText(els.resultLink.href, els.resultCopy));

/* =========================================================
   Démarrage
   ========================================================= */
splitTitle();
setupCard();
setupMagnetic();
resizeBackground();

window.addEventListener("resize", () => {
  resizeBackground();
  if (reduceMotion) drawBackground();
});
window.addEventListener("pointermove", (e) => {
  bg.mouse.x = e.clientX;
  bg.mouse.y = e.clientY;
});
document.documentElement.addEventListener("pointerleave", () => {
  bg.mouse.x = -9999;
  bg.mouse.y = -9999;
});

if (reduceMotion) drawBackground();
else requestAnimationFrame(loop);

refresh();
setInterval(refresh, REFRESH_MS);