const $ = (q) => document.querySelector(q);
let settings = load();
// Runtime, non-persistent state for debouncing chime/alarm triggers
const runtime = {
  lastChimeKey: null, // e.g., YYYY-M-D-H
  lastAlarmKey: null, // e.g., YYYY-M-D-HH:MM
  audioContext: null,
};
let translations = {};

// Synchronize separator blink animation for all .separator .dot
function syncSeparatorBlink() {
  // Animation duration in ms (should match CSS)
  const duration = 1000;
  const now = Date.now();
  const offset = now % duration;
  document.querySelectorAll(".separator .dot").forEach((dot) => {
    dot.style.animationDelay = `-${offset}ms`;
  });
}

// Basic in-file translation dictionary fallback (can be replaced by external JSON fetch if added later)
const TRANSLATIONS = {
  en: {
    clockSettings: "Clock Settings",
    timeDate: "Time & Date",
    timeDateSub: "Set format, timezone and automatic adjustments.",
    timeSection: "Time",
    dateSection: "Date",
    timeFormat: "Time format",
    leadingZero: "Leading Zero",
    dateFormat: "Date format",
    autoDateDisplay: "Auto date display",
    showSeconds: "Show seconds",
    timeZone: "Time zone",
    dst: "Summer Time (DST)",
    separatorBehavior: "Separator Behavior",
    setTime: "Set Time",
    setDate: "Set Date",
    reset: "Reset",
    apply: "Apply",
    displayLighting: "Display & Lighting",
    displayLightingSub: "Adjust brightness, colors, animations and effects.",
    brightness: "Brightness",
    glowIntensity: "Glow Intensity",
    underlightColor: "Under-light color",
    animation: "Animation",
    steady: "Steady",
    gradient: "Gradient",
    slotMachine: "Slot Machine",
    pulse: "Pulse",
    off: "Off",
    autoDim: "Auto-dim at night",
    autoDimHint: "Night Mode reduces brightness on schedule",
    revert: "Revert",
    applyLighting: "Apply Lighting",
    connectivity: "Connectivity",
    connectivitySub: "Wi-Fi setup and Internet synchronization.",
    wifiSSID: "Wi-Fi SSID",
    wifiPass: "Wi-Fi Password",
    inetTimeSync: "Internet time sync",
    timeServer: "Time server (optional)",
    test: "Test",
    saveWifi: "Save Wi-Fi",
    soundAlarms: "Sound & Alarms",
    soundAlarmsSub: "Chimes, alarms and tones.",
    hourlyChime: "Hourly chime",
    alarmTime: "Alarm time",
    days: "Days",
    volume: "Volume",
    testSound: "Test Sound",
    saveAlarm: "Save Alarm",
    modesSafety: "Modes & Safety",
    modesSafetySub: "Protect your tubes and tailor the experience.",
    slotMachineAntiPoisoning: "Slot Machine (anti-poisoning)",
    slotInterval: "Slot interval (min)",
    tempUnits: "Temperature units",
    showTemp: "Show temperature",
    defaults: "Defaults",
    applyModes: "Apply Modes",
    system: "System",
    systemSub: "Firmware, device name and maintenance.",
    deviceName: "Device name",
    autoUpdates: "Auto updates",
    firmware: "Firmware",
    checkFw: "Check for updates",
    eraseRestart: "Erase & Restart",
    cancel: "Cancel",
    saveAll: "Save All",
    themeLight: "Light",
    themeDark: "Dark",
    themeSystem: "System",
    // Toasts
    toastApplied: "Applied",
    toastReset: "Reset",
    toastPingOk: "Ping ok",
    toastWifiSaved: "Wi-Fi saved",
    toastReverted: "Reverted",
    toastLightingApplied: "Lighting applied",
    toastAlarmSaved: "Alarm saved",
    toastDefaults: "Defaults",
    toastModesApplied: "Modes applied",
    toastNoUpdates: "No updates",
    toastErased: "Erased",
    toastCanceled: "Canceled",
    toastSaved: "Saved",
    toastBeep: "Beep",
  },
  de: {
    clockSettings: "Uhreinstellungen",
    timeDate: "Zeit & Datum",
    timeDateSub: "Format, Zeitzone und automatische Anpassungen.",
    timeSection: "Zeit",
    dateSection: "Datum",
    timeFormat: "Zeitformat",
    leadingZero: "Führende Null",
    dateFormat: "Datumsformat",
    autoDateDisplay: "Automatische Datumsanzeige",
    showSeconds: "Sekunden anzeigen",
    timeZone: "Zeitzone",
    dst: "Sommerzeit",
    separatorBehavior: "Separator-Verhalten",
    setTime: "Zeit einstellen",
    setDate: "Datum einstellen",
    reset: "Zurücksetzen",
    apply: "Anwenden",
    displayLighting: "Anzeige & Beleuchtung",
    displayLightingSub: "Helligkeit, Farben und Effekte anpassen.",
    brightness: "Helligkeit",
    glowIntensity: "Glühintensität",
    underlightColor: "Unterlichtfarbe",
    animation: "Animation",
    steady: "Stabil",
    gradient: "Farbverlauf",
    slotMachine: "Slot Machine",
    pulse: "Puls",
    off: "Aus",
    autoDim: "Nachts dimmen",
    autoDimHint: "Nachtmodus reduziert Helligkeit zeitgesteuert",
    revert: "Rückgängig",
    applyLighting: "Beleuchtung anwenden",
    connectivity: "Konnektivität",
    connectivitySub: "Wi-Fi Setup und Internet-Synchronisation.",
    wifiSSID: "Wi-Fi SSID",
    wifiPass: "Wi-Fi Passwort",
    inetTimeSync: "Internet Zeitsync",
    timeServer: "Zeitserver (optional)",
    test: "Testen",
    saveWifi: "Wi-Fi speichern",
    soundAlarms: "Sound & Alarme",
    soundAlarmsSub: "Stundenschlag, Alarme und Töne.",
    hourlyChime: "Stundenschlag",
    alarmTime: "Alarmzeit",
    days: "Tage",
    volume: "Lautstärke",
    testSound: "Sound testen",
    saveAlarm: "Alarm speichern",
    modesSafety: "Modi & Schutz",
    modesSafetySub: "Schützt Röhren und passt Erlebnis an.",
    slotMachineAntiPoisoning: "Slot Machine (Anti-Burn)",
    slotInterval: "Slot Intervall (Min)",
    tempUnits: "Temperatureinheiten",
    showTemp: "Temperatur anzeigen",
    defaults: "Standard",
    applyModes: "Modi anwenden",
    system: "System",
    systemSub: "Firmware, Gerätename & Wartung.",
    deviceName: "Gerätename",
    autoUpdates: "Auto Updates",
    firmware: "Firmware",
    checkFw: "Auf Updates prüfen",
    eraseRestart: "Löschen & Neustart",
    cancel: "Abbrechen",
    saveAll: "Alles speichern",
    themeLight: "Hell",
    themeDark: "Dunkel",
    themeSystem: "System",
    // Toasts
    toastApplied: "Angewendet",
    toastReset: "Zurückgesetzt",
    toastPingOk: "Ping OK",
    toastWifiSaved: "Wi-Fi gespeichert",
    toastReverted: "Zurückgesetzt",
    toastLightingApplied: "Beleuchtung angewendet",
    toastAlarmSaved: "Alarm gespeichert",
    toastDefaults: "Standard",
    toastModesApplied: "Modi angewendet",
    toastNoUpdates: "Keine Updates",
    toastErased: "Gelöscht",
    toastCanceled: "Abgebrochen",
    toastSaved: "Gespeichert",
    toastBeep: "Pieps",
  },
};

