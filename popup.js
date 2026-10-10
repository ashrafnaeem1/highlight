
const search = document.getElementById("search");
const list = document.getElementById("list");
const status = document.getElementById("status");

let groups = [];



// Right-click menu for expand/collapse
const ctxMenu = document.createElement("div");
ctxMenu.className = "ctx-menu";
ctxMenu.hidden = true;
document.body.appendChild(ctxMenu);

function hideMenu() {
  ctxMenu.hidden = true;
}

// items: [{ label, icon (optional icon name), onPick }]
function showMenu(x, y, items) {
  ctxMenu.textContent = "";
  for (const it of items) {
    const item = document.createElement("button");
    item.className = "ctx-item";
    if (it.icon) item.append(icon(it.icon));
    const text = document.createElement("span");
    text.textContent = it.label;
    item.append(text);
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      hideMenu();
      it.onPick();
    });
    ctxMenu.appendChild(item);
  }
  ctxMenu.style.left = Math.min(x, window.innerWidth - 150) + "px";
  ctxMenu.style.top = y + "px";
  ctxMenu.hidden = false;
}

document.addEventListener("click", hideMenu);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") hideMenu();
});

// A local SVG icon from icons/, drawn in the current text color
function icon(name) {
  const span = document.createElement("span");
  span.className = "ico";
  span.style.setProperty("--icon", `url("icons/${name}.svg")`);
  return span;
}

const COLLAPSED_LINES = 4;

// Shorten the text so it fits COLLAPSED_LINES, with the "…" button right after the last visible word
function fitText(li, body, str, more, full) {
  const expanded = li.classList.contains("expanded");
  const lineHeight = parseFloat(getComputedStyle(body).lineHeight);
  const maxHeight = lineHeight * COLLAPSED_LINES + 1;

  str.textContent = full;
  more.hidden = true;
  if (body.offsetHeight <= maxHeight) return; // fits in full: no button needed

  more.hidden = false;
  more.replaceChildren(icon(expanded ? "chevron-down" : "chevron-right"));
  if (expanded) {
    str.textContent = full;
    return;
  }

  // Collapsed: cut at the last word that fits, with plain "..." before the chevron
  let lo = 0;
  let hi = full.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    str.textContent = full.slice(0, mid).trimEnd() + "...";
    if (body.offsetHeight <= maxHeight) lo = mid;
    else hi = mid - 1;
  }
  str.textContent = full.slice(0, lo).trimEnd() + "...";
}

// ---------- Scope: current site, all sites, or one site ----------
let siteHost = null;            // host of the current page, if reachable
let scope = "current";          // "current" | "all" | a host name
let storedByHost = new Map();   // host -> groups saved for that host (read from storage)
let scopeReady = false;

const scopeBtn = document.getElementById("scopeBtn");
const scopeLabel = document.getElementById("scopeLabel");
const scopeList = document.getElementById("scopeList");

const COLOR_NAMES = {
  lavender: "#E6E0F8", yellow: "#FFFBD1", green: "#C8F7C5",
  skyblue: "#BEE3F8", coral: "#F8B4A8", black: "#000000",
};

// Background and text color of a saved run, from its palette slot or its own colors
function colorOf(r, pal) {
  const entry = r.p && pal.find((p) => p.id === r.p);
  if (entry) return { bg: entry.bg, fg: entry.fg || null };
  const bg = typeof r.c === "string" && r.c.startsWith("#") ? r.c : COLOR_NAMES[r.c] || "#FFFBD1";
  return { bg, fg: r.f || null };
}

// Groups of one page's saved runs, in page order. Pieces that do not touch are joined with " … ".
function groupRuns(runs, url, pal) {
  const sorted = runs
    .filter((r) => r && typeof r.t === "string" && typeof r.s === "number")
    .sort((x, y) => x.s - y.s);
  const byId = new Map();
  for (const r of sorted) {
    const end = typeof r.e === "number" ? r.e : r.s + r.t.length;
    const existing = byId.get(r.g);
    if (!existing) {
      const col = colorOf(r, pal);
      byId.set(r.g, {
        id: r.g,
        url,
        stored: true,
        bgColor: col.bg,
        fgColor: col.fg || (isDark(col.bg) ? "#ffffff" : "#222222"),
        text: r.t,
        note: r.n || "",
        prevE: end,
      });
      continue;
    }
    existing.text += (existing.prevE === r.s ? "" : " … ") + r.t;
    existing.prevE = end;
    if (!existing.note && r.n) existing.note = r.n;
  }
  return [...byId.values()];
}

