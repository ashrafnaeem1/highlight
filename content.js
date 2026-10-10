// ---- Tunable: keyboard shortcuts ----
// ctrl: Ctrl on Windows and Linux, Cmd on macOS. Set shift or alt to true to require them.
// key: the letter or key name, in lowercase, for example "k" or "j".
const SHORTCUT_QUICK_HIGHLIGHT = {
  ctrl: true,
  shift: false,
  alt: false,
  key: 'k',
}
const SHORTCUT_ERASE = {
  ctrl: true,
  shift: true,
  alt: false,
  key: 'x',
}
const SHORTCUT_UNDO = {
  ctrl: true,
  shift: true,
  alt: false,
  key: 'z',
}
const SHORTCUT_REDO = {
  ctrl: true,
  shift: true,
  alt: false,
  key: 'y',
}

// ---- Data version ----
// Version of the stored data this build writes. Data stored without a stamp is pre-0.0
// legacy data. Each update that changes the stored format bumps this and adds a fix
// in migrateEntries(); old data is repaired automatically on load and on import.
const DATA_VERSION = '0.1.1'

// ---- Tunable: curve of the trim handles ----
// 0 = square edge, 1 = full half-round (plano-convex). Values in between flatten the curve.
const HANDLE_CURVE = 0.1
// ---- Tunable: size of the trim handles ----
const HANDLE_WIDTH = 6 // horizontal thickness, in pixels
const HANDLE_HEIGHT = 1 // vertical size, as a multiple of the text line height (1 = same height)

// Shadow DOM isolates our popup from the page's CSS
const host = document.createElement('div')
host.id = 'highlight-host'
host.style.setProperty('--handle-curve', HANDLE_CURVE)
host.style.all = 'initial' // page styles (including dark modes) do not reach this host
host.style.setProperty('--handle-w', HANDLE_WIDTH + 'px')
document.documentElement.appendChild(host)
const shadow = host.attachShadow({ mode: 'closed' }) // closed: page scripts and dark modes cannot reach it

const COLORS = {
  lavender: '#E6E0F8',
  yellow: '#FFFBD1',
  green: '#C8F7C5',
  skyblue: '#BEE3F8',
  coral: '#F8B4A8',
  black: '#000000',
}

// Palette: each entry is { bg, fg }. fg null = automatic text color.
const DEFAULT_PALETTE = [
  { id: 'p2', name: 'Default', bg: '#BBD9B8', fg: null },
  { id: 'p0', bg: '#CAD1F7', fg: null },
  { id: 'p6', bg: '#FFFBD1', fg: null },
  { id: 'p3', bg: '#A9DAF0', fg: null },
  { id: 'p4', bg: '#F4C7AF', fg: null },
  {
    id: 'p5',
    name: 'Black',
    fixed: true,
    bg: '#24273A',
    fg: '#CAD3F5',
  },
  {
    id: 'p7',
    name: 'White',
    fixed: true,
    bg: '#EFF1F5',
    fg: '#4C4F69',
  },
]
let palette = DEFAULT_PALETTE

function normalizePalette(list) {
  const out = list.map((p, i) => {
    const d = DEFAULT_PALETTE.find((x) => x.id === p.id)
    // Fixed colors always use their built-in values and cannot be changed
    if (d && d.fixed) return { ...d }
    return {
      id: p.id || 'p' + i,
      name: p.name || (d && d.name) || null,
      fixed: false,
      bg: p.bg,
      fg: p.fg || null,
    }
  })
  // Add any fixed colors missing from an older saved palette
  for (const d of DEFAULT_PALETTE) {
    if (d.fixed && !out.some((p) => p.id === d.id))
      out.push({ ...d })
  }
  return out
}

// A highlight shows its palette slot's current colors; runs without a slot keep their own snapshot
function resolveRun(r) {
  const entry = r.p && palette.find((p) => p.id === r.p)
  if (entry) return { bg: entry.bg, fg: entry.fg || null }
  return { bg: resolveBg(r.c), fg: r.f || null }
}

// Link older highlights to the palette slot with the same colors, so they follow later edits
function linkLegacyRuns() {
  for (const r of model) {
    if (r.p) continue
    const bg = resolveBg(r.c)
    const fg = r.f || null
    const entry = palette.find(
      (p) => p.bg === bg && (p.fg || null) === fg,
    )
    if (entry) r.p = entry.id
  }
}

// Saved highlights may hold a legacy color name or a hex value
function resolveBg(c) {
  return c && c.startsWith('#') ? c : COLORS[c] || '#ffffff'
}

function isDarkColor(hex) {
  const n = parseInt(hex.slice(1), 16)
  const lum =
    0.299 * ((n >> 16) & 255) +
    0.587 * ((n >> 8) & 255) +
    0.114 * (n & 255)
  return lum < 140
}

// Local icon files (Heroicons, 24x24 outline) shipped inside the extension
const ICONS = {
  copy: chrome.runtime.getURL('icons/document-duplicate.svg'),
  remove: chrome.runtime.getURL('icons/trash.svg'),
  deselect: chrome.runtime.getURL('icons/backspace.svg'),
  hide: chrome.runtime.getURL('icons/minus.svg'),
  up: chrome.runtime.getURL('icons/arrow-up.svg'),
  down: chrome.runtime.getURL('icons/arrow-down.svg'),
  check: chrome.runtime.getURL('icons/check.svg'),
  plus: chrome.runtime.getURL('icons/plus.svg'),
}

