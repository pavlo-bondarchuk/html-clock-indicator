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
    tubeBrightness: "Tube Brightness",
    tubeGlow: "Tube Glow",
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
    tubeBrightness: "Röhrenhelligkeit",
    tubeGlow: "Röhren-Glow",
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
  ledColor: $("#ledColor"),
  hourlyMelody: $("#hourlyMelody"),
  alarmMelody: $("#alarmMelody"),
  nightStart: $("#nightStart"),
  nightEnd: $("#nightEnd"),
  nixieDate: $("#nixie-date"),
  is24hSelect: $("#is24hSelect"),
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
    el.d1.src = `assets/img/${day[0]}.png`;
    el.d2.src = `assets/img/${day[1]}.png`;
    el.mo1.src = `assets/img/${mon[0]}.png`;
    el.mo2.src = `assets/img/${mon[1]}.png`;
  } else {
    // MM-DD-YYYY
    el.d1.src = `assets/img/${mon[0]}.png`;
    el.d2.src = `assets/img/${mon[1]}.png`;
    el.mo1.src = `assets/img/${day[0]}.png`;
    el.mo2.src = `assets/img/${day[1]}.png`;
  }
  el.y1.src = `assets/img/${yr[0]}.png`;
  el.y2.src = `assets/img/${yr[1]}.png`;
  el.y3.src = `assets/img/${yr[2]}.png`;
  el.y4.src = `assets/img/${yr[3]}.png`;
}

