const state = {
  status: null,
  busy: false,
  files: null,
  editorKey: "",
  downloadKind: "",
  autoTimer: null,
  lang: "en",
  me: null,
};

const $ = (selector) => document.querySelector(selector);

const translations = {
  en: {
    refresh: "Refresh",
    autoOff: "Auto off",
    connections: "Connections",
    connectionsText: "External IP, country and provider for direct access and WireGuard tunnels.",
    start: "Start",
    restart: "Restart",
    stop: "Stop",
    update: "Update",
    table: "Table",
    timer: "Timer",
    rules: "Rules",
    entries: "Entries",
    domains: "Domains",
    dnsRoute: "DNS route",
    forwardingRules: "Forwarding rules",
    clearDnsCache: "Clear DNS cache",
    clearDnsCacheConfirm: "Clear the DNS cache on this UDM?",
    updateProject: "Update URM",
    updateProjectConfirm: "Update UniFi Routing Manager from GitHub now? The Web UI will restart.",
    updateStarted: "Update started. Waiting for the Web UI to restart...",
    updateTimeout: "The updater started, but the Web UI did not return in time.",
    localIcon: "Local icon",
    icons: "Icons",
    lightTheme: "Light theme",
    darkTheme: "Dark theme",
    edit: "Edit",
    noEntries: "No entries",
    noDomains: "No domains",
    seconds15: "15 sec",
    seconds30: "30 sec",
    minute1: "1 min",
    minutes5: "5 min",
    language: "Language",
    changeIcon: "Change URM icon",
    generatedDomains: "Generated root domains",
    viewGeneratedDomains: "View generated DNSCrypt domains",
    addProvider: "Add provider",
    addFlag: "Add flag",
    editor: "Editor",
    editorText: "Manual routing lists and WireGuard map.",
    cloudDomains: "Cloud domains",
    cloudNetworks: "Cloud networks",
    updatesDomains: "Updates domains",
    updatesNetworks: "Updates networks",
    dnscryptGeneratedDomains: "DNSCrypt generated domains",
    dnscryptGeneratedDescription: "Generated from the Cloud and Updates domain lists. Edit those source lists to change DNSCrypt forwarding.",
    wireGuardMap: "WireGuard map",
    save: "Save",
    close: "Close",
    upload: "Upload",
    logs: "Logs",
    logsText: "Latest entries from local project logs.",
    expandLogs: "Expand logs",
    collapseLogs: "Collapse logs",
    signIn: "Sign in",
    login: "Login",
    password: "Password",
    profile: "Profile",
    avatar: "Avatar",
    uploadAvatar: "Upload avatar",
    chooseImage: "Choose image",
    noFileSelected: "No file selected",
    account: "Account",
    currentPassword: "Current password",
    newPassword: "New password",
    confirmPassword: "Confirm new password",
    requiredToSave: "Required to save",
    leaveEmptyPassword: "Leave empty to keep current",
    repeatPassword: "Repeat new password",
    saveAccount: "Save account",
    logout: "Logout",
    connection: "Connection",
    country: "Country",
    provider: "Provider",
    networks: "Networks",
    resolvedAddresses: "Resolved IP addresses",
    noConnectionData: "No connection data.",
    noRecentActivity: "No recent activity",
    noIcons: "No icons",
    noLogEntries: "No log entries.",
    addCountryFlag: "Add country flag",
    addProviderIcon: "Add provider icon",
    running: "Running",
    done: "Done",
    failed: "Failed",
    saved: "Saved",
    uploaded: "Uploaded",
    avatarUpdated: "Avatar updated",
    logoUpdated: "URM icon updated",
    accountUpdated: "Account updated",
    logoTypeError: "URM icon must be PNG or JPG",
    logoSizeError: "URM icon must be smaller than 512 KB",
    avatarTypeError: "Avatar must be PNG or JPG",
    avatarSizeError: "Avatar must be smaller than 512 KB",
    passwordMismatch: "New passwords do not match",
    active: "Active",
    inactive: "Inactive",
    enabled: "Enabled",
    disabled: "Disabled",
    configured: "Configured",
    notConfigured: "Not configured",
    unknown: "Unknown",
    unavailable: "Unavailable",
    error: "Error",
  },
  ru: {
    clearDnsCache: "\u041e\u0447\u0438\u0441\u0442\u0438\u0442\u044c DNS-\u043a\u044d\u0448",
    clearDnsCacheConfirm: "\u041e\u0447\u0438\u0441\u0442\u0438\u0442\u044c DNS-\u043a\u044d\u0448 \u043d\u0430 \u044d\u0442\u043e\u0439 UDM?",
    updateProject: "\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c URM",
    updateProjectConfirm: "\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c UniFi Routing Manager \u0438\u0437 GitHub? Web-\u0438\u043d\u0442\u0435\u0440\u0444\u0435\u0439\u0441 \u0431\u0443\u0434\u0435\u0442 \u043f\u0435\u0440\u0435\u0437\u0430\u043f\u0443\u0449\u0435\u043d.",
    updateStarted: "\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u0435 \u0437\u0430\u043f\u0443\u0449\u0435\u043d\u043e. \u0416\u0434\u0451\u043c \u043f\u0435\u0440\u0435\u0437\u0430\u043f\u0443\u0441\u043a Web UI...",
    updateTimeout: "\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u0435 \u0437\u0430\u043f\u0443\u0449\u0435\u043d\u043e, \u043d\u043e Web UI \u043d\u0435 \u0432\u0435\u0440\u043d\u0443\u043b\u0441\u044f \u0437\u0430 \u043e\u0442\u0432\u0435\u0434\u0451\u043d\u043d\u043e\u0435 \u0432\u0440\u0435\u043c\u044f.",
    refresh: "Обновить",
    autoOff: "Авто выкл.",
    connections: "Подключения",
    connectionsText: "Внешний IP, страна и провайдер для прямого доступа и WireGuard.",
    start: "Старт",
    restart: "Рестарт",
    stop: "Стоп",
    update: "Обновить",
    table: "Таблица",
    timer: "Таймер",
    rules: "Правила",
    entries: "Записи",
    domains: "Домены",
    dnsRoute: "DNS-маршрут",
    forwardingRules: "Правила перенаправления",
    localIcon: "Локальные иконки",
    icons: "Иконки",
    lightTheme: "Светлая тема",
    darkTheme: "Тёмная тема",
    edit: "Редактировать",
    noEntries: "Нет записей",
    noDomains: "Нет доменов",
    seconds15: "15 сек",
    seconds30: "30 сек",
    minute1: "1 мин",
    minutes5: "5 мин",
    language: "Язык",
    changeIcon: "Изменить иконку URM",
    generatedDomains: "Сгенерированные корневые домены",
    viewGeneratedDomains: "Посмотреть сгенерированные домены DNSCrypt",
    addProvider: "Добавить провайдера",
    addFlag: "Добавить флаг",
    editor: "Редактор",
    editorText: "Ручные списки маршрутизации и карта WireGuard.",
    cloudDomains: "Домены Cloud",
    cloudNetworks: "Сети Cloud",
    updatesDomains: "Домены Updates",
    updatesNetworks: "Сети Updates",
    dnscryptGeneratedDomains: "Сгенерированные домены DNSCrypt",
    dnscryptGeneratedDescription: "Формируется из списков доменов Cloud и Updates. Для изменения перенаправления DNSCrypt редактируйте исходные списки.",
    wireGuardMap: "Карта WireGuard",
    save: "Сохранить",
    close: "Закрыть",
    upload: "Загрузить",
    logs: "Журналы",
    logsText: "Последние записи из локальных журналов проекта.",
    expandLogs: "Развернуть журналы",
    collapseLogs: "Свернуть журналы",
    signIn: "Войти",
    login: "Логин",
    password: "Пароль",
    profile: "Профиль",
    avatar: "Аватар",
    uploadAvatar: "Загрузить аватар",
    chooseImage: "Выбрать изображение",
    noFileSelected: "Файл не выбран",
    account: "Учётная запись",
    currentPassword: "Текущий пароль",
    newPassword: "Новый пароль",
    confirmPassword: "Подтвердите новый пароль",
    requiredToSave: "Требуется для сохранения",
    leaveEmptyPassword: "Оставьте пустым, чтобы не менять",
    repeatPassword: "Повторите новый пароль",
    saveAccount: "Сохранить учётную запись",
    logout: "Выйти",
    connection: "Подключение",
    country: "Страна",
    provider: "Провайдер",
    networks: "Сети",
    resolvedAddresses: "Разрешённые IP-адреса",
    noConnectionData: "Нет данных о подключениях.",
    noRecentActivity: "Нет недавней активности",
    noIcons: "Нет иконок",
    noLogEntries: "В журнале нет записей.",
    addCountryFlag: "Добавить флаг страны",
    addProviderIcon: "Добавить иконку провайдера",
    running: "Выполняется",
    done: "Готово",
    failed: "Ошибка",
    saved: "Сохранено",
    uploaded: "Загружено",
    avatarUpdated: "Аватар обновлён",
    logoUpdated: "Иконка URM обновлена",
    accountUpdated: "Учётная запись обновлена",
    logoTypeError: "Иконка URM должна быть в формате PNG или JPG",
    logoSizeError: "Размер иконки URM не должен превышать 512 КБ",
    avatarTypeError: "Аватар должен быть в формате PNG или JPG",
    avatarSizeError: "Размер аватара не должен превышать 512 КБ",
    passwordMismatch: "Новые пароли не совпадают",
    active: "Активен",
    inactive: "Неактивен",
    enabled: "Включён",
    disabled: "Отключён",
    configured: "Настроен",
    notConfigured: "Не настроено",
    unknown: "Неизвестно",
    unavailable: "Недоступно",
    error: "Ошибка",
  },
};