shadow.innerHTML = `
  <style>
    :host {
      all: initial;
      color-scheme: light;
      font-family: sans-serif;
      font-size: 13px;
      line-height: 1.4;
    }
    :host {
      --bg: #eff1f5;
      --fg: #4c4f69;
      --border: #bcc0cc;
      --sep: #ccd0da;
      --hover: #ccd0da;
      --hover-border: #acb0be;
      --swatch-border: #9ca0b0;
      --shadow: rgba(76, 79, 105, 0.25);
      --tip-bg: #ccd0da;
      --tip-fg: #4c4f69;
      --tip-border: #acb0be;
      --handle: #3f5f94;
    }
    :host([data-theme="dark"]) {
      --bg: #24273a;
      --fg: #cad3f5;
      --border: #494d64;
      --sep: #494d64;
      --hover: #363a4f;
      --hover-border: #5b6078;
      --swatch-border: #6e738d;
      --shadow: rgba(0, 0, 0, 0.5);
      --tip-bg: #363a4f;
      --tip-fg: #cad3f5;
      --tip-border: #5b6078;
      --handle: #4d6b9e;
    }
    .popup {
      position: fixed;
      display: none;
      align-items: center;
      gap: 6px;
      padding: 6px 8px;
      background: var(--bg);
      color: var(--fg);
      border: 1px solid var(--border);
      border-radius: 8px;
      box-shadow: 0 2px 8px var(--shadow);
      z-index: 2147483647;
      font-family: sans-serif;
    }
    .popup.show { display: flex; }
    .popup { white-space: nowrap; }
    .controls {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .swatches { display: flex; gap: 6px; }
    .swatch {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: 1px solid var(--swatch-border);
      cursor: pointer;
      padding: 0;
    }
    .sep {
      width: 1px;
      height: 20px;
      background: var(--sep);
    }
    .action {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      border: 1px solid transparent;
      border-radius: 4px;
      background: transparent;
      cursor: pointer;
      padding: 0;
    }
    .action { color: var(--fg); }
    .action:hover { background: var(--hover); border-color: var(--hover-border); }
    .ico {
      display: inline-block;
      width: 18px;
      height: 18px;
      pointer-events: none;
      background: currentColor;
      mask: var(--icon) center / contain no-repeat;
      -webkit-mask: var(--icon) center / contain no-repeat;
    }
    .ico.ok { background: #16a34a; }
    .toast {
      position: absolute;
      display: none;
      align-items: center;
      gap: 4px;
      transform: translateX(-50%);
      padding: 3px 8px;
      background: var(--bg);
      color: var(--fg);
      border: 1px solid var(--border);
      border-radius: 6px;
      box-shadow: 0 2px 6px var(--shadow);
      font-size: 12px;
      white-space: nowrap;
      pointer-events: none;
    }
    .toast.show { display: flex; }
    .toast.above { bottom: calc(100% + 6px); }
    .toast.below { top: calc(100% + 6px); }
    .toast .ico { width: 14px; height: 14px; }
    .action[hidden] { display: none !important; }
    .note {
      position: fixed;
      display: none;
      align-items: center;
      gap: 6px;
      padding: 6px;
      background: var(--bg);
      color: var(--fg);
      border: 1px solid var(--border);
      border-radius: 8px;
      box-shadow: 0 2px 8px var(--shadow);
      z-index: 2147483647;
      font-family: sans-serif;
      font-size: 12px;
    }
    .note.show { display: flex; }
    .note input {
      width: 200px;
      padding: 4px 6px;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: var(--bg);
      color: var(--fg);
      font: inherit;
    }
    .note-ok {
      padding: 4px 10px;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: transparent;
      color: var(--fg);
      font: inherit;
      cursor: pointer;
    }
    .note-ok:hover { background: var(--hover); }
    .tip {
      position: fixed;
      display: none;
      max-width: 260px;
      padding: 4px 8px;
      background: var(--tip-bg);
      color: var(--tip-fg);
      border: 1px solid var(--tip-border);
      border-radius: 6px;
      box-shadow: 0 2px 6px var(--shadow);
      font-family: sans-serif;
      font-size: 12px;
      white-space: pre-wrap;
      word-break: break-word;
      pointer-events: none;
      z-index: 2147483646;
    }
    .tip.show { display: block; }
    .ctip {
      position: fixed;
      display: none;
      max-width: 260px;
      padding: 4px 8px;
      background: var(--bg);
      color: var(--fg);
      border: 1px solid var(--border);
      border-radius: 6px;
      box-shadow: 0 2px 6px var(--shadow);
      font-family: sans-serif;
      font-size: 12px;
      white-space: pre-wrap;
      word-break: break-word;
      pointer-events: none;
      z-index: 2147483647;
    }
    .ctip.show { display: block; }
    .handle {
      position: fixed;
      width: var(--handle-w);
      background: var(--handle);
      cursor: ew-resize;
      touch-action: none;
      z-index: 2147483646;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
    }
    /* Plano-convex: the flat side touches the text, the curve points outward */
    .handle.left {
      border-radius: calc(var(--handle-w) * var(--handle-curve)) 0 0 calc(var(--handle-w) * var(--handle-curve)) / 50% 0 0 50%;
    }
    .handle.right {
      border-radius: 0 calc(var(--handle-w) * var(--handle-curve)) calc(var(--handle-w) * var(--handle-curve)) 0 / 0 50% 50% 0;
    }
    .handle i {
      display: block;
      width: calc(var(--handle-w) * 0.5);
      height: 1.5px;
      background: #ffffff;
      border-radius: 1px;
    }
    .handle::before {
      content: "";
      position: absolute;
      left: -6px;
      right: -6px;
      top: 0;
      bottom: 0;
    }
    .handle[hidden] { display: none; }
    .tip.interactive {
      pointer-events: auto;
      user-select: text;
      cursor: text;
      outline: 1px solid var(--tip-border);
    }
    .tip.interactive:focus { outline: 2px solid var(--tip-fg); }
  </style>
  <div class="popup" id="popup">
    <div class="toast" id="toast"><span class="ico ok" style="--icon:url(${ICONS.check})"></span>Copied!</div>
    <div class="controls">
    <div class="swatches" id="swatches"></div>
    <span class="sep"></span>
    <button class="action" data-action="note" data-tip="Add Tooltip Note" hidden><span class="ico" style="--icon:url(${ICONS.plus})"></span></button>
    <button class="action" data-action="copy" data-tip="Copy Text"><span class="ico" style="--icon:url(${ICONS.copy})"></span></button>
    <button class="action" data-action="remove" data-tip="Remove Highlight"><span class="ico" style="--icon:url(${ICONS.remove})"></span></button>
    <button class="action" data-action="deselect" data-tip="Deselect Text and Hide Popup"><span class="ico" style="--icon:url(${ICONS.deselect})"></span></button>
    <button class="action" data-action="hide" data-tip="Hide Popup"><span class="ico" style="--icon:url(${ICONS.hide})"></span></button>
    <span class="sep"></span>
    <button class="action" data-action="up" data-tip="Move Popup Above"><span class="ico" style="--icon:url(${ICONS.up})"></span></button>
    <button class="action" data-action="down" data-tip="Move Popup Below"><span class="ico" style="--icon:url(${ICONS.down})"></span></button>
    </div>
  </div>
  <div class="note" id="note">
    <input type="text" id="noteInput" maxlength="200" placeholder="Tooltip Text" autocomplete="off">
    <button class="note-ok" id="noteOk">OK</button>
  </div>
  <div class="tip" id="tip"></div>
  <div class="handle left" id="hL" hidden><i></i><i></i></div>
  <div class="handle right" id="hR" hidden><i></i><i></i></div>
  <div class="ctip" id="ctip"></div>
`

const popup = shadow.getElementById('popup')
const DATA_TIP = shadow.getElementById('ctip')
const GAP = 8
const CONTEXT = 30 // characters kept before and after a highlight
const STORAGE_KEY = 'hl:' + location.href.split('#')[0]

// ---------- Theme: "system" | "light" | "dark", stored under "theme" ----------
const THEME_KEY = 'theme'
const PLACEMENT_KEY = 'popupPlacement'
let themePref = 'system'
const darkQuery = window.matchMedia(
  '(prefers-color-scheme: dark)',
)
function applyContentTheme() {
  const dark =
    themePref === 'dark' ||
    (themePref === 'system' && darkQuery.matches)
  host.dataset.theme = dark ? 'dark' : 'light'
}
applyContentTheme()

let savedSpan = null // [start, end] page-text offsets of the current text selection
let savedGroupId = null // set when an existing highlight is clicked
let anchorRect = null // where the popup is attached to the page
let placement = null // null = automatic, "above" or "below" = manual
let hlCounter = 0
let toastTimer = null

// ---------- Model: the source of truth for highlights ----------
// Each run: { g: group id, c: color, s, e: page-text offsets, t: text, pre, suf: context }
// Only user actions change the model. Page re-renders never remove anything from it.
let model = []

function freshId() {
  return 'hl-' + Date.now() + '-' + hlCounter++
}

// Every visible text node in page order, with its character offset in the page text
function buildTextIndex() {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (n) =>
        n.parentElement &&
        /^(SCRIPT|STYLE|NOSCRIPT)$/.test(
          n.parentElement.tagName,
        )
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT,
    },
  )
  const index = []
  let offset = 0
  let node
  while ((node = walker.nextNode())) {
    index.push({ node, start: offset })
    offset += node.nodeValue.length
  }
  return index
}

function pageText() {
  return buildTextIndex()
    .map((x) => x.node.nodeValue)
    .join('')
}

// Page-text offsets covered by a DOM range
function rangeToSpan(range) {
  let a = null
  let b = null
  for (const { node, start } of buildTextIndex()) {
    if (!range.intersectsNode(node)) continue
    const from =
      node === range.startContainer ? range.startOffset : 0
    const to =
      node === range.endContainer
        ? range.endOffset
        : node.nodeValue.length
    if (from >= to) continue
    if (a === null || start + from < a) a = start + from
    if (b === null || start + to > b) b = start + to
  }
  return a === null ? null : [a, b]
}

function makeRun(text, g, c, s, e, f = null, p = null) {
  return {
    g,
    c,
    f,
    p,
    s,
    e,
    t: text.slice(s, e),
    pre: text.slice(Math.max(0, s - CONTEXT), s),
    suf: text.slice(e, e + CONTEXT),
  }
}

// Remove [a, b) from every run, keeping the parts outside it
function keepNote(piece, r) {
  if (r.n) piece.n = r.n
  if (r.o) piece.o = r.o
  return piece
}

function cutSpan(text, a, b) {
  const out = []
  for (const r of model) {
    if (r.e <= a || r.s >= b) {
      out.push(r)
      continue
    }
    if (r.s < a)
      out.push(
        keepNote(makeRun(text, r.g, r.c, r.s, a, r.f, r.p), r),
      )
    if (r.e > b)
      out.push(
        keepNote(makeRun(text, r.g, r.c, b, r.e, r.f, r.p), r),
      )
  }
  model = out
}

// Highlight [a, b) with a new group. Parts already that color keep their group.
function applyToModel(text, a, b, entry, id) {
  const sameAs = (r) =>
    r.p
      ? r.p === entry.id
      : r.c === entry.bg && (r.f || null) === (entry.fg || null)
  const same = model
    .filter((r) => sameAs(r) && r.e > a && r.s < b)
    .map((r) => [Math.max(a, r.s), Math.min(b, r.e)])
    .sort((x, y) => x[0] - y[0])

  const pieces = []
  let cursor = a
  for (const [s, e] of same) {
    if (s > cursor) pieces.push([cursor, s])
    cursor = Math.max(cursor, e)
  }
  if (cursor < b) pieces.push([cursor, b])

  for (const [s, e] of pieces) cutSpan(text, s, e)
  for (const [s, e] of pieces)
    model.push(
      makeRun(
        text,
        id,
        entry.bg,
        s,
        e,
        entry.fg || null,
        entry.id,
      ),
    )
}

