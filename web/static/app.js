const state = {
  status: null,
  busy: false,
  files: null,
  editorKey: "",
  downloadKind: "",
  autoTimer: null,
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
  cloud: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.5 18H8a4 4 0 1 1 .7-7.94A5.5 5.5 0 0 1 19 12.5h.5a2.75 2.75 0 0 1 0 5.5h-2"/></svg>',
  update: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v10"/><path d="m8 10 4 4 4-4"/><path d="M5 18h14"/></svg>',
  download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z"/></svg>',
  imagePlus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v14H5z"/><path d="m5 15 4-4 3 3 2-2 5 5"/><path d="M16 4v6"/><path d="M13 7h6"/></svg>',
  flag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4"/><path d="M5 5h11l-1 4 1 4H5"/></svg>',
  globe: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.4 2.4 3.6 5.4 3.6 9S14.4 18.6 12 21"/><path d="M12 3c-2.4 2.4-3.6 5.4-3.6 9S9.6 18.6 12 21"/></svg>',
  moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a7 7 0 1 0 11 11Z"/></svg>',
  sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>',
  chevronDown: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  chevronUp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>',
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
  const brandClass = ["unifi", "unifiOs", "unifiNetwork", "ubiquiti", "image"].includes(name) ? " brand-mark" : "";
  return `<span class="icon${brandClass}"><img src="${src}" alt="" loading="lazy"></span>`;
}

function providerIcon(item) {
  if (item.icon) {
    return `<span class="icon provider-mark"><img src="${escapeHtml(item.icon)}" alt="" loading="lazy"></span>`;
  }
  const text = (item.isp || item.label || "IP")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "IP";
  return `<span class="icon provider-mark fallback">${escapeHtml(text)}</span>`;
}

function actionButton(action, label, iconName, options = {}) {
  const classes = [options.danger ? "danger" : "", options.state || ""].filter(Boolean).join(" ");
  return `<button class="${classes}" data-action="${action}">${icon(iconName)}<span>${label}</span></button>`;
}

const editorLabels = {
  "cloud.domains": "Cloud domains",
  "cloud.networks": "Cloud manual networks",
  "updates.domains": "Updates domains",
  "updates.networks": "Updates manual networks",
  "wg.map": "WireGuard map",
};

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
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    throw new Error(payload?.output || payload?.error || `Request failed: ${response.status}`);
  }
  return payload;
}

function renderConnections(data) {
  const connections = (data.connections || []).filter((item) => item.ip && item.ip !== "N/A");
  $("#connectionsList").innerHTML = connections.length
    ? `
      <div class="connection header">
        <div>Connection</div>
        <div>IP</div>
        <div>Country</div>
        <div>Provider</div>
      </div>
      ${connections
        .map((item) => {
          const active = item.active ? item.activeFor.map((tag) => `<span class="active-pill">${escapeHtml(tag)}</span>`).join("") : "";
          const title = item.iface
            ? `${escapeHtml(item.label)} <span>${escapeHtml(item.iface)}</span>`
            : "ISP";
          const country = item.countryCode && item.countryCode !== "Unknown"
            ? `${item.flag ? `<img class="flag" src="${escapeHtml(item.flag)}" alt="">` : ""}${escapeHtml(item.countryCode)} · ${escapeHtml(item.country)}`
            : escapeHtml(item.country || "Unknown");
          const provider = `${item.icon ? `<img class="provider-inline" src="${escapeHtml(item.icon)}" alt="">` : ""}${escapeHtml(item.isp)}`;
          return `
            <article class="connection ${item.active ? "active" : ""}">
              <div class="connection-title">
                ${icon(item.iface ? "wireguard" : "globe")}
                <div><strong>${title}</strong>${active}</div>
              </div>
              <div><strong>${escapeHtml(item.ip)}</strong></div>
              <div><strong class="inline-media">${country}</strong></div>
              <div><strong class="inline-media">${provider}</strong></div>
            </article>
          `;
        })
        .join("")}`
    : `<p class="empty">No connection data.</p>`;
}

function readableFileLabel(label) {
  return {
    domains: "Domains",
    networks: "Networks",
    addresses: "Resolved IP addresses",
  }[label] || label;
}

