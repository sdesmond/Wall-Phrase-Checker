// Client-side implementation of the tile checker logic

function parseSingleTiles(input) {
  // single tiles tokens are space-separated, each token optionally with :count (e.g. A:3 .:1 X)
  // To include a literal colon in a token, escape it with a backslash (e.g. "\:").
  const parts = (input || '').split(/\s+/).map(p => p.trim()).filter(Boolean);
  const tiles = [];
  for (const part of parts) {
    const [tileSpecRaw, countSpec] = splitTokenCount(part);
    if (!tileSpecRaw) continue;
    const count = countSpec ? parseInt(countSpec, 10) || 1 : 1;
    const tileSpec = tileSpecRaw;
    for (let i = 0; i < count; i++) {
      tiles.push({ sides: [tileSpec], id: `${tileSpec}#s${i}` });
    }
  }
  return tiles;
}

// Helper: split token into [value, countStr] using the last unescaped ':' as separator.
function splitTokenCount(token) {
  if (!token) return [null, null];
  let last = -1;
  for (let i = 0; i < token.length; i++) {
    if (token[i] === ':') {
      // count backslashes immediately before
      let j = i - 1;
      let bs = 0;
      while (j >= 0 && token[j] === '\\') { bs++; j--; }
      if (bs % 2 === 0) last = i;
    }
  }
  if (last === -1) return [unescapeToken(token), null];
  const left = token.slice(0, last);
  const right = token.slice(last + 1);
  return [unescapeToken(left), right];
}

// Unescape backslash-escaped characters (e.g. '\\:' -> ':', '\\\\' -> '\\')
function unescapeToken(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && i + 1 < s.length) {
      out += s[i + 1];
      i++;
    } else {
      out += s[i];
    }
  }
  return out;
}

function wrapPhrase(phrase, rowLength) {
  const words = phrase.split(' ');
  const lines = [];
  let curr = '';
  for (let w of words) {
    if (curr.length === 0) {
      while (w.length > rowLength) {
        lines.push(w.slice(0, rowLength));
        w = w.slice(rowLength);
      }
      curr = w;
      continue;
    }
    if (curr.length + 1 + w.length <= rowLength) {
      curr = curr + ' ' + w;
    } else {
      lines.push(curr);
      while (w.length > rowLength) {
        lines.push(w.slice(0, rowLength));
        w = w.slice(rowLength);
      }
      curr = w;
    }
  }
  if (curr.length > 0) lines.push(curr);
  return lines;
}

// Matching that also returns mapping of char index -> tile index
function matchTiles(lines, tiles) {
  const chars = [];
  const charPos = []; // {line, col}
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    for (let ci = 0; ci < line.length; ci++) {
      const ch = line[ci];
      if (ch === ' ') continue;
      chars.push(ch);
      charPos.push({ line: li, col: ci });
    }
  }
  const n = chars.length;
  const m = tiles.length;
  const adj = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    const need = chars[i];
    for (let j = 0; j < m; j++) {
      for (const side of tiles[j].sides) {
        if (side.toLowerCase() === need.toLowerCase()) { adj[i].push(j); break; }
      }
    }
  }

  const mt = Array(m).fill(-1); // matched char index for tile j
  const usedGlobal = Array(n).fill(false);

  function tryKuhn(v, visited) {
    if (visited[v]) return false;
    visited[v] = true;
    for (const to of adj[v]) {
      if (mt[to] === -1 || tryKuhn(mt[to], visited)) {
        mt[to] = v;
        return true;
      }
    }
    return false;
  }

  let matchCount = 0;
  for (let v = 0; v < n; v++) {
    const visited = Array(n).fill(false);
    if (tryKuhn(v, visited)) matchCount++;
  }

  const charToTile = Array(n).fill(-1);
  for (let j = 0; j < m; j++) {
    if (mt[j] !== -1) charToTile[mt[j]] = j;
  }

  const unmatched = [];
  for (let i = 0; i < n; i++) if (charToTile[i] === -1) unmatched.push(i);

  return { ok: matchCount === n, charToTile, unmatched, chars, charPos };
}

function aggregateMissing(chars, unmatchedIndices) {
  const missing = {};
  for (const idx of unmatchedIndices) {
    const ch = chars[idx];
    missing[ch] = (missing[ch] || 0) + 1;
  }
  return missing;
}

// UI wiring
const rowsEl = document.getElementById('rows');
const rowLengthEl = document.getElementById('rowLength');
const phraseEl = document.getElementById('phrase');
const checkBtn = document.getElementById('checkBtn');
const clearBtn = document.getElementById('clearBtn');
const resultEl = document.getElementById('result');
const showLeftoverEl = document.getElementById('showLeftover');
const singleTilesEl = document.getElementById('singleTiles');

// Storage keys and helpers: prefer localStorage, fall back to cookies if unavailable
const STORAGE_KEY_SINGLE = 'tileChecker.singleTiles';

function setStored(key, value) {
  try {
    if (window.localStorage) {
      localStorage.setItem(key, value);
      return;
    }
  } catch (e) {
    // fall through to cookie
  }
  // fallback: cookie (expires in 365 days)
  try {
    const ex = new Date();
    ex.setDate(ex.getDate() + 365);
    document.cookie = encodeURIComponent(key) + '=' + encodeURIComponent(value) + '; expires=' + ex.toUTCString() + '; path=/';
  } catch (e) {
    // ignore
  }
}