async function loadTranslations(lang) {
  translations = TRANSLATIONS[lang] || TRANSLATIONS.en;
  translatePage();
}

function translatePage() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (translations[key]) {
      el.textContent = translations[key];
    }
  });
  if (el.footerBrand) {
    const year = new Date().getFullYear();
    el.footerBrand.textContent = `© ${year} Millclock`;
  }
}

const defaults = {
  lang: "en",
  theme: "system",
  is24h: true,
  leadingZero: true,
  autoDate: true,
  dateFormat: "DD-MM-YYYY",
  timezone: "UTC+00:00",
  dstMode: "off",
  separator: "blinking",
  showSeconds: false,
  led: { r: 255, g: 102, b: 0 }, // retained only if needed for other parts; color picking removed
  brightness: 90,
  glowIntensity: 70,
  nightMode: false,
  wifi: { ssid: "", pass: "" },
  ntpEnable: true,
  ntpServer: "pool.ntp.org",
  anim: "steady",
  hourlyChime: false,
  alarmTime: "07:30",
  alarmDays: "monfri",
  volume: 40,
  slotMachine: true,
  slotInterval: 30,
  units: "c",
  showTemp: false,
  deviceName: "ZIN-70-LivingRoom",
  autoUpdates: true,
  firmware: "v1.0.0",
};