// All saved highlights, grouped by site host
async function loadStored() {
  const all = await chrome.storage.local.get(null);
  const pal = normalizePalette(Array.isArray(all.palette) && all.palette.length ? all.palette : DEFAULT_PALETTE);
  const byHost = new Map();
  for (const [key, value] of Object.entries(all)) {
    if (!key.startsWith("hl:") || !Array.isArray(value)) continue;
    const url = key.slice(3);
    let host;
    try {
      host = new URL(url).host;
    } catch (err) {
      continue;
    }
    if (!byHost.has(host)) byHost.set(host, []);
    byHost.get(host).push(...groupRuns(value, url, pal));
  }
  return byHost;
}

// Current site at the top, then All Sites, then the other sites alphabetically
function scopeOptions() {
  const opts = [];
  if (siteHost) opts.push({ value: "current", label: `Current: ${siteHost}` });
  opts.push({ value: "all", label: "All Sites" });
  const hosts = [...storedByHost.keys()]
    .filter((h) => h !== siteHost)
    .sort((x, y) => x.localeCompare(y));
  for (const h of hosts) opts.push({ value: h, label: h });
  return opts;
}

function renderScope() {
  const opts = scopeOptions();
  scopeList.textContent = "";
  for (const o of opts) {
    const li = document.createElement("li");
    li.className = "scope-item" + (o.value === scope ? " active" : "");
    li.textContent = o.label;
    li.addEventListener("click", (e) => {
      e.stopPropagation();
      setScope(o.value);
    });
    scopeList.appendChild(li);
  }
  const cur = opts.find((o) => o.value === scope) || opts[0];
  scopeLabel.textContent = cur ? cur.label : "";
}

function setScope(value) {
  scope = value;
  scopeList.hidden = true;
  renderScope();
  render();
}

scopeBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  scopeList.hidden = !scopeList.hidden;
});
document.addEventListener("click", () => {
  scopeList.hidden = true;
});

// Open a saved page in a new tab
// Open a saved page; the page scrolls to the group once it has loaded
async function openStored(url, id) {
  await chrome.storage.local.set({ pendingScroll: { url, id } });
  chrome.tabs.create({ url });
}

// Delete one group from storage (for sites that are not open in this window)
async function deleteStored(url, id) {
  const key = "hl:" + url;
  const current = (await chrome.storage.local.get(key))[key] || [];
  await chrome.storage.local.set({ [key]: current.filter((r) => r.g !== id) });
  load();
}

// One list item. Page items (current site, live) scroll and merge; stored items open their page.
function createItem(g, page, parent) {
  const li = document.createElement("li");
  li.className = "item";
  li.style.background = g.bgColor;
  li.style.color = g.fgColor;

  const body = document.createElement("span");
  body.className = "body";
  const str = document.createElement("span");
  str.className = "str";
  const more = document.createElement("button");
  more.className = "more";
  more.dataset.tip = "Expand or Collapse";
  more.addEventListener("click", (e) => {
    e.stopPropagation();
    li.classList.toggle("expanded");
    fitText(li, body, str, more, g.text);
  });
  body.append(str);

  const side = document.createElement("span");
  side.className = "side";
  const del = document.createElement("button");
  del.className = "icon-btn";
  del.dataset.tip = "Delete Highlight";
  del.replaceChildren(icon("trash"));
  del.addEventListener("click", (e) => {
    e.stopPropagation();
    if (page) deleteGroup(g.id);
    else deleteStored(g.url, g.id);
  });
  side.append(del);

  li.addEventListener("mouseenter", () => showPtip(g, li));
  li.addEventListener("mouseleave", () => {
    if (!altHeld && document.activeElement !== ptip) hidePtip();
  });

  li.addEventListener("click", () => (page ? scrollTo(g.id) : openStored(g.url, g.id)));

  const openMenu = (e) => {
    e.stopPropagation();
    const items = [];
    if (!more.hidden) {
      const expanded = li.classList.contains("expanded");
      items.push({
        label: expanded ? "Collapse" : "Expand",
        icon: expanded ? "chevron-down" : "chevron-right",
        onPick: () => {
          li.classList.toggle("expanded");
          fitText(li, body, str, more, g.text);
        },
      });
    }
    if (page) {
      items.push({ label: "Scroll to Highlight", icon: null, onPick: () => scrollTo(g.id) });
      items.push({ label: "Merge Above", icon: null, onPick: () => mergeWith(g.id, "above") });
      items.push({ label: "Merge Below", icon: null, onPick: () => mergeWith(g.id, "below") });
      items.push({ label: "Split Back to Original Subgroups", icon: null, onPick: () => splitGroup(g.id) });
    } else {
      items.push({ label: "Open Page", icon: null, onPick: () => openStored(g.url, g.id) });
    }
    showMenu(e.clientX, e.clientY, items);
  };
  li.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    openMenu(e);
  });

  li.append(body, side, more);
  parent.appendChild(li);
  fitText(li, body, str, more, g.text);
  return li;
}