// Each visually continuous run of a group keeps the group id; a run cut off by
// unhighlighted text gets its own new id. Whitespace-only gaps do not split a run.
function regroupModel(text) {
  model.sort((x, y) => x.s - y.s)
  const last = new Map() // original group id -> { id, e }
  const used = new Set()
  for (const r of model) {
    const original = r.g
    const info = last.get(original)
    let id
    if (
      info &&
      r.s >= info.e &&
      text.slice(info.e, r.s).trim() === ''
    ) {
      id = info.id
    } else {
      id = used.has(original) ? freshId() : original
    }
    used.add(id)
    last.set(original, { id, e: r.e })
    r.g = id
  }
}

function relocateModel(text) {
  const found = []
  for (const r of model) {
    const p = locateRun(text, r)
    if (p >= 0) {
      r.s = p
      r.e = p + r.t.length
      found.push(r)
    }
  }
  return found
}

// ---------- Rendering: make the page show the model ----------
const OBSERVE_OPTIONS = {
  childList: true,
  subtree: true,
  characterData: true,
}
let renderTimer = null

function unwrapAll() {
  for (const mark of [
    ...document.querySelectorAll('mark[data-hl-id]'),
  ]) {
    markGuards.get(mark)?.disconnect()
    const parent = mark.parentNode
    while (mark.firstChild)
      parent.insertBefore(mark.firstChild, mark)
    parent.removeChild(mark)
    parent.normalize()
  }
}

// ---------- Dark-mode filters (Dark Reader "filter" modes) ----------
// Those modes put a CSS filter on the page root, which also changes highlights and the popup.
// We compute the inverse of that filter as a color matrix and apply it to our own elements,
// so the filter cancels out and our colors show as chosen.
const INV_ID =
  'hl-inverse-filter-' + Math.random().toString(36).slice(2)
let invFilter = 'none'

const identity5 = () => [
  [1, 0, 0, 0, 0],
  [0, 1, 0, 0, 0],
  [0, 0, 1, 0, 0],
  [0, 0, 0, 1, 0],
  [0, 0, 0, 0, 1],
]

function mul5(A, B) {
  const C = []
  for (let i = 0; i < 5; i++) {
    C.push([])
    for (let j = 0; j < 5; j++) {
      let sum = 0
      for (let k = 0; k < 5; k++) sum += A[i][k] * B[k][j]
      C[i].push(sum)
    }
  }
  return C
}

// 3x3 color transform plus offsets, as a 5x5 homogeneous matrix (alpha untouched)
function fromColor(m3, off) {
  return [
    [m3[0][0], m3[0][1], m3[0][2], 0, off[0]],
    [m3[1][0], m3[1][1], m3[1][2], 0, off[1]],
    [m3[2][0], m3[2][1], m3[2][2], 0, off[2]],
    [0, 0, 0, 1, 0],
    [0, 0, 0, 0, 1],
  ]
}

function filterStep(name, v) {
  const zero = [0, 0, 0]
  if (name === 'invert')
    return fromColor(
      [
        [1 - 2 * v, 0, 0],
        [0, 1 - 2 * v, 0],
        [0, 0, 1 - 2 * v],
      ],
      [v, v, v],
    )
  if (name === 'brightness')
    return fromColor(
      [
        [v, 0, 0],
        [0, v, 0],
        [0, 0, v],
      ],
      zero,
    )
  if (name === 'contrast')
    return fromColor(
      [
        [v, 0, 0],
        [0, v, 0],
        [0, 0, v],
      ],
      [0.5 * (1 - v), 0.5 * (1 - v), 0.5 * (1 - v)],
    )
  const a = 1 - v
  if (name === 'grayscale')
    return fromColor(
      [
        [
          0.2126 + 0.7874 * a,
          0.7152 - 0.7152 * a,
          0.0722 - 0.0722 * a,
        ],
        [
          0.2126 - 0.2126 * a,
          0.7152 + 0.2848 * a,
          0.0722 - 0.0722 * a,
        ],
        [
          0.2126 - 0.2126 * a,
          0.7152 - 0.7152 * a,
          0.0722 + 0.9278 * a,
        ],
      ],
      zero,
    )
  if (name === 'sepia')
    return fromColor(
      [
        [
          0.393 + 0.607 * a,
          0.769 - 0.769 * a,
          0.189 - 0.189 * a,
        ],
        [
          0.349 - 0.349 * a,
          0.686 + 0.314 * a,
          0.168 - 0.168 * a,
        ],
        [
          0.272 - 0.272 * a,
          0.534 - 0.534 * a,
          0.131 + 0.869 * a,
        ],
      ],
      zero,
    )
  if (name === 'saturate')
    return fromColor(
      [
        [
          0.213 + 0.787 * v,
          0.715 - 0.715 * v,
          0.072 - 0.072 * v,
        ],
        [
          0.213 - 0.213 * v,
          0.715 + 0.285 * v,
          0.072 - 0.072 * v,
        ],
        [
          0.213 - 0.213 * v,
          0.715 - 0.715 * v,
          0.072 + 0.928 * v,
        ],
      ],
      zero,
    )
  if (name === 'hue-rotate') {
    const c = Math.cos(v),
      sn = Math.sin(v)
    return fromColor(
      [
        [
          0.213 + c * 0.787 - sn * 0.213,
          0.715 - c * 0.715 - sn * 0.715,
          0.072 - c * 0.072 + sn * 0.928,
        ],
        [
          0.213 - c * 0.213 + sn * 0.143,
          0.715 + c * 0.285 + sn * 0.14,
          0.072 - c * 0.072 - sn * 0.283,
        ],
        [
          0.213 - c * 0.213 - sn * 0.787,
          0.715 - c * 0.715 + sn * 0.715,
          0.072 + c * 0.928 + sn * 0.072,
        ],
      ],
      zero,
    )
  }
  return identity5()
}

// The color matrix of a computed CSS filter string such as "invert(1) hue-rotate(180deg)"
function filterMatrix(str) {
  let M = identity5()
  if (!str || str === 'none') return M
  for (const m of str.matchAll(/([a-z-]+)\(([^)]*)\)/g)) {
    const raw = m[2].trim()
    const num = parseFloat(raw)
    const v =
      m[1] === 'hue-rotate'
        ? (num * Math.PI) / 180
        : raw.endsWith('%')
          ? num / 100
          : isNaN(num)
            ? 1
            : num
    M = mul5(filterStep(m[1], v), M)
  }
  return M
}

// Inverse of a 5x5 matrix (Gauss-Jordan); null if it is singular
function invert5(M) {
  const A = M.map((row, i) => [...row, ...identity5()[i]])
  for (let c = 0; c < 5; c++) {
    let p = c
    for (let r = c + 1; r < 5; r++)
      if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r
    if (Math.abs(A[p][c]) < 1e-9) return null
    ;[A[c], A[p]] = [A[p], A[c]]
    const d = A[c][c]
    for (let k = 0; k < 10; k++) A[c][k] /= d
    for (let r = 0; r < 5; r++) {
      if (r === c) continue
      const f = A[r][c]
      for (let k = 0; k < 10; k++) A[r][k] -= f * A[c][k]
    }
  }
  return A.map((row) => row.slice(5))
}

function setInverseFilterValues(M) {
  const svg = document.getElementById(INV_ID + '-svg')
  if (!svg) return
  const values = M.slice(0, 4)
    .flat()
    .map((x) => x.toFixed(6))
    .join(' ')
  svg
    .querySelector('feColorMatrix')
    .setAttribute('values', values)
}

// Key of the page's current filters, so changes are detected whatever mechanism sets them
let compensatedFor = null
function pageFilterKey() {
  return (
    getComputedStyle(document.documentElement).filter +
    '|' +
    getComputedStyle(document.body).filter
  )
}

// Recompute the compensation whenever the page's filter changes
function updateInverseFilter() {
  compensatedFor = pageFilterKey()
  const page = mul5(
    filterMatrix(
      getComputedStyle(document.documentElement).filter,
    ),
    filterMatrix(getComputedStyle(document.body).filter),
  )
  const isIdentity = page.every((row, i) =>
    row.every((x, j) => Math.abs(x - (i === j ? 1 : 0)) < 1e-6),
  )
  const inverse = isIdentity ? null : invert5(page)
  if (inverse) {
    setInverseFilterValues(inverse)
    invFilter = `url(#${INV_ID})`
  } else {
    invFilter = 'none'
  }
  host.style.setProperty('filter', invFilter)
  for (const mark of document.querySelectorAll(
    'mark[data-hl-id]',
  )) {
    mark.style.setProperty('filter', invFilter, 'important')
  }
}

// Highlight colors are always explicit and !important, so page or dark-mode CSS
// cannot make a highlight unreadable (text color is never inherited from the page).
const markGuards = new WeakMap()