settings = Object.assign({}, defaults, settings || {});

const el = {
  nixie: $("#nixie"),
  h1: $("#h1"),
  h2: $("#h2"),
  m1: $("#m1"),
  m2: $("#m2"),
  s1: $("#s1"),
  s2: $("#s2"),
  d1: $("#d1"),
  d2: $("#d2"),
  mo1: $("#mo1"),
  mo2: $("#mo2"),
  y1: $("#y1"),
  y2: $("#y2"),
  y3: $("#y3"),
  y4: $("#y4"),
  nixieDate: $("#nixie-date"),
  is24hSelect: $("#is24hSelect"),
  dateFormat: $("#dateFormat"),
  tzText: $("#tzText"),
  dstMode: $("#dstMode"),
  separatorBehavior: $("#separatorBehavior"),
  leadingZero: $("#leadingZero"),
  autoDateDisplay: $("#autoDateDisplay"),
  showSeconds: $("#showSeconds"),
  timeInput: $("#timeInput"),
  dateInput: $("#dateInput"),
  ssid: $("#ssid"),
  wpass: $("#wpass"),
  passToggle: $("#passToggle"),
  ntpEnable: $("#ntpEnable"),
  ntpServer: $("#ntpServer"),
  glowIntensity: $("#glowIntensity"),
  nightMode: $("#nightMode"),
  brightness: $("#brightness"),
  hourlyChime: $("#hourlyChime"),
  alarmTime: $("#alarmTime"),
  alarmDays: $("#alarmDays"),
  volume: $("#volume"),
  slotMachine: $("#slotMachine"),
  slotInterval: $("#slotInterval"),
  units: $("#units"),
  showTemp: $("#showTemp"),
  deviceName: $("#deviceName"),
  autoUpdates: $("#autoUpdates"),
  firmware: $("#firmware"),
  tdApply: $("#tdApply"),
  tdReset: $("#tdReset"),
  netTest: $("#netTest"),
  netSave: $("#netSave"),
  lightRevert: $("#lightRevert"),
  lightApply: $("#lightApply"),
  soundTest: $("#soundTest"),
  alarmSave: $("#alarmSave"),
  modesDefaults: $("#modesDefaults"),
  modesApply: $("#modesApply"),
  checkFw: $("#checkFw"),
  factoryReset: $("#factoryReset"),
  cancelAll: $("#cancelAll"),
  saveBtn: $("#saveBtn"),
  toast: $("#toast"),
  lang: $("#langSelect"),
  theme: $("#themeSelect"),
  themeToggle: $("#themeToggle"),
  footerBrand: $("#footerBrand"),
};

async function init() {
  await loadTranslations(settings.lang || "en");
  applySettingsToUI();
  // Normalize system to concrete light/dark for two-state toggle
  if (settings.theme === "system") {
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    settings.theme = prefersDark ? "dark" : "light";
    save();
  }
  applyTheme();
  updateBrightness();
  updateGlow();
  // animation modes removed
  attachEvents();
  setupThemeToggle();
  syncSeparatorBlink();
  tick();
  el.nixie.dataset.ready = "true";
  setInterval(tick, 250);

  // Prime audio on first user interaction to satisfy autoplay policies
  const prepareAudio = () => {
    try {
      const ac = getAudioContext();
      if (ac && ac.resume) ac.resume().catch(() => {});
    } catch {}
  };
  window.addEventListener("pointerdown", prepareAudio, {
    once: true,
    passive: true,
  });

  // Back to top visibility handler
  const topBtn = document.getElementById("backToTop");
  if (topBtn) {
    const revealY = () => {
      // after the clock section height
      const clock = document.querySelector(".card-clock");
      const threshold = (clock?.offsetHeight || 400) + 80; // padding
      return threshold;
    };
    const onScroll = () => {
      if (window.scrollY > revealY()) topBtn.classList.add("show");
      else topBtn.classList.remove("show");
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    topBtn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      // hide after a short delay to sync with scroll finish
      setTimeout(() => topBtn.classList.remove("show"), 500);
    });
  }
}