function t(key) {
  return translations[state.lang]?.[key] || translations.en[key] || key;
}

function detectLanguage() {
  const saved = localStorage.getItem("language");
  if (saved === "ru" || saved === "en") return saved;
  return navigator.language?.toLowerCase().startsWith("ru") ? "ru" : "en";
}

function applyLanguage() {
  document.documentElement.lang = state.lang;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-i18n-title]").forEach((node) => {
    const label = t(node.dataset.i18nTitle);
    node.title = label;
    node.setAttribute("aria-label", label);
  });
  const languageSelect = $("#languageSelect");
  if (languageSelect) languageSelect.value = state.lang;
  renderThemeButton();
  enhanceButtons(true);
}

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
  return `<button class="${classes}" data-action="${action}">${icon(iconName)}<span>${escapeHtml(label)}</span></button>`;
}

const editorLabels = {
  "cloud.domains": "cloudDomains",
  "cloud.networks": "cloudNetworks",
  "updates.domains": "updatesDomains",
  "updates.networks": "updatesNetworks",
  "dnscrypt.domains": "dnscryptGeneratedDomains",
  "wg.map": "wireGuardMap",
};

function localizedStatus(value) {
  const key = {
    active: "active",
    inactive: "inactive",
    enabled: "enabled",
    disabled: "disabled",
    configured: "configured",
    "not configured": "notConfigured",
    unknown: "unknown",
    unavailable: "unavailable",
    failed: "failed",
    error: "error",
  }[String(value || "unknown").toLowerCase()];
  return key ? t(key) : String(value || t("unknown"));
}