function applyMarkColors(mark) {
  const { bg, fg } = mark._hlColors
  mark.style.setProperty('background-color', bg, 'important')
  mark.style.setProperty('color', fg, 'important')
  mark.style.setProperty('filter', invFilter, 'important')
}

// If a page or a dark-mode extension rewrites a highlight's inline colors, restore ours.
// At most three restores per second per highlight, so the two can never loop.
function guardMark(mark) {
  const guard = new MutationObserver(() => {
    const { bg, fg } = mark._hlColors
    if (
      mark.style.getPropertyValue('background-color') === bg &&
      mark.style.getPropertyValue('color') === fg
    )
      return
    const now = Date.now()
    mark._hlRestores = (mark._hlRestores || []).filter(
      (t) => now - t < 1000,
    )
    if (mark._hlRestores.length >= 3) return
    mark._hlRestores.push(now)
    guard.disconnect()
    applyMarkColors(mark)
    guard.observe(mark, {
      attributes: true,
      attributeFilter: ['style'],
    })
  })
  guard.observe(mark, {
    attributes: true,
    attributeFilter: ['style'],
  })
  markGuards.set(mark, guard)
}

function paintMark(mark, { bg, fg }) {
  mark._hlColors = {
    bg,
    fg: fg || (isDarkColor(bg) ? '#ffffff' : '#222222'),
  }
  applyMarkColors(mark)
  if (!markGuards.has(mark)) guardMark(mark)
}

// Wrap one run of page text in a mark with its group and color
function wrapRun(run) {
  const { g, s, e } = run
  for (const { node, start } of buildTextIndex()) {
    const end = start + node.nodeValue.length
    if (end <= s || start >= e) continue
    const from = Math.max(s, start) - start
    const to = Math.min(e, end) - start
    if (from >= to) continue

    let target = node
    if (to < target.nodeValue.length) target.splitText(to)
    if (from > 0) target = target.splitText(from)

    const mark = document.createElement('mark')
    mark.dataset.hlId = g
    paintMark(mark, resolveRun(run))
    target.parentNode.insertBefore(mark, target)
    mark.appendChild(target)
  }
}

const observer = new MutationObserver(() => scheduleRender())

function scheduleRender() {
  clearTimeout(renderTimer)
  renderTimer = setTimeout(() => {
    // Do not disturb the page while the user is selecting text
    const sel = window.getSelection()
    if (sel && !sel.isCollapsed) return scheduleRender()
    render()
  }, 400)
}

function render() {
  observer.disconnect()
  linkLegacyRuns()
  try {
    const found = relocateModel(pageText())
    unwrapAll()
    found.sort((x, y) => x.s - y.s).forEach(wrapRun)
  } catch (err) {
    console.warn('[highlight] render failed', err)
  } finally {
    observer.observe(document.body, OBSERVE_OPTIONS)
  }
}

// ---------- Saving and loading ----------
let lastSavedJson = null

// ---------- Undo history ----------
// Every saved change pushes the state before it. Undo restores the last one.
const UNDO_LIMIT = 100
const undoStack = []
const redoStack = []
let lastCommitted = null // JSON of the model as of the last save

// Move one step through the history: take the state from `source` and keep the current one in `target`
function stepHistory(source, target) {
  if (!source.length) return false
  target.push(lastCommitted)
  lastCommitted = source.pop()
  model = JSON.parse(lastCommitted)
  hidePopup()
  render()
  persistModel()
  return true
}

function undoLast() {
  return stepHistory(undoStack, redoStack)
}

function redoLast() {
  return stepHistory(redoStack, undoStack)
}

async function saveModel() {
  const now = JSON.stringify(model)
  if (lastCommitted !== null && now !== lastCommitted) {
    undoStack.push(lastCommitted)
    redoStack.length = 0
    if (undoStack.length > UNDO_LIMIT) undoStack.shift()
  }
  lastCommitted = now
  await persistModel()
}

async function persistModel() {
  const entries = model.map(
    ({ g, c, f, p, n, o, s, e, t, pre, suf }) => ({
      g,
      c,
      f: f || null,
      p: p || null,
      n: n || null,
      o: o || null,
      s,
      e,
      t,
      pre,
      suf,
    }),
  )
  lastSavedJson = JSON.stringify(entries)
  try {
    await chrome.storage.local.set({
      [STORAGE_KEY]: entries,
      dataVersion: DATA_VERSION,
    })
  } catch (err) {
    console.warn('[highlight] save failed', err)
  }
}

// Keys written by earlier versions that this version no longer uses
const LEGACY_KEYS = ['lastBackupSig', 'restoreHint']

// Repairs stored highlight runs from any earlier version. Safe to run on current data too.
function migrateEntries(raw) {
  const out = []
  const seen = new Set()
  for (const x of Array.isArray(raw) ? raw : []) {
    // Unusable runs are dropped: no text, or no position
    if (
      !x ||
      typeof x.t !== 'string' ||
      !x.t ||
      typeof x.s !== 'number' ||
      !isFinite(x.s)
    )
      continue
    const s0 = Math.max(0, Math.floor(x.s))
    const g = typeof x.g === 'string' && x.g ? x.g : freshId()
    // Colors saved as names (earlier versions) become hex; missing colors get the first slot's
    let c =
      typeof x.c === 'string' && x.c ? resolveBg(x.c) : null
    if (!c && !x.p) c = DEFAULT_PALETTE[0].bg
    const key = g + '|' + s0 + '|' + x.t
    if (seen.has(key)) continue // duplicate run
    seen.add(key)
    out.push({
      g,
      c,
      f: typeof x.f === 'string' ? x.f : null,
      p: typeof x.p === 'string' ? x.p : null,
      n:
        typeof x.n === 'string' && x.n.trim()
          ? x.n.trim().slice(0, 200)
          : null,
      o: typeof x.o === 'string' ? x.o : null,
      s: s0,
      e: s0 + x.t.length,
      t: x.t,
      pre: typeof x.pre === 'string' ? x.pre : '',
      suf: typeof x.suf === 'string' ? x.suf : '',
    })
  }
  return out
}

async function loadModel() {
  try {
    const data = await chrome.storage.local.get([
      STORAGE_KEY,
      'dataVersion',
    ])
    const raw = data[STORAGE_KEY] || []
    model = migrateEntries(raw)
    lastCommitted = JSON.stringify(model)
    // Write back repaired or older-format data with the current stamp
    if (raw.length && data.dataVersion !== DATA_VERSION)
      saveModel()
  } catch (err) {
    console.warn('[highlight] load failed', err)
  }
  render()
}

// ---------- Fuzzy relocation (exact first, then 80%+ similar near the old position) ----------
function editDistance(a, b, k) {
  if (Math.abs(a.length - b.length) > k) return k + 1
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const v = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + cost,
      )
      cur[j] = v
      if (v < rowMin) rowMin = v
    }
    if (rowMin > k) return k + 1
    prev = cur
  }
  return prev[b.length]
}

function locateRun(pageText, run) {
  const { t, s, pre, suf } = run
  if (!t) return -1

  const exact = []
  for (
    let p = pageText.indexOf(t);
    p !== -1;
    p = pageText.indexOf(t, p + 1)
  )
    exact.push(p)
  if (exact.length) {
    const contextOk = (p) =>
      pageText.slice(Math.max(0, p - pre.length), p) === pre ||
      pageText.slice(
        p + t.length,
        p + t.length + suf.length,
      ) === suf
    const pool = exact.filter(contextOk).length
      ? exact.filter(contextOk)
      : exact
    return pool.reduce((best, p) =>
      Math.abs(p - s) < Math.abs(best - s) ? p : best,
    )
  }

  if (t.length < 20) return -1
  const m = t.length
  const maxK = Math.floor(m * 0.2)
  const lo = Math.max(0, s - 3000)
  const hi = Math.min(pageText.length - m, s + 3000)
  let best = -1
  let bestScore = 0.8
  for (let p = lo; p <= hi; p++) {
    const d = editDistance(pageText.slice(p, p + m), t, maxK)
    const score = 1 - d / m
    if (score >= bestScore) {
      best = p
      bestScore = score
    }
  }
  return best
}

// ---------- Popup ----------
function positionPopup() {
  if (!anchorRect) return
  popup.classList.add('show')
  const h = popup.offsetHeight
  const w = popup.offsetWidth

  const vh = window.innerHeight
  const spaceBelow = vh - anchorRect.bottom
  const spaceAbove = anchorRect.top
  const belowTop = anchorRect.bottom + GAP
  const aboveTop = anchorRect.top - h - GAP
  const fitsBelow = belowTop + h <= vh - 8
  const fitsAbove = aboveTop >= 8

  let below
  if (placement === 'above') below = false
  else if (placement === 'below') below = true
  else below = spaceBelow >= h + GAP || spaceBelow >= spaceAbove

  let top
  if (below && fitsBelow) top = belowTop
  else if (!below && fitsAbove) top = aboveTop
  else if (fitsBelow) top = belowTop
  else if (fitsAbove) top = aboveTop
  else {
    // No room above or below (selection spans the page): sit on the selection, centered, kept in view
    const center =
      anchorRect.top + anchorRect.height / 2 - h / 2
    top = Math.max(8, Math.min(center, vh - h - 8))
  }

  let left = anchorRect.left + anchorRect.width / 2 - w / 2
  left = Math.max(8, Math.min(left, window.innerWidth - w - 8))

  popup.style.top = top + 'px'
  popup.style.left = left + 'px'
}