function setupThemeToggle() {
  function syncThemeToggleVisual() {
    if (!el.theme) return;
    el.theme.setAttribute("data-mode", settings.theme);
    const labelMap = {
      light: translations.themeLight || "Light",
      dark: translations.themeDark || "Dark",
    };
    el.theme.setAttribute("data-label", labelMap[settings.theme]);
    if (el.themeToggle)
      el.themeToggle.setAttribute("aria-pressed", settings.theme === "dark");
  }
  syncThemeToggleVisual();
  if (el.themeToggle) {
    el.themeToggle.addEventListener("click", () => {
      settings.theme = settings.theme === "dark" ? "light" : "dark";
      applyTheme();
      syncThemeToggleVisual();
      save();
    });
    el.themeToggle.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        el.themeToggle.click();
      }
    });
  }
}

function renderDate(d) {
  if (!settings.autoDate) {
    el.nixieDate.classList.remove("visible");
    return;
  }

  el.nixieDate.classList.add("visible");

  const day = String(d.getDate()).padStart(2, "0");
  const mon = String(d.getMonth() + 1).padStart(2, "0");
  const yr = String(d.getFullYear());

  if (settings.dateFormat === "DD-MM-YYYY") {
    setDigit("d1", day[0]);
    setDigit("d2", day[1]);
    setDigit("mo1", mon[0]);
    setDigit("mo2", mon[1]);
  } else {
    // MM-DD-YYYY
    setDigit("d1", mon[0]);
    setDigit("d2", mon[1]);
    setDigit("mo1", day[0]);
    setDigit("mo2", day[1]);
  }
  setDigit("y1", yr[0]);
  setDigit("y2", yr[1]);
  setDigit("y3", yr[2]);
  setDigit("y4", yr[3]);
}

function setDigit(id, val) {
  const n = document.getElementById(id);
  if (!n) return;
  const next = val == null ? "" : String(val).trim();
  const same = n.textContent === next;
  if (same) return;
  n.textContent = next;
}

