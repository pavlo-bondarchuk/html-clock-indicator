// Clean minimal clock script - single implementation only
// (If editing, ensure no legacy code appended below.)
const DIGIT_PATH = "assets/img/clock/";
const SEP_COLON = "assets/img/clock/sep-colon.png";
const SEP_EMPTY = "assets/img/clock/sep-e.png"; // separator blank
const DIGIT_EMPTY = "assets/img/clock/e.png"; // digit (tube off)
const defaults = {
  is24h: true,
  leadingZero: true,
  showSeconds: false,
  dateFormat: "DD-MM-YYYY",
  autoDateDisplay: true,
  timezone: "UTC+00:00",
  dstMode: false,
  separatorBehavior: "blinking",
  manualOffsetMs: 0,
  manualActive: false,
  // Lighting
  brightness: 90, // percent (10-100)
  // brightness now maps to opacity (0-100)
  glowIntensity: 70, // percent (0-100)
  ledColor: "#EBA947", // LED/glow color (updated palette)
  // Transitions
  transitionMode: "smooth", // none | smooth | fade | slide
  transitionSpeed: 300, // ms
  // Temperature display
  showTemp: false,
  tempValue: 22, // integer temperature value
  units: "c", // 'c' or 'f'
};

// Theme handling (independent from main settings persistence)
const THEME_KEY = "clockTheme";
function loadTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
let currentTheme = loadTheme();
function applyTheme(theme) {
  currentTheme = theme === "dark" ? "dark" : "light";
  const root = document.documentElement;
  const body = document.body;
  root.setAttribute("data-theme", currentTheme);
  body.setAttribute("data-theme", currentTheme);
  const toggleWrap = document.getElementById("themeSelect");
  if (toggleWrap) {
    toggleWrap.setAttribute("data-mode", currentTheme);
    toggleWrap.setAttribute(
      "data-label",
      currentTheme === "light" ? "Light" : "Dark"
    );
  }
  const logo = document.getElementById("brandLogo");
  if (logo) {
    // Swap logo if both variants exist (fallback keeps current src)
    const lightLogo = "assets/img/logo_dark.svg"; // dark logo on light bg
    const darkLogo = "assets/img/logo_light.svg"; // light logo on dark bg
    logo.src = currentTheme === "dark" ? darkLogo : lightLogo;
  }
}
function wireThemeToggle() {
  document.getElementById("themeToggle")?.addEventListener("click", () => {
    const next = currentTheme === "light" ? "dark" : "light";
    applyTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}
  });
}
function loadSettings() {
  try {
    return {
      ...defaults,
      ...JSON.parse(localStorage.getItem("clockSettings") || "{}"),
    };
  } catch {
    return { ...defaults };
  }
}
const persistedSettings = loadSettings();
// Migration: upgrade old default color (#ff6600) to new brand if user didn't customize
if (!persistedSettings.ledColor || persistedSettings.ledColor === "#ff6600") {
  persistedSettings.ledColor = "#EBA947";
  // Clear custom accent flag so new color propagates
  delete persistedSettings._customAccentApplied;
}
let settings = { ...persistedSettings }; // working copy (unsaved until Save All)
function saveSettings() {
  localStorage.setItem("clockSettings", JSON.stringify(settings));
}
// ===== i18n =====
const LOCALE_KEY = "clockLocale";
function loadLocaleCode() {
  try {
    const v = localStorage.getItem(LOCALE_KEY);
    if (v && (v === "en" || v === "de")) return v;
  } catch {}
  return "en";
}
let currentLocale = loadLocaleCode();
let localeDict = {};
async function fetchLocale(code) {
  try {
    const res = await fetch(`locales/${code}.json`);
    if (!res.ok) throw new Error("net");
    return await res.json();
  } catch {
    return {};
  }
}
function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (!key) return;
    const txt = localeDict[key];
    if (typeof txt === "string") {
      if (
        el.tagName === "INPUT" &&
        (el.type === "button" || el.type === "submit")
      ) {
        el.value = txt;
      } else {
        el.textContent = txt;
      }
    }
  });
  // Attribute-specific translations
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const k = el.getAttribute("data-i18n-placeholder");
    if (k && typeof localeDict[k] === "string") {
      el.setAttribute("placeholder", localeDict[k]);
    }
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const k = el.getAttribute("data-i18n-title");
    if (k && typeof localeDict[k] === "string") {
      el.setAttribute("title", localeDict[k]);
    }
  });
  document.querySelectorAll("[data-i18n-label]").forEach((el) => {
    const k = el.getAttribute("data-i18n-label");
    if (k && typeof localeDict[k] === "string") {
      el.setAttribute("aria-label", localeDict[k]);
    }
  });
  // Update select option text nodes (options may not render inner spans)
  document.querySelectorAll("option[data-i18n]").forEach((opt) => {
    const k = opt.getAttribute("data-i18n");
    if (k && localeDict[k]) opt.textContent = localeDict[k];
  });
  // Theme toggle label attribute
  const themeSel = document.getElementById("themeSelect");
  if (themeSel) {
    themeSel.setAttribute(
      "data-label",
      currentTheme === "light"
        ? localeDict.themeLight || "Light"
        : localeDict.themeDark || "Dark"
    );
  }
}
async function setLocale(code) {
  currentLocale = code;
  localeDict = await fetchLocale(code);
  applyTranslations();
  try {
    localStorage.setItem(LOCALE_KEY, code);
  } catch {}
}
function wireLocaleSelect() {
  const sel = document.getElementById("langSelect");
  if (!sel) return;
  sel.value = currentLocale;
  // expose locale to CSS for locale-specific tweaks
  document.documentElement.setAttribute("data-locale", currentLocale);
  sel.addEventListener("change", () => {
    const v = sel.value;
    if (v === currentLocale) return;
    if (v === "en" || v === "de") setLocale(v);
  });
}
const $ = (s) => document.querySelector(s);
const el = {
  clock: $("#nixie-clock"),
  date: $("#nixie-date"),
  h1: $(".hour1"),
  h2: $(".hour2"),
  m1: $(".min1"),
  m2: $(".min2"),
  s1: $(".sec1"),
  s2: $(".sec2"),
  day1: $(".day1"),
  day2: $(".day2"),
  mon1: $(".month1"),
  mon2: $(".month2"),
  yr1: $(".year1"),
  yr2: $(".year2"),
  is24h: $("#is24h"),
  leadingZero: $("#leadingZero"),
  showSeconds: $("#showSeconds"),
  dateFormat: $("#dateFormat"),
  autoDateDisplay: $("#autoDateDisplay"),
  tzSelect: $("#tzSelect"),
  dstMode: $("#dstMode"),
  separatorBehavior: $("#separatorBehavior"),
  timeInput: $("#timeInput"),
  dateInput: $("#dateInput"),
  applyBtn: $("#tdApply"),
  resetBtn: $("#tdReset"),
  // Lighting controls
  brightness: $("#brightness"),
  glowIntensity: $("#glowIntensity"),
  ledColor: $("#ledColor"),
  transitionSelect: $("#transitionSelect"),
  transitionSpeed: $("#transitionSpeed"),
  // Temperature controls
  showTemp: $("#showTemp"),
  tempValue: $("#tempValue"),
  units: $("#units"),
};
const digitSrc = (d) => DIGIT_PATH + d + ".png";
const UNIT_C = DIGIT_PATH + "celsium.png";
const UNIT_F = DIGIT_PATH + "farenheit.png";
function setDigit(img, d, animate = true) {
  if (!img) return;
  const newSrc = digitSrc(d);
  if (img.src.endsWith("/" + d + ".png")) {
    img.dataset.prevDigit = d; // ensure stored
    return;
  }
  img.src = newSrc;
  if (!animate) {
    img.dataset.prevDigit = d;
    img.classList.remove("anim");
    return;
  }
  if (settings.transitionMode !== "none") {
    const prev = img.dataset.prevDigit;
    img.dataset.prevDigit = d;
    if (prev !== d) {
      img.classList.remove("anim");
      void img.offsetWidth; // restart
      img.classList.add("anim");
    }
  }
}
function parseTz(str) {
  const m = /^UTC([+-])(\d{2}):(\d{2})$/.exec(str || "UTC+00:00");
  if (!m) return 0;
  const s = m[1] == "+" ? 1 : -1;
  return s * (+m[2] * 60 + +m[3]);
}
function baseNow() {
  const r = new Date();
  const tz = parseTz(settings.timezone);
  const loc = -r.getTimezoneOffset();
  let diff = tz - loc;
  if (settings.dstMode) diff += 60;
  return new Date(r.getTime() + diff * 60000);
}
function currentNow() {
  const b = baseNow();
  return settings.manualActive
    ? new Date(b.getTime() + settings.manualOffsetMs)
    : b;
}
function updateTime() {
  const n = currentNow();
  let h = n.getHours();
  if (!settings.is24h) {
    h = h % 12;
    if (h === 0) h = 12;
  }
  const m = n.getMinutes(),
    s = n.getSeconds();
  const hStr =
    !settings.is24h && !settings.leadingZero && h < 10
      ? String(h)
      : String(h).padStart(2, "0");
  const mStr = String(m).padStart(2, "0");
  const sStr = String(s).padStart(2, "0");
  if (hStr.length === 1) {
    if (el.h1) el.h1.src = DIGIT_EMPTY;
    setDigit(el.h2, hStr[0]);
  } else {
    setDigit(el.h1, hStr[0]);
    setDigit(el.h2, hStr[1]);
  }
  setDigit(el.m1, mStr[0]);
  setDigit(el.m2, mStr[1]);
  if (settings.showTemp) {
    updateTemperatureDisplay();
  } else {
    if (settings.showSeconds) {
      setDigit(el.s1, sStr[0]);
      setDigit(el.s2, sStr[1]);
    } else {
      if (el.s1) el.s1.src = DIGIT_EMPTY;
      if (el.s2) el.s2.src = DIGIT_EMPTY;
    }
    applySecondsVisibility();
  }
}
function updateDate() {
  if (!el.date) return;
  if (!settings.autoDateDisplay) {
    el.date.setAttribute("data-off", "true");
    return;
  } else {
    el.date.removeAttribute("data-off");
  }
  const n = currentNow();
  const d = n.getDate(),
    mo = n.getMonth() + 1,
    y = n.getFullYear() % 100;
  const ds = String(d).padStart(2, "0"),
    ms = String(mo).padStart(2, "0"),
    ys = String(y).padStart(2, "0");
  const monthFirst = settings.dateFormat === "MM-DD-YYYY";
  const first = monthFirst ? ms : ds;
  const second = monthFirst ? ds : ms;
  // Date digits: no animation effect
  setDigit(el.day1, first[0], false);
  setDigit(el.day2, first[1], false);
  setDigit(el.mon1, second[0], false);
  setDigit(el.mon2, second[1], false);
  setDigit(el.yr1, ys[0], false);
  setDigit(el.yr2, ys[1], false);
  // Ensure any leftover anim class removed (e.g. if switching mode mid-change)
  el.date
    .querySelectorAll("img.anim")
    .forEach((i) => i.classList.remove("anim"));
}
function applySecondsVisibility() {
  const secWrap = el.clock?.querySelector(".nixie-wrap-sec");
  if (secWrap) secWrap.style.display = "";
  const seps = el.clock?.querySelectorAll(".separator");
  if (settings.showTemp) {
    // temperature mode: both separators blank
    seps?.forEach((s) => (s.src = SEP_EMPTY));
    return;
  }
  if (settings.showSeconds) {
    if (seps && seps[1] && settings.separatorBehavior !== "off") {
      seps[1].src =
        settings.separatorBehavior === "blinking"
          ? blinkOn
            ? SEP_COLON
            : SEP_EMPTY
          : SEP_COLON;
    } else if (seps && seps[1] && settings.separatorBehavior === "off") {
      seps[1].src = SEP_EMPTY;
    }
  } else {
    if (el.s1) el.s1.src = DIGIT_EMPTY;
    if (el.s2) el.s2.src = DIGIT_EMPTY;
    if (seps && seps[1]) seps[1].src = SEP_EMPTY;
  }
}
let blinkTimer = null,
  blinkOn = true;
