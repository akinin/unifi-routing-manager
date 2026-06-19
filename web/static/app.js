const state = {
  status: null,
  busy: false,
};

const $ = (selector) => document.querySelector(selector);

const icons = {
  unifi: "/assets/brand/u-logo.svg",
  unifiOs: "/assets/brand/unifi-os.svg",
  unifiNetwork: "/assets/brand/u-logo.svg",
  ubiquiti: "/assets/brand/u-logo.svg",
  wireguard: "/assets/brand/wireguard.svg",
  image: "/assets/brand/u-logo.svg",
};

const inlineIcons = {
  route: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 18.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/><path d="M17.5 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/><path d="M9 16h3.5c2.2 0 4-1.8 4-4v-1.5"/></svg>',
  dns: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7.5h14"/><path d="M5 12h14"/><path d="M5 16.5h14"/><path d="M7 4.5h10c1.1 0 2 .9 2 2v11c0 1.1-.9 2-2 2H7c-1.1 0-2-.9-2-2v-11c0-1.1.9-2 2-2Z"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M18.2 9A7 7 0 0 0 6.5 7.2L4 10"/><path d="M5.8 15A7 7 0 0 0 17.5 16.8L20 14"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10-6.5-10-6.5Z"/></svg>',
  stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10v10H7z"/></svg>',
  terminal: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 8 4 4-4 4"/><path d="M12.5 16H17"/><path d="M4 5h16v14H4z"/></svg>',
};

function icon(name) {
  if (inlineIcons[name]) {
    return `<span class="icon">${inlineIcons[name]}</span>`;
  }
  const src = icons[name] || icons.unifi;
  return `<span class="icon"><img src="${src}" alt="" loading="lazy"></span>`;
}

function actionButton(action, label, iconName, danger = false) {
  return `<button class="${danger ? "danger" : ""}" data-action="${action}">${icon(iconName)}<span>${label}</span></button>`;
}