function attachEvents() {
  el.is24hSelect.addEventListener("change", (e) => {
    settings.is24h = e.target.value === "true";
    document.body.setAttribute("data-12h", settings.is24h ? "false" : "true");
    save();
  });
  el.dateFormat.addEventListener("change", (e) => {
    settings.dateFormat = e.target.value;
    save();
  });
  el.tzText.addEventListener("input", (e) => {
    settings.timezone = e.target.value || "UTC+00:00";
    save();
  });
  el.dstMode.addEventListener("change", (e) => {
    settings.dstMode = e.target.value;
    save();
  });
  el.leadingZero.addEventListener("change", (e) => {
    settings.leadingZero = e.target.checked;
    save();
  });
  el.autoDateDisplay.addEventListener("change", (e) => {
    settings.autoDate = e.target.checked;
    save();
  });
  el.showSeconds.addEventListener("change", (e) => {
    settings.showSeconds = e.target.checked;
    save();
    setTimeout(syncSeparatorBlink, 0);
  });
  el.separatorBehavior.addEventListener("change", (e) => {
    settings.separator = e.target.value;
    save();
  });
  el.timeInput.addEventListener("change", onManual);
  el.dateInput.addEventListener("change", onManual);
  el.tdApply.addEventListener("click", () => {
    flash(translations.toastApplied || "Applied");
  });
  el.tdReset.addEventListener("click", () => {
    settings = Object.assign({}, settings, { manual: null });
    applySettingsToUI();
    save();
    flash(translations.toastReset || "Reset");
  });

  el.passToggle.addEventListener("click", () => {
    el.wpass.type = el.wpass.type === "password" ? "text" : "password";
  });
  el.ssid.addEventListener("input", (e) => {
    settings.wifi.ssid = e.target.value;
    save();
  });
  el.wpass.addEventListener("input", (e) => {
    settings.wifi.pass = e.target.value;
    save();
  });
  el.ntpEnable.addEventListener("change", (e) => {
    settings.ntpEnable = e.target.checked;
    save();
  });
  el.ntpServer.addEventListener("input", (e) => {
    settings.ntpServer = e.target.value;
    save();
  });
  el.netTest.addEventListener("click", () => {
    flash(translations.toastPingOk || "Ping ok");
  });
  el.netSave.addEventListener("click", () => {
    save();
    flash(translations.toastWifiSaved || "Wi-Fi saved");
  });

  el.brightness.addEventListener("input", (e) => {
    settings.brightness = +e.target.value;
    updateBrightness();
    updateSliderFill(e.target);
    save();
  });
  if (el.glowIntensity) {
    el.glowIntensity.addEventListener("input", (e) => {
      settings.glowIntensity = +e.target.value;
      updateGlow();
      updateSliderFill(e.target);
      save();
    });
  }
  el.nightMode.addEventListener("change", (e) => {
    settings.nightMode = e.target.checked;
    save();
  });
  el.lightRevert.addEventListener("click", () => {
    settings.brightness = 90;
    updateBrightness();
    applyTheme();
    save();
    flash(translations.toastReverted || "Reverted");
  });
  el.lightApply.addEventListener("click", () => {
    save();
    flash(translations.toastLightingApplied || "Lighting applied");
  });

  el.hourlyChime.addEventListener("change", (e) => {
    settings.hourlyChime = e.target.checked;
    save();
  });
  el.alarmTime.addEventListener("change", (e) => {
    settings.alarmTime = e.target.value;
    save();
  });
  el.alarmDays.addEventListener("change", (e) => {
    settings.alarmDays = e.target.value;
    save();
  });
  el.volume.addEventListener("input", (e) => {
    settings.volume = +e.target.value;
    updateSliderFill(e.target);
    save();
  });
  el.soundTest.addEventListener("click", beep);
  el.alarmSave.addEventListener("click", () => {
    save();
    flash(translations.toastAlarmSaved || "Alarm saved");
  });

  el.slotMachine.addEventListener("change", (e) => {
    settings.slotMachine = e.target.checked;
    save();
  });
  el.slotInterval.addEventListener("input", (e) => {
    settings.slotInterval = +e.target.value;
    save();
  });
  el.units.addEventListener("change", (e) => {
    settings.units = e.target.value;
    save();
  });
  el.showTemp.addEventListener("change", (e) => {
    settings.showTemp = e.target.checked;
    save();
  });
  el.modesDefaults.addEventListener("click", () => {
    settings.slotMachine = true;
    settings.slotInterval = 30;
    settings.units = "c";
    settings.showTemp = false;
    applySettingsToUI();
    save();
    flash(translations.toastDefaults || "Defaults");
  });
  el.modesApply.addEventListener("click", () => {
    save();
    flash(translations.toastModesApplied || "Modes applied");
  });

  el.deviceName.addEventListener("input", (e) => {
    settings.deviceName = e.target.value;
    save();
  });
  el.autoUpdates.addEventListener("change", (e) => {
    settings.autoUpdates = e.target.checked;
    save();
  });
  el.checkFw.addEventListener("click", () => {
    flash(translations.toastNoUpdates || "No updates");
  });
  el.factoryReset.addEventListener("click", () => {
    localStorage.removeItem("millclock_settings");
    settings = Object.assign({}, defaults);
    applySettingsToUI();
    applyTheme();
    updateBrightness();
    save();
    flash(translations.toastErased || "Erased");
  });

  el.cancelAll.addEventListener("click", () => {
    settings = load();
    applySettingsToUI();
    applyTheme();
    updateBrightness();
    flash(translations.toastCanceled || "Canceled");
  });
  el.saveBtn.addEventListener("click", () => {
    save();
    flash(translations.toastSaved || "Saved");
  });

  el.lang.addEventListener("change", (e) => {
    settings.lang = e.target.value;
    loadTranslations(settings.lang);
    save();
  });

  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      if (settings.theme === "system") {
        applyTheme();
      }
    });
}