function stopBlink() {
  if (blinkTimer) {
    clearInterval(blinkTimer);
    blinkTimer = null;
  }
}
function applySeparatorMode() {
  stopBlink();
  if (!el.clock) return;
  const seps = el.clock.querySelectorAll(".separator");
  if (!seps.length) return;
  if (settings.showTemp) {
    // keep separators blank
    seps.forEach((i) => (i.src = SEP_EMPTY));
    return;
  }
  switch (settings.separatorBehavior) {
    case "off":
      seps.forEach((i) => (i.src = SEP_EMPTY));
      return;
    case "static":
      seps.forEach((i) => (i.src = SEP_COLON));
      return;
    default:
      seps.forEach((i) => (i.src = SEP_COLON));
      blinkOn = true;
      blinkTimer = setInterval(() => {
        blinkOn = !blinkOn;
        seps.forEach((i) => (i.src = blinkOn ? SEP_COLON : SEP_EMPTY));
      }, 1000);
  }
}
function setManualTime() {
  if (!el.timeInput || !el.timeInput.value) return;
  const [HH, MM] = el.timeInput.value.split(":").map(Number);
  if ([HH, MM].some(isNaN)) return;
  const now = baseNow();
  const tgt = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    HH,
    MM,
    now.getSeconds()
  );
  settings.manualOffsetMs = tgt.getTime() - now.getTime();
  settings.manualActive = true;
  updateTime();
  updateDate();
}
function setManualDate() {
  if (!el.dateInput || !el.dateInput.value) return;
  const [Y, M, D] = el.dateInput.value.split("-").map(Number);
  if ([Y, M, D].some(isNaN)) return;
  const now = baseNow();
  const tgt = new Date(
    Y,
    M - 1,
    D,
    now.getHours(),
    now.getMinutes(),
    now.getSeconds()
  );
  settings.manualOffsetMs = tgt.getTime() - now.getTime();
  settings.manualActive = true;
  updateTime();
  updateDate();
}
function applySettingsToControls() {
  el.is24h && (el.is24h.checked = settings.is24h);
  el.leadingZero && (el.leadingZero.checked = settings.leadingZero);
  el.showSeconds && (el.showSeconds.checked = settings.showSeconds);
  el.dateFormat && (el.dateFormat.value = settings.dateFormat);
  el.autoDateDisplay && (el.autoDateDisplay.checked = settings.autoDateDisplay);
  el.tzSelect && (el.tzSelect.value = settings.timezone);
  el.dstMode && (el.dstMode.checked = settings.dstMode);
  el.separatorBehavior &&
    (el.separatorBehavior.value = settings.separatorBehavior);
  // Lighting sliders
  el.brightness && (el.brightness.value = settings.brightness);
  el.glowIntensity && (el.glowIntensity.value = settings.glowIntensity);
  el.ledColor && (el.ledColor.value = settings.ledColor || defaults.ledColor);
  // Transition controls
  el.transitionSelect && (el.transitionSelect.value = settings.transitionMode);
  el.transitionSpeed && (el.transitionSpeed.value = settings.transitionSpeed);
  // Temperature controls
  el.showTemp && (el.showTemp.checked = settings.showTemp);
  el.tempValue && (el.tempValue.value = settings.tempValue);
  el.units && (el.units.value = settings.units);
  enforceTempLimit();
  applySecondsVisibility();
}
function applyLighting() {
  const root = document.documentElement;
  root.style.setProperty(
    "--tube-opacity",
    (Math.max(0, Math.min(100, settings.brightness)) / 100).toString()
  );
  root.style.setProperty(
    "--glow-intensity",
    (Math.max(0, Math.min(100, settings.glowIntensity)) / 100).toString()
  );
  if (settings.ledColor) {
    const c = settings.ledColor;
    root.style.setProperty("--led-color", c);
    root.style.setProperty("--underlight-color", c);
    // Always keep accent variables in sync with current LED color (simplified design rule)
    root.style.setProperty("--accent", c);
    root.style.setProperty("--accent-1", c);
    root.style.setProperty("--accent-2", c);
  }
}
function applyTransition() {
  const root = document.documentElement;
  const mode = settings.transitionMode || "smooth";
  root.setAttribute("data-transition", mode);
  let dur = parseInt(settings.transitionSpeed, 10);
  if (isNaN(dur) || dur < 0) dur = defaults.transitionSpeed;
  const finalDur = mode === "none" ? 0 : dur;
  root.style.setProperty("--nixie-transition-duration", finalDur + "ms");
}

