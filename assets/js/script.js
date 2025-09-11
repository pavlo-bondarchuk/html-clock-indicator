const $ = (q) => document.querySelector(q);
let settings = load();
const runtime = {
  lastChimeKey: null,
  lastAlarmKey: null,
  audioContext: null,
};
let translations = {};

// Map app language codes to BCP-47 tags preferred by native inputs
function toLocaleTag(lang) {
  if (!lang) return "en";
  const map = { en: "en-US", de: "de-DE" };
  return map[lang] || lang;
}

function setDocumentLanguage(lang) {
  const tag = toLocaleTag(lang);
  try {
    document.documentElement.setAttribute("lang", tag);
  } catch {}
  try {
    // Apply language to native locale-aware inputs
    const inputs = document.querySelectorAll(
      'input[type="date"], input[type="time"]'
    );
    inputs.forEach((inp) => inp.setAttribute("lang", tag));
  } catch {}
}

function _getSeparators() {
  const container =
    el && el.nixie ? el.nixie : document.getElementById("nixie-clock");
  if (!container) return [];
  return Array.from(
    container.querySelectorAll(".nixie-wrap-separator .separator")
  );
}

function startSeparatorBlinking(interval = 1000) {
  stopSeparatorBlinking();
  runtime._sepState = runtime._sepState || { on: true };
  // ensure initial state
  _getSeparators().forEach((s) => {
    s.classList.remove("off");
    if (runtime._sepState.on) s.classList.add("on");
    else s.classList.remove("on");
  });
  // reflect image sources for separators immediately
  updateSeparatorImages();
  runtime.sepTicker = setInterval(() => {
    runtime._sepState.on = !runtime._sepState.on;
    _getSeparators().forEach((s) => {
      if (runtime._sepState.on) {
        s.classList.add("on");
        s.classList.remove("off");
      } else {
        s.classList.remove("on");
        s.classList.add("off");
      }
    });
    // update separator images whenever state toggles
    updateSeparatorImages();
  }, interval);
}

function stopSeparatorBlinking() {
  if (runtime.sepTicker) {
    clearInterval(runtime.sepTicker);
    runtime.sepTicker = null;
  }
}

function applySeparatorMode() {
  const mode = settings.separator || "blinking";
  const seps = _getSeparators();
  // If seconds are hidden, we will force the second separator (index 1)
  // to the empty image so it stays visually absent.
  const showSeconds = !!settings.showSeconds;
  if (mode === "off") {
    stopSeparatorBlinking();
    seps.forEach((s, i) => {
      s.classList.remove("on");
      s.classList.add("off");
    });
    // ensure image sources reflect the off state
    updateSeparatorImages();
    if (!showSeconds && seps[1])
      updateImgFor(seps[1], "assets/img/clock/separator-empty.jpg");
    return;
  }
  if (mode === "static") {
    stopSeparatorBlinking();
    seps.forEach((s) => {
      s.classList.add("on");
      s.classList.remove("off");
    });
    updateSeparatorImages();
    if (!showSeconds && seps[1])
      updateImgFor(seps[1], "assets/img/clock/separator-empty.jpg");
    return;
  }
  // blinking
  startSeparatorBlinking(1000);
  // update images immediately to reflect current state and showSeconds
  updateSeparatorImages();
  if (!showSeconds && seps[1])
    updateImgFor(seps[1], "assets/img/clock/separator-empty.jpg");
}

// --- Wheel picker implementation (iOS-like scroller for time inputs) ---
const wheel = {
  el: document.getElementById("wheelPicker"),
  body: null,
  cols: {},
  targetInput: null,
  mode24: true,
};

function initWheelPicker() {
  if (!wheel.el) return;
  wheel.body = wheel.el.querySelector(".wheel-body");
  wheel.cols.hours = wheel.el.querySelector(
    '.wheel-column[data-type="hours"] ul'
  );
  wheel.cols.minutes = wheel.el.querySelector(
    '.wheel-column[data-type="minutes"] ul'
  );
  wheel.cols.ampm = wheel.el.querySelector(
    '.wheel-column[data-type="ampm"] ul'
  );

  // populate minutes and hours
  populateWheel();

  // wire buttons
  document
    .getElementById("wheelCancel")
    .addEventListener("click", closeWheelPicker);
  document
    .getElementById("wheelConfirm")
    .addEventListener("click", confirmWheelPicker);
  wheel.el
    .querySelector(".wheel-backdrop")
    .addEventListener("click", closeWheelPicker);

  // debounce snapping on scroll end
  ["hours", "minutes", "ampm"].forEach((col) => {
    const ul = wheel.cols[col];
    if (!ul) return;
    let tid = null;
    ul.addEventListener(
      "scroll",
      () => {
        if (tid) clearTimeout(tid);
        tid = setTimeout(() => snapColumn(ul), 120);
      },
      { passive: true }
    );
  });
}

function populateWheel() {
  // hours
  const hUl = wheel.cols.hours;
  const mUl = wheel.cols.minutes;
  if (!hUl || !mUl) return;
  hUl.innerHTML = "";
  mUl.innerHTML = "";
  // default to 24-hour hours but allow AM/PM column when needed
  for (let h = 0; h < 24; h++) {
    const li = document.createElement("li");
    li.dataset.value = String(h).padStart(2, "0");
    li.textContent = settings.is24h ? String(h).padStart(2, "0") : h % 12 || 12;
    hUl.appendChild(li);
  }
  for (let m = 0; m < 60; m++) {
    const li = document.createElement("li");
    li.dataset.value = String(m).padStart(2, "0");
    li.textContent = String(m).padStart(2, "0");
    mUl.appendChild(li);
  }
}

function openWheelPickerFor(inputEl, title) {
  if (!wheel.el) return;
  wheel.targetInput = inputEl;
  wheel.el.querySelector(".wheel-title").textContent =
    title || inputEl.getAttribute("aria-label") || "Set time";
  // show or hide AM/PM column depending on settings
  const ampmCol = wheel.el.querySelector(".wheel-ampm");
  if (settings.is24h) {
    ampmCol.style.display = "none";
  } else {
    ampmCol.style.display = "block";
  }

  // parse input value (HH:MM)
  let hh = 0,
    mm = 0;
  if (inputEl && inputEl.value) {
    const v = inputEl.value.split(":");
    hh = parseInt(v[0] || "0", 10);
    mm = parseInt(v[1] || "0", 10);
  } else {
    const now = new Date();
    hh = now.getHours();
    mm = now.getMinutes();
  }

  // scroll to values
  scrollToValue(wheel.cols.hours, String(hh).padStart(2, "0"));
  scrollToValue(wheel.cols.minutes, String(mm).padStart(2, "0"));
  // AM/PM selection
  if (wheel.cols.ampm) {
    const ampm = hh >= 12 ? "PM" : "AM";
    const node = Array.from(wheel.cols.ampm.children).find(
      (n) => n.dataset.value === ampm
    );
    if (node)
      node.parentElement.scrollTop =
        node.offsetTop -
        node.parentElement.clientHeight / 2 +
        node.clientHeight / 2;
  }

  wheel.el.classList.add("show");
  wheel.el.setAttribute("aria-hidden", "false");
}