function onManual() {
  const t = el.timeInput.value;
  const d = el.dateInput.value;
  if (!t && !d) {
    settings.manual = null;
    save();
    return;
  }
  const base = new Date();
  const parts = {
    y: d ? Number(d.slice(0, 4)) : base.getFullYear(),
    m: d ? Number(d.slice(5, 7)) - 1 : base.getMonth(),
    day: d ? Number(d.slice(8, 10)) : base.getDate(),
    hh: t ? Number(t.slice(0, 2)) : base.getHours(),
    mm: t ? Number(t.slice(3, 5)) : base.getMinutes(),
    ss: 0,
  };
  const temp = new Date(
    Date.UTC(parts.y, parts.m, parts.day, parts.hh, parts.mm, parts.ss)
  );
  const tzMin = parseTz(settings.timezone);
  const utcMillis = temp.getTime() - tzMin * 60000;
  settings.manual = {
    startReal: Date.now(),
    startClock: new Date(utcMillis).getTime(),
  };
  save();
}

function applySettingsToUI() {
  el.lang.value = settings.lang;
  el.is24hSelect.value = settings.is24h ? "true" : "false";
  document.body.setAttribute("data-12h", settings.is24h ? "false" : "true");
  el.dateFormat.value = settings.dateFormat;
  el.tzText.value = settings.timezone || "UTC+00:00";
  el.dstMode.value = settings.dstMode;
  el.leadingZero.checked = settings.leadingZero;
  el.autoDateDisplay.checked = settings.autoDate;
  el.showSeconds.checked = settings.showSeconds;
  el.separatorBehavior.value = settings.separator;
  if (el.nixie) {
    el.nixie.dataset.separator = settings.separator;
    el.nixie.dataset.showSeconds = settings.showSeconds;
  }
  el.timeInput.value = "";
  el.dateInput.value = "";
  el.ssid.value = settings.wifi.ssid || "";
  el.wpass.value = settings.wifi.pass || "";
  el.ntpEnable.checked = !!settings.ntpEnable;
  el.ntpServer.value = settings.ntpServer || "";
  if (el.glowIntensity) el.glowIntensity.value = settings.glowIntensity;
  if (el.glowIntensity) updateSliderFill(el.glowIntensity);
  el.nightMode.checked = !!settings.nightMode;
  el.brightness.value = settings.brightness;
  updateSliderFill(el.brightness);
  el.hourlyChime.checked = !!settings.hourlyChime;
  el.alarmTime.value = settings.alarmTime;
  el.alarmDays.value = settings.alarmDays;
  el.volume.value = settings.volume;
  updateSliderFill(el.volume);
  el.slotMachine.checked = !!settings.slotMachine;
  el.slotInterval.value = settings.slotInterval;
  el.units.value = settings.units;
  el.showTemp.checked = !!settings.showTemp;
  el.deviceName.value = settings.deviceName;
  el.autoUpdates.checked = !!settings.autoUpdates;
  el.firmware.value = settings.firmware;
  // Leading Zero is always visible and user-controlled
}

function applyTheme() {
  const doc = document.documentElement;
  let theme = settings.theme;

  if (theme === "system") {
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    theme = prefersDark ? "dark" : "light";
  }

  doc.setAttribute("data-theme", theme);

  const hex = rgbToHex(settings.led.r, settings.led.g, settings.led.b);
  doc.style.setProperty("--led-color", hex);
  if (el.theme) {
    const map = {
      system: translations.themeSystem || "System",
      light: translations.themeLight || "Light",
      dark: translations.themeDark || "Dark",
    };
    el.theme.setAttribute("data-theme-label", map[settings.theme]);
  }
}