// "+" edits a group's note, or, on a selection with no highlighted text in it,
// highlights the selection with palette color 1 and adds a note. Hidden if any highlight is selected.
function updateNoteButton() {
  const btn = shadow.querySelector('[data-action="note"]')
  let show = false
  if (savedGroupId) {
    show = true
    btn.dataset.tip = 'Add or Edit Tooltip Note'
  } else if (savedSpan) {
    relocateModel(pageText())
    const [a, b] = savedSpan
    show = !model.some((r) => r.e > a && r.s < b)
    btn.dataset.tip = 'Add Tooltip Note and Highlight'
  }
  btn.hidden = !show
}

function highlightWithNote() {
  if (!savedSpan) return
  const [a, b] = savedSpan
  const text = pageText()
  relocateModel(text)
  applyToModel(text, a, b, palette[0], freshId())
  regroupModel(text)
  const first = model
    .filter((r) => r.e > a && r.s < b)
    .sort((x, y) => x.s - y.s)[0]
  savedGroupId = first ? first.g : null
  savedSpan = null
  window.getSelection().removeAllRanges()
  render()
  saveModel()
  if (!savedGroupId) return
  updateNoteButton()
  openNoteBox()
}

function openPopup(rect) {
  anchorRect = rect
  updateNoteButton()
  // Deselect only applies to a text selection, so hide it when a group is opened by click
  shadow.querySelector('[data-action="deselect"]').hidden =
    !!savedGroupId
  if (savedGroupId) {
    popup.classList.add('show')
    showTip(savedGroupId, true)
    layoutGroup()
  } else {
    hideTip()
    positionPopup()
  }
}

function hidePopup() {
  popup.classList.remove('show')
  updateHandles()
  closeNoteBox()
  hideTip()
  shadow.getElementById('toast').classList.remove('show')
  savedSpan = null
  savedGroupId = null
  anchorRect = null
}

// Small "Copied!" note next to the copy button, and the copy icon becomes a check briefly
function showCopiedToast(btn) {
  const toast = shadow.getElementById('toast')
  const above = popup.getBoundingClientRect().top > 36
  toast.classList.toggle('above', above)
  toast.classList.toggle('below', !above)
  toast.style.left = btn.offsetLeft + btn.offsetWidth / 2 + 'px'
  toast.classList.add('show')

  const icon = btn.querySelector('.ico')
  icon.style.setProperty('--icon', `url(${ICONS.check})`)
  icon.classList.add('ok')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.classList.remove('show')
    icon.style.setProperty('--icon', `url(${ICONS.copy})`)
    icon.classList.remove('ok')
  }, 1500)
}

// Text of one group, pieces joined with a space
function groupText(groupId) {
  return model
    .filter((r) => r.g === groupId)
    .sort((x, y) => x.s - y.s)
    .map((r) => r.t)
    .join(' ')
}

// ---------- Tooltip notes ----------
const tip = shadow.getElementById('tip')
const note = shadow.getElementById('note')
const noteInput = shadow.getElementById('noteInput')
let tipGroupId = null // group whose note is shown
let tipPinned = false // true while its popup is open (click), false for hover
let noteGroupId = null // group whose note is being edited
let altHeld = false // while Alt is held, tooltips stay and can be edited
let tipHovered = false // pointer is over the tooltip

function overlaps(a, b) {
  return !(
    a.right <= b.left ||
    a.left >= b.right ||
    a.bottom <= b.top ||
    a.top >= b.bottom
  )
}

// Place a box below the anchor, or above it if below has no room; never over `avoid`
function fitBox(el, rect, avoid) {
  const w = el.offsetWidth
  const h = el.offsetHeight
  const vh = window.innerHeight
  const left = Math.max(
    8,
    Math.min(
      rect.left + rect.width / 2 - w / 2,
      window.innerWidth - w - 8,
    ),
  )
  for (const top of [rect.bottom + GAP, rect.top - h - GAP]) {
    if (top < 8 || top + h > vh - 8) continue
    const box = { left, right: left + w, top, bottom: top + h }
    if (avoid && overlaps(box, avoid)) continue
    el.style.left = left + 'px'
    el.style.top = top + 'px'
    return true
  }
  return false
}

function noteOf(groupId) {
  const r = model.find((x) => x.g === groupId && x.n)
  return r ? r.n : ''
}

function setInteractive(on) {
  tip.classList.toggle('interactive', on)
  tip.contentEditable = on ? 'true' : 'false'
}

function hideTip() {
  if (shadow.activeElement === tip) tip.blur() // commits the edit
  tip.classList.remove('show')
  setInteractive(false)
  tipGroupId = null
  tipPinned = false
}

function setGroupNote(groupId, text) {
  model.forEach((r) => {
    if (r.g !== groupId) return
    if (text) r.n = text
    else delete r.n
  })
  saveModel()
  render()
}

// Save the tooltip text as the group's note
function commitTipEdit() {
  if (!tipGroupId) return
  const groupId = tipGroupId
  const text = tip.textContent.trim().slice(0, 200)
  if (text === noteOf(groupId)) return
  model.forEach((r) => {
    if (r.g !== groupId) return
    if (text) r.n = text
    else delete r.n
  })
  saveModel()
  render()
  if (!text) hideTip()
  else layoutGroup()
}

tip.addEventListener('blur', commitTipEdit)
tip.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    tip.blur()
  } else if (e.key === 'Escape') {
    tip.textContent = noteOf(tipGroupId)
    tip.blur()
  }
})

// Group popup and tooltip share one row, directly above the start of the group's text
// (left edge for LTR, right edge for RTL). The popup sits right beside the tooltip.
// If there is no room above, the row goes below the text; at screen edges it uses the
// nearest free spot. Popup placement "below" (up/down arrows) puts the row below the text.
function layoutGroup() {
  const groupId = savedGroupId || tipGroupId
  const mark =
    groupId &&
    document.querySelector(`mark[data-hl-id="${groupId}"]`)
  if (!mark) {
    hideTip()
    return
  }

  const showPopup =
    !!savedGroupId && popup.classList.contains('show')
  const showNote =
    !!tipGroupId && tipGroupId === groupId && !!noteOf(groupId)
  if (!showPopup && !showNote) {
    tip.classList.remove('show')
    return
  }

  tip.classList.toggle('show', showNote)
  if (showNote && shadow.activeElement !== tip)
    tip.textContent = noteOf(groupId)
  if (showPopup) popup.classList.add('show')

  const rtl = getComputedStyle(mark).direction === 'rtl'
  const start =
    mark.getClientRects()[0] || mark.getBoundingClientRect()
  const tw = showNote ? tip.offsetWidth : 0
  const th = showNote ? tip.offsetHeight : 0
  const pw = showPopup ? popup.offsetWidth : 0
  const ph = showPopup ? popup.offsetHeight : 0
  const gap = showNote && showPopup ? 4 : 0
  const W = tw + gap + pw
  const H = Math.max(th, ph)
  const vw = window.innerWidth
  const vh = window.innerHeight

  let x = rtl ? start.right - W : start.left
  x = Math.max(8, Math.min(x, vw - W - 8))

  const above = start.top - H - GAP
  const below = start.bottom + GAP
  const preferBelow = showPopup && placement === 'below'
  const tops = preferBelow ? [below, above] : [above, below]
  tops.push(8, vh - H - 8)
  const y = tops.find((t) => t >= 8 && t + H <= vh - 8)
  if (y === undefined) {
    tip.classList.remove('show')
    return
  }

  if (showNote) {
    tip.style.left = (rtl ? x + pw + gap : x) + 'px'
    tip.style.top = y + (H - th) / 2 + 'px' // vertically centered in the row
  }
  if (showPopup) {
    popup.style.left = (rtl ? x : x + tw + gap) + 'px'
    popup.style.top = y + (H - ph) / 2 + 'px' // vertically centered in the row
  }
  updateHandles()
}

function positionTip() {
  layoutGroup()
}

function showTip(groupId, pinned) {
  const text = noteOf(groupId)
  if (!text) {
    hideTip()
    return
  }
  tipGroupId = groupId
  tipPinned = pinned
  tip.textContent = text
  setInteractive(pinned || altHeld)
  positionTip()
}