function getStored(key) {
  try {
    if (window.localStorage) {
      const v = localStorage.getItem(key);
      if (v !== null) return v;
    }
  } catch (e) {
    // fall back to cookie
  }
  try {
    const cookies = document.cookie ? document.cookie.split('; ') : [];
    for (const c of cookies) {
      const [k, ...rest] = c.split('=');
      if (decodeURIComponent(k) === key) return decodeURIComponent(rest.join('='));
    }
  } catch (e) {
    return null;
  }
  return null;
}

// Load saved tile sets (if any) and populate inputs
function loadTileSetsToUI() {
  const single = getStored(STORAGE_KEY_SINGLE);
  if (single !== null && single !== undefined) singleTilesEl.value = single;
}

// Save on input changes
function wireTileSetPersistence() {
  if (!singleTilesEl) return;
  singleTilesEl.addEventListener('input', () => setStored(STORAGE_KEY_SINGLE, singleTilesEl.value));
}

// initialize storage and wire events
loadTileSetsToUI();
wireTileSetPersistence();

function renderLines(lines) {
  return lines.map((l, idx) => `<div class="row"><strong>Row ${idx+1}:</strong> <span class="line">${escapeHtml(l)}</span></div>`).join('');
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

checkBtn.addEventListener('click', () => {
  resultEl.innerHTML = '';
  const rows = parseInt(rowsEl.value, 10) || 1;
  const rowLength = parseInt(rowLengthEl.value, 10) || 1;
  const singleSpec = document.getElementById('singleTiles').value.trim();
  const phrase = phraseEl.value || '';
  const singleTiles = parseSingleTiles(singleSpec);
  const tiles = singleTiles;
  const lines = wrapPhrase(phrase, rowLength);

  if (lines.length > rows) {
    resultEl.className = 'result failure';
    resultEl.innerHTML = `<div><strong>FAILURE:</strong> Not enough rows. Phrase needs ${lines.length} rows but only ${rows} available.</div>` +
      `<div class="mapping">${renderLines(lines)}</div>`;
    return;
  }

  const match = matchTiles(lines, tiles);
  if (match.ok) {
    // Build assignment layout for rows
    const assignmentRows = lines.map(l => Array.from({ length: l.length }).fill(null));
    // populate characters and assigned tile IDs where applicable
    let charIndex = 0;
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      for (let ci = 0; ci < line.length; ci++) {
        const ch = line[ci];
        if (ch === ' ') continue;
        const tileIdx = match.charToTile[charIndex];
        assignmentRows[li][ci] = tileIdx !== -1 ? tiles[tileIdx].id : null;
        charIndex++;
      }
    }

    let mapHtml = '<div><strong>SUCCESS:</strong> Phrase can be constructed.</div>';

    // Compute how many of each tile are needed (aggregate used tiles) and show before the layout
    const usedTileIndices = match.charToTile.filter(i => i !== -1);
    const neededByLabel = {};
    for (const idx of usedTileIndices) {
      const t = tiles[idx];
      const label = (t.sides.length === 1) ? t.sides[0] : `${t.sides[0]}/${t.sides[1]}`;
      neededByLabel[label] = (neededByLabel[label] || 0) + 1;
    }
    let neededHtml = '<div class="mapping"><strong>Tiles needed (counts):</strong>';
    if (Object.keys(neededByLabel).length === 0) {
      neededHtml += '<div>None</div>';
    } else {
      neededHtml += '<div>';
      for (const [lab, cnt] of Object.entries(neededByLabel)) {
        neededHtml += `<div>${escapeHtml(lab)}: ${cnt}</div>`;
      }
      neededHtml += '</div>';
    }
    neededHtml += '</div>';

    // Now show needed counts first, then the wrapped layout
    mapHtml += neededHtml;
    mapHtml += `<div class="mapping">${renderLines(lines)}</div>`;
    mapHtml += '</div>';
    resultEl.className = 'result success';
    // If requested, compute leftover tiles and append summary
    const showLeftover = showLeftoverEl && showLeftoverEl.checked;
    if (showLeftover) {
      const usedSet = new Set(match.charToTile.filter(i => i !== -1));
      const leftoverIndices = tiles.map((t, i) => i).filter(i => !usedSet.has(i));
      const leftoverCount = leftoverIndices.length;
      const leftoverByLabel = {};
      for (const idx of leftoverIndices) {
        const t = tiles[idx];
        const label = (t.sides.length === 1) ? t.sides[0] : `${t.sides[0]}/${t.sides[1]}`;
        leftoverByLabel[label] = (leftoverByLabel[label] || 0) + 1;
      }
      let leftoverHtml = `<div class="mapping"><strong>Leftover tiles:</strong> ${leftoverCount} remaining</div>`;
      leftoverHtml += '<div class="mapping">';
      for (const [lab, cnt] of Object.entries(leftoverByLabel)) {
        leftoverHtml += `<div>${escapeHtml(lab)}: ${cnt}</div>`;
      }
      leftoverHtml += '</div>';
      resultEl.innerHTML = mapHtml + leftoverHtml;
    } else {
      resultEl.innerHTML = mapHtml;
    }
  } else {
    const missing = aggregateMissing(match.chars, match.unmatched);
    let badHtml = '<div><strong>FAILURE:</strong> Tiles are insufficient to construct the phrase.</div>';
    badHtml += `<div class="mapping">${renderLines(lines)}</div>`;
    badHtml += '<div class="mapping"><strong>Missing characters:</strong><br/>';
    for (const [k,v] of Object.entries(missing)) badHtml += `<div>${escapeHtml(k)}: ${v}</div>`;
    badHtml += '</div>';
    resultEl.className = 'result failure';
    resultEl.innerHTML = badHtml;
  }
});

clearBtn.addEventListener('click', () => { phraseEl.value = ''; resultEl.innerHTML = ''; resultEl.className = 'result'; });