function getDstOffsetMinutes(date, tzMinutes) {
  // Returns DST offset (0 or 60) for supported modes.
  if (settings.dstMode === "off") return 0;
  const year = date.getUTCFullYear();
  if (settings.dstMode === "eu") {
    // EU: last Sunday March 01:00 UTC to last Sunday Oct 01:00 UTC
    const lastSunday = (month) => {
      const d = new Date(Date.UTC(year, month + 1, 0)); // last day of month
      const day = d.getUTCDay();
      d.setUTCDate(d.getUTCDate() - day); // back to Sunday
      return d;
    };
    const start = lastSunday(2); // March
    start.setUTCHours(1, 0, 0, 0);
    const end = lastSunday(9); // October
    end.setUTCHours(1, 0, 0, 0);
    if (date >= start && date < end) return 60;
    return 0;
  }
  if (settings.dstMode === "us") {
    // US: second Sunday March 02:00 local to first Sunday Nov 02:00 local
    const nthSunday = (month, n) => {
      const d = new Date(Date.UTC(year, month, 1));
      const add = (7 - d.getUTCDay()) % 7; // first Sunday offset
      d.setUTCDate(1 + add + 7 * (n - 1));
      return d;
    };
    const firstSunday = (month) => nthSunday(month, 1);
    const secondSunday = (month) => nthSunday(month, 2);
    const start = secondSunday(2); // March
    // Convert 02:00 local to UTC: local = UTC + tzMinutes (+ possible DST not yet applied)
    start.setUTCMinutes(start.getUTCMinutes() - tzMinutes + 120);
    const end = firstSunday(10); // November
    end.setUTCMinutes(end.getUTCMinutes() - (tzMinutes + 60) + 120); // during DST subtract extra 60
    if (date >= start && date < end) return 60;
    return 0;
  }
  return 0;
}

function computeClockDate() {
  const tzMin = parseTz(settings.timezone || "UTC+00:00");
  let baseUtc;
  if (settings.manual) {
    const elapsed = Date.now() - settings.manual.startReal;
    baseUtc = settings.manual.startClock + elapsed;
  } else {
    baseUtc = Date.now();
  }
  const tempDate = new Date(baseUtc + tzMin * 60000);
  const dstAdd = getDstOffsetMinutes(tempDate, tzMin);
  return new Date(baseUtc + (tzMin + dstAdd) * 60000);
}

function renderTime(now) {
  let hoursUtc = now.getUTCHours();
  let minutes = now.getUTCMinutes();
  let seconds = now.getUTCSeconds();
  // We used UTC math already applied; treat as local display values
  let displayHour = hoursUtc;
  let isPM = false;
  if (!settings.is24h) {
    isPM = displayHour >= 12;
    displayHour = displayHour % 12;
    if (displayHour === 0) displayHour = 12;
  }
  const hStr = String(displayHour).padStart(2, "0");
  const mStr = String(minutes).padStart(2, "0");
  const sStr = String(seconds).padStart(2, "0");
  const twelveMode = !settings.is24h;
  document.body.setAttribute("data-12h", twelveMode ? "true" : "false");
  const hideLeading = twelveMode && !settings.leadingZero && displayHour < 10;
  if (hideLeading) {
    // Show only second digit of hour
    setDigit("h1", "");
    setDigit("h2", hStr.slice(-1));
  } else {
    setDigit("h1", hStr[0]);
    setDigit("h2", hStr[1]);
  }
  setDigit("m1", mStr[0]);
  setDigit("m2", mStr[1]);
  if (settings.showSeconds) {
    setDigit("s1", sStr[0]);
    setDigit("s2", sStr[1]);
  } else {
    setDigit("s1", "");
    setDigit("s2", "");
  }
}

function tick() {
  const now = computeClockDate();
  renderTime(now);
  renderDate(now);
  // Update separator state attributes continuously (in case of change)
  if (el.nixie) {
    el.nixie.dataset.separator = settings.separator;
    el.nixie.dataset.showSeconds = settings.showSeconds;
  }
  // Sound features
  checkHourlyChime(now);
  checkAlarm(now);
}
// Removed legacy animation code.

function updateGlow() {
  const raw = Math.max(0, Math.min(100, settings.glowIntensity || 0)) / 100;
  // Apply easing (quadratic) for stronger change near high end
  const eased = Math.pow(raw, 1.4); // tweak exponent for perceptual spacing
  document.documentElement.style.setProperty(
    "--glow-intensity",
    eased.toString()
  );
}

function updateBrightness() {
  // brightness stored 10..100 -> scale to 0.1..1.0
  const b = Math.max(10, Math.min(100, settings.brightness || 90));
  const val = (b / 100).toFixed(2);
  document.documentElement.style.setProperty("--tube-brightness", val);
  if (el.brightness) updateSliderFill(el.brightness);
}