function openNoteBox() {
  if (!savedGroupId) return
  hideTip()
  noteGroupId = savedGroupId
  noteInput.value = noteOf(noteGroupId)
  note.classList.add('show')
  const pr = popup.getBoundingClientRect()
  if (!fitBox(note, pr, null)) {
    note.style.left = pr.left + 'px'
    note.style.top =
      Math.max(
        8,
        Math.min(
          pr.top,
          window.innerHeight - note.offsetHeight - 8,
        ),
      ) + 'px'
  }
  noteInput.focus()
}

function closeNoteBox() {
  note.classList.remove('show')
  noteGroupId = null
}

function commitNote() {
  if (!noteGroupId) return
  const groupId = noteGroupId
  const text = noteInput.value.trim().slice(0, 200)
  model.forEach((r) => {
    if (r.g !== groupId) return
    if (text) r.n = text
    else delete r.n
  })
  saveModel()
  render()
  closeNoteBox()
  if (
    popup.classList.contains('show') &&
    savedGroupId === groupId
  )
    showTip(groupId, true)
}

function cancelNote() {
  closeNoteBox()
  if (popup.classList.contains('show') && savedGroupId)
    showTip(savedGroupId, true)
}

shadow
  .getElementById('noteOk')
  .addEventListener('click', commitNote)
noteInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') commitNote()
  else if (e.key === 'Escape') cancelNote()
})

// Hover shows the note while no popup is open
document.addEventListener('mouseover', (e) => {
  if (host.contains(e.target)) return
  const mark =
    e.target.closest && e.target.closest('mark[data-hl-id]')
  if (!mark || popup.classList.contains('show') || tipPinned)
    return
  showTip(mark.dataset.hlId, false)
})
document.addEventListener('mouseout', (e) => {
  const mark =
    e.target.closest && e.target.closest('mark[data-hl-id]')
  if (!mark || tipPinned) return
  if (altHeld) return // Alt held: the tooltip stays so the pointer can reach it
  if (e.relatedTarget && mark.contains(e.relatedTarget)) return
  if (tipGroupId === mark.dataset.hlId) hideTip()
})
tip.addEventListener('mouseenter', () => {
  tipHovered = true
})
tip.addEventListener('mouseleave', () => {
  tipHovered = false
  if (!altHeld && !tipPinned && shadow.activeElement !== tip)
    hideTip()
})
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Alt') return
  altHeld = true
  if (tipGroupId && !tipPinned) setInteractive(true)
})
window.addEventListener('keyup', (e) => {
  if (e.key !== 'Alt') return
  altHeld = false
  if (tipGroupId && !tipPinned) {
    if (!tipHovered && shadow.activeElement !== tip) hideTip()
    else if (shadow.activeElement !== tip) setInteractive(false)
  }
})
window.addEventListener('blur', () => {
  altHeld = false
})
window.addEventListener(
  'scroll',
  () => {
    if (
      tipGroupId ||
      (savedGroupId && popup.classList.contains('show'))
    )
      layoutGroup()
  },
  true,
)

// ---------- Merging two groups ----------
// Merged id for (a, b): "m:" + enc(a) + ":" + enc(b). Decoding gives back a and b.
function mergedId(a, b) {
  return (
    'm:' + encodeURIComponent(a) + ':' + encodeURIComponent(b)
  )
}
function mergedFirst(x) {
  return decodeURIComponent(x.slice(2).split(':')[0])
}
function mergedSecond(x) {
  return decodeURIComponent(x.slice(2).split(':')[1])
}

// Split a merged group back into the two groups it was made from
function splitGroup(x) {
  if (!x.startsWith('m:')) return { ok: false }
  const a = mergedFirst(x)
  const b = mergedSecond(x)
  const runs = model.filter((r) => r.g === x)
  if (!runs.length) return { ok: false }
  const note = noteOf(x)
  runs.forEach((r) => {
    r.g = r.o === a ? a : r.o === b ? b : x
    delete r.o
    if (note) r.n = note
  })
  saveModel()
  render()
  return { ok: true }
}

// Merge two groups that are neighbors in the popup list. Checked only when called.
function mergeGroups(a, b) {
  const list = listGroups()
  const ia = list.findIndex((g) => g.id === a)
  const ib = list.findIndex((g) => g.id === b)
  if (ia < 0 || ib < 0 || Math.abs(ia - ib) !== 1)
    return { ok: false }

  const [first, second] =
    ia < ib ? [list[ia], list[ib]] : [list[ib], list[ia]]
  if (
    first.bgColor !== second.bgColor ||
    first.fgColor !== second.fgColor
  )
    return { ok: false }

  const text = pageText()
  relocateModel(text)
  const runsA = model.filter((r) => r.g === first.id)
  const runsB = model.filter((r) => r.g === second.id)
  if (!runsA.length || !runsB.length) return { ok: false }

  // Boundary must be continuous: only whitespace between the end of one and the start of the other
  const endA = Math.max(...runsA.map((r) => r.e))
  const startA = Math.min(...runsA.map((r) => r.s))
  const endB = Math.max(...runsB.map((r) => r.e))
  const startB = Math.min(...runsB.map((r) => r.s))
  const touching =
    (endA <= startB &&
      text.slice(endA, startB).trim() === '') ||
    (endB <= startA && text.slice(endB, startA).trim() === '')
  if (!touching) return { ok: false }

  const x = mergedId(first.id, second.id)
  const note = noteOf(first.id) || noteOf(second.id)
  model.forEach((r) => {
    if (r.g !== first.id && r.g !== second.id) return
    r.o = r.g // original group, used to split back
    r.g = x
    if (note) r.n = note
    else delete r.n
  })
  saveModel()
  render()
  return { ok: true, id: x }
}

// ---------- Quick highlight: Ctrl+K highlights the selection with "default" ----------
// True when a keyboard event matches one of the shortcut settings above
function matchesShortcut(e, shortcut) {
  const modifier = e.ctrlKey || e.metaKey
  return (
    modifier === shortcut.ctrl &&
    e.shiftKey === shortcut.shift &&
    e.altKey === shortcut.alt &&
    e.key.toLowerCase() === shortcut.key
  )
}

function quickHighlight() {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed) return false
  const span = rangeToSpan(sel.getRangeAt(0))
  if (!span) return false
  const [a, b] = span
  const text = pageText()
  relocateModel(text)
  if (model.some((r) => r.e > a && r.s < b)) return false // same rule as "+"
  applyToModel(text, a, b, palette[0], freshId())
  regroupModel(text)
  sel.removeAllRanges()
  savedSpan = null
  render()
  saveModel()
  return true
}

