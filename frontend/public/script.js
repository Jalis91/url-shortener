const REFRESH_MS = 5000;

const els = {
  form: document.getElementById("form"),
  url: document.getElementById("url"),
  alias: document.getElementById("alias"),
  message: document.getElementById("message"),
  status: document.getElementById("status"),
  statLinks: document.getElementById("stat-links"),
  statClicks: document.getElementById("stat-clicks"),
  statTop: document.getElementById("stat-top"),
  table: document.getElementById("table"),
  links: document.getElementById("links"),
  empty: document.getElementById("empty"),
};

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
  els.status.textContent = online ? "Backend en ligne" : "Backend injoignable";
  els.status.className = `status ${online ? "online" : "offline"}`;
}

function renderStats(stats) {
  els.statLinks.textContent = stats.total_links;
  els.statClicks.textContent = stats.total_clicks;
  const top = stats.top[0];
  els.statTop.textContent = top && top.clicks > 0 ? `/${top.code} (${top.clicks})` : "—";
}

function renderLinks(links) {
  els.links.replaceChildren();
  els.table.hidden = links.length === 0;
  els.empty.hidden = links.length !== 0;

  for (const link of links) {
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
    clicksCell.textContent = link.clicks;

    const actionsCell = document.createElement("td");
    actionsCell.className = "actions";

    const copyBtn = document.createElement("button");
    copyBtn.className = "small";
    copyBtn.textContent = "Copier";
    copyBtn.addEventListener("click", async () => {
      await navigator.clipboard.writeText(shortUrl);
      copyBtn.textContent = "Copié !";
      setTimeout(() => { copyBtn.textContent = "Copier"; }, 1500);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "small danger";
    deleteBtn.textContent = "Supprimer";
    deleteBtn.addEventListener("click", async () => {
      if (!confirm(`Supprimer le lien /${link.code} ?`)) return;
      try {
        await api(`/api/links/${encodeURIComponent(link.code)}`, { method: "DELETE" });
        setMessage(`Lien /${link.code} supprimé.`, "success");
        refresh();
      } catch (err) {
        setMessage(err.message);
      }
    });

    actionsCell.append(copyBtn, deleteBtn);
    row.append(linkCell, destCell, clicksCell, actionsCell);
    els.links.appendChild(row);
  }
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
    setMessage("Entre une URL.");
    return;
  }

  try {
    const link = await api("/api/links", {
      method: "POST",
      body: JSON.stringify({ url, alias: alias || null }),
    });
    setMessage(`Lien créé : ${location.origin}/${link.code}`, "success");
    els.url.value = "";
    els.alias.value = "";
    refresh();
  } catch (err) {
    setMessage(err.message);
  }
});

refresh();
setInterval(refresh, REFRESH_MS);