// Visually fill range slider track using background-size (expects CSS with background-image linear-gradient(var(--accent), var(--accent)))
function updateSliderFill(slider) {
  if (!slider) return;
  const min = slider.min ? parseFloat(slider.min) : 0;
  const max = slider.max ? parseFloat(slider.max) : 100;
  const val = parseFloat(slider.value);
  if (isNaN(val) || isNaN(min) || isNaN(max) || max <= min) return;
  const pct = ((val - min) / (max - min)) * 100;
  slider.style.backgroundSize = pct + "% 100%";
}

function parseTz(t) {
  const m = t.match(/UTC([+-])(\d{2}):(\d{2})/);
  if (!m) return 0;
  const s = m[1] === "-" ? -1 : 1;
  return s * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
}

function hexToRgb(h) {
  const s = h.replace("#", "");
  return {
    r: parseInt(s.slice(0, 2), 16),
    g: parseInt(s.slice(2, 4), 16),
    b: parseInt(s.slice(4, 6), 16),
  };
}
function rgbToHex(r, g, b) {
  const h = (x) => x.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function save() {
  localStorage.setItem("millclock_settings", JSON.stringify(settings));
}
function load() {
  try {
    const raw = localStorage.getItem("millclock_settings");
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function flash(t) {
  el.toast.textContent = t;
  el.toast.style.opacity = "1";
  setTimeout(() => {
    el.toast.style.opacity = "0";
  }, 1200);
}

function getAudioContext() {
  try {
    if (!runtime.audioContext) {
      runtime.audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
    }
    return runtime.audioContext;
  } catch {
    return null;
  }
}

function beep() {
  try {
    const ac = getAudioContext();
    if (!ac) throw new Error("NoAudioContext");
    if (ac.state === "suspended" && ac.resume) {
      // Attempt to resume in case browser requires a gesture; may still fail silently
      ac.resume().catch(() => {});
    }
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "square";
    osc.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(
      settings.volume / 100,
      ac.currentTime + 0.01
    );
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.18);
    osc.connect(g).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + 0.2);
  } catch (e) {
    flash(translations.toastBeep || "Beep");
  }
}

// Helper: multiple short beeps for alarms
function beepBurst(times = 3, interval = 350) {
  let count = 0;
  const id = setInterval(() => {
    beep();
    count++;
    if (count >= times) clearInterval(id);
  }, Math.max(150, interval));
  // Fire first immediately
  beep();
  count++;
}

function timePartsFromClock(now) {
  // computeClockDate returns a Date whose UTC getters correspond to displayed local time
  return {
    y: now.getUTCFullYear(),
    m: now.getUTCMonth() + 1, // 1-12
    d: now.getUTCDate(),
    dow: now.getUTCDay(), // 0-6, Sun=0
    hh: now.getUTCHours(),
    mm: now.getUTCMinutes(),
    ss: now.getUTCSeconds(),
  };
}

function checkHourlyChime(now) {
  if (!settings.hourlyChime) return;
  const t = timePartsFromClock(now);
  // Allow a small tolerance window to avoid interval drift
  if (!(t.mm === 0 && t.ss <= 3)) return;
  const key = `${t.y}-${t.m}-${t.d}-${t.hh}`;
  if (runtime.lastChimeKey === key) return; // already chimed this hour
  runtime.lastChimeKey = key;
  beep();
}

function checkAlarm(now) {
  const mode = settings.alarmDays || "off";
  if (mode === "off") return;
  if (!settings.alarmTime || !/^\d{2}:\d{2}$/.test(settings.alarmTime)) return;
  const t = timePartsFromClock(now);
  // Day filter
  const isWeekend = t.dow === 0 || t.dow === 6;
  const passDay =
    mode === "daily" ||
    (mode === "monfri" && !isWeekend) ||
    (mode === "weekends" && isWeekend);
  if (!passDay) return;
  const targetH = parseInt(settings.alarmTime.slice(0, 2), 10);
  const targetM = parseInt(settings.alarmTime.slice(3, 5), 10);
  // Allow a small tolerance window to avoid interval drift
  if (!(t.hh === targetH && t.mm === targetM && t.ss <= 3)) return;
  const key = `${t.y}-${t.m}-${t.d}-${String(targetH).padStart(
    2,
    "0"
  )}:${String(targetM).padStart(2, "0")}`;
  if (runtime.lastAlarmKey === key) return; // already fired for this minute
  runtime.lastAlarmKey = key;
  beepBurst(3, 350);
}

init();
