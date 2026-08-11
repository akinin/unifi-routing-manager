const state = {
  status: null,
  busy: false,
  files: null,
  editorKey: "",
  downloadKind: "",
  autoTimer: null,
  lang: "en",
  me: null,
  page: "overview",
  projectTab: "cloud",
  refreshing: false,
  logsLoaded: false,
  filesLoaded: false,
  connections: null,
  maintenanceLoaded: false,
  notificationsLoaded: false,
};

const $ = (selector) => document.querySelector(selector);

const translations = {
  en: {
    overview: "Overview",
    overviewText: "WAN connections and service health.",
    routing: "Routing",
    routingText: "Policy routing rules, targets and active tunnels.",
    providers: "Providers",
    providersText: "Local ISP icons, aliases and country flags.",
    settings: "Settings",
    more: "More",
    settingsText: "Routing lists, WireGuard mapping and account settings.",
    health: "Diagnostics",
    healthText: "Route health, connectivity checks and configuration backups.",
    routeDiagnostics: "Route diagnostics",
    routeDiagnosticsText: "Checks interfaces, policy rules, routing tables and external connectivity.",
    runDiagnostics: "Run diagnostics",
    diagnosticsNotRun: "Diagnostics have not been run yet.",
    diagnosticPassed: "checks passed",
    configurationBackups: "Configuration backups",
    configurationBackupsText: "Automatic snapshots are created before every change and restore.",
    createBackup: "Create backup",
    restore: "Restore",
    restoreConfirm: "Restore this configuration backup? A safety snapshot will be created first.",
    noBackups: "No configuration backups yet.",
    loading: "Loading...",
    validationOk: "Validation passed",
    validationFailed: "Validation failed",
    dnsText: "DNSCrypt status, forwarding rules and generated domains.",
    notUpdated: "Not updated",
    updatedNow: "Updated just now",
    refresh: "Refresh",
    autoOff: "Auto off",
    connections: "Connections",
    connectionsText: "External IP, country and provider for direct access and WireGuard tunnels.",
    channelMonitoring: "Channel monitoring",
    channelMonitoringText: "Availability and latency during the latest checks.",
    availability: "Availability",
    latency: "Latency",
    notifications: "Notifications",
    notificationsText: "Telegram or HTTPS webhook alerts for outages and external IP changes.",
    enableNotifications: "Enable notifications",
    keepToken: "Leave empty to keep current token",
    testNotification: "Test notification",
    notificationSaved: "Notification settings saved",
    changePreview: "Change preview",
    start: "Start",
    restart: "Restart",
    stop: "Stop",
    stopConfirm: "Stop this service?",
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
    signInPasskey: "Face ID / Touch ID",
    addPasskey: "Add Face ID / Touch ID",
    passkeyAdded: "Passkey added",
    passkeyUnavailable: "Passkeys require trusted HTTPS and a compatible browser.",
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
    overview: "Обзор",
    overviewText: "WAN-подключения и состояние сервисов.",
    routing: "Маршрутизация",
    routingText: "Правила, направления и активные туннели.",
    providers: "Провайдеры",
    providersText: "Локальные ISP-иконки, алиасы и флаги стран.",
    settings: "Настройки",
    more: "Ещё",
    settingsText: "Списки маршрутизации, карта WireGuard и учётная запись.",
    health: "Диагностика",
    healthText: "Состояние маршрутов, проверка соединений и резервные копии.",
    routeDiagnostics: "Диагностика маршрутов",
    routeDiagnosticsText: "Проверяет интерфейсы, правила, таблицы маршрутизации и внешний доступ.",
    runDiagnostics: "Запустить диагностику",
    diagnosticsNotRun: "Диагностика ещё не запускалась.",
    diagnosticPassed: "проверок пройдено",
    configurationBackups: "Резервные копии конфигурации",
    configurationBackupsText: "Снимки автоматически создаются перед каждым изменением и восстановлением.",
    createBackup: "Создать копию",
    restore: "Восстановить",
    restoreConfirm: "Восстановить эту конфигурацию? Перед откатом будет создан страховочный снимок.",
    noBackups: "Резервных копий конфигурации пока нет.",
    loading: "Загрузка...",
    validationOk: "Проверка пройдена",
    validationFailed: "Ошибка проверки",
    dnsText: "Состояние DNSCrypt, перенаправление и сгенерированные домены.",
    notUpdated: "Ещё не обновлялось",
    updatedNow: "Обновлено только что",
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
    channelMonitoring: "Мониторинг каналов",
    channelMonitoringText: "Доступность и задержка за последние проверки.",
    availability: "Доступность",
    latency: "Задержка",
    notifications: "Уведомления",
    notificationsText: "Оповещения в Telegram или HTTPS webhook о сбоях и смене внешнего IP.",
    enableNotifications: "Включить уведомления",
    keepToken: "Оставьте пустым, чтобы сохранить текущий токен",
    testNotification: "Проверить уведомление",
    notificationSaved: "Настройки уведомлений сохранены",
    changePreview: "Предварительный просмотр изменений",
    start: "Старт",
    restart: "Рестарт",
    stop: "Стоп",
    stopConfirm: "Остановить этот сервис?",
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
    signInPasskey: "Face ID / Touch ID",
    addPasskey: "Добавить Face ID / Touch ID",
    passkeyAdded: "Ключ доступа добавлен",
    passkeyUnavailable: "Для ключей доступа нужен доверенный HTTPS и совместимый браузер.",
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
  updatePageHeader();
}

const pageMeta = {
  overview: ["overview", "overviewText"],
  routing: ["routing", "routingText"],
  dns: ["DNS", "dnsText"],
  providers: ["providers", "providersText"],
  health: ["health", "healthText"],
  logs: ["logs", "logsText"],
  settings: ["settings", "settingsText"],
};

function updatePageHeader() {
  const [titleKey, descriptionKey] = pageMeta[state.page] || pageMeta.overview;
  $("#pageTitle").textContent = titleKey === "DNS" ? "DNS" : t(titleKey);
  $("#pageDescription").textContent = t(descriptionKey);
}

function showPage(page) {
  if (!pageMeta[page]) return;
  state.page = page;
  document.querySelectorAll("[data-page]").forEach((node) => {
    const active = node.dataset.page === page;
    node.hidden = !active;
    node.classList.toggle("active", active);
  });
  document.querySelectorAll("[data-nav]").forEach((button) => button.classList.toggle("active", button.dataset.nav === page));
  $("[data-mobile-more]")?.classList.toggle("active", ["providers", "logs", "settings"].includes(page));
  updatePageHeader();
  if (page === "health" && !state.maintenanceLoaded) loadBackups().catch((error) => showToast(error.message));
  if (page === "logs" && !state.logsLoaded) loadLogs().catch((error) => showToast(error.message));
  if (page === "settings") {
    if (!state.filesLoaded) loadEditors().catch((error) => showToast(error.message));
    if (!state.notificationsLoaded) loadNotificationSettings().catch((error) => showToast(error.message));
  }
}

function setupNavigationIcons() {
  const names = { overview: "overview", routing: "route", dns: "dns", providers: "globe", health: "diagnostic", logs: "terminal", settings: "settings" };
  document.querySelectorAll("[data-nav-icon]").forEach((node) => { node.innerHTML = icon(names[node.dataset.navIcon]); });
  document.querySelectorAll("[data-mobile-icon]").forEach((node) => { node.innerHTML = icon(names[node.dataset.mobileIcon]); });
  document.querySelectorAll("[data-static-icon]").forEach((node) => { node.innerHTML = icon(node.dataset.staticIcon); });
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
  overview: "M3,3H11V11H3V3M5,5V9H9V5H5M13,3H21V11H13V3M15,5V9H19V5H15M3,13H11V21H3V13M5,15V19H9V15H5M13,13H21V21H13V13M15,15V19H19V15H15Z",
  settings: "M12,15.5A3.5,3.5 0 1,1 12,8.5A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.42,11L21.54,9.37L19.54,5.9L17.05,6.9C16.54,6.5 16,6.18 15.37,5.94L15,3.29H11L10.62,5.94C10,6.18 9.45,6.5 8.95,6.9L6.46,5.9L4.46,9.37L6.57,11C6.53,11.34 6.5,11.67 6.5,12C6.5,12.33 6.53,12.65 6.58,12.97L4.46,14.63L6.46,18.1L8.95,17.09C9.46,17.5 10,17.82 10.63,18.06L11,20.71H15L15.38,18.06C16,17.81 16.55,17.5 17.05,17.09L19.54,18.1L21.54,14.63L19.43,12.97Z",
  diagnostic: "M3,13H5.2L7.1,9.2L10.6,17L13.2,12H21V14H14.4L10.5,21L7,13.8L6.4,15H3V13M3,5H21V7H3V5Z",
  backup: "M21,11V3H3V9H5V5H19V11H16L20,15L24,11H21M3,13V21H21V17H19V19H5V13H3M12,8A5,5 0 0,0 7,13H9A3,3 0 0,1 12,10A3,3 0 0,1 15,13H17A5,5 0 0,0 12,8Z",
  restore: "M13,3C8.03,3 4,7.03 4,12H1L5,16L9,12H6C6,8.69 8.69,6 12,6C15.31,6 18,8.69 18,12C18,15.31 15.31,18 12,18C10.35,18 8.85,17.33 7.76,16.24L6.34,17.66C7.79,19.1 9.79,20 12,20C16.42,20 20,16.42 20,12C20,7.03 16.42,3 12,3H13Z",
  fingerprint: "M17.81,4.47C16.27,3 14.22,2 12,2C9.79,2 7.78,2.89 6.31,4.34L7.72,5.76C8.82,4.67 10.34,4 12,4C13.66,4 15.18,4.67 16.28,5.76L17.81,4.47M20.84,7.31C19.03,4.14 15.68,2 12,2V4C14.94,4 17.6,5.71 18.91,8.37L20.84,7.31M3.16,7.31L5.09,8.37C6.4,5.71 9.06,4 12,4V2C8.32,2 4.97,4.14 3.16,7.31M12,6C8.69,6 6,8.69 6,12C6,13.1 6.9,14 8,14C9.1,14 10,13.1 10,12C10,10.9 10.9,10 12,10C13.1,10 14,10.9 14,12C14,15.31 12.66,18.31 10.5,20.47L11.91,21.88C14.44,19.35 16,15.85 16,12C16,9.79 14.21,8 12,8C9.79,8 8,9.79 8,12H6C6,8.69 8.69,6 12,6M18,12C18,16.42 16.21,20.42 13.31,23.31L14.72,24.72C17.99,21.45 20,16.95 20,12C20,7.58 16.42,4 12,4V6C15.31,6 18,8.69 18,12Z",
  profile: "M12,12A5,5 0 1,0 12,2A5,5 0 0,0 12,12M12,14C6.48,14 2,16.24 2,19V22H22V19C22,16.24 17.52,14 12,14Z",
  more: "M12,8A2,2 0 1,0 12,4A2,2 0 0,0 12,8M12,10A2,2 0 1,0 12,14A2,2 0 0,0 12,10M12,16A2,2 0 1,0 12,20A2,2 0 0,0 12,16Z",
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
  logout: "M16,13V11H7V8L2,12L7,16V13H16M20,3H8A2,2 0 0,0 6,5V7H8V5H20V19H8V17H6V19A2,2 0 0,0 8,21H20A2,2 0 0,0 22,19V5A2,2 0 0,0 20,3Z",
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
  state.connections = data;
  const connections = (data.connections || []).filter((item) => item.ip && item.ip !== "N/A");
  $("#connectionsList").innerHTML = connections.length
    ? `<div class="table-scroll"><table class="data-table">
        <thead><tr><th>${t("connection")}</th><th>IP</th><th>${t("country")}</th><th>${t("provider")}</th></tr></thead>
        <tbody>${connections
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
            <tr class="${item.active ? "active" : ""}">
              <td><div class="connection-title">
                ${icon(item.type === "wireguard" ? "wireguard" : "globe")}
                <div><strong>${title}</strong>${active}</div>
              </div></td>
              <td data-label="IP"><strong>${escapeHtml(item.ip)}</strong></td>
              <td data-label="${t("country")}"><strong class="inline-media">${country}</strong></td>
              <td data-label="${t("provider")}"><strong class="inline-media">${provider}</strong></td>
            </tr>
          `;
        })
        .join("")}</tbody></table></div>`
    : `<p class="empty">${t("noConnectionData")}</p>`;
}

function monitoringSparkline(samples) {
  const values = samples.map((sample) => Number(sample.latencyMs)).filter(Number.isFinite);
  if (values.length < 2) return `<span class="monitoring-empty">—</span>`;
  const max = Math.max(...values, 1);
  const points = values.map((value, index) => `${(index * 100) / (values.length - 1)},${28 - (value / max) * 24}`).join(" ");
  return `<svg class="monitoring-chart" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true"><polyline points="${points}"></polyline></svg>`;
}