// Helper: setDigit now targets image elements and shows/hides them
function setDigit(id, val) {
  const n = el[id] || document.getElementById(id);
  if (!n) return;
  const wrap = n.closest ? n.closest(".nixie-wrap") : n.parentElement;

  // blank case: hide and mark wrapper
  if (val === "" || val == null) {
    // cancel any pending swaps
    if (n._swapTimer) {
      clearTimeout(n._swapTimer);
      n._swapTimer = null;
    }
    n.style.opacity = "0";
    // after transition, remove src and mark blank
    n._swapTimer = setTimeout(() => {
      n.style.visibility = "hidden";
      n.removeAttribute("src");
      if (wrap) wrap.classList.add("blank");
      n._swapTimer = null;
    }, 220);
    return;
  }

  // show value with crossfade: if same digit already shown, ensure visible
  const ch = String(val).slice(-1);
  const newSrc = `assets/img/${ch}.png`;
  if (n.getAttribute("src") === newSrc) {
    // already correct; ensure visible and clear blank
    n.style.visibility = "visible";
    n.style.opacity = "1";
    if (wrap) wrap.classList.remove("blank");
    return;
  }

  // Start transition variant per settings: smooth | fade | slide
  const transitionMode =
    document.documentElement.getAttribute("data-transition") ||
    settings.transition ||
    "smooth";
  if (n._swapTimer) {
    clearTimeout(n._swapTimer);
    n._swapTimer = null;
  }
  // ensure visible while swapping
  n.style.visibility = "visible";

  if (transitionMode === "fade") {
    // fade out -> swap -> fade in (no movement)
    n.style.transform = "translateY(0) scale(1)";
    n.style.opacity = "0";
    n._swapTimer = setTimeout(() => {
      n.src = newSrc;
      void n.offsetWidth;
      n.style.opacity = "1";
      if (wrap) wrap.classList.remove("blank");
      n._swapTimer = null;
    }, Math.max(80, settings.transitionSpeed / 4));
    return;
  }

  if (transitionMode === "slide") {
    // slide up from below while fading in
    // move current image down a bit and fade out, then swap and bring from below
    n.style.transform = "translateY(6px) scale(0.98)";
    n.style.opacity = "0";
    const delay = Math.max(60, settings.transitionSpeed / 4);
    n._swapTimer = setTimeout(() => {
      n.src = newSrc;
      // start slightly below and hidden, then animate into place
      n.style.transform = "translateY(10px) scale(0.98)";
      void n.offsetWidth;
      // animate to neutral
      requestAnimationFrame(() => {
        n.style.transform = "translateY(0) scale(1)";
        n.style.opacity = "1";
      });
      if (wrap) wrap.classList.remove("blank");
      n._swapTimer = null;
    }, delay);
    return;
  }

  // default: smooth - subtle scale/pulse during swap
  n.style.transform = "translateY(0) scale(0.96)";
  n.style.opacity = "0";
  const delay = Math.max(60, settings.transitionSpeed / 5);
  n._swapTimer = setTimeout(() => {
    n.src = newSrc;
    void n.offsetWidth;
    n.style.transform = "translateY(0) scale(1)";
    n.style.opacity = "1";
    if (wrap) wrap.classList.remove("blank");
    n._swapTimer = null;
  }, delay);
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
  el.dstMode.addEventListener("change", (e) => {
    settings.dstMode = e.target.value;
    save();
  });
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
    // Recompute brightness immediately when toggling night mode
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
    // play selected test sound (alarm melody preferred)
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
  // units change handling is wired below with limits update
  // update temp input limits when units change
  if (el.units) {
    el.units.addEventListener("change", (e) => {
      settings.units = e.target.value;
      // adjust input limits and clamp value
      updateTempInputLimits();
      save();
    });
  }
  el.showTemp.addEventListener("change", (e) => {
    settings.showTemp = e.target.checked;
    save();
    // if enabled, display temperature overlay briefly
    if (e.target.checked) {
      const val = el.tempValue ? el.tempValue.value : "";
      showTemperatureOverlay(val);
      // auto-uncheck after showing so control acts as a trigger
      setTimeout(() => {
        el.showTemp.checked = false;
        settings.showTemp = false;
        save();
      }, 1200);
    }
  });
  // ...existing code...
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

  if (el.ledColor) {
    el.ledColor.addEventListener("input", (e) => {
      const hex = e.target.value;
      // update settings.led
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
  el.is24hSelect.value = settings.is24h ? "true" : "false";
  document.body.setAttribute("data-12h", settings.is24h ? "false" : "true");
  el.dateFormat.value = settings.dateFormat;
  if (el.tzSelect) {
    // If settings.timezone matches one of the select options, use it
    const tz = settings.timezone || "UTC+00:00";
    const opt = Array.from(el.tzSelect.options).find((o) => o.value === tz);
    if (opt) el.tzSelect.value = tz;
  }
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
  if (el.glowIntensity) {
    el.glowIntensity.value = settings.glowIntensity;
  }
  if (el.transitionSelect)
    el.transitionSelect.value = settings.transition || "smooth";
  if (el.transitionSpeed) {
    el.transitionSpeed.value = settings.transitionSpeed || 300;
    updateSliderFill(el.transitionSpeed);
  }
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
  // apply transition visuals
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
  // set temp input limits according to current units
  updateTempInputLimits();
  el.showTemp.checked = !!settings.showTemp;
  el.deviceName.value = settings.deviceName;
  el.autoUpdates.checked = !!settings.autoUpdates;
  el.firmware.value = settings.firmware;
  if (el.hourlyMelody)
    el.hourlyMelody.value = settings.hourlyMelody || "chime1";
  if (el.alarmMelody) el.alarmMelody.value = settings.alarmMelody || "beep";
  // Leading Zero is always visible and user-controlled
}

// Adjust the temp input min/max according to selected units
function updateTempInputLimits() {
  if (!el.tempValue) return;
  if (settings.units === "c") {
    el.tempValue.min = 0;
    el.tempValue.max = 99;
    // clamp
    let v = Number(el.tempValue.value);
    if (isNaN(v) || v < 0) v = 0;
    if (v > 99) v = 99;
    el.tempValue.value = String(v);
  } else {
    // convert Celsius 0..99 to Fahrenheit range
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

// Small melody player stub for testing — replace with real audio assets as needed
function playMelody(name) {
  if (!name || name === "none") return;
  // Simple beep variations using WebAudio for demo
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
  // chime/tone variants
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

// Return true if current clock time falls inside night schedule (handles overnight spans)
function isNight(now) {
  if (!settings.nightMode) return false;
  const start = settings.nightStart || "23:00";
  const end = settings.nightEnd || "07:00";
  const [sh, sm] = start.split(":").map((x) => parseInt(x, 10));
  const [eh, em] = end.split(":").map((x) => parseInt(x, 10));
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = sh * 60 + (isNaN(sm) ? 0 : sm);
  const endMinutes = eh * 60 + (isNaN(em) ? 0 : em);
  if (startMinutes === endMinutes) return false; // degenerate
  if (startMinutes < endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }
  // overnight: e.g., 23:00 - 07:00
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
  // also set CSS variable for underlight color so glow CSS can use it
  doc.style.setProperty("--underlight-color", hex);
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
  // If temperature overlay mode is active, do not overwrite seconds
  if (el.nixie && el.nixie.dataset.showTemp === "true") {
    // leave seconds as set by showTemperatureOverlay
  } else if (settings.showSeconds) {
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
  // Update brightness according to night schedule (if enabled)
  updateBrightness();
}
// Removed legacy animation code.

function updateGlow() {
  const raw = Math.max(0, Math.min(100, settings.glowIntensity || 0)) / 100;
  // Apply easing (quadratic) for stronger change near high end
  // Boost top end so 100 -> slightly above 1.0 for a stronger highlight
  let eased = Math.pow(raw, 1.3);
  if (raw > 0.95) eased = Math.min(1.0, eased * 1.08);
  eased = Math.max(0, Math.min(1, eased));
  document.documentElement.style.setProperty(
    "--glow-intensity",
    eased.toString()
  );
}

function updateBrightness() {
  // brightness stored 10..100 -> scale to 0.1..1.0
  const b = Math.max(10, Math.min(100, settings.brightness || 90));
  let effective = b;
  // apply night dimming schedule when enabled
  if (settings.nightMode) {
    const now = computeClockDate();
    if (isNight(now)) {
      // dim to 30% of configured brightness (tunable)
      effective = Math.max(10, Math.round(b * 0.3));
    }
  }
  const val = (effective / 100).toFixed(2);
  document.documentElement.style.setProperty("--tube-brightness", val);
  // Map raw slider brightness to a perceptual opacity for the tubes
  // so when user sets the slider to 100% the image opacity becomes 1.0.
  const minOpacity = 0.15;
  const opacity = (minOpacity + ((b - 10) / 90) * (1 - minOpacity)).toFixed(2);
  document.documentElement.style.setProperty("--tube-opacity", opacity);
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

// Show a temporary temperature overlay on the clock for a short duration (defaults to 3s)
function showTemperatureOverlay(temp, duration = 3000) {
  const overlay = document.getElementById("tempOverlay");
  if (!overlay) return;
  const text = temp === "" || temp == null ? "--°" : `${temp}°`;
  overlay.textContent = text;
  overlay.classList.add("show");
  // hide separators to avoid visual clash
  const nix = el.nixie;
  if (nix) {
    // mark showTemp so renderTime doesn't clobber seconds
    nix.dataset.showTemp = "true";
    // save current seconds to restore later
    // save current seconds and last-minute digit to restore later
    runtime._savedSeconds = [
      el.s1.getAttribute("src"),
      el.s2.getAttribute("src"),
    ];
    runtime._savedM2 = el.m2.getAttribute("src");
    // also save separator visual state (minute-second separator with id sep2)
    const sepEl = document.getElementById("sep2");
    if (sepEl) {
      runtime._savedSep = {
        opacity: sepEl.style.opacity || "",
        visibility: sepEl.style.visibility || "",
      };
      // hide the separator dot during overlay
      sepEl.style.opacity = "0";
      // also stop animation if any
      const dot = sepEl.querySelector(".dot");
      if (dot) dot.style.animation = "none";
    }

    // Prepare temperature string and decide mapping
    // Normalize to string without degree symbol
    const raw = temp === "" || temp == null ? "--" : String(temp);
    // If the value includes sign or non-digit, keep characters but we only map digits or placeholder
    // Trim whitespace
    const clean = raw.trim();
    // If longer than 3, use last 3 chars (e.g., thousands unlikely)
    const repFull = clean.length > 3 ? clean.slice(-3) : clean;
    // If we have 3 characters and they are all digits (or digit+), display using m2+s1+s2
    const digitsOnly = (s) => Array.from(s).filter((c) => /\d/.test(c)).length;
    if (repFull.length === 3 && digitsOnly(repFull) >= 3) {
      // Map 3-digit number: use last minute lamp (m2) as hundreds, seconds as tens/ones
      const a = repFull[0];
      const b = repFull[1];
      const c = repFull[2];
      setDigit("m2", /\d/.test(a) ? a : "-");
      setDigit("s1", /\d/.test(b) ? b : "-");
      setDigit("s2", /\d/.test(c) ? c : "-");
    } else {
      // Default: map last two characters into seconds pair (preserve minutes)
      const t = String(repFull).padStart(2, " ");
      const rep = String(t).slice(-2);
      setDigit("s1", /\d/.test(rep[0]) ? rep[0] : "-");
      setDigit("s2", /\d/.test(rep[1]) ? rep[1] : "-");
    }
  }
  // After duration, hide overlay and restore
  setTimeout(() => {
    overlay.classList.remove("show");
    if (nix) {
      nix.dataset.showTemp = "false";
      // restore saved seconds and minute image
      if (runtime._savedSeconds) {
        if (runtime._savedSeconds[0]) el.s1.src = runtime._savedSeconds[0];
        else setDigit("s1", "");
        if (runtime._savedSeconds[1]) el.s2.src = runtime._savedSeconds[1];
        else setDigit("s2", "");
      }
      if (runtime._savedM2) {
        if (runtime._savedM2) el.m2.src = runtime._savedM2;
        else setDigit("m2", "");
      }
      runtime._savedSeconds = null;
      runtime._savedM2 = null;
      // restore separator
      const sepEl = document.getElementById("sep2");
      if (sepEl && runtime._savedSep) {
        sepEl.style.opacity = runtime._savedSep.opacity || "";
        sepEl.style.visibility = runtime._savedSep.visibility || "";
        const dot = sepEl.querySelector(".dot");
        if (dot) dot.style.animation = "";
      }
      runtime._savedSep = null;
    }
  }, duration);
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