function render() {
  const query = search.value.trim().toLowerCase();
  const match = (g) => !query || g.text.toLowerCase().includes(query);
  list.textContent = "";
  let total = 0;
  let shown = 0;

  if (scope === "current") {
    total = groups.length;
    for (const g of groups.filter(match)) {
      createItem(g, true, list);
      shown++;
    }
  } else if (scope === "all") {
    const blocks = [];
    if (siteHost && groups.length) blocks.push({ host: siteHost, page: true, items: groups });
    const others = [...storedByHost]
      .filter(([host]) => host !== siteHost)
      .sort(([x], [y]) => x.localeCompare(y));
    for (const [host, items] of others) blocks.push({ host, page: false, items });

    for (const block of blocks) {
      total += block.items.length;
      const visible = block.items.filter(match);
      if (!visible.length) continue;
      const head = document.createElement("li");
      head.className = "section";
      head.textContent = block.page ? `${block.host} (Current)` : block.host;
      list.appendChild(head);
      for (const g of visible) {
        createItem(g, block.page, list);
        shown++;
      }
    }
  } else {
    const items = storedByHost.get(scope) || [];
    total = items.length;
    for (const g of items.filter(match)) {
      createItem(g, false, list);
      shown++;
    }
  }

  if (scope === "current" && !siteHost) status.textContent = "Highlights are not available here. Refresh the page first.";
  else if (!total) status.textContent = scope === "all" ? "No highlights saved." : scope === "current" ? "No highlights on this page." : "No highlights on this site.";
  else if (!shown) status.textContent = "No matches.";
  else status.textContent = "";
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function scrollTo(id) {
  const tab = await activeTab();
  let ok = false;
  try {
    ok = await chrome.tabs.sendMessage(tab.id, { type: "scrollToGroup", id });
  } catch (err) {
    ok = false;
  }
  if (!ok) say("Can't scroll.");
}

// Split a merged group back into its two original groups; the page checks the rule
async function splitGroup(id) {
  const tab = await activeTab();
  let res;
  try {
    res = await chrome.tabs.sendMessage(tab.id, { type: "splitGroup", id });
  } catch (err) {
    res = { ok: false };
  }
  if (res && res.ok) {
    say("Split.");
    load();
  } else {
    say("Not splittable.");
  }
}

// Merge with the neighbor above or below in the list; the page checks the rules
async function mergeWith(id, direction) {
  const idx = groups.findIndex((g) => g.id === id);
  const neighbor = groups[direction === "above" ? idx - 1 : idx + 1];
  if (!neighbor) { say("Not mergeable."); return; }
  const tab = await activeTab();
  let res;
  try {
    res = await chrome.tabs.sendMessage(tab.id, { type: "mergeGroups", a: id, b: neighbor.id });
  } catch (err) {
    res = { ok: false };
  }
  if (res && res.ok) {
    say("Merged.");
    load();
  } else {
    say("Not mergeable.");
  }
}

async function deleteGroup(id) {
  const tab = await activeTab();
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "deleteGroup", id });
    groups = groups.filter((g) => g.id !== id);
    render();
  } catch (err) {
    status.textContent = "Could not delete. Refresh the page first.";
  }
}