function editorKeyFor(projectKey, label) {
  if (projectKey === "cloud" && label === "domains") return "cloud.domains";
  if (projectKey === "cloud" && label === "networks") return "cloud.networks";
  if (projectKey === "updates" && label === "domains") return "updates.domains";
  if (projectKey === "updates" && label === "networks") return "updates.networks";
  return "";
}

function eventLine(event, fallback) {
  if (!event) return escapeHtml(fallback || "No recent activity");
  const time = event.time ? `<span>${escapeHtml(event.time)}</span>` : "";
  return `${escapeHtml(event.message || fallback || "No recent activity")}${time}`;
}

function eventTime(event, fallback) {
  if (event?.time) return escapeHtml(event.time);
  const text = String(fallback || "");
  const match = text.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
  return match ? escapeHtml(match[0]) : "No recent activity";
}

function compactEvent(label, event, fallback) {
  const time = eventTime(event, fallback);
  const safeLabel = escapeHtml(label || "");
  if (time === "No recent activity") return safeLabel || time;
  return safeLabel ? `${safeLabel} - ${time}` : time;
}

function statusDot(value) {
  const text = String(value || "").toLowerCase();
  const ok = ["active", "enabled", "configured"].includes(text) || Number(value) > 0;
  return `<span class="status-dot ${ok ? "ok" : "bad"}" title="${escapeHtml(String(value || "unknown"))}"></span>`;
}

function isActiveState(value) {
  return String(value || "").toLowerCase() === "active";
}

function setActionState(action, state) {
  const button = document.querySelector(`button[data-action="${action}"]`);
  if (!button) return;
  button.classList.remove("state-ok", "state-bad");
  if (state) button.classList.add(state);
}