function enforceTempLimit() {
  if (!el.tempValue) return;
  const isF = settings.units === "f";
  const maxVal = isF ? 999 : 99; // 3 digits F, 2 digits C
  el.tempValue.max = String(maxVal);
  // Trim existing value if exceeding
  if (settings.tempValue > maxVal) {
    settings.tempValue = maxVal;
    el.tempValue.value = settings.tempValue;
  }
}
// Hard block extra digit entry in temperature field (rather than only clamping afterwards)
function limitTempInput() {
  if (!el.tempValue) return;
  const maxLen = settings.units === "f" ? 3 : 2;
  // Keep only digits
  let raw = el.tempValue.value.replace(/\D+/g, "");
  if (raw.length > maxLen) raw = raw.slice(0, maxLen);
  el.tempValue.value = raw;
  // Update setting (empty becomes 0 but we don't save 0 unless user actually typed it)
  if (raw.length) {
    const num = parseInt(raw, 10);
    if (!isNaN(num)) {
      settings.tempValue = num;
      updateTime();
    }
  }
}
function wireControls() {
  // Password visibility toggle
  const passToggle = document.getElementById("passToggle");
  const passInput = document.getElementById("wpass");
  passToggle?.addEventListener("click", () => {
    if (!passInput) return;
    const isPwd = passInput.getAttribute("type") === "password";
    passInput.setAttribute("type", isPwd ? "text" : "password");
    passToggle.classList.toggle("revealed", isPwd);
  });
  el.is24h?.addEventListener("change", () => {
    settings.is24h = el.is24h.checked;
    updateTime();
  });
  el.leadingZero?.addEventListener("change", () => {
    settings.leadingZero = el.leadingZero.checked;
    updateTime();
  });
  el.showSeconds?.addEventListener("change", () => {
    settings.showSeconds = el.showSeconds.checked;
    updateTime();
    applySeparatorMode();
  });
  el.dateFormat?.addEventListener("change", () => {
    settings.dateFormat = el.dateFormat.value;
    updateDate();
  });
  el.autoDateDisplay?.addEventListener("change", () => {
    settings.autoDateDisplay = el.autoDateDisplay.checked;
    updateDate();
  });
  el.tzSelect?.addEventListener("change", () => {
    settings.timezone = el.tzSelect.value;
    updateTime();
    updateDate();
  });
  el.dstMode?.addEventListener("change", () => {
    settings.dstMode = el.dstMode.checked;
    updateTime();
    updateDate();
  });
  el.separatorBehavior?.addEventListener("change", () => {
    settings.separatorBehavior = el.separatorBehavior.value;
    applySeparatorMode();
  });
  // Lighting events
  el.brightness?.addEventListener("input", () => {
    settings.brightness = +el.brightness.value;
    applyLighting();
  });
  el.glowIntensity?.addEventListener("input", () => {
    settings.glowIntensity = +el.glowIntensity.value;
    applyLighting();
  });
  el.ledColor?.addEventListener("input", () => {
    settings.ledColor = el.ledColor.value;
    // Mark that user intentionally changed accent so we don't overwrite later automatically
    settings._customAccentApplied = true;
    applyLighting();
  });
  // Transition controls
  el.transitionSelect?.addEventListener("change", () => {
    settings.transitionMode = el.transitionSelect.value;
    applyTransition();
  });
  el.transitionSpeed?.addEventListener("input", () => {
    settings.transitionSpeed = +el.transitionSpeed.value;
    applyTransition();
  });
  // Temperature controls
  el.showTemp?.addEventListener("change", () => {
    settings.showTemp = el.showTemp.checked;
    updateTime();
    applySeparatorMode();
  });
  el.tempValue?.addEventListener("input", () => {
    limitTempInput();
  });
  el.units?.addEventListener("change", () => {
    settings.units = el.units.value;
    enforceTempLimit();
    // Re-run limiter in case new unit reduces allowed length
    limitTempInput();
    updateTime();
  });
  el.timeInput?.addEventListener("change", setManualTime);
  el.dateInput?.addEventListener("change", setManualDate);
  el.applyBtn?.addEventListener("click", () => {
    updateTime();
    updateDate();
    showToast(localeDict.toastApplied || "Applied", "time");
  });
  el.resetBtn?.addEventListener("click", () => {
    resetTimeDateSection();
  });
  document.getElementById("lightApply")?.addEventListener("click", () => {
    applyLighting();
    applyTransition();
    showToast(localeDict.toastLightingApplied || "Lighting applied", "light");
  });
  document.getElementById("lightRevert")?.addEventListener("click", () => {
    resetLightingSection();
  });
  // Connectivity block actions
  document.getElementById("netTest")?.addEventListener("click", () => {
    showToast(localeDict.toastPingOk || "Ping ok", "net");
  });
  document.getElementById("netSave")?.addEventListener("click", () => {
    showToast(localeDict.toastWifiSaved || "Wi-Fi saved", "net");
  });
  // Alarm block actions: sound test (no toast) + save alarm toast
  document.getElementById("soundTest")?.addEventListener("click", () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880; // A5 tone
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch {}
  });
  document.getElementById("alarmSave")?.addEventListener("click", () => {
    showToast(localeDict.toastAlarmSaved || "Alarm saved", "alarm");
  });
  document.getElementById("modesApply")?.addEventListener("click", () => {
    updateTime();
    showToast(localeDict.toastModesApplied || "Modes applied", "modes");
  });
  document.getElementById("modesDefaults")?.addEventListener("click", () => {
    resetModesSection();
    showToast(localeDict.toastDefaults || "Defaults", "modes");
  });
}
function tick() {
  updateTime();
  settings.autoDateDisplay && updateDate();
}
function start() {
  applySettingsToControls();
  applyLighting();
  applyTransition();
  applyTheme(currentTheme);
  // Load locale then attach listeners
  setLocale(currentLocale).then(() => {
    wireLocaleSelect();
  });
  wireThemeToggle();
  wireControls();
  updateTime();
  updateDate();
  applySeparatorMode();
  setInterval(tick, 1000);
}
document.addEventListener("DOMContentLoaded", start);

