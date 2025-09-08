const $ = (q) => document.querySelector(q);
let settings = load();
let translations = {};

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
  led: { r: 255, g: 102, b: 0 },
  brightness: 90,
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
  underColor: $("#underColor"),
  animSelect: $("#animSelect"),
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
};

async function init() {
  await loadTranslations(settings.lang);
  applySettingsToUI();
  applyTheme();
  updateBrightness();
  attachEvents();
  tick();
  el.nixie.dataset.ready = "true";
  setInterval(tick, 250);
}

async function loadTranslations(lang) {
  try {
    const response = await fetch(`locales/${lang}.json`);
    translations = await response.json();
    translatePage();
  } catch (error) {
    console.error(`Could not load translation file for ${lang}.`, error);
  }
}

function translatePage() {
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n");
    if (translations[key]) {
      element.textContent = translations[key];
    }
  });
}

function tick() {
  const now = new Date();
  const shown = getDisplayDate(now);
  renderTime(shown);
  renderDate(shown);
}

function getDisplayDate(now) {
  let base = new Date(now.getTime() + parseTz(settings.timezone) * 60000);
  const dst =
    settings.dstMode === "off" ? 0 : 60 * (settings.dstMode !== "off");
  base = new Date(base.getTime() + dst * 60000);
  if (
    settings.manual &&
    settings.manual.startReal &&
    settings.manual.startClock
  ) {
    const diff = now.getTime() - settings.manual.startReal;
    base = new Date(settings.manual.startClock + diff);
  }
  return base;
}

function renderTime(d) {
  const raw = d.getHours();
  const m = d.getMinutes();
  const s = d.getSeconds();
  let h = raw;
  if (!settings.is24h) {
    h = h % 12;
    if (h === 0) h = 12;
  }
  if (settings.leadingZero && h < 10) h = String(h).padStart(2, "0");
  const hs = String(h);
  const ms = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  const h1 = hs.length === 1 ? " " : hs[0];
  const h2 = hs.length === 1 ? hs[0] : hs[1];
  setDigit("h1", h1 === " " ? " " : h1);
  setDigit("h2", h2);
  setDigit("m1", ms[0]);
  setDigit("m2", ms[1]);
  if (settings.showSeconds) {
    setDigit("s1", ss[0]);
    setDigit("s2", ss[1]);
  } else {
    setDigit("s1", "");
    setDigit("s2", "");
  }
  el.nixie.dataset.separator = settings.separator;
  el.nixie.dataset.showSeconds = settings.showSeconds ? "true" : "false";

  let b = settings.brightness / 100;
  const hr = d.getHours();
  const isNight = settings.nightMode && (hr >= 22 || hr < 7);
  if (
    isNight &&
    document.documentElement.getAttribute("data-theme") === "dark"
  ) {
    b = Math.max(0.18, b * 0.32);
  }
  document.documentElement.style.setProperty("--tube-brightness", String(b));
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
    save();
  });
  el.underColor.addEventListener("input", (e) => {
    const rgb = hexToRgb(e.target.value);
    settings.led = rgb;
    applyTheme();
    save();
  });
  el.animSelect.addEventListener("change", (e) => {
    settings.anim = e.target.value;
    save();
  });
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

  el.theme.addEventListener("change", (e) => {
    settings.theme = e.target.value;
    applyTheme();
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
  el.theme.value = settings.theme;
  el.is24hSelect.value = settings.is24h ? "true" : "false";
  el.dateFormat.value = settings.dateFormat;
  el.tzText.value = settings.timezone || "UTC+00:00";
  el.dstMode.value = settings.dstMode;
  el.leadingZero.checked = settings.leadingZero;
  el.autoDateDisplay.checked = settings.autoDate;
  el.showSeconds.checked = settings.showSeconds;
  el.separatorBehavior.value = settings.separator;
  el.timeInput.value = "";
  el.dateInput.value = "";
  el.ssid.value = settings.wifi.ssid || "";
  el.wpass.value = settings.wifi.pass || "";
  el.ntpEnable.checked = !!settings.ntpEnable;
  el.ntpServer.value = settings.ntpServer || "";
  el.underColor.value = rgbToHex(
    settings.led.r,
    settings.led.g,
    settings.led.b
  );
  el.animSelect.value = settings.anim;
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
}

function updateBrightness() {
  const b = Math.max(0.12, Math.min(2, settings.brightness / 100));
  document.documentElement.style.setProperty("--tube-brightness", String(b));
  updateSliderFill(el.brightness);
}

function updateSliderFill(slider) {
  const min = slider.min || 0;
  const max = slider.max || 100;
  const val = slider.value;
  const percentage = ((val - min) / (max - min)) * 100;
  slider.style.backgroundSize = `${percentage}% 100%`;
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

function beep() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
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

init();