document.addEventListener('keydown', (e) => {
  if (!matchesShortcut(e, SHORTCUT_QUICK_HIGHLIGHT)) return
  const t = e.target
  if (
    t &&
    (t.isContentEditable ||
      /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
  )
    return
  if (quickHighlight()) e.preventDefault()
})

// Ctrl+E: same as the trash button. Erases the active group, or else the selected text.
function eraseHighlight() {
  const text = pageText()
  if (savedGroupId) {
    model = model.filter((r) => r.g !== savedGroupId)
  } else {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return false
    const span = rangeToSpan(sel.getRangeAt(0))
    if (!span) return false
    relocateModel(text)
    cutSpan(text, span[0], span[1])
    regroupModel(text)
  }
  window.getSelection().removeAllRanges()
  hidePopup()
  render()
  saveModel()
  return true
}

document.addEventListener('keydown', (e) => {
  if (!matchesShortcut(e, SHORTCUT_UNDO)) return
  const t = e.target
  if (
    t &&
    (t.isContentEditable ||
      /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
  )
    return
  if (undoLast()) e.preventDefault()
})

document.addEventListener('keydown', (e) => {
  if (!matchesShortcut(e, SHORTCUT_REDO)) return
  const t = e.target
  if (
    t &&
    (t.isContentEditable ||
      /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
  )
    return
  if (redoLast()) e.preventDefault()
})

document.addEventListener('keydown', (e) => {
  if (!matchesShortcut(e, SHORTCUT_ERASE)) return
  const t = e.target
  if (
    t &&
    (t.isContentEditable ||
      /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
  )
    return
  if (eraseHighlight()) e.preventDefault()
})

// ---------- Resize handles: drag a group's edges like a video trim ----------
const hL = shadow.getElementById('hL')
const hR = shadow.getElementById('hR')
let drag = null // { side, id } while a handle is dragged
let dragPos = null // latest page offset under the pointer
let dragFrame = null

// Rectangle of the character at page offset `off`
function charRect(off) {
  for (const { node, start } of buildTextIndex()) {
    const len = node.nodeValue.length
    if (off >= start && off < start + len) {
      const r = document.createRange()
      r.setStart(node, off - start)
      r.setEnd(node, off - start + 1)
      return r.getBoundingClientRect()
    }
  }
  return null
}

// Place the two handles just outside the group's first and last characters
function updateHandles() {
  const hide = () => {
    hL.hidden = true
    hR.hidden = true
  }
  if (!savedGroupId || !popup.classList.contains('show'))
    return hide()
  const runs = model.filter((r) => r.g === savedGroupId)
  if (!runs.length) return hide()
  const s0 = Math.min(...runs.map((r) => r.s))
  const e0 = Math.max(...runs.map((r) => r.e))
  const left = charRect(s0)
  const right = charRect(e0 - 1)
  if (!left || !right) return hide()
  hL.hidden = false
  hR.hidden = false
  const hh = left.height * HANDLE_HEIGHT
  const hr = right.height * HANDLE_HEIGHT
  hL.style.left = left.left - HANDLE_WIDTH + 'px'
  hL.style.top = left.top + (left.height - hh) / 2 + 'px'
  hL.style.height = hh + 'px'
  hR.style.left = right.right + 'px'
  hR.style.top = right.top + (right.height - hr) / 2 + 'px'
  hR.style.height = hr + 'px'
}

// Page offset of the text boundary under the pointer, or null
function pageOffsetAt(x, y) {
  let node
  let offset
  if (document.caretPositionFromPoint) {
    const p = document.caretPositionFromPoint(x, y)
    if (!p) return null
    node = p.offsetNode
    offset = p.offset
  } else {
    const r = document.caretRangeFromPoint(x, y)
    if (!r) return null
    node = r.startContainer
    offset = r.startOffset
  }
  if (!node || node.nodeType !== Node.TEXT_NODE) return null
  const entry = buildTextIndex().find((en) => en.node === node)
  return entry ? entry.start + offset : null
}

// Move one edge of a group to page offset `pos`. Extending overrides other highlights;
// shrinking releases text. Returns false if nothing changed.
function resizeGroup(id, side, pos) {
  const text = pageText()
  relocateModel(text)
  const runs = model.filter((r) => r.g === id)
  if (!runs.length) return false
  const curS = Math.min(...runs.map((r) => r.s))
  const curE = Math.max(...runs.map((r) => r.e))
  const proto = runs[0]

  if (side === 'left') {
    pos = Math.min(pos, curE - 1)
    if (pos === curS) return false
    if (pos < curS) {
      cutSpan(text, pos, curS)
      model.push(
        keepNote(
          makeRun(
            text,
            id,
            proto.c,
            pos,
            curS,
            proto.f,
            proto.p,
          ),
          proto,
        ),
      )
    } else {
      cutSpan(text, curS, pos)
    }
  } else {
    pos = Math.max(pos, curS + 1)
    if (pos === curE) return false
    if (pos > curE) {
      cutSpan(text, curE, pos)
      model.push(
        keepNote(
          makeRun(
            text,
            id,
            proto.c,
            curE,
            pos,
            proto.f,
            proto.p,
          ),
          proto,
        ),
      )
    } else {
      cutSpan(text, pos, curE)
    }
  }
  return true
}

function scheduleDrag() {
  if (dragFrame) return
  dragFrame = requestAnimationFrame(() => {
    dragFrame = null
    if (!drag || dragPos === null) return
    if (resizeGroup(drag.id, drag.side, dragPos)) {
      render()
      layoutGroup()
    }
  })
}

function endDrag() {
  if (!drag) return
  drag = null
  host.style.pointerEvents = ''
  saveModel()
  layoutGroup()
}

for (const [el, side] of [
  [hL, 'left'],
  [hR, 'right'],
]) {
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    el.setPointerCapture(e.pointerId)
    drag = { side, id: savedGroupId }
    // Let the pointer's position resolve to page text while dragging
    host.style.pointerEvents = 'none'
  })
  el.addEventListener('pointermove', (e) => {
    if (!drag) return
    const pos = pageOffsetAt(e.clientX, e.clientY)
    if (pos === null) return
    dragPos = pos
    scheduleDrag()
  })
  el.addEventListener('pointerup', endDrag)
  el.addEventListener('pointercancel', endDrag)
}

// Catppuccin tooltips for any element with data-tip (replaces native title tooltips)
function showDataTip(el) {
  const text = el.dataset.tip
  if (!text) return
  DATA_TIP.textContent = text
  DATA_TIP.classList.add('show')
  const r = el.getBoundingClientRect()
  const w = DATA_TIP.offsetWidth
  const h = DATA_TIP.offsetHeight
  const vw = window.innerWidth
  const vh = window.innerHeight
  const left = Math.max(
    4,
    Math.min(r.left + r.width / 2 - w / 2, vw - w - 4),
  )
  const above = r.top - h - 6
  const below = r.bottom + 6
  const top =
    above >= 4
      ? above
      : below + h <= vh - 4
        ? below
        : Math.max(4, vh - h - 4)
  DATA_TIP.style.left = left + 'px'
  DATA_TIP.style.top = top + 'px'
}

function hideDataTip() {
  DATA_TIP.classList.remove('show')
}

shadow.addEventListener('mouseover', (e) => {
  const el = e.target.closest && e.target.closest('[data-tip]')
  if (el) showDataTip(el)
})
shadow.addEventListener('mouseout', (e) => {
  const el = e.target.closest && e.target.closest('[data-tip]')
  if (el && !el.contains(e.relatedTarget)) hideDataTip()
})

// Listen in the capture phase, before page scripts can stop the event (GitHub does)
function listenCapture(type, handler) {
  document.addEventListener(type, handler, true)
}

// ---------- Event handlers ----------
// Keep the page selection alive while clicking the popup
shadow.addEventListener('mousedown', (e) => {
  if (
    e.target.closest &&
    e.target.closest('input, .tip, .handle')
  )
    return
  e.preventDefault()
})

shadow.addEventListener('click', async (e) => {
  const swatch = e.target.closest('.swatch')
  if (swatch) {
    const entry = palette[Number(swatch.dataset.index)]
    if (savedGroupId) {
      model.forEach((r) => {
        if (r.g === savedGroupId) {
          r.c = entry.bg
          r.f = entry.fg || null
          r.p = entry.id
        }
      })
    } else if (savedSpan) {
      const text = pageText()
      relocateModel(text)
      applyToModel(
        text,
        savedSpan[0],
        savedSpan[1],
        entry,
        freshId(),
      )
      regroupModel(text)
    }
    window.getSelection().removeAllRanges()
    hidePopup()
    render()
    saveModel()
    return
  }

  const action = e.target.closest('.action')
  if (!action) return

  switch (action.dataset.action) {
    case 'note': {
      if (savedGroupId) openNoteBox()
      else highlightWithNote()
      break
    }
    case 'copy': {
      let text = ''
      if (savedGroupId) text = groupText(savedGroupId)
      else if (savedSpan)
        text = pageText().slice(savedSpan[0], savedSpan[1])
      if (text) {
        try {
          await navigator.clipboard.writeText(text)
          showCopiedToast(action)
        } catch (err) {
          console.warn('[highlight] copy failed', err)
        }
      }
      break
    }
    case 'remove': {
      const text = pageText()
      if (savedGroupId) {
        model = model.filter((r) => r.g !== savedGroupId)
      } else if (savedSpan) {
        relocateModel(text)
        cutSpan(text, savedSpan[0], savedSpan[1])
        regroupModel(text)
      }
      window.getSelection().removeAllRanges()
      hidePopup()
      render()
      saveModel()
      break
    }
    case 'deselect': {
      window.getSelection().removeAllRanges()
      hidePopup()
      break
    }
    case 'hide': {
      hidePopup() // keep the selection, just close the popup
      break
    }
    case 'up':
    case 'down': {
      placement =
        action.dataset.action === 'up' ? 'above' : 'below'
      chrome.storage.local.set({ [PLACEMENT_KEY]: placement })
      if (savedGroupId) layoutGroup()
      else positionPopup()
      break
    }
  }
})

// Clicking an existing highlight opens the popup for its whole group
listenCapture('click', (e) => {
  if (host.contains(e.target)) return
  const selection = window.getSelection()
  if (selection && !selection.isCollapsed) return // user was selecting, not clicking
  const mark =
    e.target.closest && e.target.closest('mark[data-hl-id]')
  if (!mark) return
  savedGroupId = mark.dataset.hlId
  savedSpan = null
  openPopup(mark.getBoundingClientRect())
})

// Clicking anywhere outside the popup or a highlight closes the popup
listenCapture('mousedown', (e) => {
  if (host.contains(e.target)) return
  if (e.target.closest && e.target.closest('mark[data-hl-id]'))
    return
  hidePopup()
})

listenCapture('mouseup', (e) => {
  if (host.contains(e.target)) return
  const selection = window.getSelection()
  if (
    !selection ||
    selection.isCollapsed ||
    !selection.toString().trim()
  )
    return
  const range = selection.getRangeAt(0)
  const span = rangeToSpan(range)
  if (!span) return
  savedSpan = span
  savedGroupId = null
  openPopup(range.getBoundingClientRect())
})

document.addEventListener('selectionchange', () => {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed) {
    if (!savedGroupId) hidePopup()
    scheduleRender()
  }
})

// ---------- Toolbar popup support: list groups in page order and scroll to one ----------
// The nearest block-level element around a text node (inline elements are skipped)
function blockOf(node) {
  let el = node.parentElement
  while (
    el &&
    el !== document.body &&
    getComputedStyle(el).display === 'inline'
  )
    el = el.parentElement
  return el
}

// Groups in order of first appearance, with their full text.
// Pieces that meet inside one block are joined directly; pieces separated by a
// block boundary or by unhighlighted text are joined with " … ".
function listGroups() {
  const index = buildTextIndex()
  const blockAt = (offset) => {
    for (let i = index.length - 1; i >= 0; i--) {
      if (index[i].start <= offset)
        return blockOf(index[i].node)
    }
    return null
  }

  const groups = new Map()
  for (const r of [...model].sort((x, y) => x.s - y.s)) {
    const block = blockAt(r.s)
    let g = groups.get(r.g)
    if (!g) {
      const colors = resolveRun(r)
      g = {
        id: r.g,
        bg: colors.bg,
        fg: colors.fg,
        text: r.t,
        prevE: r.e,
        prevBlock: block,
        note: r.n || '',
      }
      groups.set(r.g, g)
      continue
    }
    const sameBlock = block !== null && block === g.prevBlock
    const contiguous = g.prevE === r.s
    g.text += sameBlock && contiguous ? r.t : ' … ' + r.t
    g.prevE = r.e
    g.prevBlock = block
  }
  return [...groups.values()].map((g) => ({
    id: g.id,
    bgColor: g.bg,
    fgColor:
      g.fg || (isDarkColor(g.bg) ? '#ffffff' : '#222222'),
    text: g.text,
    note: g.note,
  }))
}

// Nearest ancestor that actually scrolls, or the page itself
function findScroller(el) {
  for (
    let n = el.parentElement;
    n && n !== document.body;
    n = n.parentElement
  ) {
    const style = getComputedStyle(n)
    if (
      /(auto|scroll)/.test(style.overflowY) &&
      n.scrollHeight > n.clientHeight + 1
    )
      return n
  }
  return document.scrollingElement
}

// Scroll the group into view. Order: centered, then at the bottom, then at the top.
// The first position the scroll area can reach is used. Returns false if none is reachable.
function scrollToGroup(id) {
  try {
    const first = document.querySelector(
      `mark[data-hl-id="${id}"]`,
    )
    if (!first) return false

    const scroller = findScroller(first)
    const isPage = scroller === document.scrollingElement
    const box = isPage
      ? { top: 0, height: window.innerHeight }
      : scroller.getBoundingClientRect()
    const r = first.getBoundingClientRect()

    const topInScroller = r.top - box.top + scroller.scrollTop
    const maxScroll = scroller.scrollHeight - box.height
    const candidates = [
      topInScroller + r.height / 2 - box.height / 2, // centered
      topInScroller + r.height - box.height, // bottom of the area
      topInScroller, // top of the area
    ]
    const target = candidates.find(
      (t) => t >= 0 && t <= maxScroll,
    )
    if (target === undefined) return false

    scroller.scrollTo({ top: target, behavior: 'smooth' })
    return true
  } catch (err) {
    return false
  }
}

chrome.runtime.onMessage.addListener(
  (msg, sender, sendResponse) => {
    if (msg.type === 'listGroups') sendResponse(listGroups())
    if (msg.type === 'scrollToGroup')
      sendResponse(scrollToGroup(msg.id))
    if (msg.type === 'siteInfo') {
      sendResponse({ host: location.host })
    }
    if (msg.type === 'undo') {
      sendResponse({ ok: undoLast() })
    }
    if (msg.type === 'redo') {
      sendResponse({ ok: redoLast() })
    }
    if (msg.type === 'setNote') {
      setGroupNote(
        msg.id,
        (msg.text || '').trim().slice(0, 200),
      )
      sendResponse({ ok: true })
    }
    if (msg.type === 'splitGroup') {
      sendResponse(splitGroup(msg.id))
    }
    if (msg.type === 'mergeGroups') {
      const result = mergeGroups(msg.a, msg.b)
      if (result.ok) hidePopup()
      sendResponse(result)
    }
    if (msg.type === 'deleteGroup') {
      model = model.filter((r) => r.g !== msg.id)
      render()
      saveModel()
      sendResponse(true)
    }
  },
)

function renderSwatches() {
  const box = shadow.getElementById('swatches')
  box.textContent = ''
  palette.forEach((p, i) => {
    const b = document.createElement('button')
    b.className = 'swatch'
    b.dataset.index = i
    b.style.background = p.bg
    b.dataset.tip = p.name || 'Highlight Color ' + (i + 1)
    box.appendChild(b)
  })
}

// Opened from the action popup: scroll to the group once the page has drawn its highlights
async function applyPendingScroll() {
  const here = location.href.split('#')[0]
  const { pendingScroll } =
    await chrome.storage.local.get('pendingScroll')
  if (!pendingScroll || pendingScroll.url !== here) return
  await chrome.storage.local.remove('pendingScroll')
  for (let i = 0; i < 20; i++) {
    if (scrollToGroup(pendingScroll.id)) return
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
}

// ---------- Start ----------
{
  const NS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(NS, 'svg')
  svg.id = INV_ID + '-svg'
  svg.setAttribute('width', '0')
  svg.setAttribute('height', '0')
  svg.style.cssText =
    'position:absolute;width:0;height:0;overflow:hidden'
  const filter = document.createElementNS(NS, 'filter')
  filter.id = INV_ID
  filter.setAttribute('color-interpolation-filters', 'sRGB')
  const matrix = document.createElementNS(NS, 'feColorMatrix')
  matrix.setAttribute('type', 'matrix')
  matrix.setAttribute(
    'values',
    '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0',
  )
  filter.appendChild(matrix)
  svg.appendChild(filter)
  document.documentElement.appendChild(svg)
  updateInverseFilter()
  // Dark modes set filters by inline style or by a stylesheet in <head>. Watch both,
  // re-check after load, and poll briefly, since a filter can arrive at any time.
  const recheck = () => {
    if (pageFilterKey() !== compensatedFor)
      updateInverseFilter()
  }
  new MutationObserver(recheck).observe(
    document.documentElement,
    { attributes: true, attributeFilter: ['style', 'class'] },
  )
  new MutationObserver(recheck).observe(
    document.head || document.documentElement,
    {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    },
  )
  window.addEventListener('load', recheck)
  setInterval(recheck, 500)
}
renderSwatches()
chrome.storage.local.get('palette').then((d) => {
  if (Array.isArray(d.palette) && d.palette.length)
    palette = normalizePalette(d.palette)
  renderSwatches()
  render()
})
darkQuery.addEventListener('change', applyContentTheme)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return
  if (changes[STORAGE_KEY]) {
    // Changed by an import in another page or the popup: take the new list, unless it is our own save
    const incoming = changes[STORAGE_KEY].newValue || []
    if (!changes[STORAGE_KEY].newValue) {
      // Storage was cleared (RESET EVERYTHING): close any open popup, tooltip, or note box
      hidePopup()
      closeNoteBox()
    }
    if (JSON.stringify(incoming) !== lastSavedJson) {
      model = migrateEntries(incoming)
      lastCommitted = JSON.stringify(model)
      if (!changes[STORAGE_KEY].newValue) {
        undoStack.length = 0
        redoStack.length = 0
      } // storage was cleared
      lastSavedJson = JSON.stringify(incoming)
      render()
    }
  }
  if (changes.palette) {
    palette = normalizePalette(
      changes.palette.newValue || DEFAULT_PALETTE,
    )
    renderSwatches()
    render()
  }
  if (changes[THEME_KEY]) {
    themePref = changes[THEME_KEY].newValue || 'system'
    applyContentTheme()
  }
  if (changes[PLACEMENT_KEY]) {
    placement = changes[PLACEMENT_KEY].newValue || null
  }
})
chrome.storage.local.get(PLACEMENT_KEY).then((d) => {
  placement = d[PLACEMENT_KEY] || null
})
chrome.storage.local.get(THEME_KEY).then((d) => {
  themePref = d[THEME_KEY] || 'system'
  applyContentTheme()
})
chrome.storage.local.remove(LEGACY_KEYS).catch(() => {})
observer.observe(document.body, OBSERVE_OPTIONS)
loadModel().then(applyPendingScroll)
