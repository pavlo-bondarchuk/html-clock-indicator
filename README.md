# HTML Clock Indicator

Single‑page (static) web app simulating a Nixie‑style indicator clock rendered with digit images and flexible settings for time, date, temperature and lighting. All preferences are stored in `localStorage`, so they persist across reloads in the same browser.

## Key Features

- Time formats: 24h / 12h with optional leading zero suppression.
- Seconds display: toggle on/off.
- Separator modes: off, static, blinking. When temperature mode is active the first separator is hidden, the second acts as the decimal point.
- Date: automatic display, formats `DD-MM-YYYY` / `MM-DD-YYYY`, manual time & date override with reset.
- Time zone + DST (daylight saving) adjustment.
- Temperature: one decimal place (e.g. `22.5C` / `75.5F`), input sanitising & range enforcement. Supports °C and °F.
- Decimal logic: first separator (between hours & minutes) off, second shows `sep-dot.png` if a fractional part exists; for 3+ integer digits (e.g. 100.x) the fraction is dropped.
- Lighting: brightness, glow intensity, LED/accent color, transition style & speed.
- Modes section: quick toggles (e.g. show temperature) + defaults restore.
- Themes (dark / light) + remembered custom accent color.
- Localisation (i18n): English (`en.json`) & German (`de.json`) as examples, easily extendable.
- `.btn-ghost` buttons get a brief flash effect (`.flash`) on click.
- Toast notifications per section + global (auto hide & dismiss on click).
- Global `Save All` / `Cancel` buttons (bottom card) to persist or revert all settings at once.

## Project Structure

```
html-clock-indicator/
  index.html              # Main page
  assets/
    css/style.css         # Styles (cards, themes, animations, flash, toast)
    js/script.js          # Clock logic, state, persistence, i18n, rendering
    img/clock/            # Digits 0-9, units (celsium.png, farenheit.png), separators
      0.png .. 9.png
      sep-colon.png       # Colon
      sep-dot.png         # Decimal dot (temperature)
      sep-e.png           # Empty separator
      celsium.png         # °C indicator
      farenheit.png       # °F indicator
    font/                 # UI webfont
  locales/
    en.json               # English locale
    de.json               # German locale
  favicon.*               # Favicons
  README.md               # This file
```

### Core Files

- `index.html` – layout of the indicator + settings cards + global action buttons.
- `assets/js/script.js` – main logic:
  - second ticking loop (`setInterval`)
  - separator mode handling (stops blinking in temperature mode)
  - temperature decimal formatting & image source swapping
  - localisation (load JSON, inject text)
  - state save/restore via `localStorage`
  - toast notifications
- `assets/css/style.css` – themes, glassy cards, glow, responsive tweaks, button effects.

## How It Works (Short)

1. `start()` runs on DOMContentLoaded.
2. Settings merge defaults with any stored `localStorage` values.
3. Selected locale & theme are applied.
4. A 1s interval updates time (respecting timezone / DST / manual offset).
5. If temperature mode is active, seconds are replaced by temperature digits + decimal point logic.
6. `applySeparatorMode()` controls separators: blinking/static/off; in temperature mode first off, second shows decimal or empty.
7. UI controls mutate `settings`, immediately reflected in the digit “tubes”.

## Run / Preview

Static app – just open `index.html` in a modern browser.

To avoid possible future CORS issues (if external assets are added) you can serve it locally.

### Option 1: Python (3.x)

```bash
cd path/to/html-clock-indicator
python3 -m http.server 8080
```

Open: http://localhost:8080/

### Option 2: Node.js (npx serve)

```bash
cd path/to/html-clock-indicator
npx serve . -l 8080
```

### Option 3: VS Code Live Server

Install the Live Server extension, then “Open with Live Server” on `index.html`.

## Settings & Persistence

- All changes reflect instantly.
- `Save All` persists the aggregated state to `localStorage`.
- `Cancel` reloads the persisted state, discarding unsaved edits.
- Reset/Revert/Defaults buttons reset their section and flash briefly.

## Localisation

Add a new language:

1. Create `locales/xx.json` mirroring existing structure.
2. Add an option in the language select in `index.html`.
3. Text updates via existing `setLocale()` logic.

## Temperature Logic

- Input accepts fractional numbers (sanitised).
- Always formatted to one decimal (`toFixed(1)`).
- If integer part length > 2 the fraction is dropped (3 digits + unit fit only).
- Blinking separators stop while showing temperature.
- `sep-dot.png` used solely as the decimal point in the second separator.

## State Storage

`settings` is serialised to `localStorage` under a defined key (see `script.js`). On load:

- defaults merge with stored values
- controls are populated
- digits render accordingly

## Extensions / Ideas

- Real network diagnostics instead of placeholders.
- Alarm tone & snooze / repeat logic.
- Adaptive / mobile layout variant.
- Export / import settings (JSON).
- PWA manifest + offline cache.

## Contributing

Open a PR / issue with improvement ideas (license not yet defined – add `LICENSE` if distributing).

## License

Not specified. Add a LICENSE file if you plan public distribution.

---

Need extra locales, asset optimisation, or different indicator sizes? Open an issue.