function badge(value) {
  const text = String(value || "unknown");
  let tone = "";
  if (["active", "enabled", "configured"].includes(text.toLowerCase())) tone = "ok";
  if (["inactive", "disabled", "unknown", "not configured", "unavailable"].includes(text.toLowerCase())) tone = "warn";
  if (["failed", "error"].includes(text)) tone = "bad";
  return `<span class="badge ${tone}"><span class="badge-dot"></span><span>${escapeHtml(text)}</span></span>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function getJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

function renderMetrics(data) {
  const cloud = data.projects.find((item) => item.key === "cloud");
  const updates = data.projects.find((item) => item.key === "updates");
  const totalRules = [cloud?.rules, updates?.rules]
    .map((value) => Number(value))
    .filter(Number.isFinite)
    .reduce((sum, value) => sum + value, 0);

  $("#overview").innerHTML = [
    ["unifiNetwork", "Cloud tunnel", cloud?.activeName || "unknown"],
    ["wireguard", "Updates tunnel", updates?.activeName || "unknown"],
    ["route", "Policy rules", totalRules || "unknown"],
    ["dns", "DNSCrypt", data.dnscrypt.service || "unknown"],
    ["unifi", "Web UI", data.web?.service || "unknown"],
  ]
    .map(([iconName, label, value]) => `<article class="metric">${icon(iconName)}<div><span>${label}</span><strong>${escapeHtml(value)}</strong></div></article>`)
    .join("");
}

function readableFileLabel(label) {
  return {
    domains: "Domains",
    networks: "Networks",
    addresses: "Resolved IP addresses",
  }[label] || label;
}

function eventLine(event, fallback) {
  if (!event) return escapeHtml(fallback || "No recent activity");
  const time = event.time ? `<span>${escapeHtml(event.time)}</span>` : "";
  return `${escapeHtml(event.message || fallback || "No recent activity")}${time}`;
}

function renderProject(project) {
  const sampleHtml = Object.entries(project.samples || {})
    .map(([label, values]) => {
      const chips = values.length
        ? values.map((value) => `<code>${escapeHtml(value)}</code>`).join("")
        : `<p>No entries</p>`;
      return `<div><h3>${escapeHtml(readableFileLabel(label))}</h3>${chips}</div>`;
    })
    .join("");

  const projectIcon = project.key === "cloud" ? "unifiNetwork" : "wireguard";
  return `
    <section class="panel" id="${project.key}">
      <div class="panel-head">
        <div class="title-row">
          ${icon(projectIcon)}
          <div>
            <h2>${escapeHtml(project.title)}</h2>
            <p class="event">${eventLine(project.lastEvent, project.lastLog)}</p>
          </div>
        </div>
        <div class="actions">
          ${actionButton(`${project.key}.start`, "Start", "play")}
          ${actionButton(`${project.key}.restart`, "Restart", "refresh")}
          ${actionButton(`${project.key}.stop`, "Stop", "stop", true)}
        </div>
      </div>
      <div class="status-row">
        <div class="status-cell"><span>Status</span><strong>${badge(project.configured ? "configured" : "not configured")}</strong></div>
        <div class="status-cell"><span>WG</span><strong>${escapeHtml(project.activeName)}</strong></div>
        <div class="status-cell"><span>Interface</span><strong>${escapeHtml(project.activeIface)}</strong></div>
        <div class="status-cell"><span>Table</span><strong>${escapeHtml(project.activeTable)}</strong></div>
      </div>
      <div class="status-row">
        <div class="status-cell"><span>Timer</span><strong>${badge(project.timer)}</strong></div>
        <div class="status-cell"><span>Enabled</span><strong>${badge(project.enabled)}</strong></div>
        <div class="status-cell"><span>Rules</span><strong>${escapeHtml(project.rules)}</strong></div>
        <div class="status-cell"><span>Entries</span><strong>${escapeHtml(Object.values(project.counts || {}).join(" / ") || "0")}</strong></div>
      </div>
      <div class="list">${sampleHtml}</div>
    </section>
  `;
}

function renderStatus(data) {
  state.status = data;
  const address = data.host === "0.0.0.0" ? `LAN access on port ${data.port}` : `${data.host}:${data.port}`;
  $("#rootPath").textContent = `${address} · root ${data.root}`;
  renderMetrics(data);
  $("#projects").innerHTML = data.projects.map(renderProject).join("");

  $("#dnscryptStatus").innerHTML = `
    <div><span>Service</span><strong>${badge(data.dnscrypt.service)}</strong></div>
    <div><span>Domains</span><strong>${escapeHtml(data.dnscrypt.domains)}</strong></div>
    <div><span>Forwarding</span><strong>${escapeHtml(data.dnscrypt.forwarding)}</strong></div>
    <div><span>Last activity</span><strong class="event-compact">${eventLine(data.dnscrypt.lastEvent, data.dnscrypt.lastLog)}</strong></div>
  `;

  $("#iconsStatus").innerHTML = `
    <div><span>Directory</span><strong>${badge(data.ispIcons.exists ? "configured" : "not configured")}</strong></div>
    <div><span>Icons</span><strong>${escapeHtml(data.ispIcons.icons)}</strong></div>
    <div><span>Path</span><strong>${escapeHtml(data.ispIcons.directory)}</strong></div>
    <div><span>Last activity</span><strong class="event-compact">${eventLine(data.ispIcons.lastEvent, data.ispIcons.lastLog)}</strong></div>
  `;
}

async function refresh() {
  const data = await getJson("/api/status");
  renderStatus(data);
  enhanceButtons();
  await loadLogs();
}

async function loadLogs() {
  const target = $("#logTarget").value;
  const data = await getJson(`/api/logs?target=${encodeURIComponent(target)}&lines=160`);
  $("#logBox").textContent = data.log || "No log entries.";
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.hidden = true;
  }, 7000);
}

function enhanceButtons() {
  const actionIcons = {
    "dnscrypt.update": "refresh",
    "dnscrypt.extract": "dns",
    "dnscrypt.generate": "route",
    "dnscrypt.restart": "refresh",
    "icons.install": "image",
  };

  document.querySelectorAll("button[data-action]").forEach((button) => {
    if (button.querySelector(".icon")) return;
    const label = button.textContent.trim();
    const iconName = actionIcons[button.dataset.action] || "play";
    button.innerHTML = `${icon(iconName)}<span>${escapeHtml(label)}</span>`;
  });

  const refreshBtn = $("#refreshBtn");
  if (refreshBtn && !refreshBtn.querySelector(".icon")) {
    refreshBtn.innerHTML = `${icon("refresh")}<span>Refresh</span>`;
  }
}

async function runAction(action) {
  if (state.busy) return;
  state.busy = true;
  showToast(`Running ${action}...`);
  try {
    const result = await getJson("/api/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    showToast(`${result.ok ? "Done" : "Failed"}: ${action}\n${result.output || ""}`.trim());
    await refresh();
  } catch (error) {
    showToast(error.message);
  } finally {
    state.busy = false;
  }
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (button) runAction(button.dataset.action);
});

$("#refreshBtn").addEventListener("click", refresh);
$("#logTarget").addEventListener("change", loadLogs);
enhanceButtons();

refresh().catch((error) => {
  showToast(error.message);
});
