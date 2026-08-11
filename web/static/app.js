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
    cloudDomains: "Домены облака UniFi",
    cloudNetworks: "Сети облака UniFi",
    updatesDomains: "Домены обновлений",
    updatesNetworks: "Сети обновлений",
    dnscryptGeneratedDomains: "Сгенерированные домены DNSCrypt",
    dnscryptGeneratedDescription: "Формируется из списков доменов облака UniFi и обновлений. Для изменения перенаправления DNSCrypt редактируйте исходные списки.",
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
  unifi: "/assets/brand/urm-logo.png",
  unifiOs: "/assets/brand/unifi-os.svg",
  unifiNetwork: "/assets/brand/urm-logo.png",
  ubiquiti: "/assets/brand/urm-logo.png",
  wireguard: "/assets/brand/wireguard.svg",
  image: "/assets/brand/urm-logo.png",
};

const mdiPaths = {
  cloud: "M6.5 20Q4.22 20 2.61 18.43 1 16.85 1 14.58 1 12.63 2.17 11.1 3.35 9.57 5.25 9.15 5.88 6.85 7.75 5.43 9.63 4 12 4 14.93 4 16.96 6.04 19 8.07 19 11 20.73 11.2 21.86 12.5 23 13.78 23 15.5 23 17.38 21.69 18.69 20.38 20 18.5 20M6.5 18H18.5Q19.55 18 20.27 17.27 21 16.55 21 15.5 21 14.45 20.27 13.73 19.55 13 18.5 13H17V11Q17 8.93 15.54 7.46 14.08 6 12 6 9.93 6 8.46 7.46 7 8.93 7 11H6.5Q5.05 11 4.03 12.03 3 13.05 3 14.5 3 15.95 4.03 17 5.05 18 6.5 18M12 12Z",
  update: "M21,10.12H14.22L16.96,7.3C14.23,4.6 9.81,4.5 7.08,7.2C4.35,9.91 4.35,14.28 7.08,17C9.81,19.7 14.23,19.7 16.96,17C18.32,15.65 19,14.08 19,12.1H21C21,14.08 20.12,16.65 18.36,18.39C14.85,21.87 9.15,21.87 5.64,18.39C2.14,14.92 2.11,9.28 5.62,5.81C9.13,2.34 14.76,2.34 18.27,5.81L21,3V10.12M12.5,8V12.25L16,14.33L15.28,15.54L11,13V8H12.5Z",
  download: "M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z",
  edit: "M14.06,9L15,9.94L5.92,19H5V18.08L14.06,9M17.66,3C17.41,3 17.15,3.1 16.96,3.29L15.13,5.12L18.88,8.87L20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18.17,3.09 17.92,3 17.66,3M14.06,6.19L3,17.25V21H6.75L17.81,9.94L14.06,6.19Z",
  imagePlus: "M13 19C13 19.7 13.13 20.37 13.35 21H5C3.9 21 3 20.11 3 19V5C3 3.9 3.9 3 5 3H19C20.11 3 21 3.9 21 5V13.35C20.37 13.13 19.7 13 19 13V5H5V19H13M13.96 12.29L11.21 15.83L9.25 13.47L6.5 17H13.35C13.75 15.88 14.47 14.91 15.4 14.21L13.96 12.29M20 18V15H18V18H15V20H18V23H20V20H23V18H20Z",
  flag: "M12.36,6L12.76,8H18V14H14.64L14.24,12H7V6H12.36M14,4H5V21H7V14H12.6L13,16H20V6H14.4",
  globe: "M17.9,17.39C17.64,16.59 16.89,16 16,16H15V13A1,1 0 0,0 14,12H8V10H10A1,1 0 0,0 11,9V7H13A2,2 0 0,0 15,5V4.59C17.93,5.77 20,8.64 20,12C20,14.08 19.2,15.97 17.9,17.39M11,19.93C7.05,19.44 4,16.08 4,12C4,11.38 4.08,10.78 4.21,10.21L9,15V16A2,2 0 0,0 11,18M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z",
  moon: "M17.75,4.09L15.22,6.03L16.13,9.09L13.5,7.28L10.87,9.09L11.78,6.03L9.25,4.09L12.44,4L13.5,1L14.56,4L17.75,4.09M21.25,11L19.61,12.25L20.2,14.23L18.5,13.06L16.8,14.23L17.39,12.25L15.75,11L17.81,10.95L18.5,9L19.19,10.95L21.25,11M18.97,15.95C19.8,15.87 20.69,17.05 20.16,17.8C19.84,18.25 19.5,18.67 19.08,19.07C15.17,23 8.84,23 4.94,19.07C1.03,15.17 1.03,8.83 4.94,4.93C5.34,4.53 5.76,4.17 6.21,3.85C6.96,3.32 8.14,4.21 8.06,5.04C7.79,7.9 8.75,10.87 10.95,13.06C13.14,15.26 16.1,16.22 18.97,15.95M17.33,17.97C14.5,17.81 11.7,16.64 9.53,14.5C7.36,12.31 6.2,9.5 6.04,6.68C3.23,9.82 3.34,14.64 6.35,17.66C9.37,20.67 14.19,20.78 17.33,17.97Z",
  sun: "M3.55 19.09L4.96 20.5L6.76 18.71L5.34 17.29M12 6C8.69 6 6 8.69 6 12S8.69 18 12 18 18 15.31 18 12C18 8.68 15.31 6 12 6M20 13H23V11H20M17.24 18.71L19.04 20.5L20.45 19.09L18.66 17.29M20.45 5L19.04 3.6L17.24 5.39L18.66 6.81M13 1H11V4H13M6.76 5.39L4.96 3.6L3.55 5L5.34 6.81L6.76 5.39M1 13H4V11H1M13 20H11V23H13",
  chevronDown: "M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z",
  chevronUp: "M7.41,15.41L12,10.83L16.59,15.41L18,14L12,8L6,14L7.41,15.41Z",
  route: "M11,10H5L3,8L5,6H11V3L12,2L13,3V4H19L21,6L19,8H13V10H19L21,12L19,14H13V20A2,2 0 0,1 15,22H9A2,2 0 0,1 11,20V10Z",
  dns: "M19,15V19H5V15H19M20,13H4A1,1 0 0,0 3,14V20A1,1 0 0,0 4,21H20A1,1 0 0,0 21,20V14A1,1 0 0,0 20,13M7,18.5A1.5,1.5 0 0,1 5.5,17A1.5,1.5 0 0,1 7,15.5A1.5,1.5 0 0,1 8.5,17A1.5,1.5 0 0,1 7,18.5M19,5V9H5V5H19M20,3H4A1,1 0 0,0 3,4V10A1,1 0 0,0 4,11H20A1,1 0 0,0 21,10V4A1,1 0 0,0 20,3M7,8.5A1.5,1.5 0 0,1 5.5,7A1.5,1.5 0 0,1 7,5.5A1.5,1.5 0 0,1 8.5,7A1.5,1.5 0 0,1 7,8.5Z",
  refresh: "M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z",
  play: "M8,5.14V19.14L19,12.14L8,5.14Z",
  stop: "M18,18H6V6H18V18Z",
  terminal: "M13,19V16H21V19H13M8.5,13L2.47,7H6.71L11.67,11.95C12.25,12.54 12.25,13.5 11.67,14.07L6.74,19H2.5L8.5,13Z",
};

const inlineIcons = Object.fromEntries(Object.entries(mdiPaths).map(([name, path]) => [
  name,
  `<svg class="mdi-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"></path></svg>`,
]));

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
                ${icon(item.type === "wireguard" ? "wireguard" : "globe")}
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
  const url = logoUrl || "/assets/brand/urm-logo.png";
  $("#brandLogo").src = url;
  const favicon = $("#favicon");
  favicon.href = logoUrl || "/favicon.png";
  favicon.type = logoUrl?.includes(".jpg") ? "image/jpeg" : "image/png";
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
document.body.classList.toggle("dark", localStorage.getItem("theme") !== "light");
state.lang = detectLanguage();
applyLanguage();
renderLogToggle();
enhanceButtons();

checkAuth().then((ok) => ok && refresh()).catch((error) => {
  showToast(error.message);
});