function renderProject(project) {
  const sampleHtml = Object.entries(project.samples || {})
    .map(([label, values]) => {
      const chips = values.length
        ? values.map((value) => `<code>${escapeHtml(value)}</code>`).join("")
        : `<p>No entries</p>`;
      const editorKey = editorKeyFor(project.key, label);
      const editButton = editorKey ? `<button class="icon-button edit-button" data-open-editor="${editorKey}" type="button" title="Edit" aria-label="Edit ${escapeHtml(readableFileLabel(label))}">${icon("edit")}</button>` : "";
      return `<div><div class="list-head"><h3>${escapeHtml(readableFileLabel(label))}</h3>${editButton}</div>${chips}</div>`;
    })
    .join("");

  const projectIcon = project.key === "cloud" ? "cloud" : "update";
  const active = isActiveState(project.timer);
  const projectEvent = compactEvent("", project.lastEvent, project.lastLog);
  const projectSubtitle = [project.activeName || "not configured", projectEvent]
    .filter((value) => value && value !== "unknown")
    .join(" - ");
  return `
    <section class="panel" id="${project.key}">
      <div class="panel-head">
        <div class="title-row">
            ${icon(projectIcon)}
          <div>
            <h2>${statusDot(project.timer)}${escapeHtml(project.title)}</h2>
            <p class="event">${escapeHtml(projectSubtitle || "not configured")}</p>
          </div>
        </div>
        <div class="actions">
          ${actionButton(`${project.key}.start`, "Start", "play", { state: active ? "state-ok" : "" })}
          ${actionButton(`${project.key}.restart`, "Restart", "refresh")}
          ${actionButton(`${project.key}.stop`, "Stop", "stop", { danger: true, state: active ? "" : "state-bad" })}
        </div>
      </div>
      <div class="status-row">
        <div class="status-cell"><span>Table</span><strong>${escapeHtml(project.activeTable)}</strong></div>
        <div class="status-cell"><span>Timer</span><strong>${badge(project.timer)}</strong></div>
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
  const rootPath = $("#rootPath");
  if (rootPath) rootPath.textContent = `${address} - root ${data.root}`;
  renderConnections(data);
  $("#projects").innerHTML = data.projects.map(renderProject).join("");

  $("#dnscryptTitle").innerHTML = `
    ${icon("dns")}
    <div>
      <h2>${statusDot(data.dnscrypt.service)}DNSCrypt</h2>
      <p class="event">${compactEvent("Forwarding rules", data.dnscrypt.lastEvent, data.dnscrypt.lastLog)}</p>
    </div>
  `;

  $("#dnscryptStatus").innerHTML = `
    <div><span>Timer</span><strong>${badge(data.dnscrypt.timer)}</strong></div>
    <div><span>Domains</span><strong>${escapeHtml(data.dnscrypt.domains)}</strong></div>
    <div><span>DNS route</span><strong>${escapeHtml(data.dnscrypt.route?.name || data.dnscrypt.route?.iface || "unknown")}</strong></div>
  `;
  $("#dnscryptDomains").innerHTML = (data.dnscrypt.samples || [])
    .map((value) => `<code>${escapeHtml(value)}</code>`)
    .join("") || "<p>No domains</p>";

  $("#iconsTitle").innerHTML = `
      ${icon("globe")}
    <div>
      <h2>${statusDot(data.ispIcons.icons)}ISP Icons</h2>
      <p class="event">${compactEvent("Local icon", data.ispIcons.lastEvent, data.ispIcons.lastLog)}</p>
    </div>
  `;

  $("#iconsStatus").innerHTML = `
    <div><span>Icons</span><strong>${escapeHtml(data.ispIcons.icons)}</strong></div>
    <div><span>Timer</span><strong>${badge(data.ispIcons.exists ? "active" : "inactive")}</strong></div>
  `;
  $("#iconsList").innerHTML = (data.ispIcons.items || [])
    .map((item) => `<article class="isp-icon-item"><img src="${escapeHtml(item.url)}" alt=""><span>${escapeHtml(item.name)}</span></article>`)
    .join("") || "<p>No icons</p>";

  const dnsActive = isActiveState(data.dnscrypt.service);
  setActionState("dnscrypt.start", dnsActive ? "state-ok" : "");
  setActionState("dnscrypt.stop", dnsActive ? "" : "state-bad");
  const iconsActive = Boolean(data.ispIcons.exists && Number(data.ispIcons.icons) > 0);
  setActionState("icons.install", iconsActive ? "state-ok" : "");
  setActionState("icons.uninstall", iconsActive ? "" : "state-bad");
}

async function loadEditors() {
  const data = await getJson("/api/files");
  state.files = data.files || {};
  document.querySelectorAll("[data-editor]").forEach((editor) => {
    const item = data.files?.[editor.dataset.editor];
    if (!item) return;
    editor.value = item.content || "";
    const path = document.querySelector(`[data-editor-path="${editor.dataset.editor}"]`);
    if (path) path.textContent = item.path;
  });
}

async function checkAuth() {
  const me = await getJson("/api/auth/me");
  const modal = $("#loginModal");
  modal.hidden = Boolean(me.authenticated);
  if (me.authenticated) {
    $("#avatarInitials").textContent = (me.name || me.username || "UR").slice(0, 2).toUpperCase();
    if (me.avatar) {
      $("#avatarImg").src = me.avatar;
      $("#avatarImg").hidden = false;
      $("#avatarInitials").hidden = true;
    }
  }
  return me.authenticated;
}

async function refresh() {
  if (!(await checkAuth())) return;
  const data = await getJson("/api/status");
  renderStatus(data);
  enhanceButtons();
  await loadLogs();
  await loadEditors();
}

function openEditor(key) {
  state.editorKey = key;
  const item = state.files?.[key];
  $("#editorTitle").textContent = editorLabels[key] || key;
  $("#editorPath").textContent = item?.path || "";
  $("#modalEditor").value = item?.content || "";
  $("#editorModal").hidden = false;
}

function openDownload(kind) {
  state.downloadKind = kind;
  $("#downloadTitle").textContent = kind === "country" ? "Add country flag" : "Add provider icon";
  $("#downloadUrl").value = "";
  $("#downloadName").value = "";
  $("#downloadModal").hidden = false;
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

function renderThemeButton() {
  const button = $("#themeBtn");
  const dark = document.body.classList.contains("dark");
  button.innerHTML = icon(dark ? "sun" : "moon");
  button.title = dark ? "Light theme" : "Dark theme";
  button.setAttribute("aria-label", button.title);
}

function renderLogToggle() {
  const button = $("#toggleLogs");
  const expanded = !$("#logBox").hidden;
  button.innerHTML = icon(expanded ? "chevronUp" : "chevronDown");
  button.title = expanded ? "Collapse logs" : "Expand logs";
  button.setAttribute("aria-label", button.title);
}

function enhanceButtons() {
  const actionIcons = {
    "dnscrypt.start": "play",
    "dnscrypt.update": "refresh",
    "dnscrypt.extract": "dns",
    "dnscrypt.generate": "route",
    "dnscrypt.restart": "refresh",
    "dnscrypt.stop": "stop",
    "icons.install": "play",
    "icons.discover": "refresh",
    "icons.uninstall": "stop",
  };

  document.querySelectorAll("button[data-action]").forEach((button) => {
    if (button.querySelector(".icon")) return;
    const label = button.textContent.trim();
    const iconName = actionIcons[button.dataset.action] || "play";
    button.innerHTML = `${icon(iconName)}<span>${escapeHtml(label)}</span>`;
  });

  document.querySelectorAll("button[data-open-editor].icon-button").forEach((button) => {
    if (button.querySelector(".icon")) return;
    button.innerHTML = icon("edit");
  });

  document.querySelectorAll("button[data-open-download].icon-button").forEach((button) => {
    if (button.querySelector(".icon")) return;
    button.innerHTML = icon(button.dataset.openDownload === "country" ? "flag" : "globe");
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

async function saveEditor(key) {
  const editor = key === state.editorKey ? $("#modalEditor") : document.querySelector(`[data-editor="${key}"]`);
  if (!editor) return;
  const result = await getJson("/api/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, content: editor.value }),
  });
  showToast(`${result.ok ? "Saved" : "Failed"}: ${key}\n${result.output || ""}`.trim());
  await refresh();
  $("#editorModal").hidden = true;
}

async function login(username, password) {
  const result = await getJson("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (result.ok) {
    $("#loginModal").hidden = true;
    await refresh();
  }
}

async function downloadAsset() {
  const result = await getJson("/api/assets/download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: state.downloadKind, url: $("#downloadUrl").value, filename: $("#downloadName").value }),
  });
  showToast(`${result.ok ? "Uploaded" : "Failed"}\n${result.output || ""}`.trim());
  $("#downloadModal").hidden = true;
  await refresh();
}

async function uploadAvatar() {
  const file = $("#avatarFile").files[0];
  if (!file) return;
  if (!["image/png", "image/jpeg"].includes(file.type)) {
    showToast("Avatar must be PNG or JPG");
    return;
  }
  if (file.size > 512 * 1024) {
    showToast("Avatar must be smaller than 512 KB");
    return;
  }
  try {
    const data = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
    const result = await getJson("/api/auth/avatar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, data }),
    });
    showToast(result.ok ? "Avatar updated" : result.output || "Failed");
    $("#profileModal").hidden = true;
    await checkAuth();
  } catch (error) {
    showToast(error.message || "Avatar upload failed");
  }
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (button) runAction(button.dataset.action);
  const save = event.target.closest("[data-save-editor]");
  if (save) saveEditor(save.dataset.saveEditor);
  const open = event.target.closest("[data-open-editor]");
  if (open) openEditor(open.dataset.openEditor);
  const download = event.target.closest("[data-open-download]");
  if (download) openDownload(download.dataset.openDownload);
  if (event.target.closest("[data-close-modal]")) event.target.closest(".modal").hidden = true;
});

$("#refreshBtn").addEventListener("click", refresh);
$("#logTarget").addEventListener("change", loadLogs);
$("#loginForm").addEventListener("submit", (event) => {
  event.preventDefault();
  login($("#loginUser").value, $("#loginPass").value).catch((error) => showToast(error.message));
});
$("#saveModalEditor").addEventListener("click", () => saveEditor(state.editorKey));
$("#downloadBtn").addEventListener("click", downloadAsset);
$("#avatarBtn").addEventListener("click", () => {
  $("#profileModal").hidden = false;
});
$("#uploadAvatar").addEventListener("click", uploadAvatar);
$("#logoutBtn").addEventListener("click", async () => {
  await getJson("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  location.reload();
});
$("#themeBtn").addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("theme", document.body.classList.contains("dark") ? "dark" : "light");
  renderThemeButton();
});
$("#autoRefresh").addEventListener("change", () => {
  clearInterval(state.autoTimer);
  const seconds = Number($("#autoRefresh").value);
  if (seconds > 0) state.autoTimer = setInterval(refresh, seconds * 1000);
});
$("#toggleLogs").addEventListener("click", () => {
  const box = $("#logBox");
  box.hidden = !box.hidden;
  renderLogToggle();
});
if (localStorage.getItem("theme") === "dark") document.body.classList.add("dark");
renderThemeButton();
renderLogToggle();
enhanceButtons();

checkAuth().then((ok) => ok && refresh()).catch((error) => {
  showToast(error.message);
});