function renderMonitoring(data) {
  const items = data.items || [];
  $("#monitoringGrid").innerHTML = items.length
    ? items.map((item) => {
      const latest = item.samples?.at(-1) || {};
      const latency = Number.isFinite(Number(latest.latencyMs)) ? `${Math.round(Number(latest.latencyMs))} ms` : "—";
      return `<article class="monitoring-card">
        <div class="monitoring-title"><span class="status-dot ${latest.online ? "ok" : "bad"}"></span><strong>${escapeHtml(item.id)}</strong><span>${escapeHtml(String(item.availability))}%</span></div>
        ${monitoringSparkline(item.samples || [])}
        <div class="monitoring-meta"><span>${t("latency")}</span><strong>${latency}</strong><span>${t("availability")}</span><strong>${escapeHtml(String(item.availability))}%</strong></div>
      </article>`;
    }).join("")
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
      const visibleValues = values.slice(0, 3);
      const chips = visibleValues.length
        ? visibleValues.map((value) => `<code title="${escapeHtml(value)}">${escapeHtml(value)}</code>`).join("")
        : `<p>${t("noEntries")}</p>`;
      const remaining = values.length - visibleValues.length;
      return `<div class="project-sample"><div class="list-head"><h3>${escapeHtml(readableFileLabel(label))}</h3><span class="sample-count">${values.length}</span></div><div class="sample-chips">${chips}${remaining > 0 ? `<span class="more-count">+${remaining}</span>` : ""}</div></div>`;
    })
    .join("");

  const projectIcon = project.key === "cloud" ? "cloud" : "update";
  const active = isActiveState(project.timer);
  const projectEvent = compactEvent("", project.lastEvent, project.lastLog);
  const projectSubtitle = [localizedStatus(project.activeName || "not configured"), projectEvent]
    .filter((value) => value && value !== "unknown")
    .join(" - ");
  const controls = active
    ? `${actionButton(`${project.key}.restart`, t("restart"), "refresh")}${actionButton(`${project.key}.stop`, t("stop"), "stop", { danger: true })}`
    : actionButton(`${project.key}.start`, t("start"), "play");
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
          ${controls}
        </div>
      </div>
      <div class="status-row">
        <div class="status-cell"><span>${t("timer")}</span><strong>${badge(project.timer)}</strong></div>
        <div class="status-cell"><span>${t("table")}</span><strong>${escapeHtml(localizedStatus(project.activeTable))}</strong></div>
        <div class="status-cell"><span>${t("rules")}</span><strong>${escapeHtml(localizedStatus(project.rules))}</strong></div>
        <div class="status-cell"><span>${t("entries")}</span><strong>${escapeHtml(Object.values(project.counts || {}).join(" / ") || "0")}</strong></div>
      </div>
      <div class="project-samples">${sampleHtml}</div>
    </section>
  `;
}

function renderProjects() {
  const projects = state.status?.projects || [];
  const selected = projects.filter((project) => project.key === state.projectTab);
  $("#projects").innerHTML = selected.map(renderProject).join("");
  document.querySelectorAll("[data-project-tab]").forEach((button) => button.classList.toggle("active", button.dataset.projectTab === state.projectTab));
}

function renderServiceOverview(data) {
  const cards = [
    ...(data.projects || []).map((project) => ({
      title: project.title,
      subtitle: project.activeName || t("notConfigured"),
      value: `${project.rules || 0} ${t("rules").toLowerCase()}`,
      state: project.timer,
      icon: project.key === "cloud" ? "cloud" : "update",
      page: "routing",
      project: project.key,
    })),
    {
      title: "DNSCrypt",
      subtitle: `${data.dnscrypt.domains || 0} ${t("domains").toLowerCase()}`,
      value: data.dnscrypt.route?.name || data.dnscrypt.route?.iface || t("unknown"),
      state: data.dnscrypt.service,
      icon: "dns",
      page: "dns",
    },
  ];
  $("#serviceOverview").innerHTML = cards.map((item) => `
    <button class="service-card" type="button" data-go-page="${item.page}" ${item.project ? `data-go-project="${item.project}"` : ""}>
      <span class="service-icon">${icon(item.icon)}</span>
      <span class="service-copy"><span>${item.title}</span><small>${escapeHtml(localizedStatus(item.subtitle))}</small></span>
      <span class="service-meta">${badge(item.state)}<small>${escapeHtml(item.value)}</small></span>
    </button>
  `).join("");
}

function renderStatus(data) {
  state.status = data;
  const address = data.host === "0.0.0.0" ? `LAN access on port ${data.port}` : `${data.host}:${data.port}`;
  const rootPath = $("#rootPath");
  if (rootPath) rootPath.textContent = `${address} - root ${data.root}`;
  renderServiceOverview(data);
  renderProjects();

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
  const dnsActive = isActiveState(data.dnscrypt.service);
  $("#dnscryptActions").innerHTML = dnsActive
    ? `${actionButton("dnscrypt.restart", t("restart"), "refresh")}${actionButton("dnscrypt.stop", t("stop"), "stop", { danger: true })}`
    : actionButton("dnscrypt.start", t("start"), "play");

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
    .map((item) => `<article class="isp-icon-item" title="${escapeHtml(item.name)}"><img src="${escapeHtml(item.url)}" alt=""><span>${escapeHtml(item.name.replace(/_101x101\.png$/i, ""))}</span></article>`)
    .join("") || `<p>${t("noIcons")}</p>`;
  const iconsActive = Boolean(data.ispIcons.exists && Number(data.ispIcons.icons) > 0);
  $("#iconsActions").innerHTML = iconsActive
    ? `${actionButton("icons.discover", t("update"), "refresh")}${actionButton("icons.uninstall", t("stop"), "stop", { danger: true })}`
    : actionButton("icons.install", t("start"), "play");
}

async function loadEditors() {
  const data = await getJson("/api/files");
  state.files = data.files || {};
  state.filesLoaded = true;
  document.querySelectorAll("[data-editor]").forEach((editor) => {
    const item = data.files?.[editor.dataset.editor];
    if (!item) return;
    editor.value = item.content || "";
    const path = document.querySelector(`[data-editor-path="${editor.dataset.editor}"]`);
    if (path) path.textContent = item.path;
  });
}

async function loadNotificationSettings() {
  const data = await getJson("/api/notifications", { cache: "no-store" });
  $("#notificationsEnabled").checked = Boolean(data.enabled);
  $("#telegramBotToken").value = "";
  $("#telegramBotToken").placeholder = data.telegramConfigured ? "••••••••••••" : t("keepToken");
  $("#telegramChatId").value = data.telegramChatId || "";
  $("#notificationWebhook").value = data.webhookUrl || "";
  state.notificationsLoaded = true;
}

async function saveNotificationSettings() {
  const result = await getJson("/api/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      enabled: $("#notificationsEnabled").checked,
      telegramBotToken: $("#telegramBotToken").value,
      telegramChatId: $("#telegramChatId").value,
      webhookUrl: $("#notificationWebhook").value,
    }),
  });
  showToast(result.output || t("notificationSaved"));
  await loadNotificationSettings();
}

async function testNotification() {
  const result = await getJson("/api/notifications/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  showToast(result.output || t("done"));
}

function renderUserIdentity(me) {
  const initials = (me.name || me.username || "UR").slice(0, 2).toUpperCase();
  $("#avatarInitials").textContent = initials;
  $("#profileAvatarInitials").textContent = initials;
  $("#profileDisplayName").textContent = me.name || me.username || "Administrator";
  for (const [imageSelector, initialsSelector] of [["#avatarImg", "#avatarInitials"], ["#profileAvatarImg", "#profileAvatarInitials"]]) {
    const image = $(imageSelector);
    const text = $(initialsSelector);
    image.hidden = !me.avatar;
    text.hidden = Boolean(me.avatar);
    if (me.avatar) image.src = me.avatar;
  }
}

async function checkAuth() {
  const me = await getJson("/api/auth/me");
  state.me = me;
  const modal = $("#loginModal");
  modal.hidden = Boolean(me.authenticated);
  document.body.classList.remove("auth-pending");
  document.body.classList.toggle("auth-locked", !me.authenticated);
  applyBranding(me.logo);
  const passkeysAvailable = window.isSecureContext && Boolean(window.PublicKeyCredential);
  $("#passkeyLoginBtn").hidden = !passkeysAvailable || !me.passkeys;
  $("#registerPasskeyBtn").hidden = !passkeysAvailable || !me.authenticated;
  if (me.authenticated) renderUserIdentity(me);
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
  if (state.refreshing) return;
  if (!state.me?.authenticated && !(await checkAuth())) return;
  state.refreshing = true;
  $("#refreshState").classList.add("loading");
  $("#connectionsLoader").hidden = false;
  $("#monitoringLoader").hidden = false;
  $("#refreshBtn").disabled = true;
  const overviewRequest = getJson("/api/overview", { cache: "no-store" });
  const connectionsRequest = getJson("/api/connections", { cache: "no-store" })
    .then((data) => renderConnections(data))
    .catch((error) => showToast(error.message))
    .finally(() => { $("#connectionsLoader").hidden = true; });
  const monitoringRequest = connectionsRequest
    .then(() => getJson("/api/monitoring", { cache: "no-store" }))
    .then((data) => renderMonitoring(data))
    .finally(() => { $("#monitoringLoader").hidden = true; });
  try {
    const data = await overviewRequest;
    renderStatus(data);
    enhanceButtons();
    $("#lastUpdated").textContent = t("updatedNow");
    const optional = [connectionsRequest, monitoringRequest];
    if (state.page === "logs") optional.push(loadLogs());
    if (state.page === "settings" && !state.filesLoaded) optional.push(loadEditors());
    if (state.page === "settings" && !state.notificationsLoaded) optional.push(loadNotificationSettings());
    const results = await Promise.allSettled(optional);
    const rejected = results.find((result) => result.status === "rejected");
    if (rejected) throw rejected.reason;
  } finally {
    state.refreshing = false;
    $("#refreshState").classList.remove("loading");
    $("#refreshBtn").disabled = false;
  }
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
  state.logsLoaded = true;
}

function formatBytes(value) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function renderBackups(data) {
  const items = data.backups || [];
  $("#backupList").innerHTML = items.length ? items.map((item) => `
    <article class="backup-item">
      <div><strong>${escapeHtml(new Date(item.createdAt * 1000).toLocaleString(state.lang))}</strong><small>${escapeHtml(item.reason)} · ${formatBytes(item.size)}</small></div>
      <button type="button" data-restore-backup="${escapeHtml(item.id)}">${icon("restore")}<span>${t("restore")}</span></button>
    </article>
  `).join("") : `<p class="empty">${t("noBackups")}</p>`;
}

async function loadBackups() {
  const data = await getJson("/api/backups", { cache: "no-store" });
  renderBackups(data);
  state.maintenanceLoaded = true;
}

async function createBackup() {
  const result = await getJson("/api/backups/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  showToast(result.ok ? t("done") : t("failed"));
  await loadBackups();
}

async function restoreBackup(id) {
  if (!window.confirm(t("restoreConfirm"))) return;
  const result = await getJson("/api/backups/restore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  showToast(result.output || (result.ok ? t("done") : t("failed")));
  state.filesLoaded = false;
  await Promise.all([loadBackups(), refresh()]);
}

function renderDiagnostics(data) {
  $("#diagnosticSummary").innerHTML = `
    <div class="diagnostic-score ${data.ok ? "ok" : "bad"}"><strong>${data.passed}/${data.total}</strong><span>${t("diagnosticPassed")}</span></div>
    <div class="diagnostic-duration"><strong>${data.durationMs} ms</strong><span>${escapeHtml(new Date(data.generatedAt * 1000).toLocaleTimeString(state.lang))}</span></div>`;
  $("#diagnosticResults").innerHTML = (data.sections || []).map((section) => `
    <article class="diagnostic-section">
      <div class="list-head"><h3>${escapeHtml(section.title)}</h3>${badge(section.ok ? "active" : "error")}</div>
      <div class="diagnostic-checks">${section.checks.map((check) => `
        <div class="diagnostic-check ${check.ok ? "ok" : "bad"}"><span class="status-dot ${check.ok ? "ok" : "bad"}"></span><strong>${escapeHtml(check.label)}</strong><code title="${escapeHtml(check.detail)}">${escapeHtml(check.detail || "—")}</code></div>`).join("")}</div>
    </article>`).join("");
}

async function runDiagnostics() {
  const button = $("#runDiagnosticsBtn");
  button.disabled = true;
  try {
    const data = await getJson("/api/diagnostics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    renderDiagnostics(data);
  } finally {
    button.disabled = false;
  }
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
    refreshBtn.innerHTML = icon("refresh");
    refreshBtn.title = t("refresh");
    refreshBtn.setAttribute("aria-label", t("refresh"));
  }
}

async function runAction(action) {
  if (state.busy) return;
  if (action === "dnscrypt.flush-cache" && !window.confirm(t("clearDnsCacheConfirm"))) return;
  if (action === "system.update" && !window.confirm(t("updateProjectConfirm"))) return;
  if ((action.endsWith(".stop") || action === "icons.uninstall") && !window.confirm(t("stopConfirm"))) return;
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
  const validationTarget = document.querySelector(`[data-validation="${key}"]`);
  const validation = await getJson("/api/files/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, content: editor.value }),
  });
  if (validationTarget) {
    validationTarget.className = `editor-validation ${validation.ok ? "ok" : "bad"}`;
    validationTarget.textContent = validation.ok
      ? `${t("validationOk")}: ${validation.entries}`
      : `${t("validationFailed")}: ${(validation.errors || []).join("; ")}`;
  }
  if (!validation.ok) return;
  if (validation.warnings?.length && !window.confirm(validation.warnings.join("\n"))) return;
  const preview = validation.preview || {};
  if (!preview.changed) {
    showToast(`${t("changePreview")}: 0`);
    return;
  }
  const summary = `${t("changePreview")}: +${preview.added || 0} / −${preview.removed || 0}`;
  if (!window.confirm(`${summary}\n\n${preview.diff || ""}`)) return;
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
    document.body.classList.remove("auth-locked", "auth-pending");
    await refresh();
  }
}

function decodeBase64Url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

function encodeBase64Url(value) {
  const bytes = new Uint8Array(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function preparePublicKey(options) {
  const result = { ...options, challenge: decodeBase64Url(options.challenge) };
  if (options.user) result.user = { ...options.user, id: decodeBase64Url(options.user.id) };
  if (options.allowCredentials) result.allowCredentials = options.allowCredentials.map((item) => ({ ...item, id: decodeBase64Url(item.id) }));
  if (options.excludeCredentials) result.excludeCredentials = options.excludeCredentials.map((item) => ({ ...item, id: decodeBase64Url(item.id) }));
  return result;
}

function serializeCredential(credential) {
  const response = {};
  for (const key of ["clientDataJSON", "attestationObject", "authenticatorData", "signature", "userHandle"]) {
    if (credential.response[key]) response[key] = encodeBase64Url(credential.response[key]);
  }
  return { id: credential.id, rawId: encodeBase64Url(credential.rawId), type: credential.type, response };
}

async function loginWithPasskey() {
  if (!window.isSecureContext || !window.PublicKeyCredential) throw new Error(t("passkeyUnavailable"));
  const options = await getJson("/api/auth/passkey/options", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  const credential = await navigator.credentials.get({ publicKey: preparePublicKey(options.publicKey) });
  const result = await getJson("/api/auth/passkey/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: options.token, credential: serializeCredential(credential) }),
  });
  if (result.ok) {
    $("#loginModal").hidden = true;
    document.body.classList.remove("auth-locked", "auth-pending");
    await checkAuth();
    await refresh();
  }
}

async function registerPasskey() {
  if (!window.isSecureContext || !window.PublicKeyCredential) throw new Error(t("passkeyUnavailable"));
  const options = await getJson("/api/auth/passkey/register/options", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  const credential = await navigator.credentials.create({ publicKey: preparePublicKey(options.publicKey) });
  const result = await getJson("/api/auth/passkey/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: options.token, name: navigator.platform || "Passkey", credential: serializeCredential(credential) }),
  });
  showToast(result.ok ? t("passkeyAdded") : result.output || t("failed"));
  if (result.ok) {
    state.me.passkeys = result.count;
    $("#passkeyLoginBtn").hidden = false;
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
    state.me = { ...state.me, avatar: result.avatar };
    renderUserIdentity(state.me);
    showToast(result.ok ? t("avatarUpdated") : result.output || t("failed"));
    $("#avatarFile").value = "";
    $("#avatarFileName").textContent = t("noFileSelected");
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

function openProfile() {
  $("#profileLogin").value = state.me?.username || "";
  $("#profileCurrentPassword").value = "";
  $("#profileNewPassword").value = "";
  $("#profileConfirmPassword").value = "";
  $("#profileModal").hidden = false;
}

async function logout() {
  await getJson("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  location.reload();
}

document.addEventListener("click", async (event) => {
  const mobileMenu = $("#mobileMoreMenu");
  const mobileMore = event.target.closest("[data-mobile-more]");
  if (mobileMore) {
    mobileMenu.hidden = !mobileMenu.hidden;
    mobileMore.setAttribute("aria-expanded", String(!mobileMenu.hidden));
    return;
  }
  const nav = event.target.closest("[data-nav]");
  if (nav) {
    showPage(nav.dataset.nav);
    mobileMenu.hidden = true;
    $("[data-mobile-more]")?.setAttribute("aria-expanded", "false");
  }
  if (event.target.closest("[data-mobile-profile]")) {
    mobileMenu.hidden = true;
    $("[data-mobile-more]")?.setAttribute("aria-expanded", "false");
    openProfile();
  }
  if (event.target.closest("[data-mobile-logout]")) await logout();
  if (!event.target.closest("#mobileMoreMenu")) {
    mobileMenu.hidden = true;
    $("[data-mobile-more]")?.setAttribute("aria-expanded", "false");
  }
  const pageLink = event.target.closest("[data-go-page]");
  if (pageLink) {
    if (pageLink.dataset.goProject) state.projectTab = pageLink.dataset.goProject;
    showPage(pageLink.dataset.goPage);
    renderProjects();
  }
  const projectTab = event.target.closest("[data-project-tab]");
  if (projectTab) {
    state.projectTab = projectTab.dataset.projectTab;
    renderProjects();
  }
  const button = event.target.closest("[data-action]");
  if (button) runAction(button.dataset.action);
  const save = event.target.closest("[data-save-editor]");
  if (save) saveEditor(save.dataset.saveEditor);
  const open = event.target.closest("[data-open-editor]");
  if (open) {
    try {
      if (!state.filesLoaded) await loadEditors();
      openEditor(open.dataset.openEditor);
    } catch (error) {
      showToast(error.message);
    }
  }
  const download = event.target.closest("[data-open-download]");
  if (download) openDownload(download.dataset.openDownload);
  const restore = event.target.closest("[data-restore-backup]");
  if (restore) restoreBackup(restore.dataset.restoreBackup).catch((error) => showToast(error.message));
  if (event.target.closest("[data-close-modal]")) event.target.closest(".modal").hidden = true;
});

$("#refreshBtn").addEventListener("click", () => refresh().catch((error) => showToast(error.message)));
$("#runDiagnosticsBtn").addEventListener("click", () => runDiagnostics().catch((error) => showToast(error.message)));
$("#createBackupBtn").addEventListener("click", () => createBackup().catch((error) => showToast(error.message)));
$("#logTarget").addEventListener("change", () => loadLogs().catch((error) => showToast(error.message)));
$("#loginForm").addEventListener("submit", (event) => {
  event.preventDefault();
  login($("#loginUser").value, $("#loginPass").value).catch((error) => showToast(error.message));
});
$("#passkeyLoginBtn").addEventListener("click", () => loginWithPasskey().catch((error) => showToast(error.message)));
$("#registerPasskeyBtn").addEventListener("click", () => registerPasskey().catch((error) => showToast(error.message)));
$("#saveModalEditor").addEventListener("click", () => saveEditor(state.editorKey));
$("#downloadBtn").addEventListener("click", downloadAsset);
$("#avatarBtn").addEventListener("click", openProfile);
$("#brandLogoBtn").addEventListener("click", () => $("#brandLogoFile").click());
$("#brandLogoFile").addEventListener("change", () => uploadBrandLogo($("#brandLogoFile").files[0]));
$("#chooseAvatar").addEventListener("click", () => $("#avatarFile").click());
$("#avatarFile").addEventListener("change", () => {
  $("#avatarFileName").textContent = $("#avatarFile").files[0]?.name || t("noFileSelected");
  if ($("#avatarFile").files[0]) uploadAvatar();
});
$("#profileForm").addEventListener("submit", (event) => {
  event.preventDefault();
  updateProfile().catch((error) => showToast(error.message));
});
$("#notificationForm").addEventListener("submit", (event) => {
  event.preventDefault();
  saveNotificationSettings().catch((error) => showToast(error.message));
});
$("#testNotificationBtn").addEventListener("click", () => testNotification().catch((error) => showToast(error.message)));
$("#logoutBtn").addEventListener("click", logout);
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
  if (state.connections) renderConnections(state.connections);
});
$("#autoRefresh").addEventListener("change", () => {
  clearInterval(state.autoTimer);
  const seconds = Number($("#autoRefresh").value);
  if (seconds > 0) state.autoTimer = setInterval(() => refresh().catch((error) => showToast(error.message)), seconds * 1000);
});
$("#toggleLogs").addEventListener("click", () => {
  const box = $("#logBox");
  box.hidden = !box.hidden;
  renderLogToggle();
});
document.body.classList.toggle("dark", localStorage.getItem("theme") !== "light");
state.lang = detectLanguage();
setupNavigationIcons();
applyLanguage();
renderLogToggle();
enhanceButtons();

checkAuth().then((ok) => ok && refresh()).catch((error) => {
  showToast(error.message);
});