function closeWheelPicker() {
  if (!wheel.el) return;
  wheel.el.classList.remove("show");
  wheel.el.setAttribute("aria-hidden", "true");
  wheel.targetInput = null;
}

function confirmWheelPicker() {
  if (!wheel.targetInput) {
    closeWheelPicker();
    return;
  }
  const h = getSelectedValue(wheel.cols.hours) || "00";
  const m = getSelectedValue(wheel.cols.minutes) || "00";
  let hh = parseInt(h, 10);
  if (!settings.is24h) {
    const ampm = getSelectedValue(wheel.cols.ampm) || "AM";
    if (ampm === "PM" && hh < 12) hh += 12;
    if (ampm === "AM" && hh === 12) hh = 0;
  }
  const val = `${String(hh).padStart(2, "0")}:${String(
    parseInt(m, 10)
  ).padStart(2, "0")}`;
  wheel.targetInput.value = val;
  // trigger change handlers the same way regular input does
  wheel.targetInput.dispatchEvent(new Event("change", { bubbles: true }));
  closeWheelPicker();
}

function getSelectedValue(ul) {
  if (!ul) return null;
  // find li whose center is nearest the viewport center
  const children = Array.from(ul.children);
  const center = ul.scrollTop + ul.clientHeight / 2;
  let best = null,
    bestDiff = Infinity;
  children.forEach((li) => {
    const liCenter = li.offsetTop + li.clientHeight / 2;
    const diff = Math.abs(liCenter - center);
    if (diff < bestDiff) {
      best = li;
      bestDiff = diff;
    }
  });
  return best ? best.dataset.value : null;
}

function snapColumn(ul) {
  if (!ul) return;
  const children = Array.from(ul.children);
  const center = ul.scrollTop + ul.clientHeight / 2;
  let best = null,
    bestDiff = Infinity;
  children.forEach((li) => {
    const liCenter = li.offsetTop + li.clientHeight / 2;
    const diff = Math.abs(liCenter - center);
    if (diff < bestDiff) {
      best = li;
      bestDiff = diff;
    }
  });
  if (best) {
    ul.scrollTo({
      top: best.offsetTop - ul.clientHeight / 2 + best.clientHeight / 2,
      behavior: "smooth",
    });
    // mark selection
    children.forEach((c) => c.classList.remove("selected"));
    best.classList.add("selected");
  }
}

function scrollToValue(ul, value) {
  if (!ul) return;
  const node = Array.from(ul.children).find((n) => n.dataset.value === value);
  if (node)
    ul.scrollTop = node.offsetTop - ul.clientHeight / 2 + node.clientHeight / 2;
}

// attach wheel to time-like inputs
function wireWheelInputs() {
  const timeInputs = ["timeInput", "nightStart", "nightEnd", "alarmTime"];
  // Detect whether the current device/input modality is touch/mobile-like.
  function isMobileLike() {
    try {
      if (typeof window === "undefined") return false;
      // Prefer coarse pointer query when available
      if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches)
        return true;
      // Touch capability fallbacks
      if (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) return true;
      if ("ontouchstart" in window) return true;
      // Fallback to UA sniff for small/mobile devices
      return /Mobi|Android|iP(hone|ad|od)/.test(navigator.userAgent || "");
    } catch (e) {
      return false;
    }
  }

  const mobile = isMobileLike();
  timeInputs.forEach((id) => {
    const inp = document.getElementById(id);
    if (!inp) return;
    if (mobile) {
      // On mobile/touch devices, intercept focus/click and show the custom wheel
      inp.addEventListener("focus", (e) => {
        // prevent native picker on mobile by blurring
        e.target.blur();
        openWheelPickerFor(
          e.target,
          (e.target.previousElementSibling || {}).textContent || "Set time"
        );
      });
      inp.addEventListener("click", (e) => {
        e.preventDefault();
        openWheelPickerFor(
          e.target,
          (e.target.previousElementSibling || {}).textContent || "Set time"
        );
      });
    } else {
      // Desktop: do not intercept. Let the browser show its native time picker.
      // No handlers attached so focus/click behave normally.
    }
  });
}

// initialize wheel after DOM ready
document.addEventListener("DOMContentLoaded", () => {
  initWheelPicker();
  wireWheelInputs();
});