async function load() {
  siteHost = null;
  groups = [];
  try {
    const tab = await activeTab();
    const info = await chrome.tabs.sendMessage(tab.id, { type: "siteInfo" });
    siteHost = (info && info.host) || null;
    groups = await chrome.tabs.sendMessage(tab.id, { type: "listGroups" });
  } catch (err) {
    groups = [];
  }
  storedByHost = await loadStored();
  if (!scopeReady) {
    scope = siteHost ? "current" : "all";
    scopeReady = true;
  }
  if (scope === "current" && !siteHost) scope = "all";
  if (scope !== "all" && scope !== "current" && !storedByHost.has(scope)) scope = "all";
  renderScope();
  search.disabled = false;
  render();
}

// ---------- Theme ----------
const themeButtons = document.querySelectorAll("[data-theme-choice]");
const systemDark = window.matchMedia("(prefers-color-scheme: dark)");
let themePref = "system";

function applyTheme() {
  const dark = themePref === "dark" || (themePref === "system" && systemDark.matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  themeButtons.forEach((b) => b.classList.toggle("active", b.dataset.themeChoice === themePref));
}

themeButtons.forEach((b) => {
  b.addEventListener("click", async () => {
    themePref = b.dataset.themeChoice;
    await chrome.storage.local.set({ theme: themePref });
    applyTheme();
  });
});
systemDark.addEventListener("change", applyTheme);

search.addEventListener("input", render);

// ---------- Export and import ----------
const notice = document.getElementById("notice");

function say(text) {
  notice.textContent = text;
}

async function exportHighlights() {
  const all = await chrome.storage.local.get(null);
  const highlights = {};
  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith("hl:") && Array.isArray(value) && value.length) {
      highlights[key.slice(3)] = value;
    }
  }
  const json = JSON.stringify(
    { format: "highlight-backup", version: 1, exportedAt: new Date().toISOString(), highlights },
    null,
    2
  );
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `highlight-export-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  say("Export saved.");
}

document.getElementById("exportBtn").addEventListener("click", async () => {
  await exportHighlights();
});

document.getElementById("importBtn").addEventListener("click", () => {
  document.getElementById("importFile").click();
});

document.getElementById("importFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.format !== "highlight-backup" || typeof data.highlights !== "object") {
      say("This is not a highlight backup file.");
      return;
    }
    let added = 0;
    for (const [url, runs] of Object.entries(data.highlights)) {
      if (!Array.isArray(runs)) continue;
      const key = "hl:" + url;
      const current = (await chrome.storage.local.get(key))[key] || [];
      const seen = new Set(current.map((r) => r.g + "|" + r.s + "|" + r.t));
      for (const r of runs) {
        if (!r || typeof r.t !== "string" || typeof r.s !== "number" || typeof r.g !== "string") continue;
        const k = r.g + "|" + r.s + "|" + r.t;
        if (!seen.has(k)) {
          // Repair imported runs from older backups: missing color or note fields
          current.push({
            ...r,
            c: r.c || "#FFFBD1",
            n: typeof r.n === "string" && r.n.trim() ? r.n.trim().slice(0, 200) : null,
          });
          seen.add(k);
          added++;
        }
      }
      await chrome.storage.local.set({ [key]: current });
    }
    say(`Imported ${added} highlight(s). Refresh open pages to see them.`);
    load();
  } catch (err) {
    say("Could not read that file.");
  }
});

(async () => {
  const saved = await chrome.storage.local.get(["theme", "dataVersion"]);
  // Repair the theme if it is missing or unknown (older versions)
  themePref = ["system", "light", "dark"].includes(saved.theme) ? saved.theme : "system";
  if (saved.theme !== themePref || saved.dataVersion !== "0.0.7") {
    chrome.storage.local.set({ theme: themePref, dataVersion: "0.0.7" });
  }
  applyTheme();
  load();
})();


// ---------- Palette and color picker ----------
const DEFAULT_PALETTE = [
  { id: "p2", name: "Default", bg: "#BBD9B8", fg: null }, { id: "p0", bg: "#CAD1F7", fg: null },
  { id: "p6", bg: "#FFFBD1", fg: null }, { id: "p3", bg: "#A9DAF0", fg: null },
  { id: "p4", bg: "#F4C7AF", fg: null },
  { id: "p5", name: "Black", fixed: true, bg: "#24273A", fg: "#CAD3F5" },
  { id: "p7", name: "White", fixed: true, bg: "#EFF1F5", fg: "#4C4F69" },
];
let palette = DEFAULT_PALETTE.map((p) => ({ ...p }));

// Each slot keeps its id, so highlights that use it follow its color
function normalizePalette(list) {
  const out = list.map((p, i) => {
    const d = DEFAULT_PALETTE.find((x) => x.id === p.id);
    // Fixed colors always use their built-in values and cannot be changed
    if (d && d.fixed) return { ...d };
    return {
      id: p.id || "p" + i,
      name: p.name || (d && d.name) || null,
      fixed: false,
      bg: p.bg,
      fg: p.fg || null,
    };
  });
  // Add any fixed colors missing from an older saved palette
  for (const d of DEFAULT_PALETTE) {
    if (d.fixed && !out.some((p) => p.id === d.id)) out.push({ ...d });
  }
  return out;
}
let editIdx = 0;
let target = "bg";
let hsv = [0, 0, 1];
let prevHex = "#FFFFFF";

const paletteBox = document.getElementById("palette");
const picker = document.getElementById("picker");
const main = document.getElementById("main");
const wheel = document.getElementById("wheel");
const wctx = wheel.getContext("2d");
const R = 70;

function isDark(hex) {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 140;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]) {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
}

function hsvToRgb(h, s, v) {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
  return [r * 255, g * 255, b * 255];
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  return [h, max ? d / max : 0, max];
}

function savePalette() {
  chrome.storage.local.set({ palette });
}

function renderPalette() {
  paletteBox.textContent = "";
  palette.forEach((p, i) => {
    const b = document.createElement("button");
    b.className = "pal";
    b.style.background = p.bg;
    if (p.fixed) {
      b.dataset.tip = `${p.name} (Fixed Color, Not Editable)`;
      b.style.cursor = "not-allowed";
    } else {
      b.dataset.tip = p.name ? `Edit ${p.name} Color` : "Edit Color " + (i + 1);
      b.addEventListener("click", () => openPicker(i));
    }
    paletteBox.appendChild(b);
  });
}

// The color the picker is editing right now (text falls back to automatic)
function currentHex() {
  const entry = palette[editIdx];
  if (target === "bg") return entry.bg;
  return entry.fg || (isDark(entry.bg) ? "#FFFFFF" : "#222222");
}

function syncInputs() {
  document.getElementById("newSwatch").style.background = currentHex();
  document.getElementById("prevSwatch").style.background = prevHex;
  const [r, g, b] = hexToRgb(currentHex());
  document.getElementById("bright").value = Math.round(hsv[2] * 100);
  for (const [id, v] of [["r", r], ["g", g], ["b", b]]) {
    document.getElementById(id).value = v;
    document.getElementById(id + "n").value = v;
  }
  document.getElementById("hex").value = currentHex();
}

function drawWheel() {
  const img = wctx.createImageData(140, 140);
  for (let y = 0; y < 140; y++) {
    for (let x = 0; x < 140; x++) {
      const dx = x - R + 0.5;
      const dy = y - R + 0.5;
      const d = Math.hypot(dx, dy) / R;
      const k = (y * 140 + x) * 4;
      if (d > 1) { img.data[k + 3] = 0; continue; }
      const h = (Math.atan2(dy, dx) / (2 * Math.PI) + 1) % 1;
      const [r, g, b] = hsvToRgb(h, d, hsv[2]);
      img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = 255;
    }
  }
  wctx.putImageData(img, 0, 0);
  const a = hsv[0] * 2 * Math.PI;
  const mx = R + Math.cos(a) * hsv[1] * R;
  const my = R + Math.sin(a) * hsv[1] * R;
  wctx.beginPath();
  wctx.arc(mx, my, 5, 0, 2 * Math.PI);
  wctx.lineWidth = 2;
  wctx.strokeStyle = "#ffffff";
  wctx.stroke();
  wctx.lineWidth = 1;
  wctx.strokeStyle = "#000000";
  wctx.stroke();
}

// A change from the picker: write it to the palette entry being edited
function commit(newHex) {
  if (target === "bg") palette[editIdx].bg = newHex;
  else palette[editIdx].fg = newHex;
  savePalette();
  renderPalette();
  drawWheel();
  syncInputs();
}

function fromRgb(r, g, b) {
  hsv = rgbToHsv(r, g, b);
  commit(rgbToHex([r, g, b]));
}

function openPicker(i) {
  editIdx = i;
  target = "bg";
  setTarget("bg");
  main.hidden = true;
  picker.hidden = false;
}

function setTarget(t) {
  target = t;
  prevHex = currentHex();
  document.querySelectorAll("#target button").forEach((b) => b.classList.toggle("active", b.dataset.target === t));
  hsv = rgbToHsv(...hexToRgb(currentHex()));
  drawWheel();
  syncInputs();
}

function pickFromWheel(e) {
  const rect = wheel.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (140 / rect.width) - R;
  const y = (e.clientY - rect.top) * (140 / rect.height) - R;
  hsv[0] = (Math.atan2(y, x) / (2 * Math.PI) + 1) % 1;
  hsv[1] = Math.min(1, Math.hypot(x, y) / R);
  commit(rgbToHex(hsvToRgb(hsv[0], hsv[1], hsv[2])));
}

wheel.addEventListener("pointerdown", (e) => {
  wheel.setPointerCapture(e.pointerId);
  pickFromWheel(e);
});
wheel.addEventListener("pointermove", (e) => {
  if (e.buttons) pickFromWheel(e);
});

document.getElementById("bright").addEventListener("input", (e) => {
  hsv[2] = e.target.value / 100;
  commit(rgbToHex(hsvToRgb(hsv[0], hsv[1], hsv[2])));
});
for (const id of ["r", "g", "b"]) {
  const slider = document.getElementById(id);
  const number = document.getElementById(id + "n");
  slider.addEventListener("input", () => {
    number.value = slider.value;
    fromRgb(+document.getElementById("r").value, +document.getElementById("g").value, +document.getElementById("b").value);
  });
  number.addEventListener("change", () => {
    slider.value = number.value;
    fromRgb(+document.getElementById("r").value, +document.getElementById("g").value, +document.getElementById("b").value);
  });
}
document.getElementById("hex").addEventListener("change", (e) => {
  const v = e.target.value.trim();
  if (/^#?[0-9a-f]{6}$/i.test(v)) {
    const hex = v.startsWith("#") ? v : "#" + v;
    hsv = rgbToHsv(...hexToRgb(hex.toUpperCase()));
    commit(hex.toUpperCase());
  } else {
    syncInputs();
  }
});
document.querySelectorAll("#target button").forEach((b) => {
  b.addEventListener("click", () => setTarget(b.dataset.target));
});
document.getElementById("autoText").addEventListener("click", () => {
  palette[editIdx].fg = null;
  savePalette();
  setTarget("fg");
  renderPalette();
});
// Restore the picked slot to its default color
document.getElementById("pickerReset").addEventListener("click", () => {
  const id = palette[editIdx].id;
  const def = DEFAULT_PALETTE.find((p) => p.id === id);
  if (!def) return;
  palette[editIdx] = { ...def };
  savePalette();
  renderPalette();
  setTarget(target);
});

document.getElementById("pickerDone").addEventListener("click", () => {
  picker.hidden = true;
  main.hidden = false;
});

chrome.storage.local.get("palette").then((d) => {
  if (Array.isArray(d.palette) && d.palette.length) palette = normalizePalette(d.palette);
  renderPalette();
});


// ---------- Advanced: reset everything ----------
const advToggle = document.getElementById("advToggle");
const advPanel = document.getElementById("advPanel");
const advIcon = advToggle.querySelector(".ico");
const resetBtn = document.getElementById("resetBtn");

function setAdvanced(open) {
  advPanel.hidden = !open;
  advIcon.style.setProperty("--icon", `url('icons/${open ? "chevron-down" : "chevron-right"}.svg')`);
}
advToggle.addEventListener("click", () => setAdvanced(advPanel.hidden));

async function resetAll() {
  // Clears every stored key: highlights from this and earlier versions, and all settings
  await chrome.storage.local.clear();
  palette = DEFAULT_PALETTE.map((p) => ({ ...p }));
  renderPalette();
  picker.hidden = true;
  main.hidden = false;
  themePref = "system";
  applyTheme();
  say("Everything was reset.");
  load();
}

const resetModal = document.getElementById("resetModal");
resetBtn.addEventListener("click", () => {
  resetModal.hidden = false;
});
document.getElementById("mExport").addEventListener("click", async () => {
  resetModal.hidden = true;
  await exportHighlights();
  await resetAll();
});
document.getElementById("mReset").addEventListener("click", async () => {
  resetModal.hidden = true;
  await resetAll();
});
document.getElementById("mCancel").addEventListener("click", () => {
  resetModal.hidden = true;
});


// ---------- Hover tooltip for list items (Alt keeps it alive and editable) ----------
const ptip = document.getElementById("ptip");
let altHeld = false;
let ptipGroup = null;
let ptipHovered = false;

function setPtipEditable(on) {
  ptip.classList.toggle("interactive", on);
  ptip.contentEditable = on ? "true" : "false";
}

function hidePtip() {
  if (document.activeElement === ptip) ptip.blur(); // commits any edit
  ptip.hidden = true;
  setPtipEditable(false);
  ptipGroup = null;
}

function showPtip(g, li) {
  if (!g.note || document.activeElement === ptip) return;
  ptipGroup = g;
  ptip.textContent = g.note;
  ptip.hidden = false;
  setPtipEditable(altHeld && !g.stored);
  const r = li.getBoundingClientRect();
  const w = ptip.offsetWidth;
  const h = ptip.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.max(4, Math.min(r.left + 8, vw - w - 4));
  const above = r.top - h - 6;
  const below = r.bottom + 6;
  const top = above >= 4 ? above : below + h <= vh - 4 ? below : Math.max(4, vh - h - 4);
  ptip.style.left = left + "px";
  ptip.style.top = top + "px";
}

// Save an edited note back to the group in the page
async function commitPtipEdit() {
  if (!ptipGroup || ptipGroup.stored) return;
  const g = ptipGroup;
  const text = ptip.textContent.trim().slice(0, 200);
  if (text === (g.note || "")) return;
  const tab = await activeTab();
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "setNote", id: g.id, text });
  } catch (err) {
    say("Could not save the note. Refresh the page first.");
  }
  load();
}

ptip.addEventListener("blur", commitPtipEdit);
ptip.addEventListener("mouseenter", () => { ptipHovered = true; });
ptip.addEventListener("mouseleave", () => {
  ptipHovered = false;
  if (!altHeld && document.activeElement !== ptip) hidePtip();
});
ptip.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    ptip.blur();
  } else if (e.key === "Escape") {
    ptip.textContent = ptipGroup ? ptipGroup.note || "" : "";
    ptip.blur();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Alt") return;
  altHeld = true;
  if (ptipGroup && !ptipGroup.stored) setPtipEditable(true);
});
document.addEventListener("keyup", (e) => {
  if (e.key !== "Alt") return;
  altHeld = false;
  if (!ptipGroup) return;
  if (!ptipHovered && document.activeElement !== ptip) hidePtip();
  else if (document.activeElement !== ptip) setPtipEditable(false);
});
window.addEventListener("blur", () => { altHeld = false; });

// ---------- Catppuccin tooltips for data-tip elements ----------
const DATA_TIP = document.getElementById("ctip");

// Catppuccin tooltips for any element with data-tip (replaces native title tooltips)
function showDataTip(el) {
  const text = el.dataset.tip;
  if (!text) return;
  DATA_TIP.textContent = text;
  DATA_TIP.classList.add("show");
  const r = el.getBoundingClientRect();
  const w = DATA_TIP.offsetWidth;
  const h = DATA_TIP.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.max(4, Math.min(r.left + r.width / 2 - w / 2, vw - w - 4));
  const above = r.top - h - 6;
  const below = r.bottom + 6;
  const top = above >= 4 ? above : below + h <= vh - 4 ? below : Math.max(4, vh - h - 4);
  DATA_TIP.style.left = left + "px";
  DATA_TIP.style.top = top + "px";
}

function hideDataTip() {
  DATA_TIP.classList.remove("show");
}

document.addEventListener("mouseover", (e) => {
  const el = e.target.closest && e.target.closest("[data-tip]");
  if (el) showDataTip(el);
});
document.addEventListener("mouseout", (e) => {
  const el = e.target.closest && e.target.closest("[data-tip]");
  if (el && !el.contains(e.relatedTarget)) hideDataTip();
});
