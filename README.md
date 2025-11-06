# Tile Wall Phrase Checker

A simple web UI to checker to accompany the [Wall Mounted Tile Display on MakerWorld](https://makerworld.com/en/models/1964330-wall-tile-display).  It checks whether a phrase can be constructed from a given set of tiles and spaces to hang them. The project provides:

- A CLI script (`c:\dev\tile_checker.js`) for interactive checks (Node.js required).
- A static web UI (`c:\dev\web`) for quick visual checks and experimentation.

Important: this version supports only single-sided tiles (one character per physical tile). Double-sided tile support was removed.

---

## Quick Start (Web UI)

1. Open the static UI in your browser (double-click the file) or run the small local server below if your browser blocks local JS:

```powershell
start 'c:\dev\web\index.html'
```

Or serve it with a tiny server:

```powershell
npx http-server c:\dev\web --port 8080
# then open http://localhost:8080
```

2. Fill the controls:
- Number of rows
- Characters per row
- Tiles (space-separated tokens, see format below)
- Phrase to check
- Optionally check "Report leftover tiles after success" to view unused tiles when the layout succeeds

3. Click "Check Phrase" — the UI will show whether the phrase can be made, which tiles are needed, the layout split across rows, and leftover tiles (if requested).

---

## Quick Start (CLI)

Requires Node.js installed.

Run the interactive CLI:

```powershell
node c:\dev\tile_checker.js
```

Follow the prompts for rows, row length, the single-sided tile list, and the phrase. The CLI prints success/failure, the wrapped layout, tiles needed, and missing or leftover info.

---

## Tile input format (single-sided)

- Input is space-separated tokens. Each token is either:
  - `TOKEN` — one copy of that tile, or
  - `TOKEN:COUNT` — `COUNT` copies of that tile

- Examples:
  - `A:5 B:3 C:3` — five A tiles, three B tiles, three C tiles
  - `.:2 \::1` — two dot tiles and one colon tile (escape rules below)

### Escaping

- `:` is the count separator. To include a literal colon in the tile label, escape it with a backslash (type `\:` in the input). The parser treats the last unescaped `:` as the separator between token and count.

---

## What the tools show

- On success:
  - "Tiles needed (counts)" — counts of tile labels consumed to build the phrase
  - The phrase split across rows (word wrapping)
  - Optional leftover tiles summary (if the web UI checkbox was selected)

- On failure (space): shows the wrapped lines and reports the number of rows needed vs available.
- On failure (tiles): lists missing characters and counts required.

---

## Persistence

- The web UI persists the single-sided tile string in `localStorage` (or cookies as a fallback). When you revisit the page, your tile string is restored.

---

## Examples

- Example (web or CLI):
  - Rows: 2
  - Row length: 11
  - Single-sided tiles: `H:1 E:1 L:3 O:2 W:1 R:1 D:1`
  - Phrase: `HELLO WORLD`

  Expected: Success, "Tiles needed" should include counts for H,E,L,O,W,R,D and the split layout shows two rows.

---

## Troubleshooting

- If the web UI doesn't behave as expected, serve it via `npx http-server` (see Quick Start) and use the served URL in the browser.
- If a token is ignored, confirm tokens are separated by spaces and any `:` that belongs to the token is escaped (use `\:`).