// Basic in-file translation dictionary fallback (can be replaced by external JSON fetch if added later)
const TRANSLATIONS = {
  en: {
    clockSettings: "Clock Settings",
    timeDate: "Time & Date",
    timeDateSub: "Set format, timezone and automatic adjustments.",
    timeSection: "Time",
    dateSection: "Date",
    timeFormat: "24-hour time formaat",
    leadingZero: "Leading Zero",
    dateFormat: "Type of date",
    autoDateDisplay: "Auto date display",
    showSeconds: "Show seconds",
    timeZone: "Time zone",
    dst: "Summer Time",
    separatorBehavior: "Separator Behavior",
    setTime: "Set Time",
    setDate: "Set Date",
    reset: "Reset",
    apply: "Apply",
    displayLighting: "Display & Lighting",
    displayLightingSub: "Adjust brightness, colors, animations and effects.",
    brightness: "Brightness",
    glowIntensity: "Glow Intensity",
    tubeBrightness: "Tube Brightness",
    tubeGlow: "LED Mode",
    tubeGlowColor: "Tube Glow Color",
    underlightColor: "Under-light color",
    animation: "Animation",
    steady: "Steady",
    gradient: "Gradient",
    slotMachine: "Slot Machine",
    pulse: "Pulse",
    off: "Off",
    autoDim: "Auto-dim at night",
    autoDimHint: "Night Mode reduces brightness on schedule",
    nightStart: "Night start",
    nightEnd: "Night end",
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
    timeFormat: "24-Stunden Format",
    leadingZero: "Führende Null",
    dateFormat: "Datentyp",
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
    tubeBrightness: "Röhrenhelligkeit",
    tubeGlow: "LED-Modus",
    tubeGlowColor: "Röhren-Glow-Farbe",
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
  transition: "smooth",
  transitionSpeed: 300,
  nightMode: false,
  nightStart: "23:00",
  nightEnd: "07:00",
  wifi: { ssid: "", pass: "" },
  ntpEnable: true,
  ntpServer: "pool.ntp.org",
  anim: "steady",
  hourlyChime: false,
  hourlyMelody: "chime1",
  alarmTime: "07:30",
  alarmMelody: "beep",
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
  nixie: $("#nixie-clock"),
  h1: $("#h1"),
  h2: $("#h2"),
  m1: $("#m1"),
  m2: $("#m2"),
  s1: $("#s1"),
  s2: $("#s2"),
  ledColor: $("#ledColor"),
  hourlyMelody: $("#hourlyMelody"),
  alarmMelody: $("#alarmMelody"),
  nightStart: $("#nightStart"),
  nightEnd: $("#nightEnd"),
  nixieDate: $("#nixie-date"),
  is24h: $("#is24h"),
  dateFormat: $("#dateFormat"),
  tzSelect: $("#tzSelect"),
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
  transitionSelect: $("#transitionSelect"),
  transitionSpeed: $("#transitionSpeed"),
  nightMode: $("#nightMode"),
  tempValue: $("#tempValue"),
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

// Rebind DOM elements at runtime (useful when script runs before DOM fully parsed)
function bindElements() {
  // Support both legacy and current id; prefer the actual clock container id
  el.nixie = $("#nixie-clock") || $("#nixie");
  el.h1 = $("#h1");
  el.h2 = $("#h2");
  el.m1 = $("#m1");
  el.m2 = $("#m2");
  el.s1 = $("#s1");
  el.s2 = $("#s2");
  // date digit elements intentionally not bound - date is static background
  el.ledColor = $("#ledColor");
  el.hourlyMelody = $("#hourlyMelody");
  el.alarmMelody = $("#alarmMelody");
  el.nightStart = $("#nightStart");
  el.nightEnd = $("#nightEnd");
  el.nixieDate = $("#nixie-date");
  el.is24h = $("#is24h");
  el.dateFormat = $("#dateFormat");
  el.tzSelect = $("#tzSelect");
  el.dstMode = $("#dstMode");
  el.separatorBehavior = $("#separatorBehavior");
  el.leadingZero = $("#leadingZero");
  el.autoDateDisplay = $("#autoDateDisplay");
  el.showSeconds = $("#showSeconds");
  el.timeInput = $("#timeInput");
  el.dateInput = $("#dateInput");
  el.ssid = $("#ssid");
  el.wpass = $("#wpass");
  el.passToggle = $("#passToggle");
  el.ntpEnable = $("#ntpEnable");
  el.ntpServer = $("#ntpServer");
  el.glowIntensity = $("#glowIntensity");
  el.transitionSelect = $("#transitionSelect");
  el.transitionSpeed = $("#transitionSpeed");
  el.nightMode = $("#nightMode");
  el.tempValue = $("#tempValue");
  el.brightness = $("#brightness");
  el.hourlyChime = $("#hourlyChime");
  el.alarmTime = $("#alarmTime");
  el.alarmDays = $("#alarmDays");
}

async function init() {
  bindElements();
  await loadTranslations(settings.lang || "en");
  setDocumentLanguage(settings.lang || "en");
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
  applySeparatorMode();
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
    // Hide visual marker and blank date tubes so UI reflects the toggle immediately
    if (el.nixieDate) el.nixieDate.classList.remove("visible");
    setDateTubesOff();
    return;
  }
  el.nixieDate.classList.add("visible");
  const day = String(d.getDate()).padStart(2, "0");
  const mon = String(d.getMonth() + 1).padStart(2, "0");
  const yr = String(d.getFullYear());
  // Determine which pair shows day and which shows month depending on format
  let firstPair = { kind: "hour", digits: "" };
  let secondPair = { kind: "minut", digits: "" };
  if (settings.dateFormat === "DD-MM-YYYY") {
    firstPair.digits = day;
    secondPair.digits = mon;
  } else {
    firstPair.digits = mon;
    secondPair.digits = day;
  }

  // day/month pairs: markup uses .nixie-wrap-day and .nixie-wrap-month with two imgs each
  try {
    const dayImgs = document.querySelectorAll(
      ".nixie-wrap-day .nixie-tube img"
    );
    if (dayImgs && dayImgs.length >= 2) {
      updateImgFor(
        dayImgs[0],
        imageSrcFor(firstPair.kind, firstPair.digits[0], 1)
      );
      updateImgFor(
        dayImgs[1],
        imageSrcFor(firstPair.kind, firstPair.digits[1], 2)
      );
    }
  } catch (e) {}

  try {
    const monImgs = document.querySelectorAll(
      ".nixie-wrap-month .nixie-tube img"
    );
    if (monImgs && monImgs.length >= 2) {
      updateImgFor(
        monImgs[0],
        imageSrcFor(secondPair.kind, secondPair.digits[0], 1)
      );
      updateImgFor(
        monImgs[1],
        imageSrcFor(secondPair.kind, secondPair.digits[1], 2)
      );
    }
  } catch (e) {}

  // year: markup uses .nixie-wrap-year and two imgs; we'll show last two digits of year
  try {
    const yearImgs = document.querySelectorAll(
      ".nixie-wrap-year .nixie-tube img"
    );
    const yDigits = String(yr).slice(-2).padStart(2, "0");
    if (yearImgs && yearImgs.length >= 2) {
      updateImgFor(yearImgs[0], imageSrcFor("second", yDigits[0], 1));
      updateImgFor(yearImgs[1], imageSrcFor("second", yDigits[1], 2));
    }
  } catch (e) {}
}

// Helper: setDigit now targets image elements and shows/hides them
// New setDigit: supports two modes:
// - legacy elements identified by id or .nixie-tube.<id> where content text is used
// - class-driven tubes for clock digits (hour-first/hour-second/minute-first/...) where
//   the digit is represented by a class like `hour-first-3` and switching is done
//   by toggling that class. This lets CSS change the tube background image per digit.
function setDigit(id, val) {
  // helper to find element: prefer el[] mapping, then element by id, then by class
  let n =
    el[id] ||
    document.getElementById(id) ||
    document.querySelector(`.nixie-tube.${id}`);
  // mapping from legacy id to class-prefix positions used in markup
  const posMap = {
    h1: "hour-first",
    h2: "hour-second",
    m1: "minute-first",
    m2: "minute-second",
    s1: "second-first",
    s2: "second-second",
    // date positions
    "day-first": "day-first",
    "day-second": "day-second",
    mo1: "mo1",
    mo2: "mo2",
    y1: "y1",
    y2: "y2",
    y3: "y3",
    y4: "y4",
  };

  // If we couldn't find an element by id/class, try locating by position prefix
  const posPrefix = posMap[id];
  if (!n && posPrefix) {
    n = document.querySelector(`.nixie-tube[class*="${posPrefix}-"]`);
  }

  if (!n) return;

  // If this element uses the position class scheme, toggle classes instead of text
  if (posPrefix || /(?:hour|minute|second|h|m|s)/.test(id)) {
    const prefix = posPrefix || id;
    // normalize value -> digit or blank
    const isBlank = val === "" || val == null;
    // remove any existing prefix-<digit> or prefix-blank classes
    const clsToRemove = Array.from(n.classList).filter((c) =>
      c.startsWith(prefix + "-")
    );
    clsToRemove.forEach((c) => n.classList.remove(c));
    if (isBlank) {
      n.classList.add(`${prefix}-blank`);
      return;
    }
    const ch = String(val).slice(-1);
    // add new class
    n.classList.add(`${prefix}-${ch}`);
    // Also remove blank marker if present
    n.classList.remove(`${prefix}-blank`);
    return;
  }

  // Fallback: legacy text-based behavior (keeps transition logic for date/other digits)
  const wrap = n.closest ? n.closest(".nixie-wrap") : n.parentElement;
  if (n._swapTimer) {
    clearTimeout(n._swapTimer);
    n._swapTimer = null;
  }
  if (val === "" || val == null) {
    if (
      (wrap && wrap.classList.contains("blank")) ||
      n.classList.contains("hidden")
    ) {
      return;
    }
    n.classList.add("hidden");
    n._swapTimer = setTimeout(() => {
      if (wrap) wrap.classList.add("blank");
      n.classList.remove("fade-out", "slide-out");
      n._swapTimer = null;
    }, 220);
    return;
  }
  const ch = String(val).slice(-1);
  if (n.textContent === ch) {
    n.classList.remove("hidden", "fade-out", "slide-out");
    if (wrap) wrap.classList.remove("blank");
    return;
  }
  const transitionMode =
    document.documentElement.getAttribute("data-transition") ||
    settings.transition ||
    "smooth";
  const delay = Math.max(60, settings.transitionSpeed / 5);
  if (transitionMode === "fade") n.classList.add("fade-out");
  else if (transitionMode === "slide") n.classList.add("slide-out");
  else n.classList.add("hidden");
  n._swapTimer = setTimeout(() => {
    n.textContent = ch;
    void n.offsetWidth;
    n.classList.remove("hidden", "fade-out", "slide-out");
    if (wrap) wrap.classList.remove("blank");
    n._swapTimer = null;
  }, delay);
}

// --- Image-based clock helpers ---
// Build src for a given kind (hour/minut/second) digit and position (1 or 2)
function imageSrcFor(kind, digit, pos) {
  const base = `assets/img/clock/${kind}`;
  if (digit === "" || digit == null) {
    // use empty frames if available
    return `${base}-empty-${pos}.jpg`;
  }
  const d = String(digit).slice(-1);
  return `${base}-${d}-${pos}.jpg`;
}

function updateImgFor(selectorOrEl, src) {
  let elimg = null;
  if (typeof selectorOrEl === "string")
    elimg = document.querySelector(selectorOrEl);
  else elimg = selectorOrEl;
  if (!elimg) return;
  if (elimg.tagName && elimg.tagName.toLowerCase() === "img") {
    // avoid reassigning same
    if (elimg.src && elimg.src.endsWith(src)) return;
    // don't animate separators
    const isSeparator =
      elimg.classList && elimg.classList.contains("separator");
    // avoid animating before initial ready state
    const nixReady =
      el.nixie && el.nixie.dataset && el.nixie.dataset.ready === "true";
    const mode = (
      document.documentElement.getAttribute("data-transition") ||
      settings.transition ||
      "smooth"
    ).toLowerCase();
    const dur = Math.max(50, Number(settings.transitionSpeed) || 300);
    const half = Math.max(30, Math.round(dur / 2));
    // throttle overlapping animations
    if (elimg._animTimer) {
      clearTimeout(elimg._animTimer);
      elimg._animTimer = null;
      elimg._animating = false;
    }
    if (!nixReady || isSeparator || mode === "none" || mode === "smooth") {
      elimg.src = src;
      return;
    }
    // remember pending target to avoid duplicate work
    if (elimg._pendingSrc === src) return;
    elimg._pendingSrc = src;
    elimg._animating = true;
    if (mode === "fade") {
      try {
        elimg.style.setProperty("--digit-alpha", "1");
        void elimg.offsetWidth;
        elimg.style.setProperty("--digit-alpha", "0");
      } catch {}
      elimg._animTimer = setTimeout(() => {
        elimg.src = src;
        void elimg.offsetWidth;
        try {
          elimg.style.setProperty("--digit-alpha", "1");
        } catch {}
        elimg._animating = false;
        elimg._pendingSrc = null;
      }, half);
      return;
    }
    if (mode === "slide") {
      try {
        elimg.style.transform = "translateY(-8px)";
        elimg.style.setProperty("--digit-alpha", "0");
      } catch {}
      elimg._animTimer = setTimeout(() => {
        elimg.src = src;
        try {
          elimg.style.transform = "translateY(8px)";
          void elimg.offsetWidth;
          requestAnimationFrame(() => {
            elimg.style.transform = "translateY(0)";
            elimg.style.setProperty("--digit-alpha", "1");
          });
        } catch {}
        elimg._animating = false;
        elimg._pendingSrc = null;
      }, half);
      return;
    }
    // fallback
    elimg.src = src;
    elimg._pendingSrc = null;
    return;
  }
  // find img child
  const img = elimg.querySelector && elimg.querySelector("img");
  if (img) img.src = src;
}

function updateSeparatorImages() {
  try {
    const seps = _getSeparators();
    // While showing temperature, keep separators blank
    if (runtime._showingTemp) {
      seps.forEach((s) =>
        updateImgFor(s, "assets/img/clock/separator-empty.jpg")
      );
      return;
    }
    seps.forEach((s) => {
      // separator DOM in markup uses <img class="separator" ...>
      const img =
        s.tagName && s.tagName.toLowerCase() === "img"
          ? s
          : s.querySelector && s.querySelector("img");
      if (!img) return;
      // choose file based on on/off state
      if (s.classList.contains("on")) {
        img.src = "assets/img/clock/separator-on.jpg";
      } else if (s.classList.contains("off")) {
        img.src = "assets/img/clock/separator-off.jpg";
      } else {
        img.src = "assets/img/clock/separator-empty.jpg";
      }
    });
  } catch (e) {}
}

// Update separators inside the date block (#nixie-date) according to mode
function updateDateSeparators() {
  try {
    const mode = settings.separator || "blinking";
    const seps = Array.from(
      document.querySelectorAll("#nixie-date .nixie-wrap-separator .separator")
    );
    if (!seps || !seps.length) return;
    if (mode === "off") {
      seps.forEach((s) => {
        s.classList.remove("on");
        s.classList.add("off");
        updateImgFor(s, "assets/img/clock/separator-off.jpg");
      });
      return;
    }
    if (mode === "static") {
      seps.forEach((s) => {
        s.classList.add("on");
        s.classList.remove("off");
        updateImgFor(s, "assets/img/clock/separator-on.jpg");
      });
      return;
    }
    // blinking
    const onState = runtime._sepState ? !!runtime._sepState.on : true;
    seps.forEach((s) => {
      if (onState) {
        s.classList.add("on");
        s.classList.remove("off");
        updateImgFor(s, "assets/img/clock/separator-on.jpg");
      } else {
        s.classList.remove("on");
        s.classList.add("off");
        updateImgFor(s, "assets/img/clock/separator-off.jpg");
      }
    });
  } catch (e) {}
}

function setDateTubesOff() {
  try {
    // day
    const dayImgs = document.querySelectorAll(
      ".nixie-wrap-day .nixie-tube img"
    );
    if (dayImgs && dayImgs.length >= 2) {
      updateImgFor(dayImgs[0], imageSrcFor("hour", "", 1));
      updateImgFor(dayImgs[1], imageSrcFor("hour", "", 2));
    }
    // month
    const monImgs = document.querySelectorAll(
      ".nixie-wrap-month .nixie-tube img"
    );
    if (monImgs && monImgs.length >= 2) {
      updateImgFor(monImgs[0], imageSrcFor("minut", "", 1));
      updateImgFor(monImgs[1], imageSrcFor("minut", "", 2));
    }
    // year
    const yearImgs = document.querySelectorAll(
      ".nixie-wrap-year .nixie-tube img"
    );
    if (yearImgs && yearImgs.length >= 2) {
      updateImgFor(yearImgs[0], imageSrcFor("second", "", 1));
      updateImgFor(yearImgs[1], imageSrcFor("second", "", 2));
    }
    const seps = Array.from(
      document.querySelectorAll("#nixie-date .nixie-wrap-separator .separator")
    );
    seps.forEach((s) => {
      s.classList.remove("on");
      s.classList.add("off");
      updateImgFor(s, "assets/img/clock/separator-empty.jpg");
    });
  } catch (e) {}
}

function attachEvents() {
  el.is24h = $("#is24h");
  if (el.is24h) {
    el.is24h.addEventListener("change", (e) => {
      settings.is24h = !!e.target.checked;
      document.body.setAttribute("data-12h", settings.is24h ? "false" : "true");
      save();
    });
  }
  el.dateFormat.addEventListener("change", (e) => {
    settings.dateFormat = e.target.value;
    save();
  });
  if (el.dstMode) {
    el.dstMode.addEventListener("change", (e) => {
      settings.dstMode = e.target.checked ? "eu" : "off";
      save();
    });
  }
  if (el.tzSelect) {
    el.tzSelect.addEventListener("change", (e) => {
      settings.timezone = e.target.value || "UTC+00:00";
      save();
    });
  }
  el.leadingZero.addEventListener("change", (e) => {
    settings.leadingZero = e.target.checked;
    save();
  });
  el.autoDateDisplay.addEventListener("change", (e) => {
    settings.autoDate = e.target.checked;
    save();
    try {
      if (settings.autoDate) {
        renderDate(computeClockDate());
      } else {
        if (el.nixieDate) el.nixieDate.classList.remove("visible");
        setDateTubesOff();
      }
    } catch (e) {}
  });
  el.showSeconds.addEventListener("change", (e) => {
    settings.showSeconds = e.target.checked;
    save();
    setTimeout(applySeparatorMode, 0);
  });
  el.separatorBehavior.addEventListener("change", (e) => {
    settings.separator = e.target.value;
    save();
    applySeparatorMode();
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
  if (el.transitionSelect) {
    el.transitionSelect.addEventListener("change", (e) => {
      settings.transition = e.target.value;
      document.documentElement.setAttribute(
        "data-transition",
        settings.transition || "none"
      );
      save();
    });
  }
  if (el.transitionSpeed) {
    el.transitionSpeed.addEventListener("input", (e) => {
      settings.transitionSpeed = +e.target.value;
      document.documentElement.style.setProperty(
        "--nixie-transition-duration",
        settings.transitionSpeed + "ms"
      );
      updateSliderFill(e.target);
      save();
    });
  }
  el.nightMode.addEventListener("change", (e) => {
    settings.nightMode = e.target.checked;
    save();
    updateBrightness();
  });
  if (el.nightStart) {
    el.nightStart.addEventListener("change", (e) => {
      settings.nightStart = e.target.value;
      save();
      updateBrightness();
    });
  }
  if (el.nightEnd) {
    el.nightEnd.addEventListener("change", (e) => {
      settings.nightEnd = e.target.value;
      save();
      updateBrightness();
    });
  }
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
  if (el.hourlyMelody) {
    el.hourlyMelody.addEventListener("change", (e) => {
      settings.hourlyMelody = e.target.value;
      save();
    });
  }
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
  el.soundTest.addEventListener("click", () => {
    const melody = settings.alarmMelody || settings.hourlyMelody || "beep";
    playMelody(melody);
  });
  el.alarmSave.addEventListener("click", () => {
    save();
    flash(translations.toastAlarmSaved || "Alarm saved");
  });

  if (el.alarmMelody) {
    el.alarmMelody.addEventListener("change", (e) => {
      settings.alarmMelody = e.target.value;
      save();
    });
  }

  el.slotMachine.addEventListener("change", (e) => {
    settings.slotMachine = e.target.checked;
    save();
  });
  el.slotInterval.addEventListener("input", (e) => {
    settings.slotInterval = +e.target.value;
    save();
  });
  if (el.units) {
    el.units.addEventListener("change", (e) => {
      settings.units = e.target.value;
      updateTempInputLimits();
      save();
    });
  }
  el.showTemp.addEventListener("change", (e) => {
    settings.showTemp = e.target.checked;
    save();
    if (e.target.checked) {
      const val = el.tempValue ? el.tempValue.value : "";
      showTemperatureOverlay(val);
      setTimeout(() => {
        el.showTemp.checked = false;
        settings.showTemp = false;
        save();
      }, 1200);
    }
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
    setDocumentLanguage(settings.lang);
    save();
  });

  if (el.ledColor) {
    el.ledColor.addEventListener("input", (e) => {
      const hex = e.target.value;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      settings.led = { r, g, b };
      document.documentElement.style.setProperty("--led-color", hex);
      document.documentElement.style.setProperty("--underlight-color", hex);
      save();
    });
  }

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
  if (el.is24h) el.is24h.checked = !!settings.is24h;
  document.body.setAttribute("data-12h", settings.is24h ? "false" : "true");
  el.dateFormat.value = settings.dateFormat;
  if (el.tzSelect) {
    const tz = settings.timezone || "UTC+00:00";
    const opt = Array.from(el.tzSelect.options).find((o) => o.value === tz);
    if (opt) el.tzSelect.value = tz;
  }
  if (el.dstMode) el.dstMode.checked = settings.dstMode === "eu";
  el.leadingZero.checked = settings.leadingZero;
  el.autoDateDisplay.checked = settings.autoDate;
  el.showSeconds.checked = settings.showSeconds;
  el.separatorBehavior.value = settings.separator;
  if (el.nixie) {
    el.nixie.dataset.separator = settings.separator;
    el.nixie.dataset.showSeconds = settings.showSeconds;
  }
  if (settings.autoDate) renderDate(computeClockDate());
  else setDateTubesOff();
  el.timeInput.value = "";
  el.dateInput.value = "";
  el.ssid.value = settings.wifi.ssid || "";
  el.wpass.value = settings.wifi.pass || "";
  el.ntpEnable.checked = !!settings.ntpEnable;
  el.ntpServer.value = settings.ntpServer || "";
  if (el.glowIntensity) {
    el.glowIntensity.value = settings.glowIntensity;
  }
  if (el.transitionSelect)
    el.transitionSelect.value = settings.transition || "smooth";
  if (el.transitionSpeed) {
    el.transitionSpeed.value = settings.transitionSpeed || 300;
    updateSliderFill(el.transitionSpeed);
  }
  // Reflect transition settings to CSS custom properties
  document.documentElement.setAttribute(
    "data-transition",
    settings.transition || "none"
  );
  document.documentElement.style.setProperty(
    "--nixie-transition-duration",
    (settings.transitionSpeed || 300) + "ms"
  );
  if (el.nightStart) el.nightStart.value = settings.nightStart || "23:00";
  if (el.nightEnd) el.nightEnd.value = settings.nightEnd || "07:00";
  if (el.glowIntensity) {
    updateSliderFill(el.glowIntensity);
  }
  if (el.ledColor)
    el.ledColor.value = rgbToHex(
      settings.led.r,
      settings.led.g,
      settings.led.b
    );
  document.documentElement.setAttribute(
    "data-transition",
    settings.transition || "none"
  );
  document.documentElement.style.setProperty(
    "--nixie-transition-duration",
    (settings.transitionSpeed || 300) + "ms"
  );
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
  updateTempInputLimits();
  el.showTemp.checked = !!settings.showTemp;
  el.deviceName.value = settings.deviceName;
  el.autoUpdates.checked = !!settings.autoUpdates;
  el.firmware.value = settings.firmware;
  if (el.hourlyMelody)
    el.hourlyMelody.value = settings.hourlyMelody || "chime1";
  if (el.alarmMelody) el.alarmMelody.value = settings.alarmMelody || "beep";
}

function updateTempInputLimits() {
  if (!el.tempValue) return;
  if (settings.units === "c") {
    el.tempValue.min = 0;
    el.tempValue.max = 99;
    let v = Number(el.tempValue.value);
    if (isNaN(v) || v < 0) v = 0;
    if (v > 99) v = 99;
    el.tempValue.value = String(v);
  } else {
    const fmin = Math.round((0 * 9) / 5 + 32);
    const fmax = Math.round((99 * 9) / 5 + 32);
    el.tempValue.min = fmin;
    el.tempValue.max = fmax;
    let v = Number(el.tempValue.value);
    if (isNaN(v) || v < fmin) v = fmin;
    if (v > fmax) v = fmax;
    el.tempValue.value = String(v);
  }
}

function playMelody(name) {
  if (!name || name === "none") return;
  const ac = getAudioContext();
  if (!ac) return beep();
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.connect(g).connect(ac.destination);
  if (name === "beep") {
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.001, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, ac.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.25);
    o.start();
    setTimeout(() => o.stop(), 300);
    return;
  }
  if (name === "chime1" || name === "tone1") {
    o.type = "square";
    o.frequency.value = 660;
  } else if (name === "chime2" || name === "tone2") {
    o.type = "triangle";
    o.frequency.value = 520;
  } else {
    o.type = "sine";
    o.frequency.value = 720;
  }
  g.gain.setValueAtTime(0.001, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(
    settings.volume / 100 || 0.4,
    ac.currentTime + 0.02
  );
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 1.2);
  o.start();
  setTimeout(() => o.stop(), 1200);
}

function isNight(now) {
  if (!settings.nightMode) return false;
  const start = settings.nightStart || "23:00";
  const end = settings.nightEnd || "07:00";
  const [sh, sm] = start.split(":").map((x) => parseInt(x, 10));
  const [eh, em] = end.split(":").map((x) => parseInt(x, 10));
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = sh * 60 + (isNaN(sm) ? 0 : sm);
  const endMinutes = eh * 60 + (isNaN(em) ? 0 : em);
  if (startMinutes === endMinutes) return false;
  if (startMinutes < endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }
  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
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
  doc.style.setProperty("--underlight-color", hex);
  try {
    const logo = document.getElementById("brandLogo");
    if (logo) {
      if (theme === "dark") logo.src = "assets/img/logo_light.svg";
      else logo.src = "assets/img/logo_dark.svg";
    }
    try {
      //   if (theme === "dark") img.src = "assets/img/nixie-tube-dark.png";
      //   else img.src = "assets/img/nixie-tube-light.png";
      // });
    } catch (e) {}
  } catch (e) {}
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
  if (settings.dstMode === "off") return 0;
  const year = date.getUTCFullYear();
  if (settings.dstMode === "eu") {
    const lastSunday = (month) => {
      const d = new Date(Date.UTC(year, month + 1, 0));
      const day = d.getUTCDay();
      d.setUTCDate(d.getUTCDate() - day);
      return d;
    };
    const start = lastSunday(2);
    start.setUTCHours(1, 0, 0, 0);
    const end = lastSunday(9);
    end.setUTCHours(1, 0, 0, 0);
    if (date >= start && date < end) return 60;
    return 0;
  }
  if (settings.dstMode === "us") {
    const nthSunday = (month, n) => {
      const d = new Date(Date.UTC(year, month, 1));
      const add = (7 - d.getUTCDay()) % 7;
      d.setUTCDate(1 + add + 7 * (n - 1));
      return d;
    };
    const firstSunday = (month) => nthSunday(month, 1);
    const secondSunday = (month) => nthSunday(month, 2);
    const start = secondSunday(2);
    start.setUTCMinutes(start.getUTCMinutes() - tzMinutes + 120);
    const end = firstSunday(10);
    end.setUTCMinutes(end.getUTCMinutes() - (tzMinutes + 60) + 120);
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
  let displayHour = hoursUtc;
  if (!settings.is24h) {
    displayHour = displayHour % 12;
    if (displayHour === 0) displayHour = 12;
  }
  const hStr = String(displayHour).padStart(2, "0");
  const mStr = String(minutes).padStart(2, "0");
  const sStr = String(seconds).padStart(2, "0");
  // body attribute for CSS
  const twelveMode = !settings.is24h;
  document.body.setAttribute("data-12h", twelveMode ? "true" : "false");

  // Hours: two img elements inside .nixie-wrap.nixie-wrap-hour
  try {
    const hourWrap = document.querySelectorAll(
      ".nixie-wrap-hour .nixie-tube img"
    );
    if (hourWrap && hourWrap.length >= 2) {
      // position 1 is first image, position 2 is second
      const hideLeading =
        twelveMode && !settings.leadingZero && parseInt(hStr, 10) < 10;
      if (hideLeading) {
        updateImgFor(hourWrap[0], imageSrcFor("hour", "", 1));
      } else {
        updateImgFor(hourWrap[0], imageSrcFor("hour", hStr[0], 1));
      }
      updateImgFor(hourWrap[1], imageSrcFor("hour", hStr[1], 2));
    }
  } catch (e) {}

  // Minutes
  try {
    const minWrap = document.querySelectorAll(
      ".nixie-wrap-min .nixie-tube img"
    );
    if (minWrap && minWrap.length >= 2) {
      updateImgFor(minWrap[0], imageSrcFor("minut", mStr[0], 1));
      // If we are showing temperature with 3 digits, don't overwrite minute second tube
      if (!(runtime._showingTemp && runtime._tempDigits === 3)) {
        updateImgFor(minWrap[1], imageSrcFor("minut", mStr[1], 2));
      }
    }
  } catch (e) {}

  // Seconds
  try {
    const secWrap = document.querySelectorAll(
      ".nixie-wrap-sec .nixie-tube img"
    );
    if (secWrap && secWrap.length >= 2) {
      // When showing temperature overlay, do not modify seconds digits
      if (runtime._showingTemp) {
        // keep whatever showTemperatureOverlay placed
      } else if (settings.showSeconds) {
        updateImgFor(secWrap[0], imageSrcFor("second", sStr[0], 1));
        updateImgFor(secWrap[1], imageSrcFor("second", sStr[1], 2));
      } else {
        updateImgFor(secWrap[0], imageSrcFor("second", "", 1));
        updateImgFor(secWrap[1], imageSrcFor("second", "", 2));
      }
    }
  } catch (e) {}

  // ensure separators update to match blinking/static/off
  updateSeparatorImages();
}

function tick() {
  const now = computeClockDate();
  renderTime(now);
  renderDate(now);
  if (el.nixie) {
    el.nixie.dataset.separator = settings.separator;
    el.nixie.dataset.showSeconds = settings.showSeconds;
  }
  checkHourlyChime(now);
  checkAlarm(now);
  updateBrightness();
}

function updateGlow() {
  const raw = Math.max(0, Math.min(100, settings.glowIntensity || 0)) / 100;
  let eased = Math.pow(raw, 1.3);
  if (raw > 0.95) eased = Math.min(1.0, eased * 1.08);
  eased = Math.max(0, Math.min(1, eased));
  document.documentElement.style.setProperty(
    "--glow-intensity",
    eased.toString()
  );
}

function updateBrightness() {
  const b = Math.max(10, Math.min(100, settings.brightness || 90));
  let effective = b;
  if (settings.nightMode) {
    const now = computeClockDate();
    if (isNight(now)) {
      effective = Math.max(10, Math.round(b * 0.3));
    }
  }
  const val = (effective / 100).toFixed(2);
  document.documentElement.style.setProperty("--tube-brightness", val);
  const minOpacity = 0.15;
  const opacity = (minOpacity + ((b - 10) / 90) * (1 - minOpacity)).toFixed(2);
  document.documentElement.style.setProperty("--tube-opacity", opacity);
  if (el.brightness) updateSliderFill(el.brightness);
}

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

function beepBurst(times = 3, interval = 350) {
  let count = 0;
  const id = setInterval(() => {
    beep();
    count++;
    if (count >= times) clearInterval(id);
  }, Math.max(150, interval));
  beep();
  count++;
}

function showTemperatureOverlay(temp, duration = 5000) {
  // Overlay is optional; we just dim tubes and swap digits
  const overlay = document.getElementById("tempOverlay");
  if (overlay) {
    const text = temp === "" || temp == null ? "--°" : `${temp}°`;
    overlay.textContent = text;
    overlay.classList.add("show");
  }
  const nix = el.nixie;
  if (nix) {
    nix.dataset.showTemp = "true";
    runtime._showingTemp = true;
    const m2img = document.querySelector(
      ".nixie-wrap-min .nixie-tube:nth-child(2) img"
    );
    const s1img = document.querySelector(
      ".nixie-wrap-sec .nixie-tube:nth-child(1) img"
    );
    const s2img = document.querySelector(
      ".nixie-wrap-sec .nixie-tube:nth-child(2) img"
    );
    runtime._savedTempImgs = {
      m2: (m2img && m2img.src) || null,
      s1: (s1img && s1img.src) || null,
      s2: (s2img && s2img.src) || null,
    };

    // save and blank separators
    const seps = _getSeparators();
    if (seps && seps.length) {
      runtime._savedSep = seps.map((s) => {
        const img =
          s.tagName && s.tagName.toLowerCase() === "img"
            ? s
            : s.querySelector && s.querySelector("img");
        return {
          src: (img && img.src) || "",
          isOn: s.classList.contains("on"),
        };
      });
      seps.forEach((s) =>
        updateImgFor(s, "assets/img/clock/separator-empty.jpg")
      );
    }

    // Compute numeric digits; support 2 or 3 digits (e.g., Fahrenheit 100+)
    const raw = temp === "" || temp == null ? "--" : String(temp).trim();
    const onlyDigits = (raw.match(/\d/g) || []).join("");
    const digits = onlyDigits.slice(-3); // last up to 3
    runtime._tempDigits = digits.length;
    // Flag whether 3-digit so CSS can undim minute second tube
    if (nix && runtime._tempDigits === 3) nix.dataset.temp3 = "true";
    else if (nix) delete nix.dataset.temp3;

    if (runtime._tempDigits === 3) {
      // Use minute second (pos2) + seconds pos1 + seconds pos2
      const d0 = digits[digits.length - 3];
      const d1 = digits[digits.length - 2];
      const d2 = digits[digits.length - 1];
      updateImgFor(m2img, imageSrcFor("minut", /\d/.test(d0) ? d0 : "", 2));
      updateImgFor(s1img, imageSrcFor("second", /\d/.test(d1) ? d1 : "", 1));
      updateImgFor(s2img, imageSrcFor("second", /\d/.test(d2) ? d2 : "", 2));
    } else {
      // Show last two digits in seconds, blank minute second
      const lastTwo = digits.slice(-2).padStart(2, " ");
      updateImgFor(m2img, imageSrcFor("minut", "", 2));
      updateImgFor(
        s1img,
        imageSrcFor("second", /\d/.test(lastTwo[0]) ? lastTwo[0] : "", 1)
      );
      updateImgFor(
        s2img,
        imageSrcFor("second", /\d/.test(lastTwo[1]) ? lastTwo[1] : "", 2)
      );
    }
  }

  setTimeout(() => {
    if (overlay) overlay.classList.remove("show");
    if (nix) {
      nix.dataset.showTemp = "false";
      if (nix) delete nix.dataset.temp3;
      // restore saved images
      const s1img = document.querySelector(
        ".nixie-wrap-sec .nixie-tube:nth-child(1) img"
      );
      const s2img = document.querySelector(
        ".nixie-wrap-sec .nixie-tube:nth-child(2) img"
      );
      const m2img = document.querySelector(
        ".nixie-wrap-min .nixie-tube:nth-child(2) img"
      );
      if (runtime._savedTempImgs) {
        if (runtime._savedTempImgs.m2)
          updateImgFor(m2img, runtime._savedTempImgs.m2);
        if (runtime._savedTempImgs.s1)
          updateImgFor(s1img, runtime._savedTempImgs.s1);
        if (runtime._savedTempImgs.s2)
          updateImgFor(s2img, runtime._savedTempImgs.s2);
      }
      runtime._savedTempImgs = null;

      const seps = _getSeparators();
      if (seps && seps.length && runtime._savedSep) {
        seps.forEach((s, i) => {
          const saved = runtime._savedSep[i];
          if (!saved) return;
          updateImgFor(s, saved.src || "assets/img/clock/separator-empty.jpg");
          if (saved.isOn) {
            s.classList.add("on");
            s.classList.remove("off");
          } else {
            s.classList.remove("on");
            s.classList.add("off");
          }
        });
      }
      applySeparatorMode();
      runtime._savedSep = null;
      runtime._showingTemp = false;
      runtime._tempDigits = 0;
    }
  }, duration);
}

function timePartsFromClock(now) {
  return {
    y: now.getUTCFullYear(),
    m: now.getUTCMonth() + 1,
    d: now.getUTCDate(),
    dow: now.getUTCDay(),
    hh: now.getUTCHours(),
    mm: now.getUTCMinutes(),
    ss: now.getUTCSeconds(),
  };
}

function getCurrentDigit(id) {
  const posMap = {
    h1: "hour-first",
    h2: "hour-second",
    m1: "minute-first",
    m2: "minute-second",
    s1: "second-first",
    s2: "second-second",
    "day-first": "day-first",
    "day-second": "day-second",
    mo1: "mo1",
    mo2: "mo2",
    y1: "y1",
    y2: "y2",
    y3: "y3",
    y4: "y4",
  };
  const prefix = posMap[id];
  let n =
    el[id] ||
    document.getElementById(id) ||
    document.querySelector(`.nixie-tube.${id}`);
  if (!n && prefix)
    n = document.querySelector(`.nixie-tube[class*="${prefix}-"]`);
  if (!n) return null;
  // check classes
  const classes = Array.from(n.classList);
  if (prefix) {
    const cls = classes.find((c) => c.startsWith(prefix + "-"));
    if (!cls) return null;
    const part = cls.split("-");
    const last = part[part.length - 1];
    if (last === "blank") return null;
    return last;
  }
  // fallback: textContent if present
  const txt = (n.textContent || "").trim();
  return txt ? txt.slice(-1) : null;
}

function checkHourlyChime(now) {
  if (!settings.hourlyChime) return;
  const t = timePartsFromClock(now);
  if (!(t.mm === 0 && t.ss <= 3)) return;
  const key = `${t.y}-${t.m}-${t.d}-${t.hh}`;
  if (runtime.lastChimeKey === key) return;
  runtime.lastChimeKey = key;
  beep();
}

function checkAlarm(now) {
  const mode = settings.alarmDays || "off";
  if (mode === "off") return;
  if (!settings.alarmTime || !/^\d{2}:\d{2}$/.test(settings.alarmTime)) return;
  const t = timePartsFromClock(now);
  const isWeekend = t.dow === 0 || t.dow === 6;
  const passDay =
    mode === "daily" ||
    (mode === "monfri" && !isWeekend) ||
    (mode === "weekends" && isWeekend);
  if (!passDay) return;
  const targetH = parseInt(settings.alarmTime.slice(0, 2), 10);
  const targetM = parseInt(settings.alarmTime.slice(3, 5), 10);
  if (!(t.hh === targetH && t.mm === targetM && t.ss <= 3)) return;
  const key = `${t.y}-${t.m}-${t.d}-${String(targetH).padStart(
    2,
    "0"
  )}:${String(targetM).padStart(2, "0")}`;
  if (runtime.lastAlarmKey === key) return;
  runtime.lastAlarmKey = key;
  beepBurst(3, 350);
}

init();