function updateTemperatureDisplay() {
  if (!settings.showTemp) return;
  const val = parseInt(settings.tempValue, 10);
  if (isNaN(val)) return;
  let digits = String(Math.abs(val));
  if (digits.length > 3) digits = digits.slice(-3);
  const unitImg = settings.units === "f" ? UNIT_F : UNIT_C;
  // Blank hours
  if (el.h1) el.h1.src = DIGIT_EMPTY;
  if (el.h2) el.h2.src = DIGIT_EMPTY;
  // Layouts:
  // 2-digit: [/][/][–][/][UNIT][–][d1][d2]
  // 3-digit: [/][/][–][UNIT][d1][–][d2][d3]
  if (digits.length === 3) {
    if (el.m1) el.m1.src = unitImg;
    if (el.m2) el.m2.src = digitSrc(digits[0]);
    if (el.s1) el.s1.src = digitSrc(digits[1]);
    if (el.s2) el.s2.src = digitSrc(digits[2]);
  } else if (digits.length === 2) {
    if (el.m1) el.m1.src = DIGIT_EMPTY;
    if (el.m2) el.m2.src = unitImg;
    if (el.s1) el.s1.src = digitSrc(digits[0]);
    if (el.s2) el.s2.src = digitSrc(digits[1]);
  } else if (digits.length === 1) {
    // single digit fallback
    if (el.m1) el.m1.src = DIGIT_EMPTY;
    if (el.m2) el.m2.src = unitImg;
    if (el.s1) el.s1.src = DIGIT_EMPTY;
    if (el.s2) el.s2.src = digitSrc(digits[0]);
  }
  // Ensure separators will be blank (applied in applySecondsVisibility / applySeparatorMode)
}
// ==== Section Reset Helpers & Toast ====
function resetTimeDateSection() {
  settings.is24h = defaults.is24h;
  settings.leadingZero = defaults.leadingZero;
  settings.showSeconds = defaults.showSeconds;
  settings.dateFormat = defaults.dateFormat;
  settings.autoDateDisplay = defaults.autoDateDisplay;
  settings.timezone = defaults.timezone;
  settings.dstMode = defaults.dstMode;
  settings.separatorBehavior = defaults.separatorBehavior;
  settings.manualOffsetMs = defaults.manualOffsetMs;
  settings.manualActive = defaults.manualActive;
  applySettingsToControls();
  applySeparatorMode();
  updateTime();
  updateDate();
  showToast(localeDict.toastReset || "Reset");
}
function resetLightingSection() {
  settings.brightness = defaults.brightness;
  settings.glowIntensity = defaults.glowIntensity;
  settings.ledColor = defaults.ledColor;
  settings.transitionMode = defaults.transitionMode;
  settings.transitionSpeed = defaults.transitionSpeed;
  settings._customAccentApplied = false;
  applySettingsToControls();
  applyLighting();
  applyTransition();
  showToast(localeDict.toastReverted || "Reverted", "light");
}
function resetModesSection() {
  settings.showTemp = defaults.showTemp;
  settings.tempValue = defaults.tempValue;
  settings.units = defaults.units;
  enforceTempLimit();
  applySettingsToControls();
  updateTime();
  showToast(localeDict.toastDefaults || "Defaults", "time");
}
function showToast(msg, scope = "global") {
  let id = "toast";
  if (scope === "time") id = "toast-time";
  else if (scope === "light") id = "toast-light";
  else if (scope === "net") id = "toast-net";
  else if (scope === "modes") id = "toast-modes";
  else if (scope === "alarm") id = "toast-alarm";
  const t = document.getElementById(id);
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._to);
  t._to = setTimeout(() => t.classList.remove("show"), 1800);
}