function badge(value) {
  const text = String(value || "unknown");
  let tone = "";
  if (["active", "enabled", "configured"].includes(text.toLowerCase())) tone = "ok";
  if (["inactive", "disabled", "unknown", "not configured", "unavailable"].includes(text.toLowerCase())) tone = "warn";
  if (["failed", "error"].includes(text)) tone = "bad";
  return `<span class="badge ${tone}"><span class="badge-dot"></span><span>${escapeHtml(localizedStatus(text))}</span></span>`;
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
        <div>${t("connection")}</div>
        <div>IP</div>
        <div>${t("country")}</div>
        <div>${t("provider")}</div>
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
    : `<p class="empty">${t("noConnectionData")}</p>`;
}

function readableFileLabel(label) {
  return {
    domains: t("domains"),
    networks: t("networks"),
    addresses: t("resolvedAddresses"),
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
  if (!event) return escapeHtml(fallback || t("noRecentActivity"));
  const time = event.time ? `<span>${escapeHtml(event.time)}</span>` : "";
  return `${escapeHtml(event.message || fallback || t("noRecentActivity"))}${time}`;
}

function eventTime(event, fallback) {
  if (event?.time) return escapeHtml(event.time);
  const text = String(fallback || "");
  const match = text.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
  return match ? escapeHtml(match[0]) : t("noRecentActivity");
}

function compactEvent(label, event, fallback) {
  const time = eventTime(event, fallback);
  const safeLabel = escapeHtml(label || "");
  if (time === t("noRecentActivity")) return safeLabel || time;
  return safeLabel ? `${safeLabel} - ${time}` : time;
}

function statusDot(value) {
  const text = String(value || "").toLowerCase();
  const ok = ["active", "enabled", "configured"].includes(text) || Number(value) > 0;
  return `<span class="status-dot ${ok ? "ok" : "bad"}" title="${escapeHtml(localizedStatus(value))}"></span>`;
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
        : `<p>${t("noEntries")}</p>`;
      const editorKey = editorKeyFor(project.key, label);
      const editButton = editorKey ? `<button class="icon-button edit-button" data-open-editor="${editorKey}" type="button" title="${t("edit")}" aria-label="${t("edit")} ${escapeHtml(readableFileLabel(label))}">${icon("edit")}</button>` : "";
      return `<div class="project-sample" data-sample-label="${escapeHtml(label)}"><div class="list-head"><h3>${escapeHtml(readableFileLabel(label))}</h3>${editButton}</div>${chips}</div>`;
    })
    .join("");

  const projectIcon = project.key === "cloud" ? "cloud" : "update";
  const active = isActiveState(project.timer);
  const projectEvent = compactEvent("", project.lastEvent, project.lastLog);
  const projectSubtitle = [localizedStatus(project.activeName || "not configured"), projectEvent]
    .filter((value) => value && value !== "unknown")
    .join(" - ");
  return `
    <section class="panel" id="${project.key}">
      <div class="panel-head">
        <div class="title-row">
            ${icon(projectIcon)}
          <div>
            <h2>${statusDot(project.timer)}${escapeHtml(project.title)}</h2>
            <p class="event">${escapeHtml(projectSubtitle || t("notConfigured"))}</p>
          </div>
        </div>
        <div class="actions">
          ${actionButton(`${project.key}.start`, t("start"), "play", { state: active ? "state-ok" : "" })}
          ${actionButton(`${project.key}.restart`, t("restart"), "refresh")}
          ${actionButton(`${project.key}.stop`, t("stop"), "stop", { state: active ? "" : "state-bad" })}
        </div>
      </div>
      <div class="status-row">
        <div class="status-cell"><span>${t("timer")}</span><strong>${badge(project.timer)}</strong></div>
        <div class="status-cell"><span>${t("table")}</span><strong>${escapeHtml(localizedStatus(project.activeTable))}</strong></div>
        <div class="status-cell"><span>${t("rules")}</span><strong>${escapeHtml(localizedStatus(project.rules))}</strong></div>
        <div class="status-cell"><span>${t("entries")}</span><strong>${escapeHtml(Object.values(project.counts || {}).join(" / ") || "0")}</strong></div>
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
  requestAnimationFrame(syncProjectSampleHeights);

  $("#dnscryptTitle").innerHTML = `
      ${icon("dns")}
    <div>
      <h2>${statusDot(data.dnscrypt.service)}DNSCrypt</h2>
      <p class="event">${compactEvent(t("forwardingRules"), data.dnscrypt.lastEvent, data.dnscrypt.lastLog)}</p>
    </div>
  `;

  $("#dnscryptStatus").innerHTML = `
    <div><span>${t("timer")}</span><strong>${badge(data.dnscrypt.timer)}</strong></div>
    <div><span>${t("domains")}</span><strong>${escapeHtml(data.dnscrypt.domains)}</strong></div>
    <div><span>${t("dnsRoute")}</span><strong>${escapeHtml(localizedStatus(data.dnscrypt.route?.name || data.dnscrypt.route?.iface || "unknown"))}</strong></div>
  `;
  $("#dnscryptDomains").innerHTML = (data.dnscrypt.samples || [])
    .map((value) => `<code>${escapeHtml(value)}</code>`)
    .join("") || `<p>${t("noDomains")}</p>`;

  $("#iconsTitle").innerHTML = `
      ${icon("globe")}
    <div>
      <h2>${statusDot(data.ispIcons.icons)}ISP Icons</h2>
      <p class="event">${compactEvent(t("localIcon"), data.ispIcons.lastEvent, data.ispIcons.lastLog)}</p>
    </div>
  `;

  $("#iconsStatus").innerHTML = `
    <div><span>${t("timer")}</span><strong>${badge(data.ispIcons.exists ? "active" : "inactive")}</strong></div>
    <div><span>${t("icons")}</span><strong>${escapeHtml(data.ispIcons.icons)}</strong></div>
  `;
  $("#iconsList").innerHTML = (data.ispIcons.items || [])
    .map((item) => `<article class="isp-icon-item"><img src="${escapeHtml(item.url)}" alt=""><span>${escapeHtml(item.name)}</span></article>`)
    .join("") || `<p>${t("noIcons")}</p>`;

  const dnsActive = isActiveState(data.dnscrypt.service);
  setActionState("dnscrypt.start", dnsActive ? "state-ok" : "");
  setActionState("dnscrypt.stop", dnsActive ? "" : "state-bad");
  const iconsActive = Boolean(data.ispIcons.exists && Number(data.ispIcons.icons) > 0);
  setActionState("icons.install", iconsActive ? "state-ok" : "");
  setActionState("icons.uninstall", iconsActive ? "" : "state-bad");
}

function syncProjectSampleHeights() {
  const samples = [...document.querySelectorAll("#projects .project-sample")];
  samples.forEach((item) => { item.style.minHeight = ""; });
  if (!window.matchMedia("(min-width: 681px)").matches) return;
  const labels = [...new Set(samples.map((item) => item.dataset.sampleLabel))];
  labels.forEach((label) => {
    const matching = samples.filter((item) => item.dataset.sampleLabel === label);
    const height = Math.max(...matching.map((item) => item.getBoundingClientRect().height));
    matching.forEach((item) => { item.style.minHeight = `${Math.ceil(height)}px`; });
  });
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
  state.me = me;
  const modal = $("#loginModal");
  modal.hidden = Boolean(me.authenticated);
  applyBranding(me.logo);
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

function applyBranding(logoUrl) {
  const url = logoUrl || "/assets/brand/u-logo.svg";
  $("#brandLogo").src = url;
  const favicon = $("#favicon");
  favicon.href = logoUrl || "/favicon.svg";
  favicon.type = logoUrl?.includes(".jpg") ? "image/jpeg" : logoUrl ? "image/png" : "image/svg+xml";
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
  $("#editorTitle").textContent = editorLabels[key] ? t(editorLabels[key]) : key;
  $("#editorPath").textContent = item?.path || "";
  const description = key === "dnscrypt.domains" ? t("dnscryptGeneratedDescription") : item?.description || "";
  $("#editorDescription").textContent = description;
  $("#editorDescription").hidden = !description;
  $("#modalEditor").value = item?.content || "";
  $("#modalEditor").readOnly = Boolean(item?.readOnly);
  $("#saveModalEditor").hidden = Boolean(item?.readOnly);
  $("#editorModal").hidden = false;
}

function openDownload(kind) {
  state.downloadKind = kind;
  $("#downloadTitle").textContent = kind === "country" ? t("addCountryFlag") : t("addProviderIcon");
  $("#downloadUrl").value = "";
  $("#downloadName").value = "";
  $("#downloadModal").hidden = false;
}

async function loadLogs() {
  const target = $("#logTarget").value;
  const data = await getJson(`/api/logs?target=${encodeURIComponent(target)}&lines=160`);
  $("#logBox").textContent = data.log || t("noLogEntries");
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
  button.title = dark ? t("lightTheme") : t("darkTheme");
  button.setAttribute("aria-label", button.title);
}

function renderLogToggle() {
  const button = $("#toggleLogs");
  const expanded = !$("#logBox").hidden;
  button.innerHTML = icon(expanded ? "chevronUp" : "chevronDown");
  button.title = expanded ? t("collapseLogs") : t("expandLogs");
  button.setAttribute("aria-label", button.title);
}

function enhanceButtons(force = false) {
  const actionIcons = {
    "dnscrypt.start": "play",
    "dnscrypt.update": "refresh",
    "dnscrypt.extract": "dns",
    "dnscrypt.generate": "route",
    "dnscrypt.restart": "refresh",
    "dnscrypt.flush-cache": "refresh",
    "dnscrypt.stop": "stop",
    "icons.install": "play",
    "icons.discover": "refresh",
    "icons.uninstall": "stop",
    "system.update": "update",
  };
  const actionLabels = {
    "cloud.start": t("start"),
    "cloud.restart": t("restart"),
    "cloud.stop": t("stop"),
    "updates.start": t("start"),
    "updates.restart": t("restart"),
    "updates.stop": t("stop"),
    "dnscrypt.start": t("start"),
    "dnscrypt.restart": t("restart"),
    "dnscrypt.flush-cache": t("clearDnsCache"),
    "dnscrypt.stop": t("stop"),
    "icons.install": t("start"),
    "icons.discover": t("update"),
    "icons.uninstall": t("stop"),
    "system.update": t("updateProject"),
  };

  document.querySelectorAll("button[data-action]").forEach((button) => {
    if (button.querySelector(".icon") && !force) return;
    const label = actionLabels[button.dataset.action] || button.textContent.trim();
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
  if (refreshBtn && (!refreshBtn.querySelector(".icon") || force)) {
    refreshBtn.innerHTML = `${icon("refresh")}<span>${t("refresh")}</span>`;
  }
}

async function runAction(action) {
  if (state.busy) return;
  if (action === "dnscrypt.flush-cache" && !window.confirm(t("clearDnsCacheConfirm"))) return;
  if (action === "system.update" && !window.confirm(t("updateProjectConfirm"))) return;
  state.busy = true;
  showToast(`${t("running")}: ${action}...`);
  try {
    const result = await getJson("/api/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (action === "system.update" && result.ok) {
      showToast(t("updateStarted"));
      await new Promise((resolve) => setTimeout(resolve, 8000));
      for (let attempt = 0; attempt < 60; attempt += 1) {
        try {
          const me = await getJson("/api/auth/me", { cache: "no-store" });
          if (me.authenticated) {
            location.reload();
            return;
          }
        } catch {
          // The Web service is expected to be unavailable briefly.
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      throw new Error(t("updateTimeout"));
    }
    showToast(`${result.ok ? t("done") : t("failed")}: ${action}\n${result.output || ""}`.trim());
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
  showToast(`${result.ok ? t("saved") : t("failed")}: ${key}\n${result.output || ""}`.trim());
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
  showToast(`${result.ok ? t("uploaded") : t("failed")}\n${result.output || ""}`.trim());
  $("#downloadModal").hidden = true;
  await refresh();
}

async function uploadAvatar() {
  const file = $("#avatarFile").files[0];
  if (!file) return;
  if (!["image/png", "image/jpeg"].includes(file.type)) {
    showToast(t("avatarTypeError"));
    return;
  }
  if (file.size > 512 * 1024) {
    showToast(t("avatarSizeError"));
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
    showToast(result.ok ? t("avatarUpdated") : result.output || t("failed"));
    $("#avatarFile").value = "";
    $("#avatarFileName").textContent = t("noFileSelected");
    $("#profileModal").hidden = true;
    await checkAuth();
  } catch (error) {
    showToast(error.message || t("failed"));
  }
}

async function uploadBrandLogo(file) {
  if (!file) return;
  if (!["image/png", "image/jpeg"].includes(file.type)) {
    showToast(t("logoTypeError"));
    return;
  }
  if (file.size > 512 * 1024) {
    showToast(t("logoSizeError"));
    return;
  }
  try {
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Could not read the selected image"));
      reader.readAsDataURL(file);
    });
    const result = await getJson("/api/auth/logo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });
    applyBranding(result.logo);
    showToast(t("logoUpdated"));
  } catch (error) {
    showToast(error.message || t("failed"));
  } finally {
    $("#brandLogoFile").value = "";
  }
}

async function updateProfile() {
  const username = $("#profileLogin").value.trim();
  const currentPassword = $("#profileCurrentPassword").value;
  const newPassword = $("#profileNewPassword").value;
  const confirmPassword = $("#profileConfirmPassword").value;
  if (newPassword !== confirmPassword) {
    throw new Error(t("passwordMismatch"));
  }
  const result = await getJson("/api/auth/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, currentPassword, newPassword }),
  });
  showToast(result.output || t("accountUpdated"));
  $("#profileCurrentPassword").value = "";
  $("#profileNewPassword").value = "";
  $("#profileConfirmPassword").value = "";
  await checkAuth();
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
  $("#profileLogin").value = state.me?.username || "";
  $("#profileCurrentPassword").value = "";
  $("#profileNewPassword").value = "";
  $("#profileConfirmPassword").value = "";
  $("#profileModal").hidden = false;
});
$("#brandLogoBtn").addEventListener("click", () => $("#brandLogoFile").click());
$("#brandLogoFile").addEventListener("change", () => uploadBrandLogo($("#brandLogoFile").files[0]));
$("#chooseAvatar").addEventListener("click", () => $("#avatarFile").click());
$("#avatarFile").addEventListener("change", () => {
  $("#avatarFileName").textContent = $("#avatarFile").files[0]?.name || t("noFileSelected");
});
$("#uploadAvatar").addEventListener("click", uploadAvatar);
$("#profileForm").addEventListener("submit", (event) => {
  event.preventDefault();
  updateProfile().catch((error) => showToast(error.message));
});
$("#logoutBtn").addEventListener("click", async () => {
  await getJson("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  location.reload();
});
$("#themeBtn").addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("theme", document.body.classList.contains("dark") ? "dark" : "light");
  renderThemeButton();
});
$("#languageSelect").addEventListener("change", () => {
  state.lang = $("#languageSelect").value;
  localStorage.setItem("language", state.lang);
  applyLanguage();
  if (state.status) renderStatus(state.status);
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
let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(syncProjectSampleHeights, 100);
});
if (localStorage.getItem("theme") === "dark") document.body.classList.add("dark");
state.lang = detectLanguage();
applyLanguage();
renderLogToggle();
enhanceButtons();

checkAuth().then((ok) => ok && refresh()).catch((error) => {
  showToast(error.message);
});
