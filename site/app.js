'use strict';

const AWARD_LABELS = {
  hugo: 'Hugo',
  nebula: 'Nebula',
};

let DATA = { books: [], meta: {} };

// Canonical reader config. `me` is the signed-in user (Supabase user_books);
// the named entries (tom/nika/…) are legacy URL-overrides for the previous
// CSV-driven multi-reader view, kept only for ?reader=... debug URLs.
const READER_CONFIG = {
  me:      { id: 'me',      label: 'You',     initial: 'Y', cls: 'reader-me', colorVar: 'var(--accent)',   colorRgb: '29,78,216' },
  tom:     { id: 'tom',     label: 'Tom',     initial: 'T', cls: 'reader-t', colorVar: 'var(--accent)',   colorRgb: '29,78,216' },
  nika:    { id: 'nika',    label: 'Nika',    initial: 'N', cls: 'reader-n', colorVar: 'var(--accent-2)', colorRgb: '220,38,38' },
  westdac: { id: 'westdac', label: 'Westdac', initial: 'W', cls: 'reader-w', colorVar: 'var(--accent-3)', colorRgb: '182,120,60' },
  colton:  { id: 'colton',  label: 'Colton',  initial: 'C', cls: 'reader-c', colorVar: 'var(--accent-4)', colorRgb: '74,122,90' },
  schupp:  { id: 'schupp',  label: 'Schupp',  initial: 'S', cls: 'reader-s', colorVar: 'var(--accent-5)', colorRgb: '122,68,134' },
};
// Excludes 'me' — only the named legacy readers (used for CSV-keyed loops).
const ALL_READER_IDS = ['tom', 'nika', 'westdac', 'colton', 'schupp'];
// Initial → id map (T->tom, N->nika, W->westdac, C->colton, S->schupp). Used to
// accept ?reader=T,N or ?reader=T&reader=N alongside the long-form names.
const INITIAL_TO_ID = Object.fromEntries(
  ALL_READER_IDS.map(id => [READER_CONFIG[id].initial.toLowerCase(), id])
);

// Optional URL override for the legacy CSV-driven multi-reader view.
// Without `?reader=...`, the active reader set is auth-derived (see
// recomputeReaders): empty when signed out, ['me'] when signed in.
const URL_READERS = (() => {
  const params = new URLSearchParams(window.location.search);
  const raw = [];
  for (const key of ['reader', 'readers']) {
    for (const val of params.getAll(key)) {
      val.split(',').forEach(v => raw.push(v.trim().toLowerCase()));
    }
  }
  return raw.map(r => READER_CONFIG[r] ? r : (INITIAL_TO_ID[r] || r))
            .filter(r => READER_CONFIG[r] && r !== 'me');
})();

// Mutable — recomputeReaders() updates these based on auth state.
let READERS = [];
let SHOW_TOM = false;
let SHOW_NIKA = false;
let SHOW_WESTDAC = false;
let SHOW_COLTON = false;
let SHOW_SCHUPP = false;
let SOLO = null;
let ACTIVE_READERS = [];
const showReader = (id) => READERS.includes(id);

function recomputeReaders() {
  if (URL_READERS.length) {
    READERS = URL_READERS.slice();
  } else if (window.MR_AUTH && window.MR_AUTH.user) {
    READERS = ['me'];
    // Keep "me" label in sync with the user's handle for nicer UI labels.
    const handle = window.MR_AUTH.profile?.handle;
    if (handle) READER_CONFIG.me.label = handle;
  } else {
    READERS = [];
  }
  SHOW_TOM = READERS.includes('tom');
  SHOW_NIKA = READERS.includes('nika');
  SHOW_WESTDAC = READERS.includes('westdac');
  SHOW_COLTON = READERS.includes('colton');
  SHOW_SCHUPP = READERS.includes('schupp');
  SOLO = (READERS.length === 1) ? READERS[0] : null;
  ACTIVE_READERS = READERS.map(r => READER_CONFIG[r]).filter(Boolean);
}
const ALL_READ_STATES = ['read', 'unread', 'started'];
const fullStatusSet = () => new Set(ALL_READ_STATES);

let state = {
  search: '',
  readTom: fullStatusSet(),
  readNika: fullStatusSet(),
  readWestdac: fullStatusSet(),
  readColton: fullStatusSet(),
  readSchupp: fullStatusSet(),
  awards: new Set(Object.keys(AWARD_LABELS)),
  statuses: new Set(['winner', 'nominee']),
  categories: new Set(['Novel', 'Novella', 'Novelette']),
  yearMin: null,
  yearMax: null,
  sort: 'year-desc',
  // Progress-page filter: 'winner' | 'nominee' | 'both'
  progressStatus: 'winner',
  // Progress-page award scope: 'both' | 'hugo' | 'nebula'
  progressAward: 'both',
  // Home page: time-window for most-awarded authors (years back)
  authorWindow: 30,
  // Home page: which gender slice is currently selected (null = all)
  genderFilter: null,
  // Books page: author-gender multi-filter. Set of {'female','male','unknown'}.
  // Full set (size 3) = no filter; smaller set = restrict to those gender(s).
  authorGender: new Set(['female', 'male', 'unknown']),
  // Books page: missing-data debug filter. Set of {'desc','cover'}.
  // Empty = no filter; any checked = books missing at least one selected.
  missingFilter: new Set(),
  // Books page: filter by the signed-in user's status. Set of
  // {'read','nightstand','neither'}. Full set (size 3) = no filter.
  // 'neither' matches books the user hasn't marked at all.
  meStatus: new Set(['read', 'nightstand', 'neither']),
};

// Solo mode is in the real query string (?solo=tom). Hash routing preserves it
// automatically as you navigate, so internal href="#/..." links just work.

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function readStatus(book, who = 'tom') {
  if (who === 'me') {
    const status = window.MR_AUTH?.statusFor?.(book.id);
    if (status === 'read') return 'read';
    if (status === 'started') return 'started';
    return 'unread';
  }
  const val = (book[who] || '').toLowerCase();
  if (!val) return 'unread';
  if (val.startsWith('read')) return 'read';
  if (/queue|progress|started|struggling/.test(val)) return 'started';
  return 'started';
}

// True if the user has the book on their nightstand (to-read shelf).
// For 'me', that's user_books.status === 'nightstand'. For CSV readers,
// that's the legacy *_shelf column.
function onNightstand(book, who) {
  if (who === 'me') {
    return window.MR_AUTH?.statusFor?.(book.id) === 'nightstand';
  }
  return book[`${who}_shelf`] === 'to-read';
}

function shelfStatus(book, who) {
  // Returns the raw shelf label string (e.g., 'to-read', 'currently-reading')
  // or 'nightstand' / 'started' / 'read' for 'me'. Used where the existing UI
  // wants to render a label or compare to a specific shelf.
  if (who === 'me') {
    return window.MR_AUTH?.statusFor?.(book.id) || null;
  }
  return book[`${who}_shelf`] || null;
}

function matchesFilters(book) {
  if (state.search) {
    const q = state.search.toLowerCase();
    const hay = (book.title + ' ' + (book.author_raw || '')).toLowerCase();
    if (!hay.includes(q)) return false;
  }
  const readerKeyMap = { tom: 'readTom', nika: 'readNika', westdac: 'readWestdac', colton: 'readColton', schupp: 'readSchupp' };
  for (const r of ACTIVE_READERS) {
    const who = r.id, key = readerKeyMap[who];
    if (!key) continue;
    const wanted = state[key];
    if (!wanted) continue;
    if (wanted.size === ALL_READ_STATES.length) continue; // all 3 = no filter
    if (!wanted.has(readStatus(book, who))) return false;
  }
  if (!state.categories.has(book.category)) return false;
  // Conjunctive: book must have at least one (award, status) pair where both match the filter
  const hasMatchingAward = Object.entries(book.awards || {}).some(([a, s]) => state.awards.has(a) && state.statuses.has(s));
  if (!hasMatchingAward) return false;
  if (state.yearMin != null && (book.year == null || book.year < state.yearMin)) return false;
  if (state.yearMax != null && (book.year == null || book.year > state.yearMax)) return false;
  // Author gender filter: full set (3 of 3) = no filter, otherwise restrict.
  if (state.authorGender && state.authorGender.size < 3) {
    const g = book.primary_author_gender || 'unknown';
    if (!state.authorGender.has(g)) return false;
  }
  // Signed-in user's status (read | nightstand | neither). Multi-select Set.
  // 'neither' = no user_books row at all. Full set = no filter.
  if (state.meStatus && state.meStatus.size > 0 && state.meStatus.size < 3 && window.MR_AUTH?.user) {
    const myStatus = window.MR_AUTH.statusFor(book.id);
    // Map legacy 'started' rows to 'nightstand' for filtering purposes —
    // those rows exist in DB from before we dropped the started state but
    // should now show under the nightstand bucket.
    const bucket = myStatus === 'read' ? 'read'
      : (myStatus === 'nightstand' || myStatus === 'started') ? 'nightstand'
      : 'neither';
    if (!state.meStatus.has(bucket)) return false;
  }
  // Missing-data filter: any checked → book must be missing at least one of
  // the checked criteria. Empty set = no filter.
  if (state.missingFilter && state.missingFilter.size > 0) {
    const missingDesc = !book.description || !book.description.trim();
    const missingCover = !book.cover_url || !book.cover_url.trim();
    const missingLink = !book.publication_url || !book.publication_url.trim();
    const wantsDesc = state.missingFilter.has('desc');
    const wantsCover = state.missingFilter.has('cover');
    const wantsLink = state.missingFilter.has('link');
    const matches = (wantsDesc && missingDesc) || (wantsCover && missingCover) || (wantsLink && missingLink);
    if (!matches) return false;
  }
  return true;
}

function sortBooks(books) {
  const arr = [...books];
  switch (state.sort) {
    case 'year-desc': arr.sort((a, b) => (b.year || 0) - (a.year || 0) || a.title.localeCompare(b.title)); break;
    case 'year-asc': arr.sort((a, b) => (a.year || 0) - (b.year || 0) || a.title.localeCompare(b.title)); break;
    case 'title': arr.sort((a, b) => a.title.localeCompare(b.title)); break;
    case 'author': arr.sort((a, b) => (a.authors[0] || '').localeCompare(b.authors[0] || '') || a.title.localeCompare(b.title)); break;
  }
  return arr;
}

function buildRadar(axes, readerValues, configOverride = null) {
  // axes: string[]
  // readerValues: { <id>: number[] }   each value 0..1
  // configOverride: optional { <id>: { label, colorVar, colorRgb } } for ad-hoc
  //   readers (compare-page handles) that aren't in READER_CONFIG.
  const lookup = id => (configOverride && configOverride[id]) || READER_CONFIG[id];
  // Wider viewBox so right-side axis labels (e.g. "Space Opera") don't clip.
  const w = 600, h = 480, cx = w / 2, cy = h / 2 - 6, R = 150;
  const n = axes.length;
  const angle = i => -Math.PI / 2 + (2 * Math.PI * i) / n;

  // Auto-scale: round the largest data value up to a clean step.
  const allVals = Object.values(readerValues).flatMap(arr => arr);
  const dataMax = Math.max(0.05, ...allVals);
  // Step depends on magnitude: use 5% steps below 30%, 10% steps above.
  const step = dataMax <= 0.30 ? 0.05 : 0.10;
  const scaleMax = Math.ceil(dataMax / step) * step;
  const normalize = v => v / scaleMax; // 0..1 within the radar's outer ring

  const pt = (i, v) => [cx + R * normalize(v) * Math.cos(angle(i)), cy + R * normalize(v) * Math.sin(angle(i))];
  const gridPt = (i, lv) => [cx + R * lv * Math.cos(angle(i)), cy + R * lv * Math.sin(angle(i))];

  // Grid: 4 concentric polygons (at quartiles of the scale max)
  const gridLevels = [0.25, 0.5, 0.75, 1.0];
  const gridPolys = gridLevels.map(lv => {
    const pts = Array.from({ length: n }, (_, i) => gridPt(i, lv).map(x => x.toFixed(1)).join(','));
    return `<polygon points="${pts.join(' ')}" fill="none" stroke="var(--border)" stroke-width="${lv === 1 ? 1.4 : 0.8}" opacity="${lv === 1 ? 0.9 : 0.5}"/>`;
  }).join('');
  // Spokes
  const spokes = Array.from({ length: n }, (_, i) => {
    const [x, y] = gridPt(i, 1.0);
    return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--border)" stroke-width="0.6" opacity="0.5"/>`;
  }).join('');
  // Grid percent labels along the top axis (reflect absolute % not normalized)
  const gridLabels = gridLevels.map(lv => {
    const [, y] = gridPt(0, lv);
    return `<text x="${cx + 4}" y="${(y + 3).toFixed(1)}" fill="var(--muted)" font-size="9">${Math.round(lv * scaleMax * 100)}%</text>`;
  }).join('');
  // Axis labels
  const axisLabels = axes.map((label, i) => {
    const [x, y] = gridPt(i, 1.18);
    let anchor = 'middle';
    const c = Math.cos(angle(i));
    if (Math.abs(c) > 0.3) anchor = c > 0 ? 'start' : 'end';
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" alignment-baseline="middle" fill="var(--muted)" font-size="11" font-weight="600">${label}</text>`;
  }).join('');
  // Reader polygons + dots
  const polys = Object.entries(readerValues).map(([id, vals]) => {
    const cfg = lookup(id);
    if (!cfg) return '';
    const pts = vals.map((v, i) => pt(i, v).map(x => x.toFixed(1)).join(',')).join(' ');
    const dots = vals.map((v, i) => {
      const [x, y] = pt(i, v);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="${cfg.colorVar}" stroke="#0f1115" stroke-width="1"/>`;
    }).join('');
    return `<polygon points="${pts}" fill="rgba(${cfg.colorRgb}, 0.18)" stroke="${cfg.colorVar}" stroke-width="2" stroke-linejoin="round"/>${dots}`;
  }).join('');
  // Legend
  const legend = Object.entries(readerValues).map(([id]) => {
    const cfg = lookup(id);
    if (!cfg) return '';
    return `<div class="radar-legend-item"><span class="radar-legend-dot" style="background: ${cfg.colorVar};"></span>${cfg.label}</div>`;
  }).join('');

  return `<div class="radar-wrap">
    <svg viewBox="0 0 ${w} ${h}" class="radar-svg" preserveAspectRatio="xMidYMid meet">
      ${gridPolys}${spokes}${gridLabels}${polys}${axisLabels}
    </svg>
    <div class="radar-legend">${legend}</div>
    <div class="radar-scale-note">Outer ring = ${Math.round(scaleMax * 100)}% (auto-scaled to fit)</div>
  </div>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Era radar helpers — shared by Home (Influence by era), Compare, and Profile.
// Buckets books by decade and exposes (a) the decade axes for the radar and
// (b) per-reader read-share values.
function bucketBooksByDecade(books) {
  const out = {};
  for (const b of books) {
    if (!b.year) continue;
    const d = Math.floor(b.year / 10) * 10;
    (out[d] = out[d] || []).push(b);
  }
  return out;
}
function eraRadarAxes(byDecade) {
  // Drop decades with fewer than 3 books so the chart doesn't get pinched by
  // outlier years. Sorted ascending so the spokes read left-to-right.
  return Object.keys(byDecade)
    .map(Number)
    .sort((a, b) => a - b)
    .filter(d => byDecade[d].length >= 3);
}
function eraAxisLabel(d) {
  const two = d % 100;
  return `${two < 10 ? '0' + two : two}s`;
}
function eraReaderValues(decades, byDecade, isReadFn) {
  return decades.map(d => {
    const books = byDecade[d] || [];
    if (books.length === 0) return 0;
    return books.filter(isReadFn).length / books.length;
  });
}
function mostReadDecade(books, isReadFn) {
  const counts = {};
  for (const b of books) {
    if (!b.year || !isReadFn(b)) continue;
    const d = Math.floor(b.year / 10) * 10;
    counts[d] = (counts[d] || 0) + 1;
  }
  let bestD = null, bestC = 0;
  for (const [d, c] of Object.entries(counts)) {
    if (c > bestC) { bestC = c; bestD = parseInt(d, 10); }
  }
  return bestD === null ? null : { decade: bestD, count: bestC };
}

// Cover-load handler — wired as an inline onload/onerror on every cover <img>.
// OpenLibrary returns a 60×40 "image not available" pixel when a cover ID has
// no actual scan, and a 404 is also a possibility. In either case we swap the
// img for a typographic fallback (serif title over a gradient) so the card
// stops looking broken. Exposed on window so inline handlers can call it.
window.__coverFallback = function(img) {
  if (!img || img.dataset.fellback === '1') return;
  // A successful image will have naturalWidth >= ~150. The OL placeholder is
  // 60x40; treat anything under 80 as broken.
  if (img.naturalWidth >= 80) return;
  img.dataset.fellback = '1';
  const card = img.closest('.card');
  const cover = img.closest('.card-cover, .swimlane-cover, .recent-read-cover');
  if (!cover) { img.style.display = 'none'; return; }
  const titleEl = card?.querySelector('.title, .swimlane-title, .rr-title');
  const title = titleEl?.textContent?.trim() || img.alt || '';
  cover.classList.add('cover-fallback');
  while (cover.firstChild) cover.removeChild(cover.firstChild);
  const inner = document.createElement('div');
  inner.className = 'cover-fallback-inner';
  const t = document.createElement('div');
  t.className = 'cover-fallback-title';
  t.textContent = title;
  inner.appendChild(t);
  cover.appendChild(inner);
};

function readerBadge(book, who) {
  if (!showReader(who)) return '';
  const cfg = READER_CONFIG[who];
  if (!cfg) return '';
  const rs = readStatus(book, who);
  // For 'me', label text comes from the Supabase status; for legacy CSV readers
  // gate on the presence of book[who] (raw status string from data.json).
  let text;
  if (who === 'me') {
    const status = window.MR_AUTH?.statusFor?.(book.id);
    if (status === 'read') text = 'Read';
    else if (status === 'started') text = 'Started';
    else if (status === 'nightstand') text = 'Nightstand';
    else return '';
  } else {
    if (!book[who]) return '';
    text = book[who];
  }
  const label = SOLO ? escapeHtml(text) : `<span class="reader-initial">${cfg.initial}</span>${escapeHtml(text)}`;
  if (rs === 'read') return `<span class="badge read ${cfg.cls}">${label}</span>`;
  if (rs === 'started' || (who === 'me' && window.MR_AUTH?.statusFor?.(book.id) === 'nightstand')) {
    return `<span class="badge queued ${cfg.cls}">${label}</span>`;
  }
  return '';
}

function bookCard(book) {
  const awardBadges = Object.entries(book.awards || {})
    .filter(([a]) => state.awards.has(a))
    .map(([a, s]) => `<span class="badge ${s}">${AWARD_LABELS[a]} ${s === 'winner' ? '★' : ''}</span>`)
    .join('');
  const readBadges = ACTIVE_READERS.map(r => readerBadge(book, r.id)).join('');
  const coverHtml = book.cover_url
    ? `<img src="${escapeHtml(book.cover_url)}" alt="" loading="lazy" onload="__coverFallback(this)" onerror="__coverFallback(this)">`
    : `<span class="cover-placeholder">📖</span>`;
  const author = escapeHtml(book.author_raw || (book.authors || []).join(', '));
  const authorLine = book.year ? `${author} <span class="meta-dot">·</span> ${book.year}` : author;
  return `<div class="card" data-id="${escapeHtml(book.id)}">
    <div class="card-cover">${coverHtml}</div>
    <div class="card-body">
      <div class="title">${escapeHtml(book.title)}</div>
      <div class="author">${authorLine}</div>
      <div class="badges">${awardBadges}${readBadges}</div>
    </div>
  </div>`;
}

function renderList() {
  pushFiltersToUrl();
  const filtered = DATA.books.filter(matchesFilters);
  const sorted = sortBooks(filtered);
  const activeFilters = [];
  if (state.authorGender && state.authorGender.size > 0 && state.authorGender.size < 3) {
    const names = { female: 'Female-authored', male: 'Male-authored', unknown: 'Unknown / pen name' };
    const label = [...state.authorGender].map(g => names[g]).join(' + ');
    activeFilters.push({ label, clear: 'gender' });
  }
  if (state.missingFilter && state.missingFilter.size > 0) {
    const names = { desc: 'Missing description', cover: 'Missing cover', link: 'Missing read link' };
    const label = [...state.missingFilter].map(k => names[k]).join(' or ');
    activeFilters.push({ label, clear: 'missing' });
  }
  if (state.meStatus && state.meStatus.size > 0 && state.meStatus.size < 3) {
    const names = { read: 'Read', nightstand: 'Nightstand', neither: 'Neither' };
    const label = 'Your status: ' + [...state.meStatus].map(s => names[s]).join(' + ');
    activeFilters.push({ label, clear: 'meStatus' });
  }
  $('#result-count').innerHTML = `${sorted.length} of ${DATA.books.length} books` +
    (activeFilters.length
      ? ' · ' + activeFilters.map(f => `<span class="active-filter-chip" data-clear="${f.clear}">${f.label} <span class="afc-x">×</span></span>`).join(' ')
      : '');
  $$('.active-filter-chip').forEach(chip => chip.addEventListener('click', () => {
    const w = chip.dataset.clear;
    if (w === 'gender') {
      state.authorGender = new Set(['female', 'male', 'unknown']);
      $$('input[name="author-gender"]').forEach(el => el.checked = true);
    }
    if (w === 'missing') {
      state.missingFilter = new Set();
      $$('input[name="missing"]').forEach(el => el.checked = false);
    }
    if (w === 'meStatus') {
      state.meStatus = new Set(['read', 'nightstand', 'neither']);
      $$('input[name="me-status"]').forEach(el => el.checked = true);
    }
    renderList();
  }));
  $('#grid').innerHTML = sorted.map(bookCard).join('');
  $$('.card', $('#grid')).forEach(card => {
    card.addEventListener('click', () => {
      location.hash = `#/books/${card.dataset.id}`;
    });
  });
}

function renderDetail(id) {
  const book = DATA.books.find(b => b.id === id);
  const root = $('#view-detail');
  if (!book) {
    root.innerHTML = `<div class="detail"><a href="#/" class="back">← back</a><h1>Not found</h1></div>`;
    return;
  }
  const awardRows = Object.entries(book.awards || {}).map(([a, s]) =>
    `<dt>${AWARD_LABELS[a]}</dt><dd><span class="badge ${s}">${s}${s === 'winner' ? ' ★' : ''}</span> · ${book.year || ''}</dd>`
  ).join('');
  const tomRs = readStatus(book, 'tom');
  const nikaRs = readStatus(book, 'nika');
  const tomLine = (book.tom && SHOW_TOM) ? `<dt>${SOLO === 'tom' ? 'Status' : 'Tom'}</dt><dd><span class="badge ${tomRs === 'read' ? 'read' : 'queued'}">${escapeHtml(book.tom)}</span></dd>` : '';
  const nikaLine = (book.nika && SHOW_NIKA) ? `<dt>${SOLO === 'nika' ? 'Status' : 'Nika'}</dt><dd><span class="badge ${nikaRs === 'read' ? 'read' : 'queued'} reader-n">${escapeHtml(book.nika)}</span></dd>` : '';
  const westdacRs = readStatus(book, 'westdac');
  const westdacLine = (book.westdac && SHOW_WESTDAC) ? `<dt>${SOLO === 'westdac' ? 'Status' : 'Westdac'}</dt><dd><span class="badge ${westdacRs === 'read' ? 'read' : 'queued'} reader-w">${escapeHtml(book.westdac)}</span></dd>` : '';
  const westdacShelfLine = (book.westdac_shelf && SHOW_WESTDAC) ? `<dt>On ${SOLO === 'westdac' ? 'the' : "Westdac's"} nightstand</dt><dd><span class="badge ${book.westdac_shelf === 'to-read' ? 'queued' : 'read'} reader-w">${book.westdac_shelf}</span></dd>` : '';
  const publisherLine = book.publisher ? `<dt>Publisher</dt><dd>${escapeHtml(book.publisher)}</dd>` : '';

  const searchQ = encodeURIComponent(`${book.title} ${book.authors[0] || ''}`);
  const coverUrl = book.cover_url || '';
  const coverHtml = coverUrl
    ? `<img src="${escapeHtml(coverUrl)}" alt="Cover of ${escapeHtml(book.title)}" loading="lazy">`
    : '📖';

  const shelfLine = (book.tom_shelf && SHOW_TOM) ? `<dt>On ${SOLO === 'tom' ? 'the' : "Tom's"} nightstand</dt><dd><span class="badge ${book.tom_shelf === 'to-read' ? 'queued' : 'read'}">${book.tom_shelf}</span></dd>` : '';
  const nikaShelfLine = (book.nika_shelf && SHOW_NIKA) ? `<dt>On ${SOLO === 'nika' ? 'the' : "Nika's"} nightstand</dt><dd><span class="badge ${book.nika_shelf === 'to-read' ? 'queued' : 'read'} reader-n">${book.nika_shelf}</span></dd>` : '';
  const seriesLine = book.series ? `<dt>Series</dt><dd>${escapeHtml(book.series)}</dd>` : '';
  const pagesLine = book.pages ? `<dt>Pages</dt><dd>${book.pages}</dd>` : '';
  const firstPubLine = book.first_pub_year ? `<dt>First published</dt><dd>${book.first_pub_year}</dd>` : '';
  const addToShelfBtn = (SHOW_TOM && !book.tom_shelf && tomRs !== 'read')
    ? `<a class="btn-primary" href="https://www.goodreads.com/search?q=${searchQ}" target="_blank" rel="noopener" title="Opens Goodreads search — click 'Want to Read' on the result">+ Add to Goodreads shelf</a>`
    : '';

  // Goodreads link: deep-link to /book/show/<id> when we have a harvested
  // Book Id (from the Goodreads CSV export → data/goodreads_ids.json),
  // otherwise fall back to a search URL.
  const goodreadsUrl = book.goodreads_id
    ? `https://www.goodreads.com/book/show/${encodeURIComponent(book.goodreads_id)}`
    : `https://www.goodreads.com/search?q=${searchQ}`;

  // Truncate long descriptions and clean up Open Library markup ([source][1] etc)
  let description = book.description || '';
  // Strip OL footnote-style refs like ([source][1]) and [1]: http://... blocks
  description = description.replace(/\(\[[^\]]+\]\[\d+\]\)/g, '').replace(/^\[\d+\]:.*$/gm, '').trim();
  const descHtml = description
    ? `<div class="book-description">${escapeHtml(description).split(/\n\n+/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('')}</div>`
    : '';

  const subjectsHtml = (book.subjects && book.subjects.length > 0)
    ? `<div class="book-subjects"><h3>Tags from Open Library</h3><div>${book.subjects.slice(0, 12).map(s => `<span class="subject-tag">${escapeHtml(s)}</span>`).join(' ')}</div></div>`
    : '';

  // More-by-this-author swimlane — books that share at least one author with
  // the current book, excluding the current one. Sorted by year desc so the
  // most recent reads sit on the left.
  const authorSet = new Set((book.authors || []).map(a => a.toLowerCase()));
  const moreByAuthor = authorSet.size === 0 ? [] : DATA.books
    .filter(b => b.id !== book.id && (b.authors || []).some(a => authorSet.has(a.toLowerCase())))
    .sort((a, b) => (b.year || 0) - (a.year || 0));
  const moreByAuthorLabel = book.authors && book.authors.length > 0
    ? `More by ${escapeHtml(book.authors[0])}${book.authors.length > 1 ? ' & co-authors' : ''}`
    : 'More by this author';
  const moreByAuthorHtml = moreByAuthor.length === 0 ? '' : `
    <div class="book-section">
      <h2>${moreByAuthorLabel} <span class="more-by-count">${moreByAuthor.length}</span></h2>
      <div class="swimlane-strip">${moreByAuthor.map(b => {
        const cover = b.cover_url
          ? `<img src="${escapeHtml(b.cover_url)}" alt="" loading="lazy" onload="__coverFallback(this)" onerror="__coverFallback(this)">`
          : `<span class="swimlane-placeholder">📖</span>`;
        const isWinner = Object.values(b.awards || {}).includes('winner');
        const awardLabels = Object.entries(b.awards || {}).map(([a, s]) =>
          `<span class="rr-pill rr-pill-${a === 'hugo' ? 'h' : 'n'}">${AWARD_LABELS[a]}${s === 'winner' ? ' ★' : ''}</span>`
        ).join('');
        return `<div class="swimlane-card" data-id="${escapeHtml(b.id)}">
          <div class="swimlane-cover${isWinner ? ' is-winner' : ''}">${cover}</div>
          <div class="swimlane-title">${escapeHtml(b.title)}</div>
          <div class="swimlane-meta">${b.year || ''} · ${escapeHtml(b.category)}</div>
          ${awardLabels ? `<div class="swimlane-pills">${awardLabels}</div>` : ''}
        </div>`;
      }).join('')}</div>
    </div>`;

  root.innerHTML = `<div class="detail">
    <a href="#/books" class="back">← back to books</a>
    <h1>${escapeHtml(book.title)}</h1>
    <div class="author-line">by ${escapeHtml(book.author_raw || book.authors.join(', '))}${book.series ? ` · <span class="series-inline">${escapeHtml(book.series)}</span>` : ''}</div>
    <div class="detail-grid">
      <div class="detail-cover">${coverHtml}</div>
      <div class="detail-info">
        <dl>
          <dt>Category</dt><dd>${escapeHtml(book.category)}</dd>
          ${seriesLine}
          ${publisherLine}
          ${firstPubLine}
          ${pagesLine}
          ${awardRows}
          ${tomLine}
          ${shelfLine}
          ${nikaLine}
          ${nikaShelfLine}
          ${westdacLine}
          ${westdacShelfLine}
        </dl>
        ${renderUserStatusControls(book.id)}
        ${addToShelfBtn ? `<div style="margin-top: 16px;">${addToShelfBtn}</div>` : ''}
        <div class="detail-links">
          ${(() => { const readUrl = book.publication_url || `https://bookshop.org/search?keywords=${searchQ}`; const host = new URL(readUrl).hostname.replace(/^www\./, ''); const favicon = `https://www.google.com/s2/favicons?domain=${host}&sz=32`; return `<a href="${escapeHtml(readUrl)}" target="_blank" rel="noopener" class="detail-link-read">Read Now <img src="${favicon}" alt="${escapeHtml(host)}" class="detail-link-favicon"></a>`; })()}
          <a href="${escapeHtml(goodreadsUrl)}" target="_blank" rel="noopener">Goodreads</a>
          <a href="https://app.thestorygraph.com/browse?search_term=${searchQ}" target="_blank" rel="noopener">StoryGraph</a>
        </div>
      </div>
    </div>
    ${descHtml ? `<div class="book-section"><h2>Description</h2>${descHtml}</div>` : ''}
    ${subjectsHtml ? `<div class="book-section">${subjectsHtml}</div>` : ''}
    ${moreByAuthorHtml}
  </div>`;
  wireUserStatusControls();
  $$('.swimlane-card', root).forEach(el => {
    el.addEventListener('click', () => { location.hash = `#/books/${el.dataset.id}`; });
  });
}

// Nightstand visual — books rendered as vertical spines stacked side by
// side on a "wooden" surface. Each spine is a colored rectangle with the
// title written vertically along it; clicking opens the book detail.
function buildNightstandShelf(books) {
  if (!books || books.length === 0) return '';
  // Deterministic per-book palette so the same book always picks the same
  // spine color across renders. A small hash on the book id picks a hue.
  const hueFor = (id) => {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
    return Math.abs(h) % 360;
  };
  const spines = books.map(b => {
    const hue = hueFor(b.id);
    // Two-tone spine: darker band on the left, lighter body. Suggests a
    // bound book without trying to look photorealistic.
    const bodyHsl = `hsl(${hue}, 38%, 32%)`;
    const bandHsl = `hsl(${hue}, 42%, 22%)`;
    const textHsl = `hsl(${hue}, 35%, 92%)`;
    const author = (b.authors && b.authors[0]) || '';
    return `<a class="spine" data-id="${escapeHtml(b.id)}" href="#/book/${escapeHtml(b.id)}"
        style="--body: ${bodyHsl}; --band: ${bandHsl}; --ink: ${textHsl};"
        title="${escapeHtml(b.title)} — ${escapeHtml(author)}">
      <span class="spine-title">${escapeHtml(b.title)}</span>
      <span class="spine-author">${escapeHtml(author)}</span>
    </a>`;
  }).join('');
  return `<div class="nightstand">
    <div class="nightstand-spines">${spines}</div>
    <div class="nightstand-surface"></div>
  </div>`;
}

// SVG donut chart via explicit arc paths. Earlier stroke-dasharray
// approach rendered segments at the wrong arc length under some browser
// quirks (visible coverage didn't match the expected percentages).
// Arc paths put exact start/end coordinates in the d attribute — what you
// see is what's in the path.
function buildDonut(slices, options = {}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total === 0) return '<p style="color: var(--muted); font-size: 13px;">No data.</p>';
  const size = options.size || 220;
  const cx = size / 2, cy = size / 2;
  const R = size * 0.36;
  const STROKE = options.stroke || 36;
  // Polar → cartesian. Angle 0° = 12 o'clock, then clockwise (screen y down).
  const polar = (angle) => {
    const rad = (angle - 90) * Math.PI / 180;
    return { x: cx + R * Math.cos(rad), y: cy + R * Math.sin(rad) };
  };
  let cursorAngle = 0;
  const segments = slices.map((s) => {
    const frac = s.value / total;
    if (frac <= 0) return '';
    const sweep = frac * 360;
    const startA = cursorAngle;
    const endA = cursorAngle + sweep;
    cursorAngle = endA;
    const p0 = polar(startA);
    const p1 = polar(endA);
    const largeArc = sweep > 180 ? 1 : 0;
    // Edge case: a single slice covering 100% — SVG arc can't draw a full
    // 360° arc in one command. Use two semicircles.
    let d;
    if (frac >= 1 - 1e-6) {
      const pMid = polar(startA + 180);
      d = `M ${p0.x},${p0.y} A ${R},${R} 0 1 1 ${pMid.x},${pMid.y} A ${R},${R} 0 1 1 ${p0.x},${p0.y}`;
    } else {
      d = `M ${p0.x},${p0.y} A ${R},${R} 0 ${largeArc} 1 ${p1.x},${p1.y}`;
    }
    return `<path class="donut-seg" data-key="${escapeHtml(s.key)}" d="${d}"
      fill="none" stroke="${s.color}" stroke-width="${STROKE}"></path>`;
  }).join('');
  const centerLabel = options.centerLabel || `${total}`;
  const centerSub = options.centerSub || '';
  return `<div class="donut-wrap">
    <svg class="donut" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
      <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="var(--bg-3)" stroke-width="${STROKE}" opacity="0.4"/>
      ${segments}
      <text x="${cx}" y="${cy - 4}" text-anchor="middle" class="donut-center-num" fill="var(--text)" font-size="${size * 0.16}" font-weight="700">${centerLabel}</text>
      <text x="${cx}" y="${cy + size * 0.10}" text-anchor="middle" fill="var(--muted)" font-size="${size * 0.06}">${centerSub}</text>
    </svg>
  </div>`;
}

// Callout grid — GigaOm-report-style stat cards. Each item:
//   { value, label, sublabel?, href?, color?, key? }
// Cards start at opacity 0 / translateY(12px); the IntersectionObserver wired
// in renderStats() adds .ready on intersection to trigger the fade-up.
function buildCalloutGrid(items, options = {}) {
  const cls = options.cls || '';
  return `<div class="callout-grid ${cls}">${items.map((it, i) => {
    const tag = it.href ? 'a' : 'div';
    const hrefAttr = it.href ? ` href="${it.href}"` : '';
    const accent = it.color ? ` style="--cc-accent: ${it.color};"` : '';
    const dataKey = it.key ? ` data-key="${escapeHtml(it.key)}"` : '';
    return `<${tag} class="callout-card"${hrefAttr}${accent}${dataKey} data-stagger="${i}">
      <div class="cc-value">${it.value}</div>
      <div class="cc-rule"></div>
      <div class="cc-label">${escapeHtml(it.label)}</div>
      ${it.sublabel ? `<div class="cc-sublabel">${it.sublabel}</div>` : ''}
      ${it.href ? `<div class="cc-arrow" aria-hidden="true">→</div>` : ''}
    </${tag}>`;
  }).join('')}</div>`;
}

// Featured banner for the Home page — a full-card promo per award. Combines
// the historical description (since/by whom/voting model) with the live 2026
// ballot promo. Each banner is self-contained: name + audience pill + history
// paragraph + ceremony info + finalist cover strip + scroll CTA.
//
// Outer container is a <div>, not <a>, so we can include book-link anchors for
// each cover without violating HTML's no-nested-anchor rule. A full-card
// overlay <a> makes the whole banner clickable.
function featuredBanner(opts) {
  const { theme, name, audience, since, descriptionHtml, ceremonyDate, ceremonyLoc, finalistsTagline, finalists, href } = opts;
  const pool = [...(finalists.Novel || []), ...(finalists.Novella || [])];
  const covers = pool.map(f => {
    const match = findBook(f.title, f.author, 'Novel')
      || findBook(f.title, f.author, 'Novella');
    if (match && match.cover_url) {
      return `<a class="featured-cover" href="#/book/${escapeHtml(match.id)}" title="${escapeHtml(f.title)} — ${escapeHtml(f.author)}">
        <img src="${escapeHtml(match.cover_url)}" alt="" loading="lazy" onload="__coverFallback(this)" onerror="__coverFallback(this)">
      </a>`;
    }
    return `<div class="featured-cover featured-cover-stub" title="${escapeHtml(f.title)} — ${escapeHtml(f.author)}">
      <div class="featured-cover-fallback">
        <div class="fc-title">${escapeHtml(f.title)}</div>
        <div class="fc-author">${escapeHtml(f.author)}</div>
      </div>
    </div>`;
  }).join('');
  return `<div class="featured-banner featured-full featured-${theme}">
    <a class="featured-banner-link" href="${href}" aria-label="${escapeHtml(name)} — view all finalists"></a>
    <div class="featured-head">
      <span class="featured-tag featured-tag-${theme}">${escapeHtml(name)}</span>
      <span class="awards-tag awards-tag-${audience.toLowerCase()}">${escapeHtml(audience)}</span>
      <span class="featured-since">since ${escapeHtml(since)}</span>
    </div>
    <div class="featured-description">${descriptionHtml}</div>
    <div class="featured-ceremony">
      <span class="featured-ceremony-label">2026 ceremony</span>
      <span class="featured-date">${escapeHtml(ceremonyDate)}</span>
      <span class="featured-loc">${escapeHtml(ceremonyLoc)}</span>
    </div>
    <div class="featured-finalists-label">${escapeHtml(finalistsTagline)}</div>
    <div class="featured-cover-strip">${covers}</div>
    <a class="featured-cta" href="${href}">View all finalists <span class="featured-arrow">→</span></a>
  </div>`;
}

function renderStats() {
  // Per-reader loops inside this function must include 'me' so signed-in
  // users (whose reader id is 'me') don't crash on map lookups.
  const READER_KEYS = [...ALL_READER_IDS, 'me'];
  // Status filter for everything on this page
  const STATUS = state.progressStatus;  // 'winner' | 'nominee' | 'both'
  const AWARD = state.progressAward;    // 'both' | 'hugo' | 'nebula'

  // Award scope: when AWARD == specific, only books that carry that award
  // (counting either winner or nominee status for it). When AWARD == 'both',
  // every book on the list is in scope.
  const inAwardScope = (b) => AWARD === 'both' || !!(b.awards || {})[AWARD];
  const isWinnerInScope = (b) => {
    if (AWARD === 'both') return Object.values(b.awards || {}).includes('winner');
    return (b.awards || {})[AWARD] === 'winner';
  };
  const scopedBooks = DATA.books.filter(inAwardScope);
  const winnersAll = scopedBooks.filter(isWinnerInScope);
  const nomineesAll = scopedBooks.filter(b => !isWinnerInScope(b));
  const allWinnersCount = winnersAll.length;
  const allNomineesCount = nomineesAll.length;
  const allBooksCount = scopedBooks.length;

  // When no readers are active (anon visitor) we suppress all per-reader
  // overlays so the page becomes a pure catalog. Each per-reader block below
  // checks HAS_READER before rendering anything user-specific.
  const HAS_READER = ACTIVE_READERS.length > 0;
  const PRIMARY_READER = HAS_READER ? (SOLO || ACTIVE_READERS[0].id) : null;

  // Award scope counts (for the second toggle)
  const hugoCount = DATA.books.filter(b => (b.awards || {}).hugo).length;
  const nebulaCount = DATA.books.filter(b => (b.awards || {}).nebula).length;

  // Which subset drives this render
  const winners = STATUS === 'winner' ? winnersAll
    : STATUS === 'nominee' ? nomineesAll
    : scopedBooks;
  const winnersTotal = winners.length;
  // Labels that adapt to filter
  const SUBSET = STATUS === 'winner' ? 'winners'
    : STATUS === 'nominee' ? 'nominees'
    : 'books';
  const SUBSET_CAP = SUBSET.charAt(0).toUpperCase() + SUBSET.slice(1);

  const winnersTom = winners.filter(b => readStatus(b, 'tom') === 'read');
  const winnersNika = winners.filter(b => readStatus(b, 'nika') === 'read');
  const winnersWestdac = winners.filter(b => readStatus(b, 'westdac') === 'read');
  const winnersColton = winners.filter(b => readStatus(b, 'colton') === 'read');
  const winnersSchupp = winners.filter(b => readStatus(b, 'schupp') === 'read');
  const winnersMe = winners.filter(b => readStatus(b, 'me') === 'read');
  const winnersEither = winners.filter(b => ACTIVE_READERS.some(r => readStatus(b, r.id) === 'read'));
  const winnersByReader = { me: winnersMe, tom: winnersTom, nika: winnersNika, westdac: winnersWestdac, colton: winnersColton, schupp: winnersSchupp };

  // Tom shelf overlap (books that are on his Goodreads to-read shelf AND in our list)
  const onShelf = DATA.books.filter(b => b.tom_shelf === 'to-read' && readStatus(b, 'tom') !== 'read');
  const currentlyReading = DATA.books.filter(b => b.tom_shelf === 'currently-reading');

  // Per-reader shelf count for solo headline
  const shelfCountByReader = {
    me: DATA.books.filter(b => onNightstand(b, 'me')).length,
    tom: DATA.books.filter(b => b.tom_shelf === 'to-read' && readStatus(b, 'tom') !== 'read').length,
    nika: DATA.books.filter(b => b.nika_shelf === 'to-read' && readStatus(b, 'nika') !== 'read').length,
    westdac: DATA.books.filter(b => b.westdac_shelf === 'to-read' && readStatus(b, 'westdac') !== 'read').length,
    colton: DATA.books.filter(b => b.colton_shelf === 'to-read' && readStatus(b, 'colton') !== 'read').length,
    schupp: DATA.books.filter(b => b.schupp_shelf === 'to-read' && readStatus(b, 'schupp') !== 'read').length,
  };
  const nikaOnShelfCount = shelfCountByReader.nika;
  const westdacOnShelfCount = shelfCountByReader.westdac;

  // This year (2026) — all readers
  const currentYear = new Date().getFullYear();
  const thisYearAll = DATA.books.filter(b => b.year === currentYear);
  const thisYearTomRead = thisYearAll.filter(b => readStatus(b, 'tom') === 'read');
  const thisYearNikaRead = thisYearAll.filter(b => readStatus(b, 'nika') === 'read');
  const thisYearWestdacRead = thisYearAll.filter(b => readStatus(b, 'westdac') === 'read');
  const thisYearTomShelf = thisYearAll.filter(b => b.tom_shelf === 'to-read');
  const thisYearNikaShelf = thisYearAll.filter(b => b.nika_shelf === 'to-read');
  const thisYearWestdacShelf = thisYearAll.filter(b => b.westdac_shelf === 'to-read');

  const emptyBucket = () => {
    const b = { total: 0 };
    for (const id of READER_KEYS) b[id] = 0;
    return b;
  };
  const byAward = {};
  for (const a of Object.keys(AWARD_LABELS)) byAward[a] = emptyBucket();
  for (const b of winners) {
    for (const a of Object.keys(b.awards || {})) {
      // When filtering to 'winner', only count this award if it was a winner status.
      // For 'nominee' subset, only count nominee statuses. For 'both', count any award.
      const s = b.awards[a];
      if (STATUS === 'winner' && s !== 'winner') continue;
      if (STATUS === 'nominee' && s !== 'nominee') continue;
      if (AWARD !== 'both' && a !== AWARD) continue;
      byAward[a].total++;
      for (const id of READER_KEYS) {
        if (readStatus(b, id) === 'read') byAward[a][id]++;
      }
    }
  }
  const byCategory = {};
  for (const b of winners) {
    byCategory[b.category] = byCategory[b.category] || emptyBucket();
    byCategory[b.category].total++;
    for (const id of READER_KEYS) {
      if (readStatus(b, id) === 'read') byCategory[b.category][id]++;
    }
  }

  const dated = winnersTom.filter(b => b.tom_date_read && /^\d{4}/.test(b.tom_date_read))
    .map(b => ({ ...b, _t: new Date(b.tom_date_read.replace(/-/g, '/')) }))
    .sort((a, b) => b._t - a._t);

  // Combined recent reads — union across active readers, deduped, sorted.
  // Includes the signed-in 'me' user via MR_AUTH.userBooks, plus any legacy
  // CSV reader that's been URL-activated for debug compare views.
  const recentEither = [];
  const seenRecent = new Set();
  const recentSources = [];
  if (showReader('me')) {
    const myBooks = window.MR_AUTH?.userBooks || {};
    const myRead = DATA.books
      .filter(b => myBooks[b.id]?.status === 'read')
      .map(b => ({ ...b, _meDate: myBooks[b.id]?.date_read || '' }))
      .sort((a, b) => (b._meDate || '').localeCompare(a._meDate || ''));
    recentSources.push(...myRead);
  }
  if (SHOW_TOM) recentSources.push(...dated, ...winnersTom);
  if (SHOW_NIKA) recentSources.push(...winnersNika);
  if (SHOW_WESTDAC) recentSources.push(...winnersWestdac);
  if (SHOW_COLTON) recentSources.push(...winnersColton);
  if (SHOW_SCHUPP) recentSources.push(...winnersSchupp);
  for (const b of recentSources) {
    if (seenRecent.has(b.id)) continue;
    seenRecent.add(b.id);
    recentEither.push(b);
  }
  // Sort by publication year (newest first) so the swimlane reads as a
  // chronological recap of "what you've read by year" rather than the
  // less stable "what you marked read most recently".
  recentEither.sort((a, b) => (b.year || 0) - (a.year || 0));

  // Combined nightstand across active readers, deduped, sorted.
  // 'me' uses MR_AUTH.userBooks status='nightstand'; legacy readers use
  // the CSV `<reader>_shelf === 'to-read'` columns.
  const nightstandBooks = [];
  const seenShelf = new Set();
  const myBooksForShelf = window.MR_AUTH?.userBooks || {};
  for (const b of DATA.books) {
    if (seenShelf.has(b.id)) continue;
    let on = false;
    if (showReader('me') && myBooksForShelf[b.id]?.status === 'nightstand') on = true;
    if (!on) {
      on = ACTIVE_READERS.some(r =>
        r.id !== 'me'
          && b[`${r.id}_shelf`] === 'to-read'
          && readStatus(b, r.id) !== 'read'
      );
    }
    if (on) {
      seenShelf.add(b.id);
      nightstandBooks.push(b);
    }
  }
  nightstandBooks.sort((a, b) => (b.year || 0) - (a.year || 0));

  // ===== Genre breakdown (winners only) =====
  const genreBuckets = {};
  for (const b of winners) {
    for (const g of (b.genres || [])) {
      if (!genreBuckets[g]) genreBuckets[g] = emptyBucket();
      genreBuckets[g].total++;
      if (readStatus(b, 'tom') === 'read') genreBuckets[g].tom++;
      if (readStatus(b, 'nika') === 'read') genreBuckets[g].nika++;
      if (readStatus(b, 'westdac') === 'read') genreBuckets[g].westdac++;
    }
  }

  // ===== Subgenre buckets (for radar + breakdown) =====
  const subBuckets = {};
  for (const b of winners) {
    for (const g of (b.subgenres || [])) {
      if (!subBuckets[g]) subBuckets[g] = emptyBucket();
      subBuckets[g].total++;
      for (const id of READER_KEYS) {
        if (readStatus(b, id) === 'read') subBuckets[g][id]++;
      }
    }
  }

  // ===== Primary genre buckets =====
  const primaryBuckets = {};
  for (const b of winners) {
    const p = b.primary_genre || 'Unclassified';
    if (!primaryBuckets[p]) primaryBuckets[p] = emptyBucket();
    primaryBuckets[p].total++;
    for (const id of READER_KEYS) {
      if (readStatus(b, id) === 'read') primaryBuckets[p][id]++;
    }
  }
  const primaryList = ['Science Fiction', 'Fantasy', 'Blend', 'Horror', 'Unclassified']
    .filter(p => primaryBuckets[p] && primaryBuckets[p].total > 0)
    .map(p => ({ name: p, ...primaryBuckets[p] }));

  // ===== Subgenre radar — top 8 most populated subgenres, with zero-rows dropped =====
  // First take the top 8 by population, then drop any axis where every active reader is 0.
  let RADAR_AXES = Object.entries(subBuckets)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 8)
    .map(([name]) => name);
  RADAR_AXES = RADAR_AXES.filter(g => {
    const bucket = subBuckets[g];
    if (!bucket) return false;
    return ACTIVE_READERS.some(r => (bucket[r.id] || 0) > 0);
  });
  const radarValues = {};
  for (const r of ACTIVE_READERS) {
    radarValues[r.id] = RADAR_AXES.map(g => {
      const bucket = subBuckets[g] || { total: 0 };
      return bucket.total > 0 ? bucket[r.id] / bucket.total : 0;
    });
  }
  const radarHtml = RADAR_AXES.length >= 3 ? buildRadar(RADAR_AXES, radarValues) : '<p style="color:var(--muted)">Not enough subgenre coverage in this view.</p>';
  const genres = Object.entries(genreBuckets)
    .map(([name, s]) => ({ name, ...s }))
    .sort((a, b) => b.total - a.total);

  // ===== Reader comparison (only when exactly 2 readers active) =====
  let comparisonHtml = '';
  if (ACTIVE_READERS.length === 2) {
    const [rA, rB] = ACTIVE_READERS;
    const both = [];
    const aOnly = [];
    const bOnly = [];
    const neither = [];
    for (const book of winners) {
      const aRead = readStatus(book, rA.id) === 'read';
      const bRead = readStatus(book, rB.id) === 'read';
      if (aRead && bRead) both.push(book);
      else if (aRead) aOnly.push(book);
      else if (bRead) bOnly.push(book);
      else neither.push(book);
    }
    [both, aOnly, bOnly, neither].forEach(arr => arr.sort((x, y) => (y.year || 0) - (x.year || 0)));

    const compTile = (b) => {
      const cover = b.cover_url
        ? `<img src="${escapeHtml(b.cover_url)}" alt="" loading="lazy" onload="__coverFallback(this)" onerror="__coverFallback(this)">`
        : `<span class="swimlane-placeholder">📖</span>`;
      const isWinner = Object.values(b.awards || {}).includes('winner');
      return `<div class="swimlane-card" data-id="${escapeHtml(b.id)}">
        <div class="swimlane-cover${isWinner ? ' is-winner' : ''}">${cover}</div>
        <div class="swimlane-title">${escapeHtml(b.title)}</div>
        <div class="swimlane-meta">${escapeHtml(b.authors[0] || '')} · ${b.year || ''}</div>
      </div>`;
    };

    const section = (title, items, sub, extraClass = '') => `
      <div class="comparison-quadrant ${extraClass}">
        <div class="comparison-quadrant-head">
          <h3>${title} <span class="comparison-count">${items.length}</span></h3>
          ${sub ? `<p style="color: var(--muted); font-size: 12px; margin: 2px 0 0;">${sub}</p>` : ''}
        </div>
        ${items.length === 0
          ? `<p style="color: var(--muted); font-size: 13px; padding: 12px 0;">— nothing here —</p>`
          : `<div class="swimlane-strip">${items.map(compTile).join('')}</div>`}
      </div>
    `;

    comparisonHtml = `
      <div class="progress-section comparison-block">
        <h2>${rA.label} vs ${rB.label} — set comparison</h2>
        <p style="color: var(--muted); font-size: 13px;">Across ${winnersTotal} ${SUBSET} on the list. Books with covers, sorted by publication year (newest first). Click any cover for details.</p>
        ${section(`<span style="color: ${rA.colorVar}">${rA.label}</span> ∩ <span style="color: ${rB.colorVar}">${rB.label}</span> — both have read`, both, 'Common ground — shared experience to talk about.')}
        ${section(`<span style="color: ${rA.colorVar}">${rA.label}</span> only`, aOnly, `Read by ${rA.label}, not ${rB.label} — what ${rA.label} could recommend.`)}
        ${section(`<span style="color: ${rB.colorVar}">${rB.label}</span> only`, bOnly, `Read by ${rB.label}, not ${rA.label} — what ${rB.label} could recommend.`, 'flip')}
        ${section(`Neither has read`, neither, 'The gap — uncovered ' + SUBSET + ' on the list, ready to be picked.')}
      </div>
    `;
  } else if (ACTIVE_READERS.length >= 3) {
    // 3+ readers: show pairwise comparison hint
    comparisonHtml = `
      <div class="progress-section">
        <h2>Reader comparison</h2>
        <p style="color: var(--muted); font-size: 13px;">Pairwise set-comparison view is available when exactly two readers are active. Try <code>?reader=tom,westdac</code> or <code>?reader=tom,nika</code>.</p>
      </div>
    `;
  }

  // ===== Genre-combination "vectors" =====
  const comboBuckets = {};
  for (const b of DATA.books) {
    const primary = b.primary_genre || '';
    const subs = (b.subgenres || []).slice().sort();
    if (!primary && subs.length === 0) continue;
    const key = primary + (subs.length ? ' / ' + subs.join(' + ') : '');
    if (!comboBuckets[key]) {
      comboBuckets[key] = { total: 0, winners: 0 };
      for (const id of READER_KEYS) comboBuckets[key][`${id}Read`] = 0;
    }
    comboBuckets[key].total++;
    if (Object.values(b.awards || {}).includes('winner')) comboBuckets[key].winners++;
    for (const id of READER_KEYS) {
      if (readStatus(b, id) === 'read') comboBuckets[key][`${id}Read`]++;
    }
  }
  // Keep combos with >= 3 samples; sort by win rate desc, then by total desc
  const genreVectors = Object.entries(comboBuckets)
    .filter(([, v]) => v.total >= 3)
    .map(([combo, v]) => ({ combo, ...v, winRate: v.winners / v.total }))
    .sort((a, b) => b.winRate - a.winRate || b.total - a.total)
    .slice(0, 15);

  // ===== Swimlanes — featured genres =====
  const swimlaneGenres = ['Time Travel', 'Horror', 'Military SF', 'Space Opera', 'Hard SF', 'Dystopian', 'First Contact', 'Cyberpunk'];
  const swimlanes = swimlaneGenres.map(g => {
    const books = DATA.books
      .filter(b => (b.genres || []).includes(g))
      .sort((a, b) => (b.year || 0) - (a.year || 0));
    return { genre: g, books };
  }).filter(s => s.books.length > 0);

  // ===== Author-gender breakdown (winners only) =====
  // Per-reader read counts so all active readers show in the gender cards.
  const genderBuckets = { male: 0, female: 0, unknown: 0 };
  const genderReadByReader = {};
  for (const id of READER_KEYS) genderReadByReader[id] = { male: 0, female: 0, unknown: 0 };
  for (const b of winners) {
    const g = b.primary_author_gender || 'unknown';
    if (!(g in genderBuckets)) continue;
    genderBuckets[g]++;
    for (const id of READER_KEYS) {
      if (readStatus(b, id) === 'read') genderReadByReader[id][g]++;
    }
  }

  // ===== Author leaderboard (sliding window) =====
  // Recomputed on slider input — extract as a closure so the input handler
  // can rebuild the rows without re-rendering the entire Stats page.
  const computeTopAuthors = (yearsBack) => {
    const now = new Date().getFullYear();
    const cutoff = yearsBack >= 100 ? -Infinity : now - yearsBack;
    const buckets = {};
    for (const b of DATA.books) {
      if (!b.year || b.year < cutoff) continue;
      for (const a of (b.authors || [])) {
        if (!buckets[a]) {
          buckets[a] = { total: 0, winners: 0 };
          for (const id of READER_KEYS) buckets[a][`${id}Read`] = 0;
        }
        buckets[a].total++;
        if (Object.values(b.awards || {}).includes('winner')) buckets[a].winners++;
        for (const id of READER_KEYS) {
          if (readStatus(b, id) === 'read') buckets[a][`${id}Read`]++;
        }
      }
    }
    const top = Object.entries(buckets)
      .map(([name, s]) => ({ name, ...s }))
      .sort((a, b) => b.total - a.total || b.winners - a.winners)
      .slice(0, 12);
    return { top, maxAppearances: top[0] ? top[0].total : 1 };
  };
  let { top: topAuthors, maxAppearances } = computeTopAuthors(state.authorWindow);

  const card = (h, v, sub, pct) => `<div class="stat-card">
    <h3>${h}</h3>
    <div class="stat-value">${v}</div>
    <div class="stat-sub">${sub}</div>
    ${pct != null ? `<div class="progress"><div class="progress-bar" style="width: ${Math.min(100, pct)}%"></div></div>` : ''}
  </div>`;

  const linkCard = (href, h, v, sub, pct) => `<a class="stat-card stat-card-link" href="${href}">
    <h3>${h}</h3>
    <div class="stat-value">${v}</div>
    <div class="stat-sub">${sub}</div>
    ${pct != null ? `<div class="progress"><div class="progress-bar" style="width: ${Math.min(100, pct)}%"></div></div>` : ''}
  </a>`;

  // Era bars — bucket winners by decade. Fill bars follow the active reader.
  const yearEnd = Math.max(...DATA.books.map(b => b.year).filter(y => y));
  const yearStart = Math.min(...DATA.books.map(b => b.year).filter(y => y));
  const eraBuckets = {};
  const firstDecade = Math.floor(yearStart / 10) * 10;
  const lastDecade = Math.floor(yearEnd / 10) * 10;
  for (let d = firstDecade; d <= lastDecade; d += 10) eraBuckets[d] = emptyBucket();
  for (const b of winners) {
    if (!b.year) continue;
    const dec = Math.floor(b.year / 10) * 10;
    if (!eraBuckets[dec]) continue;
    eraBuckets[dec].total++;
    for (const id of READER_KEYS) {
      if (readStatus(b, id) === 'read') eraBuckets[dec][id]++;
    }
  }
  const eras = Object.entries(eraBuckets).map(([d, v]) => [parseInt(d, 10), v]).sort((a, b) => a[0] - b[0]);
  const maxEra = Math.max(1, ...eras.map(([, v]) => v.total));
  const eraReader = PRIMARY_READER;
  const eraFillColor = eraReader ? READER_CONFIG[eraReader].colorVar : 'var(--accent)';
  // Vertical list of horizontal bars. Width = decade total ÷ busiest decade.
  // Filled inner bar = reader's reads in that decade.
  const eraBarsHtml = eras.map(([d, v]) => {
    const totalPct = (v.total / maxEra) * 100;
    const readCount = eraReader ? v[eraReader] : 0;
    const readWithinTotal = v.total > 0 ? (readCount / v.total) * 100 : 0;
    const countLine = HAS_READER ? `${readCount}/${v.total}` : `${v.total}`;
    const fillDiv = HAS_READER
      ? `<div class="era-row-fill" style="width:${readWithinTotal}%;background:${eraFillColor};"></div>`
      : '';
    return `<div class="era-row">
      <div class="era-row-label">${d % 100}s</div>
      <div class="era-row-track-wrap">
        <div class="era-row-track" style="width:${Math.max(3, totalPct)}%;">
          ${fillDiv}
        </div>
      </div>
      <div class="era-row-count">${countLine}</div>
    </div>`;
  }).join('');

  // Up Next: winners the active reader hasn't read AND isn't on their
  // nightstand. When signed in, use MR_AUTH.userBooks; otherwise fall back
  // to the legacy CSV 'tom' columns.
  const upNextReaderId = showReader('me') ? 'me' : (SOLO || 'tom');
  const meBooksUpNext = window.MR_AUTH?.userBooks || {};
  const upNext = winners
    .filter(b => {
      const r = upNextReaderId;
      if (r === 'me') {
        const status = meBooksUpNext[b.id]?.status;
        return status !== 'read' && status !== 'nightstand';
      }
      return readStatus(b, r) !== 'read' && !b[`${r}_shelf`];
    })
    .sort((a, b) => (b.year || 0) - (a.year || 0))
    .slice(0, 12);

  const readerPills = (b, mode) => {
    // mode = 'read' or 'shelf'. In solo mode, drop reader prefix.
    const pillClass = id => `rr-pill-${id[0]}`;
    if (SOLO) {
      const r = SOLO;
      if (mode === 'read' && readStatus(b, r) === 'read') return `<span class="rr-pill ${pillClass(r)}">read</span>`;
      if (mode === 'shelf' && b[`${r}_shelf`] === 'to-read' && readStatus(b, r) !== 'read') return `<span class="rr-pill ${pillClass(r)}">on nightstand</span>`;
      return '';
    }
    const pills = [];
    for (const r of ACTIVE_READERS) {
      if (mode === 'read' && readStatus(b, r.id) === 'read') {
        pills.push(`<span class="rr-pill ${pillClass(r.id)}">${r.initial} read</span>`);
      } else if (mode === 'shelf' && b[`${r.id}_shelf`] === 'to-read' && readStatus(b, r.id) !== 'read') {
        pills.push(`<span class="rr-pill ${pillClass(r.id)}">${r.initial} nightstand</span>`);
      }
    }
    return pills.join('');
  };

  const tile = (b, metaLine, pillsHtml = '') => {
    const coverHtml = b.cover_url
      ? `<img src="${escapeHtml(b.cover_url)}" alt="" loading="lazy" onload="__coverFallback(this)" onerror="__coverFallback(this)">`
      : '📖';
    return `<div class="recent-read" data-id="${escapeHtml(b.id)}">
      <div class="recent-read-cover">${coverHtml}</div>
      <div class="recent-read-info">
        <div class="rr-title">${escapeHtml(b.title)}</div>
        <div class="rr-meta">${metaLine}</div>
        ${pillsHtml ? `<div class="rr-pills">${pillsHtml}</div>` : ''}
      </div>
    </div>`;
  };

  // Recently-read swimlane: horizontal-scroll cards sorted by pub year desc.
  // Tail card links through to /#/books?meStatus=read for the full filtered
  // list. Cap displayed cards at 18 so the strip stays scannable.
  const swimlaneTile = (b) => {
    const cover = b.cover_url
      ? `<img src="${escapeHtml(b.cover_url)}" alt="" loading="lazy" onload="__coverFallback(this)" onerror="__coverFallback(this)">`
      : `<span class="swimlane-placeholder">📖</span>`;
    const isWinner = Object.values(b.awards || {}).includes('winner');
    return `<a class="swimlane-card" href="#/book/${escapeHtml(b.id)}">
      <div class="swimlane-cover${isWinner ? ' is-winner' : ''}">${cover}</div>
      <div class="swimlane-title">${escapeHtml(b.title)}</div>
      <div class="swimlane-meta">${escapeHtml(b.authors[0] || '')} · ${b.year || ''}</div>
    </a>`;
  };
  const recentEitherHtml = recentEither.slice(0, 18).map(swimlaneTile).join('')
    + (recentEither.length > 0
        ? `<a class="swimlane-card swimlane-view-all" href="#/books?meStatus=read">
            <div class="swimlane-cover swimlane-view-all-cover"><span>View all <br>→</span></div>
            <div class="swimlane-title">${recentEither.length} books</div>
            <div class="swimlane-meta">in /books</div>
          </a>`
        : '');

  const nightstandHtml = nightstandBooks.map(b =>
    tile(b, `${escapeHtml(b.authors[0] || '')} · ${b.year} ${Object.entries(b.awards).map(([a, s]) => `${AWARD_LABELS[a]}${s === 'winner' ? ' ★' : ''}`).join(' · ')}`, readerPills(b, 'shelf'))
  ).join('');

  const upNextHtml = upNext.map(b => {
    const ws = Object.entries(b.awards).filter(([, s]) => s === 'winner').map(([a]) => AWARD_LABELS[a]);
    const ns = Object.entries(b.awards).filter(([, s]) => s === 'nominee').map(([a]) => AWARD_LABELS[a]);
    const awardLabel = ws.length ? `${ws.join(' · ')} winner` : (ns.length ? `${ns.join(' · ')} nominee` : '');
    return tile(b, `${escapeHtml(b.authors[0] || '')} · ${b.year || ''} ${awardLabel}`.trim());
  }).join('');

  const root = $('#view-stats');

  // Top authors leaderboard — extracted so the slider can recompute without
  // re-rendering the whole Stats view.
  const renderAuthorRows = (top, maxApp) => top.map((a, idx) => {
    const widthPct = (a.total / maxApp) * 100;
    let countCol;
    if (SOLO) {
      const key = SOLO + 'Read';
      countCol = `${a.total} appearances · <span style="color:${READER_CONFIG[SOLO].colorVar}">read ${a[key] || 0}</span>`;
    } else if (HAS_READER) {
      const parts = ACTIVE_READERS.map(r => `<span style="color:${r.colorVar}">${r.initial} ${a[r.id + 'Read'] || 0}</span>`);
      countCol = `${a.total} · ${parts.join(' · ')}`;
    } else {
      countCol = `${a.total} appearances · <span style="color: var(--accent)">${a.winners} wins</span>`;
    }
    let leftAcc = 0;
    const fillBars = ACTIVE_READERS.map(r => {
      const fillPct = a.total > 0 ? (a[r.id + 'Read'] / a.total) * 100 : 0;
      const cls = r.id === 'tom' ? 'author-bar-tom' : (r.id === 'nika' ? 'author-bar-nika' : 'author-bar-westdac');
      const html = `<div class="${cls}" style="width: ${fillPct}%; left: ${leftAcc}%;" title="${r.label} read ${a[r.id + 'Read']}"></div>`;
      leftAcc += fillPct;
      return html;
    }).join('');
    return `<div class="author-row" style="animation-delay: ${idx * 0.04}s;">
      <div class="author-name">${escapeHtml(a.name)}</div>
      <div class="author-bar">
        <div class="author-bar-bg" style="--bar-width: ${widthPct}%;">${fillBars}</div>
      </div>
      <div class="author-count">${countCol}</div>
    </div>`;
  }).join('');
  const authorRows = renderAuthorRows(topAuthors, maxAppearances);

  root.innerHTML = `<div class="detail">
    ${awardFeaturedBannersHtml()}
    <h1>Home</h1>
    <div class="toggle-row">
      <div class="status-toggle" data-status="${STATUS}">
        <button class="status-tab${STATUS === 'winner' ? ' active' : ''}" data-status="winner">Winners <span class="status-count">${allWinnersCount}</span></button>
        <button class="status-tab${STATUS === 'nominee' ? ' active' : ''}" data-status="nominee">Nominees <span class="status-count">${allNomineesCount}</span></button>
        <button class="status-tab${STATUS === 'both' ? ' active' : ''}" data-status="both">Both <span class="status-count">${allBooksCount}</span></button>
      </div>
      <div class="status-toggle award-toggle" data-award="${AWARD}">
        <button class="status-tab${AWARD === 'both' ? ' active' : ''}" data-award="both">Both <span class="status-count">${DATA.books.length}</span></button>
        <button class="status-tab status-tab-hugo${AWARD === 'hugo' ? ' active' : ''}" data-award="hugo">Hugo <span class="status-count">${hugoCount}</span></button>
        <button class="status-tab status-tab-nebula${AWARD === 'nebula' ? ' active' : ''}" data-award="nebula">Nebula <span class="status-count">${nebulaCount}</span></button>
      </div>
    </div>

    <div class="headline-grid">
      ${(() => {
        const totalLabel = STATUS === 'both' ? 'Books on the list' : `${SUBSET_CAP} on the list`;
        const totalSub = STATUS === 'both' ? `${allWinnersCount} winners + ${allNomineesCount} nominees` : 'Hugo + Nebula combined';
        if (!HAS_READER) {
          // Anon: just the total card.
          return card(totalLabel, winnersTotal, totalSub);
        }
        if (SOLO) {
          const r = SOLO;
          const readBooks = winnersByReader[r];
          const shelfCount = shelfCountByReader[r] || 0;
          const startedCount = DATA.books.filter(b => readStatus(b, r) === 'started').length;
          return `
            ${card(totalLabel, winnersTotal, totalSub)}
            ${card('Read', readBooks.length, `${(readBooks.length / winnersTotal * 100).toFixed(1)}% of ${SUBSET}`, readBooks.length / winnersTotal * 100)}
            ${card('On the nightstand', shelfCount, 'from this list')}
            ${card('Queued / started', startedCount, 'across all categories')}
          `;
        }
        const readerCards = ACTIVE_READERS.map(r => {
          const n = winnersByReader[r.id].length;
          return card(`${r.label} read`, n, `${(n / winnersTotal * 100).toFixed(1)}% of ${SUBSET}`, n / winnersTotal * 100);
        }).join('');
        return `${card(totalLabel, winnersTotal, totalSub)}${readerCards}`;
      })()}
    </div>

    ${HAS_READER && recentEither.length > 0 ? `<section class="featured-shelf featured-shelf-recent">
      <div class="featured-shelf-head">
        <div>
          <h2>Recently read</h2>
          <p style="color: var(--muted); font-size: 13px; margin: 4px 0 0;">Sorted by publication year, newest first.</p>
        </div>
        <a class="featured-shelf-cta" href="#/books?meStatus=read">View all <span class="featured-arrow">→</span></a>
      </div>
      <div class="swimlane-strip">${recentEitherHtml}</div>
    </section>` : ''}

    ${HAS_READER && nightstandBooks.length > 0 ? `<section class="featured-shelf featured-shelf-nightstand">
      <div class="featured-shelf-head">
        <div>
          <h2>On the nightstand <span class="featured-shelf-count">${nightstandBooks.length}</span></h2>
          <p style="color: var(--muted); font-size: 13px; margin: 4px 0 0;">Books you have, but haven't finished yet.</p>
        </div>
        <a class="featured-shelf-cta" href="#/books?meStatus=nightstand">View all <span class="featured-arrow">→</span></a>
      </div>
      ${buildNightstandShelf(nightstandBooks)}
    </section>` : ''}

    ${HAS_READER && upNext.length > 0 ? `<section class="featured-shelf featured-shelf-upnext">
      <div class="featured-shelf-head">
        <div>
          <h2>Up next</h2>
          <p style="color: var(--muted); font-size: 13px; margin: 4px 0 0;">Recent winners on no nightstand yet. Open one to add it to your shelf.</p>
        </div>
        <a class="featured-shelf-cta" href="#/books?status=winner">View all <span class="featured-arrow">→</span></a>
      </div>
      <div class="recent-reads">${upNextHtml}</div>
    </section>` : ''}

    <div class="progress-section">
      <div class="authors-head">
        <div>
          <h2>Most-awarded authors <span class="authors-window-display" id="authors-window-display">${state.authorWindow >= 100 ? 'all time' : `last ${state.authorWindow} years`}</span></h2>
          <p style="color: var(--muted); font-size: 13px;">Authors with the most appearances on the list (winners + nominees). Drag the slider to change the time window. Bar width = appearances.</p>
        </div>
      </div>
      <div class="authors-slider-wrap">
        <span class="authors-slider-mark">5y</span>
        <input type="range" id="authors-window" class="authors-slider" min="5" max="75" step="5" value="${state.authorWindow}">
        <span class="authors-slider-mark">75y</span>
        <button type="button" class="authors-slider-all" id="authors-window-all"${state.authorWindow >= 100 ? ' aria-pressed="true"' : ''}>All time</button>
      </div>
      <div class="authors-list" id="authors-list">${authorRows}</div>
    </div>

    <div class="progress-section era-coverage-section">
      <h2>Coverage by era</h2>
      <p style="color: var(--muted); font-size: 13px;">Bar width = ${SUBSET} that decade${HAS_READER ? ' · filled portion = ' + escapeHtml(READER_CONFIG[PRIMARY_READER].label) + ' read' : ''}.</p>
      <div class="era-rows">${eraBarsHtml}</div>
    </div>

    ${HAS_READER ? (() => {
      // Influence by era — spider chart over DATA.books (winners + nominees,
      // not the SUBSET). Each axis = a decade with at least 3 books; value =
      // share of that decade the reader has finished.
      const byDecade = bucketBooksByDecade(DATA.books);
      const decades = eraRadarAxes(byDecade);
      if (decades.length < 3) return '';
      const axes = decades.map(eraAxisLabel);
      const values = {};
      for (const r of ACTIVE_READERS) {
        values[r.id] = eraReaderValues(decades, byDecade, (b) => readStatus(b, r.id) === 'read');
      }
      const mrd = ACTIVE_READERS
        .map(r => {
          const m = mostReadDecade(DATA.books, (b) => readStatus(b, r.id) === 'read');
          return m ? `<span style="color:${r.colorVar}"><strong>${r.label}</strong> · most-read ${eraAxisLabel(m.decade)} (${m.count})</span>` : '';
        })
        .filter(Boolean)
        .join(' &nbsp;·&nbsp; ');
      return `<div class="progress-section radar-hero">
        <h2>Influence by era</h2>
        <p style="color: var(--muted); font-size: 13px;">Each axis = a decade. Distance from center = % of that decade's winners + finalists this reader has read.</p>
        ${buildRadar(axes, values)}
        ${mrd ? `<p class="era-radar-stats">${mrd}</p>` : ''}
      </div>`;
    })() : ''}

    ${comparisonHtml}

    <div class="progress-section">
      <h2>By author gender (${SUBSET})</h2>
      <p style="color: var(--muted); font-size: 13px;">Primary author of each work, inferred from first name. Tap a slice or card to filter the Books tab.</p>
      <div class="gender-chart-wrap">
        ${buildDonut(
          [
            { key: 'female',  label: 'Female-authored',  value: genderBuckets.female,  color: 'var(--accent-2)' },
            { key: 'male',    label: 'Male-authored',    value: genderBuckets.male,    color: 'var(--accent)'  },
            { key: 'unknown', label: 'Unknown / pen name', value: genderBuckets.unknown, color: 'var(--accent-3)' },
          ],
          {
            size: 220,
            centerLabel: String(genderBuckets.female + genderBuckets.male + genderBuckets.unknown),
            centerSub: SUBSET,
          }
        )}
        ${buildCalloutGrid(
          [
            { key: 'female', label: 'Female-authored', color: 'var(--accent-2)' },
            { key: 'male', label: 'Male-authored', color: 'var(--accent)' },
            { key: 'unknown', label: 'Unknown / pen name', color: 'var(--accent-3)' },
          ].map(({ key, label, color }) => {
            const total = genderBuckets[key];
            const pctOfAll = winnersTotal > 0 ? Math.round(total / winnersTotal * 100) : 0;
            const readerLine = HAS_READER
              ? ACTIVE_READERS.map(r => {
                  const read = genderReadByReader[r.id][key];
                  const pct = total > 0 ? Math.round(read / total * 100) : 0;
                  return `<span style="color:${r.colorVar}">${r.label} ${read}/${total} (${pct}%)</span>`;
                }).join(' · ')
              : '';
            const statusParam = STATUS === 'both' ? '' : `&status=${STATUS}`;
            return {
              key,
              value: total,
              label,
              sublabel: `${pctOfAll}% of ${SUBSET}${readerLine ? ' · ' + readerLine : ''}`,
              href: `#/books?gender=${key}${statusParam}`,
              color,
            };
          }),
          { cls: 'callout-grid-stack' }
        )}
      </div>
    </div>

    <div class="progress-section">
      <h2>By award (${SUBSET})</h2>
      <p style="color: var(--muted); font-size: 13px;">Tap a card to see those ${SUBSET} in the Books tab.${HAS_READER ? ' Sublabel shows your read share.' : ''}</p>
      ${buildCalloutGrid(
        Object.entries(byAward).filter(([, s]) => s.total > 0).map(([a, s]) => {
          const activeCount = PRIMARY_READER ? s[PRIMARY_READER] : 0;
          const pct = HAS_READER ? Math.round(activeCount / s.total * 100) : 0;
          const statusParam = STATUS === 'both' ? '' : `&status=${STATUS}`;
          return {
            key: a,
            value: s.total,
            label: `${AWARD_LABELS[a]} ${SUBSET}`,
            sublabel: HAS_READER ? `${activeCount} read · ${pct}% complete` : '',
            color: a === 'hugo' ? 'var(--sf)' : 'var(--fantasy)',
            href: `#/books?award=${a}${statusParam}`,
          };
        })
      )}
    </div>

    <div class="progress-section">
      <h2>By category (${SUBSET})</h2>
      <p style="color: var(--muted); font-size: 13px;">Tap a card to see those ${SUBSET} in the Books tab.</p>
      ${buildCalloutGrid(
        Object.entries(byCategory).filter(([, s]) => s.total > 0).map(([c, s], i) => {
          const activeCount = PRIMARY_READER ? s[PRIMARY_READER] : 0;
          const pct = HAS_READER ? Math.round(activeCount / s.total * 100) : 0;
          const statusParam = STATUS === 'both' ? '' : `&status=${STATUS}`;
          const palette = ['var(--accent)', 'var(--accent-2)', 'var(--accent-3)', 'var(--accent-4)', 'var(--accent-5)'];
          return {
            key: c,
            value: s.total,
            label: c,
            sublabel: HAS_READER ? `${activeCount} read · ${pct}% complete` : '',
            color: palette[i % palette.length],
            href: `#/books?category=${encodeURIComponent(c)}${statusParam}`,
          };
        })
      )}
    </div>


    <div class="progress-section progress-genre-link">
      <p style="color: var(--muted); font-size: 13px;">Looking for genre breakdowns, the subgenre fingerprint, or the genre-vector win-rate table? They're on the <a href="#/genre">Genre</a> tab.</p>
    </div>
  </div>`;

  $$('.recent-read, .swimlane-card', root).forEach(el => {
    el.addEventListener('click', () => { location.hash = `#/books/${el.dataset.id}`; });
  });
  $$('.status-tab', root).forEach(btn => {
    btn.addEventListener('click', () => {
      const newStatus = btn.dataset.status;
      const newAward = btn.dataset.award;
      if (newStatus && state.progressStatus !== newStatus) {
        state.progressStatus = newStatus;
        renderStats();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (newAward && state.progressAward !== newAward) {
        state.progressAward = newAward;
        renderStats();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });

  // Donut slice click — navigate to filtered Books view
  $$('.donut-seg', root).forEach(seg => {
    seg.addEventListener('click', () => {
      const key = seg.dataset.key;
      if (!key) return;
      const statusParam = STATUS === 'both' ? '' : `&status=${STATUS}`;
      location.hash = `#/books?gender=${key}${statusParam}`;
    });
  });

  // Fade-up callout cards on scroll — same pattern as the GigaOm benchmark
  // reports. Each card gets a stagger delay from its data-stagger index so
  // siblings in a row cascade in. Observer disconnects after firing to avoid
  // re-triggering on scroll.
  const cards = $$('.callout-card', root);
  if (cards.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const card = e.target;
          const stagger = parseInt(card.dataset.stagger || '0', 10);
          card.style.transitionDelay = `${stagger * 80}ms`;
          card.classList.add('ready');
          io.unobserve(card);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    cards.forEach(c => io.observe(c));
  } else {
    // No IO support → just mark them ready so they're not invisible
    cards.forEach(c => c.classList.add('ready'));
  }

  // Author-window slider: recompute in place, no full page re-render.
  const slider = $('#authors-window', root);
  const sliderAll = $('#authors-window-all', root);
  const sliderLabel = $('#authors-window-display', root);
  const authorsListEl = $('#authors-list', root);
  const updateAuthors = (years) => {
    state.authorWindow = years;
    if (sliderLabel) sliderLabel.textContent = years >= 100 ? 'all time' : `last ${years} years`;
    if (sliderAll) sliderAll.setAttribute('aria-pressed', years >= 100 ? 'true' : 'false');
    const { top, maxAppearances: m } = computeTopAuthors(years);
    if (authorsListEl) authorsListEl.innerHTML = renderAuthorRows(top, m);
  };
  if (slider) {
    slider.addEventListener('input', e => updateAuthors(parseInt(e.target.value, 10)));
  }
  if (sliderAll) {
    sliderAll.addEventListener('click', () => {
      slider.value = 75;
      updateAuthors(100);  // 100+ means all time
    });
  }
}

// Hand-curated list of 2026 Nebula finalists for Novel + Novella.
// Source: https://nebulas.sfwa.org/9192-2/
const NEBULA_2026_FINALISTS = {
  Novel: [
    { title: 'When We Were Real',          author: 'Daryl Gregory',         publisher: 'Saga' },
    { title: 'The Buffalo Hunter Hunter',  author: 'Stephen Graham Jones',  publisher: 'Saga; Titan UK' },
    { title: 'Katabasis',                  author: 'R.F. Kuang',            publisher: 'Harper Voyager US; Harper Voyager UK' },
    { title: 'Death of the Author',        author: 'Nnedi Okorafor',        publisher: 'Morrow; Gollancz' },
    { title: 'The Incandescent',           author: 'Emily Tesh',            publisher: 'Tor; Orbit UK' },
    { title: 'Sour Cherry',                author: 'Natalia Theodoridou',   publisher: 'Tin House; Wildfire' },
    { title: 'Wearing the Lion',           author: 'John Wiswell',          publisher: 'DAW; Arcadia' },
  ],
  Novella: [
    { title: "Disgraced Return of the Kap's Needle", author: 'Renan Bernardo',   publisher: 'Dark Matter INK' },
    { title: 'The River Has Roots',                   author: 'Amal El-Mohtar',  publisher: 'Tordotcom; Arcadia' },
    { title: 'The Death of Mountains',                author: 'Jordan Kurella',  publisher: 'Lethe' },
    { title: 'Automatic Noodle',                      author: 'Annalee Newitz',  publisher: 'Tordotcom' },
    { title: 'But Not Too Bold',                      author: 'Hache Pueyo',     publisher: 'Tordotcom' },
    { title: 'Descent',                               author: 'Wole Talabi',     publisher: 'Clarkesworld, May 2025' },
  ],
};

// Hand-curated list of 2026 Hugo finalists for Novel + Novella.
// Source: https://www.thehugoawards.org/hugo-history/2026-hugo-awards/
const HUGO_2026_FINALISTS = {
  Novel: [
    { title: 'A Drop of Corruption',  author: 'Robert Jackson Bennett', publisher: 'Del Rey; Hodderscape' },
    { title: 'Death of the Author',   author: 'Nnedi Okorafor',          publisher: 'William Morrow; Gollancz' },
    { title: 'Shroud',                author: 'Adrian Tchaikovsky',      publisher: 'Tor UK; Orbit US' },
    { title: 'The Everlasting',       author: 'Alix E. Harrow',          publisher: 'Tor US; Tor UK' },
    { title: 'The Incandescent',      author: 'Emily Tesh',              publisher: 'Tor US; Orbit UK' },
    { title: 'The Raven Scholar',     author: 'Antonia Hodgson',         publisher: 'Orbit US; Hodderscape' },
  ],
  Novella: [
    { title: 'Automatic Noodle',      author: 'Annalee Newitz',          publisher: 'Tordotcom' },
    { title: 'Cinder House',          author: 'Freya Marske',            publisher: 'Tordotcom; Tor UK' },
    { title: 'Murder by Memory',      author: 'Olivia Waite',            publisher: 'Tordotcom' },
    { title: 'The River Has Roots',   author: 'Amal El-Mohtar',          publisher: 'Tordotcom; Arcadia UK' },
    { title: 'The Summer War',        author: 'Naomi Novik',             publisher: 'Del Rey US; Del Rey UK' },
    { title: 'What Stalks the Deep',  author: 'T. Kingfisher',           publisher: 'Nightfire; Titan UK' },
  ],
};

// ===== Genre tab =========================================================
// Consolidates everything genre-related: primary breakdown, subgenre detail,
// subgenre fingerprint radar, win-rate vector table, and the browse-by-genre
// swimlanes. Operates on the full catalog (no Hugo-only/winner-only filter)
// because genre is mostly useful as an at-a-glance view of the whole list.
function renderGenre() {
  const root = $('#view-genre');
  if (!root) return;

  const READER_KEYS = [...ALL_READER_IDS, 'me'];
  const HAS_READER = ACTIVE_READERS.length > 0;
  const PRIMARY_READER = HAS_READER ? (SOLO || ACTIVE_READERS[0].id) : null;

  // Same Status + Award toggles as the Home page — bucket buttons drive the
  // whole Genre tab, so swapping winners/nominees or hugo/nebula re-counts
  // every chart and bar list below.
  const STATUS = state.progressStatus;  // 'winner' | 'nominee' | 'both'
  const AWARD = state.progressAward;    // 'both' | 'hugo' | 'nebula'
  const inAwardScope = (b) => AWARD === 'both' || !!(b.awards || {})[AWARD];
  const matchesStatusAward = (b) => {
    if (!inAwardScope(b)) return false;
    const entries = Object.entries(b.awards || {}).filter(([a]) => AWARD === 'both' || a === AWARD);
    if (STATUS === 'both') return entries.length > 0;
    return entries.some(([, s]) => s === STATUS);
  };
  const scopedBooks = DATA.books.filter(matchesStatusAward);
  const allHugoCount = DATA.books.filter(b => (b.awards || {}).hugo).length;
  const allNebulaCount = DATA.books.filter(b => (b.awards || {}).nebula).length;
  const allWinnersCount = DATA.books.filter(b => Object.values(b.awards || {}).includes('winner')).length;
  const allNomineesCount = DATA.books.filter(b => Object.values(b.awards || {}).includes('nominee')).length;

  const emptyBucket = () => {
    const b = { total: 0 };
    for (const id of READER_KEYS) b[id] = 0;
    return b;
  };

  // Subgenre buckets (a book can be tagged with multiple subgenres)
  const subBuckets = {};
  for (const b of scopedBooks) {
    for (const g of (b.subgenres || [])) {
      if (!subBuckets[g]) subBuckets[g] = emptyBucket();
      subBuckets[g].total++;
      for (const id of READER_KEYS) {
        if (readStatus(b, id) === 'read') subBuckets[g][id]++;
      }
    }
  }

  // Primary genre buckets (single top-level label per book)
  const primaryBuckets = {};
  for (const b of scopedBooks) {
    const p = b.primary_genre || 'Unclassified';
    if (!primaryBuckets[p]) primaryBuckets[p] = emptyBucket();
    primaryBuckets[p].total++;
    for (const id of READER_KEYS) {
      if (readStatus(b, id) === 'read') primaryBuckets[p][id]++;
    }
  }
  const primaryList = ['Science Fiction', 'Fantasy', 'Blend', 'Horror', 'Unclassified']
    .filter(p => primaryBuckets[p] && primaryBuckets[p].total > 0)
    .map(p => ({ name: p, ...primaryBuckets[p] }));

  // Primary-genre radar — axes are the primary genres themselves so the
  // shape shows where each reader has put their time. Values = % of that
  // genre's scoped books they've read.
  const PRIMARY_RADAR_AXES = primaryList.map(g => g.name);
  const primaryRadarValues = {};
  for (const r of ACTIVE_READERS) {
    primaryRadarValues[r.id] = PRIMARY_RADAR_AXES.map(g => {
      const bucket = primaryBuckets[g] || { total: 0 };
      return bucket.total > 0 ? bucket[r.id] / bucket.total : 0;
    });
  }
  const primaryRadarHtml = (HAS_READER && PRIMARY_RADAR_AXES.length >= 3)
    ? buildRadar(PRIMARY_RADAR_AXES, primaryRadarValues)
    : '';

  // Radar (subgenre fingerprint) — top 8 most-populated subgenres, dropping
  // axes where every active reader is at zero so the chart isn't sparse.
  let RADAR_AXES = Object.entries(subBuckets)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 8)
    .map(([name]) => name);
  RADAR_AXES = RADAR_AXES.filter(g => ACTIVE_READERS.some(r => (subBuckets[g][r.id] || 0) > 0));
  const radarValues = {};
  for (const r of ACTIVE_READERS) {
    radarValues[r.id] = RADAR_AXES.map(g => {
      const bucket = subBuckets[g] || { total: 0 };
      return bucket.total > 0 ? bucket[r.id] / bucket.total : 0;
    });
  }
  const radarHtml = RADAR_AXES.length >= 3
    ? buildRadar(RADAR_AXES, radarValues)
    : '<p style="color:var(--muted)">Not enough subgenre coverage to draw the radar yet.</p>';

  // Genre vectors — primary genre + sorted subgenre combinations
  const comboBuckets = {};
  for (const b of DATA.books) {
    const primary = b.primary_genre || '';
    const subs = (b.subgenres || []).slice().sort();
    if (!primary && subs.length === 0) continue;
    const key = primary + (subs.length ? ' / ' + subs.join(' + ') : '');
    if (!comboBuckets[key]) {
      comboBuckets[key] = { total: 0, winners: 0 };
      for (const id of READER_KEYS) comboBuckets[key][`${id}Read`] = 0;
    }
    comboBuckets[key].total++;
    if (Object.values(b.awards || {}).includes('winner')) comboBuckets[key].winners++;
    for (const id of READER_KEYS) {
      if (readStatus(b, id) === 'read') comboBuckets[key][`${id}Read`]++;
    }
  }
  const genreVectors = Object.entries(comboBuckets)
    .filter(([, v]) => v.total >= 3)
    .map(([combo, v]) => ({ combo, ...v, winRate: v.winners / v.total }))
    .sort((a, b) => b.winRate - a.winRate || b.total - a.total)
    .slice(0, 15);

  // Featured-genre swimlanes
  const swimlaneGenres = ['Time Travel', 'Horror', 'Military SF', 'Space Opera', 'Hard SF', 'Dystopian', 'First Contact', 'Cyberpunk'];
  const swimlanes = swimlaneGenres.map(g => {
    const books = DATA.books
      .filter(b => (b.genres || []).includes(g))
      .sort((a, b) => (b.year || 0) - (a.year || 0));
    return { genre: g, books };
  }).filter(s => s.books.length > 0);

  const renderBars = (rows) => rows.map(g => {
    const activeRead = PRIMARY_READER ? g[PRIMARY_READER] : 0;
    const pct = (HAS_READER && g.total > 0) ? (activeRead / g.total) * 100 : 0;
    const sub = !HAS_READER ? ''
      : (SOLO ? `${activeRead} read`
              : ACTIVE_READERS.map(r => `${r.label} ${g[r.id]}`).join(' · '));
    const countHtml = HAS_READER
      ? `${activeRead} / ${g.total}<span style="color:var(--muted)"> · ${sub}</span>`
      : `${g.total}`;
    return `<div class="genre-row">
      <div class="genre-name">${escapeHtml(g.name)}</div>
      <div class="genre-bar"><div class="genre-bar-fill" style="width: ${pct}%;"></div></div>
      <div class="genre-count">${countHtml}</div>
    </div>`;
  }).join('');

  const subList = Object.entries(subBuckets).map(([name, s]) => ({ name, ...s })).sort((a, b) => b.total - a.total);

  root.innerHTML = `<div class="detail">
    <h1>Genre</h1>
    <p style="color: var(--muted); max-width: 720px;">Every book on the canonical Hugo + Nebula list, grouped by genre. Numbers show <strong>read / total</strong> for the active reader (if any). Toggle below to flip between winners, nominees, both — and across awards.</p>

    <div class="toggle-row">
      <div class="status-toggle" data-status="${STATUS}">
        <button class="status-tab${STATUS === 'winner' ? ' active' : ''}" data-status="winner">Winners <span class="status-count">${allWinnersCount}</span></button>
        <button class="status-tab${STATUS === 'nominee' ? ' active' : ''}" data-status="nominee">Nominees <span class="status-count">${allNomineesCount}</span></button>
        <button class="status-tab${STATUS === 'both' ? ' active' : ''}" data-status="both">Both <span class="status-count">${DATA.books.length}</span></button>
      </div>
      <div class="status-toggle award-toggle" data-award="${AWARD}">
        <button class="status-tab${AWARD === 'both' ? ' active' : ''}" data-award="both">Both <span class="status-count">${DATA.books.length}</span></button>
        <button class="status-tab status-tab-hugo${AWARD === 'hugo' ? ' active' : ''}" data-award="hugo">Hugo <span class="status-count">${allHugoCount}</span></button>
        <button class="status-tab status-tab-nebula${AWARD === 'nebula' ? ' active' : ''}" data-award="nebula">Nebula <span class="status-count">${allNebulaCount}</span></button>
      </div>
    </div>

    <div class="genre-twoup">
      <div class="genre-twoup-chart radar-hero">
        <h2>By primary genre</h2>
        <p style="color: var(--muted); font-size: 13px;">Top-level genre derived from Open Library subjects. "Blend" means the tags clearly point at both SF and Fantasy.</p>
        ${primaryRadarHtml || '<p style="color:var(--muted); font-size:13px;">Sign in to see the per-reader fingerprint.</p>'}
      </div>
      <div class="genre-twoup-bars">
        <div class="genre-bars">${renderBars(primaryList)}</div>
      </div>
    </div>

    <div class="genre-twoup">
      <div class="genre-twoup-chart radar-hero">
        <h2>Subgenre fingerprint</h2>
        <p style="color: var(--muted); font-size: 13px;">Each axis = a subgenre. Distance from center = % of that subgenre this reader has finished. Bigger / more even shape = broader coverage.</p>
        ${HAS_READER ? radarHtml : '<p style="color:var(--muted); font-size:13px;">Sign in to see the per-reader fingerprint.</p>'}
      </div>
      <div class="genre-twoup-bars">
        <p style="color: var(--muted); font-size: 13px; margin: 0 0 10px;">Specific subgenre tags. A book can carry multiple.</p>
        <div class="genre-bars">${renderBars(subList)}</div>
      </div>
    </div>

    <div class="progress-section">
      <h2>Genre vectors — which combinations win most?</h2>
      <p style="color: var(--muted); font-size: 13px;">Every book on the list (winners + nominees) bucketed by <strong>primary genre / subgenres</strong>. Win rate = winners ÷ (winners + nominees). Filtered to combos with at least 3 books and sorted by win rate.</p>
      <div class="vector-table">
        <div class="vector-row vector-head">
          <div>Genre vector</div>
          <div>Books</div>
          <div>Winners</div>
          <div>Nominees</div>
          <div>Win rate</div>
          <div>${HAS_READER ? ACTIVE_READERS.map(r => `${r.initial} read`).join(' · ') : ''}</div>
        </div>
        ${genreVectors.map(v => {
          const winRatePct = Math.round(v.winRate * 100);
          const nominees = v.total - v.winners;
          const readCol = HAS_READER ? ACTIVE_READERS.map(r => `<span style="color:${r.colorVar}">${r.initial} ${v[r.id + 'Read']}</span>`).join(' · ') : '';
          return `<div class="vector-row">
            <div class="vector-combo">${escapeHtml(v.combo)}</div>
            <div>${v.total}</div>
            <div><span style="color: var(--winner)">${v.winners}</span></div>
            <div><span style="color: var(--nominee)">${nominees}</span></div>
            <div><span class="vector-pct">${winRatePct}%</span></div>
            <div>${readCol}</div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <div class="progress-section">
      <h2>Browse by genre</h2>
      <p style="color: var(--muted); font-size: 13px;">Scroll any row sideways. Click a cover for details. Each row is sorted by publication year, newest first.</p>
      ${swimlanes.map(lane => `
        <div class="swimlane">
          <div class="swimlane-header">
            <h3>${escapeHtml(lane.genre)}</h3>
            <span class="swimlane-count">${lane.books.length} books</span>
          </div>
          <div class="swimlane-strip">
            ${lane.books.map(b => {
              const cover = b.cover_url
                ? `<img src="${escapeHtml(b.cover_url)}" alt="" loading="lazy" onload="__coverFallback(this)" onerror="__coverFallback(this)">`
                : `<span class="swimlane-placeholder">📖</span>`;
              const isWinner = Object.values(b.awards || {}).includes('winner');
              const readPill = HAS_READER && ACTIVE_READERS.some(r => readStatus(b, r.id) === 'read')
                ? `<span class="swimlane-pill">read</span>` : '';
              return `<div class="swimlane-card" data-id="${escapeHtml(b.id)}">
                <div class="swimlane-cover${isWinner ? ' is-winner' : ''}">${cover}${readPill}</div>
                <div class="swimlane-title">${escapeHtml(b.title)}</div>
                <div class="swimlane-meta">${escapeHtml(b.authors[0] || '')} · ${b.year || ''}</div>
              </div>`;
            }).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  </div>`;

  $$('.swimlane-card', root).forEach(el => {
    el.addEventListener('click', () => { location.hash = `#/books/${el.dataset.id}`; });
  });
  $$('.status-tab', root).forEach(btn => {
    btn.addEventListener('click', () => {
      const newStatus = btn.dataset.status;
      const newAward = btn.dataset.award;
      if (newStatus && state.progressStatus !== newStatus) {
        state.progressStatus = newStatus;
        renderGenre();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (newAward && state.progressAward !== newAward) {
        state.progressAward = newAward;
        renderGenre();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });
}

function findBook(title, author, category) {
  // Match the data.json record so we can pull cover_url, id, etc.
  // Normalize by stripping non-alphanumerics so "R.F. Kuang" matches "R. F. Kuang".
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const t = norm(title);
  const a = norm(author);
  return DATA.books.find(b =>
    b.category === category &&
    norm(b.title) === t &&
    (b.authors || []).some(x => {
      const xn = norm(x);
      return xn === a || xn.includes(a) || a.includes(xn);
    })
  );
}

function finalistCard(f, catLabel, theme) {
  const match = findBook(f.title, f.author, catLabel);
  // When a finalist isn't in the catalog (or no cover URL exists), render a
  // typographic fallback so the card doesn't look broken. Magazine pieces
  // and very recent small-press novellas often have no openlibrary entry.
  const fallback = `<div class="hugo-card-fallback">
    <div class="hugo-card-fallback-title">${escapeHtml(f.title)}</div>
    <div class="hugo-card-fallback-meta">${escapeHtml(f.author)}</div>
  </div>`;
  const cover = match && match.cover_url
    ? `<img src="${escapeHtml(match.cover_url)}" alt="Cover of ${escapeHtml(f.title)}" loading="lazy">`
    : fallback;
  const body = `<div class="hugo-card-cover">${cover}</div>
    <div class="hugo-card-body">
      <div class="hugo-card-title">${escapeHtml(f.title)}</div>
      <div class="hugo-card-author">${escapeHtml(f.author)}</div>
      <div class="hugo-card-pub">${escapeHtml(f.publisher)}</div>
    </div>`;
  // Books not yet in DATA.books render as a non-clickable card so we don't
  // navigate to "#" and bounce home.
  if (!match) {
    return `<div class="hugo-card hugo-card-${theme} hugo-card-stub" title="Not yet in the database">${body}</div>`;
  }
  return `<a class="hugo-card hugo-card-${theme}" href="#/book/${escapeHtml(match.id)}">${body}</a>`;
}

function finalistSection(catLabel, items, theme) {
  return `<section class="hugo-section">
    <h2>Best ${escapeHtml(catLabel)}</h2>
    <div class="hugo-grid">${items.map(f => finalistCard(f, catLabel, theme)).join('')}</div>
  </section>`;
}

// Body HTML for the 2026 Hugo Awards page — hero, voting steps, finalist
// grids, source attribution. Extracted so the same content can be embedded on
// the Home page directly without a roundtrip to /hugo2026.
function hugo2026Body() {
  return `<div class="hugo-hero hugo-hero-hugo">
      <div class="hugo-hero-tag hugo-hero-tag-hugo">2026 Hugo Awards · Finalists</div>
      <h1 id="hugo2026">The ballot is out.</h1>
      <p>Announced for <strong>LAcon V</strong> — the 84th World Science Fiction Convention, Anaheim, August 27–31, 2026. Ceremony: <strong>Sunday, August 30, 2026</strong>.</p>
      <div class="hugo-hero-stats">
        <span><strong>1,153</strong> ballots cast</span>
        <span><strong>555</strong> unique nominees</span>
        <span>Finalists ranged <strong>126–210</strong> nominations</span>
      </div>
    </div>

    <section class="hugo-vote">
      <h2>How to vote</h2>
      <ol>
        <li><strong>You need a LAcon V membership.</strong> Only attending and supporting members of the 2026 WorldCon can vote on the final ballot. Register at <a href="https://laconv.org/" target="_blank" rel="noopener">laconv.org</a> (a "WSFS-only" supporting membership is the cheapest path if you're not attending).</li>
        <li><strong>Read the Hugo Voter Packet.</strong> LAcon V will release a free packet of digital copies of (most) finalists to members ahead of the voting deadline. Watch your member email.</li>
        <li><strong>Rank the finalists.</strong> Voting uses instant-runoff: rank the works you've read in order of preference. You can leave the rest blank. "No Award" is a legitimate ranking.</li>
        <li><strong>Submit by the deadline.</strong> Voting typically closes in mid-to-late July 2026 — exact dates posted on the <a href="https://www.thehugoawards.org/hugo-voting/" target="_blank" rel="noopener">official Hugo voting page</a>.</li>
      </ol>
      <div class="hugo-vote-links">
        <a class="hugo-btn" href="https://www.thehugoawards.org/hugo-voting/" target="_blank" rel="noopener">Hugo voting instructions →</a>
        <a class="hugo-btn hugo-btn-secondary" href="https://laconv.org/" target="_blank" rel="noopener">LAcon V membership →</a>
      </div>
    </section>

    ${finalistSection('Novel', HUGO_2026_FINALISTS.Novel, 'hugo')}
    ${finalistSection('Novella', HUGO_2026_FINALISTS.Novella, 'hugo')}

    <p class="hugo-source">Source: <a href="https://www.thehugoawards.org/hugo-history/2026-hugo-awards/" target="_blank" rel="noopener">thehugoawards.org · 2026 Hugo Awards announcement</a></p>`;
}

function nebula2026Body() {
  return `<div class="hugo-hero hugo-hero-nebula">
      <div class="hugo-hero-tag hugo-hero-tag-nebula">2026 Nebula Awards · Finalists</div>
      <h1 id="nebula2026">What the writers chose.</h1>
      <p>The 61st annual Nebulas, voted on by members of the <strong>Science Fiction and Fantasy Writers Association</strong>. Ceremony: <strong>Saturday, June 6, 2026</strong>, at the SFWA Nebula Conference in Chicago.</p>
      <div class="hugo-hero-stats">
        <span>Voting closes <strong>11:59 PM PDT · April 15, 2026</strong></span>
        <span>Winners announced <strong>Jun 6, 2026 · Chicago</strong></span>
      </div>
    </div>

    <section class="hugo-vote">
      <h2>How to vote</h2>
      <ol>
        <li><strong>You need an active SFWA membership.</strong> Unlike the Hugos, the Nebulas are peer-voted: only Active, Associate, and Senior SFWA members may vote. If you qualify (typically through pro-rate fiction sales), join at <a href="https://www.sfwa.org/join/" target="_blank" rel="noopener">sfwa.org/join</a>.</li>
        <li><strong>Sign in to the SFWA portal.</strong> The ballot lives on the member side of the SFWA Nebula Conference site. You can rank as many or as few finalists as you've read.</li>
        <li><strong>Vote before April 15.</strong> The ballot closes 11:59 PM PDT, April 15, 2026 — winners are announced June 6 at the Nebula Conference in Chicago.</li>
        <li><strong>Not a member?</strong> You can still attend or stream the ceremony. Conference registration is at <a href="https://nebulas.sfwa.org/" target="_blank" rel="noopener">nebulas.sfwa.org</a>.</li>
      </ol>
      <div class="hugo-vote-links">
        <a class="hugo-btn hugo-btn-nebula" href="https://www.sfwa.org/nebula-conference/" target="_blank" rel="noopener">Nebula Conference + ballot →</a>
        <a class="hugo-btn hugo-btn-secondary" href="https://www.sfwa.org/join/" target="_blank" rel="noopener">SFWA membership →</a>
      </div>
    </section>

    ${finalistSection('Novel', NEBULA_2026_FINALISTS.Novel, 'nebula')}
    ${finalistSection('Novella', NEBULA_2026_FINALISTS.Novella, 'nebula')}

    <p class="hugo-source">Source: <a href="https://nebulas.sfwa.org/9192-2/" target="_blank" rel="noopener">nebulas.sfwa.org · 2026 Nebula Awards Finalists</a></p>`;
}

function renderHugo2026() {
  $('#view-hugo2026').innerHTML = `<div class="detail hugo2026">${hugo2026Body()}</div>`;
}

function renderNebula2026() {
  $('#view-nebula2026').innerHTML = `<div class="detail hugo2026 nebula2026">${nebula2026Body()}</div>`;
}

// Standalone two-reader comparison page.
// URL shape: #/compare?u=tom&u=nika  (alias: ?reader=tom,nika or initials T,N)
// Reads the legacy CSV columns in data.json for the requested readers. Future:
// pull from Supabase user_books for arbitrary @handle pairs.
// Resolve a URL-parameter id to a "side" of the comparison:
//   { handle, label, colorVar, statusMap }
// - 'me' resolves to the signed-in user's user_books (cached in MR_AUTH)
// - Anything else is treated as a Supabase profile handle (case-insensitive)
//   and we fetch their user_books over the wire.
//
// Per-handle results are cached in `__compareSideCache` so re-rendering the
// compare page (back and forth, picker → comparison) doesn't refetch.

// Cache for "other side" user_books fetches (Westdac's reads when Tom views
// /compare?u=me&u=westdac). Tom's own side reads MR_AUTH.userBooks directly.
// Friend list + leaderboard counts are preloaded by MR_AUTH bootstrap — no
// caches needed for those at the app layer.
const __compareSideCache = new Map();    // handle (lowercased) → side object

function __invalidateCompareCaches() {
  __compareSideCache.clear();
}

async function loadCompareSide(id, colorIdx = 0) {
  const PALETTE = [
    { colorVar: 'var(--accent)',   colorRgb: '29,78,216'   },
    { colorVar: 'var(--accent-2)', colorRgb: '220,38,38'   },
    { colorVar: 'var(--accent-3)', colorRgb: '182,120,60'  },
    { colorVar: 'var(--accent-4)', colorRgb: '74,122,90'   },
    { colorVar: 'var(--accent-5)', colorRgb: '122,68,134'  },
  ];
  const fallback = PALETTE[colorIdx % PALETTE.length];
  // 'me' is a legacy alias for the signed-in user. Also short-circuit when the
  // id matches the signed-in user's own handle — saves a Supabase round-trip
  // and lets shareable URLs (?u=tom&u=SappySaffron) render fast for the owner.
  const myHandle = window.MR_AUTH?.profile?.handle || null;
  if (id === 'me' || (myHandle && id.toLowerCase() === myHandle.toLowerCase())) {
    const handle = myHandle || 'you';
    return {
      handle,
      label: handle,
      colorVar: fallback.colorVar,
      colorRgb: fallback.colorRgb,
      statusMap: window.MR_AUTH?.userBooks || {},
    };
  }
  const key = String(id || '').toLowerCase();
  if (__compareSideCache.has(key)) {
    // Re-apply the requested palette color (may differ across views) but keep
    // the cached profile + statusMap.
    const cached = __compareSideCache.get(key);
    return {
      ...cached,
      colorVar: cached.legacyColor || fallback.colorVar,
      colorRgb: cached.legacyRgb   || fallback.colorRgb,
    };
  }
  const client = window.MR_AUTH?.client;
  if (!client) return null;
  // ilike for case-insensitive handle lookup (SappySaffron etc)
  const { data: prof } = await client.from('profiles')
    .select('id, handle, profile_visibility, on_leaderboard')
    .ilike('handle', id).maybeSingle();
  if (!prof) return null;
  const { data: ub } = await client.from('user_books')
    .select('book_id, status').eq('user_id', prof.id);
  const statusMap = {};
  for (const r of ub || []) statusMap[r.book_id] = r;
  // If the handle matches a legacy READER_CONFIG, reuse its color for visual continuity
  const legacy = READER_CONFIG[prof.handle.toLowerCase()];
  const side = {
    handle: prof.handle,
    label: prof.handle,
    colorVar: legacy?.colorVar || fallback.colorVar,
    colorRgb: legacy?.colorRgb || fallback.colorRgb,
    legacyColor: legacy?.colorVar || null,
    legacyRgb: legacy?.colorRgb || null,
    statusMap,
  };
  __compareSideCache.set(key, side);
  return side;
}

async function renderCompare(params) {
  const root = $('#view-compare');
  if (!root) return;
  root.innerHTML = `<div class="detail"><h1>Compare reads</h1><p style="color: var(--muted);">Loading…</p></div>`;
  // Wait for the initial auth bootstrap so MR_AUTH.user is settled before we
  // branch on it. Otherwise the friends-picker can fire listFriends() before
  // currentUser is set, returning empty by accident.
  await window.MR_AUTH?.ready;

  const rawIds = [];
  for (const key of ['u', 'reader', 'readers']) {
    for (const val of params.getAll(key)) {
      val.split(',').forEach(v => rawIds.push(v.trim().toLowerCase()));
    }
  }
  // Initials → full names for legacy reader codes
  const ids = rawIds
    .map(v => INITIAL_TO_ID[v] || v)
    .filter(id => id && id.length > 0)
    // 'me' is only valid when signed in
    .filter(id => id !== 'me' || !!window.MR_AUTH?.user);

  // Bare /#/compare (no u= params) is now redirected to /#/friends in route().
  // If we somehow land here with less than 2 ids (malformed URL), bounce home.
  if (ids.length !== 2) {
    location.hash = '#/friends';
    return;
  }

  // Two ids → render the comparison
  root.innerHTML = `<div class="detail"><a href="#/" class="back">← back</a><p style="color: var(--muted);">Loading comparison…</p></div>`;
  const [aSide, bSide] = await Promise.all([
    loadCompareSide(ids[0], 0),
    loadCompareSide(ids[1], 1),
  ]);
  if (!aSide || !bSide) {
    root.innerHTML = `<div class="detail">
      <a href="#/friends" class="back">← back to Friends</a>
      <h1>Compare reads</h1>
      <p style="color: var(--sf);">Couldn't find one of those readers (${escapeHtml(ids.join(' / '))}).</p>
    </div>`;
    return;
  }

  const both = [], aOnly = [], bOnly = [], neither = [];
  // Subgenre coverage for each side — used to draw side-by-side fingerprint
  // radars. A book contributes to every one of its subgenre buckets.
  const subBuckets = {};
  // Per-side stat accumulators (computed in one DATA.books pass).
  const empty = () => ({ Novel: 0, Novella: 0, Novelette: 0 });
  const emptyAward = () => ({ hugo: 0, nebula: 0 });
  const emptyGender = () => ({ female: 0, male: 0, unknown: 0 });
  const stats = {
    a: { byCategory: empty(), byAward: emptyAward(), byGender: emptyGender(), byPrimaryGenre: {}, byDecade: {}, yearSum: 0, yearCount: 0 },
    b: { byCategory: empty(), byAward: emptyAward(), byGender: emptyGender(), byPrimaryGenre: {}, byDecade: {}, yearSum: 0, yearCount: 0 },
  };
  const tallyOne = (s, book) => {
    if (book.category) s.byCategory[book.category] = (s.byCategory[book.category] || 0) + 1;
    for (const a of Object.keys(book.awards || {})) {
      s.byAward[a] = (s.byAward[a] || 0) + 1;
    }
    const pg = book.primary_genre || 'Unclassified';
    s.byPrimaryGenre[pg] = (s.byPrimaryGenre[pg] || 0) + 1;
    if (book.year) {
      const dec = Math.floor(book.year / 10) * 10;
      s.byDecade[dec] = (s.byDecade[dec] || 0) + 1;
      s.yearSum += book.year;
      s.yearCount++;
    }
    const g = book.primary_author_gender || 'unknown';
    if (g in s.byGender) s.byGender[g]++;
  };

  for (const book of DATA.books) {
    const aRead = aSide.statusMap[book.id]?.status === 'read';
    const bRead = bSide.statusMap[book.id]?.status === 'read';
    if (aRead && bRead) both.push(book);
    else if (aRead) aOnly.push(book);
    else if (bRead) bOnly.push(book);
    else neither.push(book);
    if (aRead) tallyOne(stats.a, book);
    if (bRead) tallyOne(stats.b, book);
    for (const g of (book.subgenres || [])) {
      if (!subBuckets[g]) subBuckets[g] = { total: 0, a: 0, b: 0 };
      subBuckets[g].total++;
      if (aRead) subBuckets[g].a++;
      if (bRead) subBuckets[g].b++;
    }
  }
  [both, aOnly, bOnly, neither].forEach(arr => arr.sort((x, y) => (y.year || 0) - (x.year || 0)));

  const aReadCount = both.length + aOnly.length;
  const bReadCount = both.length + bOnly.length;
  const unionCount = aReadCount + bReadCount - both.length;
  // Jaccard index — size of intersection ÷ size of union. 1.0 = identical reads.
  const taste = unionCount > 0 ? Math.round((both.length / unionCount) * 100) : 0;
  const avgYearA = stats.a.yearCount > 0 ? Math.round(stats.a.yearSum / stats.a.yearCount) : null;
  const avgYearB = stats.b.yearCount > 0 ? Math.round(stats.b.yearSum / stats.b.yearCount) : null;
  // Most-read decade — argmax over the decade tallies above.
  const argmaxDecade = (byDecade) => {
    let bestD = null, bestC = 0;
    for (const [d, c] of Object.entries(byDecade)) {
      if (c > bestC) { bestC = c; bestD = parseInt(d, 10); }
    }
    return bestD === null ? null : { decade: bestD, count: bestC };
  };
  const mrdA = argmaxDecade(stats.a.byDecade);
  const mrdB = argmaxDecade(stats.b.byDecade);

  // Era fingerprint radar — share of each decade's winners + finalists that
  // each side has read. Same shape as Home's "Influence by era" but with two
  // polygons (one per reader).
  const decadeBuckets = bucketBooksByDecade(DATA.books);
  const eraDecades = eraRadarAxes(decadeBuckets);
  const eraAxes = eraDecades.map(eraAxisLabel);
  const eraValsA = eraReaderValues(eraDecades, decadeBuckets, (b) => aSide.statusMap[b.id]?.status === 'read');
  const eraValsB = eraReaderValues(eraDecades, decadeBuckets, (b) => bSide.statusMap[b.id]?.status === 'read');
  const eraRadarConfig = {
    [aKey]: { label: '@' + aSide.label, colorVar: aSide.colorVar, colorRgb: aSide.colorRgb },
    [bKey]: { label: '@' + bSide.label, colorVar: bSide.colorVar, colorRgb: bSide.colorRgb },
  };
  const eraRadarHtml = eraDecades.length >= 3
    ? buildRadar(eraAxes, { [aKey]: eraValsA, [bKey]: eraValsB }, eraRadarConfig)
    : '';

  // Build per-side radars — top 8 most-populated subgenres, dropping axes
  // where neither side has any reads (keeps the chart legible).
  const radarAxes = Object.entries(subBuckets)
    .sort((x, y) => y[1].total - x[1].total)
    .slice(0, 8)
    .map(([name]) => name)
    .filter(g => (subBuckets[g].a + subBuckets[g].b) > 0);
  const valsFor = side => radarAxes.map(g => {
    const bucket = subBuckets[g];
    return bucket.total > 0 ? bucket[side] / bucket.total : 0;
  });
  const aKey = 'compare_a';
  const bKey = 'compare_b';
  const radarConfig = {
    [aKey]: { label: '@' + aSide.label, colorVar: aSide.colorVar, colorRgb: aSide.colorRgb },
    [bKey]: { label: '@' + bSide.label, colorVar: bSide.colorVar, colorRgb: bSide.colorRgb },
  };
  const radarHtml = radarAxes.length >= 3
    ? `<div class="compare-radar-grid">
        <div class="compare-radar-card">
          <h3 style="color: ${aSide.colorVar}">@${escapeHtml(aSide.label)}</h3>
          ${buildRadar(radarAxes, { [aKey]: valsFor('a') }, radarConfig)}
        </div>
        <div class="compare-radar-card">
          <h3 style="color: ${bSide.colorVar}">@${escapeHtml(bSide.label)}</h3>
          ${buildRadar(radarAxes, { [bKey]: valsFor('b') }, radarConfig)}
        </div>
      </div>`
    : '';

  const tile = (bk) => {
    const cover = bk.cover_url
      ? `<img src="${escapeHtml(bk.cover_url)}" alt="" loading="lazy" onload="__coverFallback(this)" onerror="__coverFallback(this)">`
      : `<span class="swimlane-placeholder">📖</span>`;
    const isWinner = Object.values(bk.awards || {}).includes('winner');
    return `<a class="swimlane-card" href="#/book/${escapeHtml(bk.id)}">
      <div class="swimlane-cover${isWinner ? ' is-winner' : ''}">${cover}</div>
      <div class="swimlane-title">${escapeHtml(bk.title)}</div>
      <div class="swimlane-meta">${escapeHtml(bk.authors[0] || '')} · ${bk.year || ''}</div>
    </a>`;
  };

  const section = (title, items, sub, extraClass = '') => `
    <div class="comparison-quadrant ${extraClass}">
      <div class="comparison-quadrant-head">
        <h3>${title} <span class="comparison-count">${items.length}</span></h3>
        ${sub ? `<p style="color: var(--muted); font-size: 12px; margin: 2px 0 0;">${sub}</p>` : ''}
      </div>
      ${items.length === 0
        ? `<p style="color: var(--muted); font-size: 13px; padding: 12px 0;">— nothing here —</p>`
        : `<div class="swimlane-strip">${items.map(tile).join('')}</div>`}
    </div>
  `;

  const totalBooks = DATA.books.length;

  // Helpers for the side-by-side analytics block.
  // pctRow: a labeled row with a bar+value per reader. denom controls the
  // bar's full width — pass the total catalog count for share-of-total
  // (showPct: true), or pass the row-max for purely-comparative bars.
  const pctRow = (label, aVal, bVal, denom, opts = {}) => {
    const aPct = denom > 0 ? (aVal / denom) * 100 : 0;
    const bPct = denom > 0 ? (bVal / denom) * 100 : 0;
    const aDisp = opts.showPct ? `${aVal} (${Math.round(aPct)}%)` : aVal;
    const bDisp = opts.showPct ? `${bVal} (${Math.round(bPct)}%)` : bVal;
    return `<div class="cmp-stat-row">
      <div class="cmp-stat-label">${label}</div>
      <div class="cmp-stat-side">
        <div class="cmp-stat-bar">
          <span class="cmp-stat-bar-fill" style="width:${aPct}%; background:${aSide.colorVar};"></span>
        </div>
        <div class="cmp-stat-val" style="color:${aSide.colorVar}">${aDisp}</div>
      </div>
      <div class="cmp-stat-side">
        <div class="cmp-stat-bar">
          <span class="cmp-stat-bar-fill" style="width:${bPct}%; background:${bSide.colorVar};"></span>
        </div>
        <div class="cmp-stat-val" style="color:${bSide.colorVar}">${bDisp}</div>
      </div>
    </div>`;
  };

  // Header row matching the three-column row layout above.
  const statHeadrow = (firstCol) => `<div class="cmp-stat-headrow">
    <div>${firstCol}</div>
    <div style="color:${aSide.colorVar}">@${escapeHtml(aSide.label)}</div>
    <div style="color:${bSide.colorVar}">@${escapeHtml(bSide.label)}</div>
  </div>`;

  // Category breakdown: out of N books in the catalog with that category,
  // how many has each reader finished?
  const catTotals = { Novel: 0, Novella: 0, Novelette: 0 };
  for (const b of DATA.books) {
    if (catTotals[b.category] != null) catTotals[b.category]++;
  }
  const catRows = ['Novel', 'Novella', 'Novelette']
    .map(c => pctRow(c, stats.a.byCategory[c], stats.b.byCategory[c], catTotals[c], { showPct: true }))
    .join('');

  // Award breakdown
  const awardTotals = { hugo: 0, nebula: 0 };
  for (const b of DATA.books) {
    for (const a of Object.keys(b.awards || {})) {
      if (awardTotals[a] != null) awardTotals[a]++;
    }
  }
  const awardRows = ['hugo', 'nebula']
    .map(a => pctRow(a.charAt(0).toUpperCase() + a.slice(1), stats.a.byAward[a] || 0, stats.b.byAward[a] || 0, awardTotals[a], { showPct: true }))
    .join('');

  // Primary-genre breakdown — rank by combined reader interest
  const primaryUnion = new Set([...Object.keys(stats.a.byPrimaryGenre), ...Object.keys(stats.b.byPrimaryGenre)]);
  const primaryTotals = {};
  for (const b of DATA.books) {
    const pg = b.primary_genre || 'Unclassified';
    primaryTotals[pg] = (primaryTotals[pg] || 0) + 1;
  }
  const primaryRanked = Array.from(primaryUnion)
    .sort((p, q) => ((stats.a.byPrimaryGenre[q] || 0) + (stats.b.byPrimaryGenre[q] || 0))
                  - ((stats.a.byPrimaryGenre[p] || 0) + (stats.b.byPrimaryGenre[p] || 0)));
  const primaryRows = primaryRanked
    .map(g => pctRow(g, stats.a.byPrimaryGenre[g] || 0, stats.b.byPrimaryGenre[g] || 0, primaryTotals[g] || 1, { showPct: true }))
    .join('');

  // Author-gender split
  const genderTotals = { female: 0, male: 0, unknown: 0 };
  for (const b of DATA.books) {
    const g = b.primary_author_gender || 'unknown';
    if (g in genderTotals) genderTotals[g]++;
  }
  const genderLabels = { female: 'Female-authored', male: 'Male-authored', unknown: 'Unknown / pen name' };
  const genderRows = ['female', 'male', 'unknown']
    .map(g => pctRow(genderLabels[g], stats.a.byGender[g] || 0, stats.b.byGender[g] || 0, genderTotals[g] || 1, { showPct: true }))
    .join('');

  // Decade overlay: one row per decade with each reader's count.
  const decadesUnion = Array.from(new Set([
    ...Object.keys(stats.a.byDecade).map(Number),
    ...Object.keys(stats.b.byDecade).map(Number),
  ])).sort((x, y) => x - y);
  const maxDecade = Math.max(1, ...decadesUnion.map(d => Math.max(stats.a.byDecade[d] || 0, stats.b.byDecade[d] || 0)));
  const decadeRows = decadesUnion
    .map(d => pctRow(`${d % 100 < 10 ? '0' + (d % 100) : d % 100}s`, stats.a.byDecade[d] || 0, stats.b.byDecade[d] || 0, maxDecade))
    .join('');

  root.innerHTML = `<div class="detail compare-page">
    <a href="#/friends" class="back">← compare another</a>
    <div class="compare-header">
      <h1>
        <span style="color: ${aSide.colorVar}">@${escapeHtml(aSide.label)}</span>
        <span style="color: var(--muted)">vs</span>
        <span style="color: ${bSide.colorVar}">@${escapeHtml(bSide.label)}</span>
      </h1>
      <p style="color: var(--muted); font-size: 14px;">Comparing read books across the canonical ${totalBooks} on Readmore.</p>
      <div class="compare-totals">
        <span><span style="color: ${aSide.colorVar}">@${aSide.label}</span> has read <strong>${aReadCount}</strong></span>
        <span><span style="color: ${bSide.colorVar}">@${bSide.label}</span> has read <strong>${bReadCount}</strong></span>
        <span>Shared: <strong>${both.length}</strong></span>
      </div>
    </div>

    <section class="compare-headline-grid">
      <div class="compare-stat-card compare-stat-similarity">
        <div class="compare-stat-card-label">Taste similarity</div>
        <div class="compare-stat-card-value">${taste}%</div>
        <div class="compare-stat-card-sub">Jaccard index — shared reads ÷ combined reads</div>
      </div>
      <div class="compare-stat-card">
        <div class="compare-stat-card-label">Average pub year</div>
        <div class="compare-stat-card-value compare-avg-year">
          <span style="color:${aSide.colorVar}">${avgYearA ?? '—'}</span>
          <span style="color:var(--muted)">vs</span>
          <span style="color:${bSide.colorVar}">${avgYearB ?? '—'}</span>
        </div>
        <div class="compare-stat-card-sub">Of the books each has read</div>
      </div>
      <div class="compare-stat-card">
        <div class="compare-stat-card-label">Most-read decade</div>
        <div class="compare-stat-card-value compare-avg-year">
          <span style="color:${aSide.colorVar}">${mrdA ? eraAxisLabel(mrdA.decade) : '—'}</span>
          <span style="color:var(--muted)">vs</span>
          <span style="color:${bSide.colorVar}">${mrdB ? eraAxisLabel(mrdB.decade) : '—'}</span>
        </div>
        <div class="compare-stat-card-sub">${mrdA ? `${aSide.label} ${mrdA.count}` : ''}${mrdA && mrdB ? ' · ' : ''}${mrdB ? `${bSide.label} ${mrdB.count}` : ''}</div>
      </div>
      <div class="compare-stat-card">
        <div class="compare-stat-card-label">Gap to close</div>
        <div class="compare-stat-card-value">${neither.length}</div>
        <div class="compare-stat-card-sub">Books neither of you has read</div>
      </div>
    </section>

    <section class="compare-analytics-section">
      <h2>By category</h2>
      <div class="cmp-stat-grid">
        ${statHeadrow('Category')}
        ${catRows}
      </div>
    </section>

    <section class="compare-analytics-section">
      <h2>By award</h2>
      <div class="cmp-stat-grid">
        ${statHeadrow('Award')}
        ${awardRows}
      </div>
    </section>

    <section class="compare-analytics-section">
      <h2>By primary genre</h2>
      <div class="cmp-stat-grid">
        ${statHeadrow('Genre')}
        ${primaryRows}
      </div>
    </section>

    <section class="compare-analytics-section">
      <h2>By author gender</h2>
      <div class="cmp-stat-grid">
        ${statHeadrow('Gender')}
        ${genderRows}
      </div>
    </section>

    <section class="compare-analytics-section">
      <h2>By decade</h2>
      <p style="color: var(--muted); font-size: 13px; margin: 4px 0 0;">Where each reader spends most of their time. Bars scale to the busiest decade across both.</p>
      <div class="cmp-stat-grid">
        ${statHeadrow('Decade')}
        ${decadeRows}
      </div>
    </section>

    ${eraRadarHtml ? `<section class="compare-radar-section">
      <h2>Era fingerprint</h2>
      <p style="color: var(--muted); font-size: 13px; margin-top: 4px;">Each axis = a decade. Distance from center = share of that decade's winners + finalists each reader has read.</p>
      ${eraRadarHtml}
      <div class="era-radar-stats">
        <span style="color:${aSide.colorVar}"><strong>@${escapeHtml(aSide.label)}</strong> · avg ${avgYearA ?? '—'}${mrdA ? ` · most-read ${eraAxisLabel(mrdA.decade)} (${mrdA.count})` : ''}</span>
        <span style="color:${bSide.colorVar}"><strong>@${escapeHtml(bSide.label)}</strong> · avg ${avgYearB ?? '—'}${mrdB ? ` · most-read ${eraAxisLabel(mrdB.decade)} (${mrdB.count})` : ''}</span>
      </div>
    </section>` : ''}

    ${radarHtml ? `<section class="compare-radar-section">
      <h2>Subgenre fingerprint</h2>
      <p style="color: var(--muted); font-size: 13px; margin-top: 4px;">Each axis = a subgenre. Distance from center = % of that subgenre this reader has finished.</p>
      ${radarHtml}
    </section>` : ''}

    <div class="comparison-block">
      ${section(`<span style="color: ${aSide.colorVar}">@${escapeHtml(aSide.label)}</span> ∩ <span style="color: ${bSide.colorVar}">@${escapeHtml(bSide.label)}</span> — both have read`, both, 'Common ground — shared experience to talk about.')}
      ${section(`<span style="color: ${aSide.colorVar}">@${escapeHtml(aSide.label)}</span> only`, aOnly, `Read by @${escapeHtml(aSide.label)}, not @${escapeHtml(bSide.label)}.`)}
      ${section(`<span style="color: ${bSide.colorVar}">@${escapeHtml(bSide.label)}</span> only`, bOnly, `Read by @${escapeHtml(bSide.label)}, not @${escapeHtml(aSide.label)}.`, 'flip')}
      ${section('Neither has read', neither, 'The gap — books on the list ready to be picked.')}
    </div>
  </div>`;
}

// Friends page — combined leaderboard + per-row head-to-head compare entry.
// Reads from MR_AUTH.leaderboardOverall / .leaderboardByAward, which the
// bootstrap loads from the SQL views. Only profiles with on_leaderboard = true
// appear (filter is inside the view). Each row has a Compare → button that
// deep-links into the existing /#/compare?u=me&u=them head-to-head view.
async function renderFriends() {
  const root = $('#view-friends');
  if (!root) return;
  // Always show a placeholder immediately so clicking the nav link gives
  // visual feedback even if the await or render hits a slow path.
  root.innerHTML = `<div class="detail"><h1>Friends</h1><p style="color: var(--muted);">Loading…</p></div>`;
  try {
    // Wait for the auth bootstrap so the leaderboard data is populated.
    // Race against a 10s ceiling so a stuck bootstrap doesn't park the page.
    await Promise.race([
      window.MR_AUTH?.ready,
      new Promise((_, rej) => setTimeout(() => rej(new Error('Auth bootstrap timed out')), 10000)),
    ]);
  } catch (err) {
    root.innerHTML = `<div class="detail"><h1>Friends</h1><p style="color: var(--sf);">Couldn't load: ${escapeHtml(err.message || String(err))}</p><p style="color: var(--muted); font-size: 13px;">Try refreshing the page.</p></div>`;
    return;
  }

  // Friends is sign-in-only; redirect anon visitors back to Home so the
  // empty leaderboard placeholder doesn't linger in the address bar.
  if (!window.MR_AUTH?.user) {
    location.hash = '#/';
    return;
  }

  const overall = window.MR_AUTH?.leaderboardOverall || [];
  const byAward = window.MR_AUTH?.leaderboardByAward || [];

  const meHandle = window.MR_AUTH?.profile?.handle || null;
  const myUserId = window.MR_AUTH?.user?.id || null;
  const rows = overall;

  // Build {user_id → {hugo, nebula}} maps from the per-award view so each
  // friend row can show the Hugo + Nebula counts inline. Replaces the
  // old Overall/Hugo/Nebula toggle.
  const hugoByUser = {};
  const nebulaByUser = {};
  for (const r of byAward || []) {
    if (r.award === 'hugo') hugoByUser[r.user_id] = r.read_count;
    else if (r.award === 'nebula') nebulaByUser[r.user_id] = r.read_count;
  }
  const totalLabel = `${overall[0]?.total_books ?? 0} canonical books`;

  const onLeaderboard = window.MR_AUTH?.profile?.on_leaderboard;
  const isAuthed = !!window.MR_AUTH?.user;

  const myHandleSlug = meHandle ? encodeURIComponent(meHandle) : 'me';
  const rowHtml = rows.map(r => {
    const isMe = r.user_id === myUserId;
    const canCompare = isAuthed && !isMe;
    const compareHref = canCompare ? `#/compare?u=${myHandleSlug}&u=${encodeURIComponent(r.handle)}` : '#';
    const compareTag = canCompare
      ? `<a class="lb-compare" href="${compareHref}">Compare →</a>`
      : isMe
        ? `<span class="lb-me">you</span>`
        : `<span class="lb-compare lb-compare-disabled" data-tooltip="Sign in to compare">Compare</span>`;
    const hugoCount = hugoByUser[r.user_id] ?? 0;
    const nebulaCount = nebulaByUser[r.user_id] ?? 0;
    return `<div class="lb-row${isMe ? ' lb-row-me' : ''}">
      <div class="lb-rank">#${r.rank}</div>
      <div class="lb-handle"><a href="#/u/${escapeHtml(r.handle)}">@${escapeHtml(r.handle)}</a></div>
      <div class="lb-stat"><strong>${r.read_count}</strong> <span class="lb-of">/ ${r.total_books}</span></div>
      <div class="lb-stat-sub" style="color: var(--sf);"><strong>${hugoCount}</strong> Hugo</div>
      <div class="lb-stat-sub" style="color: var(--fantasy);"><strong>${nebulaCount}</strong> Nebula</div>
      <div class="lb-pct">${r.pct ?? 0}%</div>
      <div class="lb-action">${compareTag}</div>
    </div>`;
  }).join('');

  const meOnly = isAuthed && rows.length === 1 && rows[0].user_id === myUserId;

  const emptyState = !isAuthed
    ? `<div class="lb-empty">
        <p><strong>Friends are sign-in-only.</strong></p>
        <p style="color: var(--muted);">Sign in to see your reading head-to-head with friends — and with @tom, who's auto-friends with everyone.</p>
        <p><button type="button" class="user-status-signin" id="lb-signin-empty">Sign in</button></p>
      </div>`
    : !onLeaderboard
      ? `<div class="lb-empty">
          <p><strong>You're not on the leaderboard yet.</strong></p>
          <p style="color: var(--muted);">Opt in from <a href="#/settings">Settings</a> to compare your reads with your friends.</p>
        </div>`
      : `<div class="lb-empty">
          <p><strong>No friends on the leaderboard yet.</strong></p>
          <p style="color: var(--muted);">Add a friend by their handle below — they need to be opted into the leaderboard too. @tom should show up automatically once he's on.</p>
        </div>`;

  // Add-friend form (signed-in users only). Drop-in equivalent of what
  // used to live on the Settings page.
  const addFriendForm = isAuthed
    ? `<form id="friends-add-form" class="friends-add-form">
        <input type="text" id="friends-add-handle" placeholder="@handle to add" autocomplete="off">
        <button type="submit" class="mr-btn-primary">Add friend</button>
        <span id="friends-add-status" class="settings-inline-status"></span>
      </form>`
    : '';

  root.innerHTML = `<div class="detail leaderboard-page">
    <h1>Friends</h1>
    <p style="color: var(--muted);">You and your friends, ranked by how many of the ${totalLabel} you've read. Tap <strong>Compare</strong> on any row to see the head-to-head.</p>

    ${addFriendForm}

    ${rows.length === 0
      ? emptyState
      : `<div class="lb-table">${rowHtml}</div>`}

    ${meOnly
      ? `<p style="margin-top: 22px; color: var(--muted);">It's just you for now. Add a friend above to fill out the board.</p>`
      : ''}

    ${rows.length > 0 && !isAuthed
      ? `<p style="margin-top: 22px; color: var(--muted);"><button type="button" class="user-status-signin" id="lb-signin">Sign in</button> &nbsp; to compare your reads against anyone on the leaderboard.</p>`
      : rows.length > 0 && !onLeaderboard
        ? `<p style="margin-top: 22px; color: var(--muted);">You're signed in but not on the leaderboard yet. <a href="#/settings">Opt in from Settings</a>.</p>`
        : ''}
  </div>`;

  $('#lb-signin')?.addEventListener('click', () => window.MR_AUTH?.showSignInModal());
  $('#lb-signin-empty')?.addEventListener('click', () => window.MR_AUTH?.showSignInModal());
  root.querySelectorAll('.lb-compare-disabled').forEach(el => {
    el.addEventListener('click', () => window.MR_AUTH?.showSignInModal());
  });

  // Add-friend form
  const addForm = $('#friends-add-form');
  const addStatus = $('#friends-add-status');
  if (addForm) {
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = $('#friends-add-handle');
      const v = (input.value || '').trim();
      if (!v) return;
      addStatus.textContent = 'Adding…';
      addStatus.className = 'settings-inline-status';
      try {
        const target = await window.MR_AUTH.addFriendByHandle(v);
        addStatus.textContent = `✓ Added @${target.handle}`;
        addStatus.className = 'settings-inline-status success';
        input.value = '';
        // MR_AUTH.addFriendByHandle already refreshed friends+leaderboard
        // and called notify(); the onChange listener re-routes which
        // re-renders this page. Defensive re-render in case that order
        // ever changes.
        setTimeout(() => renderFriends(), 100);
      } catch (err) {
        addStatus.textContent = err.message || String(err);
        addStatus.className = 'settings-inline-status error';
      }
    });
  }

}

// ===== Discover (Tinder-style) ========================================
// Module-scope state so the queue, undo history, and skip list survive route
// changes within a session. Reset to null only on sign-out or when the user
// explicitly hits "Start over".
let __discoverState = null;

function buildDiscoverQueue() {
  const auth = window.MR_AUTH;
  if (!auth || !auth.user) return [];
  // Unrated only — anything in user_books (read/nightstand/started) is
  // already categorized and shouldn't reappear in the swipe queue.
  return DATA.books
    .filter(b => auth.statusFor(b.id) === null)
    .sort((a, b) => {
      const aWin = Object.values(a.awards || {}).includes('winner') ? 1 : 0;
      const bWin = Object.values(b.awards || {}).includes('winner') ? 1 : 0;
      if (aWin !== bWin) return bWin - aWin;
      const yearDiff = (b.year || 0) - (a.year || 0);
      if (yearDiff !== 0) return yearDiff;
      return a.title.localeCompare(b.title);
    })
    .map(b => b.id);
}

function discoverNextBook() {
  if (!__discoverState) return null;
  for (const id of __discoverState.queue) {
    if (__discoverState.skipped.has(id)) continue;
    return DATA.books.find(b => b.id === id) || null;
  }
  // Queue exhausted ignoring skips — fall back to first skipped item so the
  // user always sees the next thing to label.
  for (const id of __discoverState.queue) {
    return DATA.books.find(b => b.id === id) || null;
  }
  return null;
}

function discoverPeekBook(offset) {
  if (!__discoverState) return null;
  let seen = 0;
  for (const id of __discoverState.queue) {
    if (__discoverState.skipped.has(id)) continue;
    if (seen === offset) return DATA.books.find(b => b.id === id) || null;
    seen++;
  }
  return null;
}

// SFF Readmore mission statement — sits at the top of the Discover tab.
// The two award featured banners live on the Home page now (kept separate
// from this CTA so anon visitors on Discover see the elevator pitch).
function discoverIntroHtml() {
  return `<section class="home-cta">
      <p><strong>SFF Readmore</strong> is a complete list of every <strong>Hugo</strong> and <strong>Nebula</strong> winner and finalist in Novel, Novella, and Novelette. I wanted to set the goal of reading more of the books that set the trends and define my favorite genre of <strong>Sci-Fiction and Fantasy</strong> across the decades. Every year these are the works the field itself decided were worth remembering. The goal is simple: <strong>to read them all</strong>.</p>
    </section>`;
}

// Hugo + Nebula featured banners — used on Home above the toggle row.
function awardFeaturedBannersHtml() {
  return `<div class="featured-banners featured-banners-full">
      ${featuredBanner({
        theme: 'hugo',
        name: 'Hugo Awards',
        audience: 'Fans',
        since: '1953',
        descriptionHtml: `The oldest annual literary award in science fiction and fantasy, presented by members of the <strong>World Science Fiction Convention (Worldcon)</strong>. Voted by the convention's attending and supporting members. Categories cover novels, novellas, novelettes, short stories, plus dramatic presentations, editors, artists, magazines, and fan work. Named after Hugo Gernsback, the editor of <em>Amazing Stories</em>. Site: <a href="https://www.thehugoawards.org/" target="_blank" rel="noopener">thehugoawards.org</a>.`,
        ceremonyDate: 'Sunday, Aug 30, 2026',
        ceremonyLoc: 'LAcon V · Anaheim',
        finalistsTagline: '2026 Best Novel + Novella finalists',
        finalists: HUGO_2026_FINALISTS,
        href: '#/hugo2026',
      })}
      ${featuredBanner({
        theme: 'nebula',
        name: 'Nebula Awards',
        audience: 'Writers',
        since: '1965',
        descriptionHtml: `Peer-voted award presented annually by the <a href="https://www.sfwa.org/" target="_blank" rel="noopener">Science Fiction and Fantasy Writers Association</a> (SFWA). Only SFWA members vote — so this is "what working writers think is best," in contrast to the Hugo's "what fans think." Categories mirror the Hugos (novel through short story plus a few others). Winners often, but not always, overlap with the Hugos.`,
        ceremonyDate: 'Saturday, Jun 6, 2026',
        ceremonyLoc: 'SFWA Conference · Chicago',
        finalistsTagline: '2026 peer-voted finalists',
        finalists: NEBULA_2026_FINALISTS,
        href: '#/nebula2026',
      })}
    </div>
    <p class="awards-tracks-note">Readmore tracks <strong>winners + finalists</strong> across both. A book appearing on either list is on Readmore.</p>`;
}

async function renderDiscover() {
  const root = $('#view-discover');
  if (!root) return;
  root.innerHTML = `<div class="detail"><h1>Discover</h1><p style="color: var(--muted);">Loading…</p></div>`;
  try {
    await Promise.race([
      window.MR_AUTH?.ready,
      new Promise((_, rej) => setTimeout(() => rej(new Error('Auth bootstrap timed out')), 10000)),
    ]);
  } catch (err) {
    root.innerHTML = `<div class="detail"><h1>Discover</h1><p style="color: var(--sf);">Couldn't load: ${escapeHtml(err.message || String(err))}</p></div>`;
    return;
  }

  const auth = window.MR_AUTH;
  if (!auth?.user) {
    // Discover is sign-in-only; redirect anon visitors back to Home so the
    // route doesn't leave a stale view in the address bar.
    location.hash = '#/';
    return;
  }

  if (!__discoverState) {
    __discoverState = {
      queue: buildDiscoverQueue(),
      history: [],
      skipped: new Set(),
      tab: 'cover',
    };
  }
  drawDiscover();
}

function drawDiscover() {
  const root = $('#view-discover');
  if (!root) return;
  const auth = window.MR_AUTH;
  if (!auth?.user) { renderDiscover(); return; }

  const total = DATA.books.length;
  const readCount = DATA.books.filter(b => auth.statusFor(b.id) === 'read').length;
  const nightstandCount = DATA.books.filter(b => {
    const s = auth.statusFor(b.id);
    return s === 'nightstand' || s === 'started';
  }).length;
  const labeledCount = DATA.books.filter(b => auth.statusFor(b.id) !== null).length;
  const remaining = total - labeledCount;
  const completionPct = total > 0 ? Math.round((readCount / total) * 100) : 0;
  const labeledPct = total > 0 ? Math.round((labeledCount / total) * 100) : 0;

  const book = discoverNextBook();

  const statsRow = `<div class="discover-stats">
    <div class="discover-stat">
      <div class="discover-stat-value">${completionPct}%</div>
      <div class="discover-stat-label">Read · ${readCount} of ${total}</div>
    </div>
    <div class="discover-stat">
      <div class="discover-stat-value">${nightstandCount}</div>
      <div class="discover-stat-label">On nightstand</div>
    </div>
    <div class="discover-stat">
      <div class="discover-stat-value">${labeledPct}%</div>
      <div class="discover-stat-label">Labeled · ${remaining} left</div>
    </div>
  </div>`;

  if (!book) {
    root.innerHTML = `<div class="detail discover-page">
      <h1>Discover</h1>
      ${statsRow}
      <div class="discover-empty">
        <p style="font-size: 18px;"><strong>You've labeled every book.</strong></p>
        <p style="color: var(--muted);">Nice work. Hit <a href="#/books">Books</a> to browse, or <a href="#/">Home</a> to see your progress.</p>
        ${__discoverState && __discoverState.skipped.size > 0
          ? `<p style="margin-top: 18px;"><button type="button" id="discover-replay" class="user-status-btn">Replay ${__discoverState.skipped.size} skipped</button></p>`
          : ''}
      </div>
    </div>`;
    $('#discover-replay')?.addEventListener('click', () => {
      __discoverState.skipped.clear();
      __discoverState.queue = buildDiscoverQueue();
      drawDiscover();
    });
    return;
  }

  const peek1 = discoverPeekBook(1);
  const peek2 = discoverPeekBook(2);

  const tab = __discoverState.tab || 'cover';
  const author = (book.authors || [])[0] || book.author_raw || '';
  const authorSet = new Set((book.authors || []).map(a => a.toLowerCase()));
  const moreByAuthor = authorSet.size === 0 ? [] : DATA.books
    .filter(b => b.id !== book.id && (b.authors || []).some(a => authorSet.has(a.toLowerCase())))
    .sort((a, b) => (b.year || 0) - (a.year || 0));

  const coverImg = book.cover_url
    ? `<img src="${escapeHtml(book.cover_url)}" alt="Cover of ${escapeHtml(book.title)}" draggable="false" onload="__coverFallback(this)" onerror="__coverFallback(this)">`
    : `<span class="discover-cover-placeholder">📖</span>`;

  let description = book.description || '';
  description = description.replace(/\(\[[^\]]+\]\[\d+\]\)/g, '').replace(/^\[\d+\]:.*$/gm, '').trim();
  const descBody = description
    ? escapeHtml(description).split(/\n\n+/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('')
    : `<p style="color: var(--muted);">No description on file for this one.</p>`;

  const awardPills = Object.entries(book.awards || {}).map(([a, s]) =>
    `<span class="rr-pill rr-pill-${a === 'hugo' ? 'h' : 'n'}">${AWARD_LABELS[a]}${s === 'winner' ? ' ★' : ''}</span>`
  ).join('');

  const authorList = moreByAuthor.length === 0
    ? `<p style="color: var(--muted);">No other Hugo/Nebula-listed books by ${escapeHtml(author)}.</p>`
    : `<ul class="discover-author-list">${moreByAuthor.slice(0, 12).map(b => {
        const myS = auth.statusFor(b.id);
        const tag = myS === 'read' ? `<span class="discover-mini-tag read">Read</span>`
          : (myS === 'nightstand' || myS === 'started') ? `<span class="discover-mini-tag night">Nightstand</span>`
          : '';
        return `<li><a href="#/book/${escapeHtml(b.id)}">${escapeHtml(b.title)}</a> <span style="color: var(--muted);">· ${b.year || ''} · ${escapeHtml(b.category)}</span> ${tag}</li>`;
      }).join('')}</ul>`;

  const tabBody = tab === 'cover'
    ? `<div class="discover-tabbody discover-tabbody-cover">${coverImg}</div>`
    : tab === 'desc'
      ? `<div class="discover-tabbody discover-tabbody-desc">
          ${awardPills ? `<div class="discover-pills">${awardPills}</div>` : ''}
          ${descBody}
        </div>`
      : `<div class="discover-tabbody discover-tabbody-author">
          <h3>${escapeHtml(author)}</h3>
          <p style="color: var(--muted); font-size: 13px; margin: -4px 0 14px;">Other Hugo/Nebula appearances</p>
          ${authorList}
        </div>`;

  const peekCard = (b, idx) => {
    if (!b) return '';
    const img = b.cover_url
      ? `<img src="${escapeHtml(b.cover_url)}" alt="" draggable="false" onload="__coverFallback(this)" onerror="__coverFallback(this)">`
      : `<span class="discover-cover-placeholder">📖</span>`;
    return `<div class="discover-card discover-card-peek" data-peek="${idx}"><div class="discover-cardbody"><div class="discover-tabbody discover-tabbody-cover">${img}</div></div></div>`;
  };

  root.innerHTML = `<div class="detail discover-page">
    <h1>Discover</h1>
    ${discoverIntroHtml()}
    ${statsRow}
    <div class="discover-stage">
      <div class="discover-side-controls">
        <button type="button" class="discover-side-btn discover-skip" title="Skip — show again later" aria-label="Skip">⤼ Skip</button>
        <button type="button" class="discover-side-btn discover-undo" title="Undo last decision" aria-label="Undo" ${__discoverState.history.length === 0 ? 'disabled' : ''}>↶ Undo</button>
      </div>
      <div class="discover-cardstack">
        ${peekCard(peek2, 2)}
        ${peekCard(peek1, 1)}
        <div class="discover-card discover-card-top" id="discover-top-card" data-book-id="${escapeHtml(book.id)}">
          <div class="discover-swipe-hint discover-swipe-hint-left">Read</div>
          <div class="discover-swipe-hint discover-swipe-hint-right">Neither</div>
          <div class="discover-swipe-hint discover-swipe-hint-up">Nightstand</div>
          <div class="discover-tabs">
            <button type="button" class="discover-tab${tab === 'cover' ? ' active' : ''}" data-tab="cover">Cover</button>
            <button type="button" class="discover-tab${tab === 'desc' ? ' active' : ''}" data-tab="desc">About</button>
            <button type="button" class="discover-tab${tab === 'author' ? ' active' : ''}" data-tab="author">Author</button>
          </div>
          <div class="discover-cardbody">${tabBody}</div>
          <div class="discover-cardfoot">
            <div class="discover-title"><a href="#/book/${escapeHtml(book.id)}">${escapeHtml(book.title)}</a></div>
            <div class="discover-meta">${escapeHtml(author)} · ${book.year || ''} · ${escapeHtml(book.category)}</div>
          </div>
        </div>
      </div>
    </div>
    <div class="discover-actions">
      <button type="button" class="discover-action discover-action-read" data-action="read">✓ Read</button>
      <button type="button" class="discover-action discover-action-night" data-action="nightstand">📖 Nightstand</button>
      <button type="button" class="discover-action discover-action-neither" data-action="neither">○ Not read</button>
    </div>
    <p class="discover-hint">Swipe <strong>left</strong> for Read · <strong>right</strong> for Not read · <strong>up</strong> for Nightstand</p>
  </div>`;

  wireDiscover();
}

function wireDiscover() {
  const root = $('#view-discover');
  if (!root) return;

  // Tabs
  root.querySelectorAll('.discover-tab').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      __discoverState.tab = btn.dataset.tab;
      drawDiscover();
    });
  });

  // Action buttons
  root.querySelectorAll('.discover-action').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      const status = action === 'neither' ? null : action;
      const card = $('#discover-top-card');
      const dir = action === 'read' ? 'left' : action === 'nightstand' ? 'up' : 'right';
      animateAndCommit(card, dir, status);
    });
  });

  // Side buttons
  root.querySelector('.discover-skip')?.addEventListener('click', () => {
    const card = $('#discover-top-card');
    const bookId = card?.dataset.bookId;
    if (!bookId) return;
    __discoverState.skipped.add(bookId);
    drawDiscover();
  });
  root.querySelector('.discover-undo')?.addEventListener('click', async () => {
    const last = __discoverState.history.pop();
    if (!last) return;
    try {
      await window.MR_AUTH.setBookStatus(last.bookId, last.prevStatus);
    } catch (err) {
      console.error('undo failed:', err);
    }
    __discoverState.skipped.delete(last.bookId);
    __discoverState.queue = buildDiscoverQueue();
    drawDiscover();
  });

  // Swipe handling — pointer events on the top card. Ignore drags that
  // originate on tabs/links so the user can still tap them.
  const card = $('#discover-top-card');
  if (!card) return;
  let startX = 0, startY = 0, dx = 0, dy = 0, dragging = false, pointerId = null;
  const onDown = (e) => {
    if (e.target.closest('.discover-tab') || e.target.closest('a')) return;
    dragging = true;
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    dx = 0; dy = 0;
    card.setPointerCapture(e.pointerId);
    card.classList.add('dragging');
  };
  const onMove = (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    dx = e.clientX - startX;
    dy = e.clientY - startY;
    const rot = dx * 0.05;
    card.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;
    // Hint visibility — show the matching label based on the dominant axis.
    const absX = Math.abs(dx), absY = Math.abs(dy);
    const leftHint = card.querySelector('.discover-swipe-hint-left');
    const rightHint = card.querySelector('.discover-swipe-hint-right');
    const upHint = card.querySelector('.discover-swipe-hint-up');
    leftHint.style.opacity = (dx < 0 && absX > absY) ? Math.min(1, absX / 120) : 0;
    rightHint.style.opacity = (dx > 0 && absX > absY) ? Math.min(1, absX / 120) : 0;
    upHint.style.opacity = (dy < 0 && absY >= absX) ? Math.min(1, absY / 120) : 0;
  };
  const onUp = (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    dragging = false;
    card.classList.remove('dragging');
    try { card.releasePointerCapture(pointerId); } catch (_) {}
    const threshold = 100;
    const absX = Math.abs(dx), absY = Math.abs(dy);
    if (absX < threshold && absY < threshold) {
      card.style.transform = '';
      card.querySelectorAll('.discover-swipe-hint').forEach(h => h.style.opacity = 0);
      return;
    }
    let dir, status;
    if (absY >= absX && dy < 0) { dir = 'up'; status = 'nightstand'; }
    else if (dx < 0) { dir = 'left'; status = 'read'; }
    else { dir = 'right'; status = null; }
    animateAndCommit(card, dir, status);
  };
  card.addEventListener('pointerdown', onDown);
  card.addEventListener('pointermove', onMove);
  card.addEventListener('pointerup', onUp);
  card.addEventListener('pointercancel', onUp);
}

async function animateAndCommit(card, dir, status) {
  if (!card) return;
  const bookId = card.dataset.bookId;
  const auth = window.MR_AUTH;
  if (!auth || !bookId) return;
  // Fly-off animation
  const off = dir === 'left' ? 'translate(-110vw, 0) rotate(-30deg)'
    : dir === 'right' ? 'translate(110vw, 0) rotate(30deg)'
    : 'translate(0, -110vh) rotate(0deg)';
  card.style.transition = 'transform 280ms ease-out, opacity 280ms ease-out';
  card.style.transform = off;
  card.style.opacity = '0';
  const prevStatus = auth.statusFor(bookId);
  // Commit to DB optimistically — UI advances regardless of result; on failure
  // we revert via the history-replay path.
  try {
    await auth.setBookStatus(bookId, status);
    __discoverState.history.push({ bookId, prevStatus });
    if (__discoverState.history.length > 50) __discoverState.history.shift();
  } catch (err) {
    console.error('setBookStatus failed in Discover:', err);
    alert('Save failed: ' + (err.message || err));
  }
  __discoverState.skipped.delete(bookId);
  __discoverState.queue = buildDiscoverQueue();
  // Small delay so the user sees the fly-off before the next card slides in.
  setTimeout(() => drawDiscover(), 220);
}

// ===== Settings page ==================================================
async function renderSettings() {
  const root = $('#view-settings');
  if (!root) return;
  root.innerHTML = `<div class="detail"><h1>Settings</h1><p style="color: var(--muted);">Loading…</p></div>`;
  // Wait for the initial auth bootstrap so user + profile are both populated.
  // Bound it so a stuck bootstrap doesn't leave the page on Loading forever.
  try {
    await Promise.race([
      window.MR_AUTH?.ready,
      new Promise((_, rej) => setTimeout(() => rej(new Error('Auth bootstrap timed out')), 10000)),
    ]);
  } catch (err) {
    root.innerHTML = `<div class="detail"><h1>Settings</h1><p style="color: var(--sf);">Couldn't load: ${escapeHtml(err.message || String(err))}</p><p style="color: var(--muted); font-size: 13px;">Try refreshing the page.</p></div>`;
    return;
  }
  if (!window.MR_AUTH?.user) {
    root.innerHTML = `<div class="detail">
      <h1>Settings</h1>
      <p style="color: var(--muted);">Sign in to manage your profile.</p>
      <div style="margin-top: 14px;"><button type="button" class="user-status-signin" id="settings-signin">Sign in</button></div>
    </div>`;
    $('#settings-signin')?.addEventListener('click', () => window.MR_AUTH.showSignInModal());
    return;
  }

  const profile = window.MR_AUTH.profile;
  const user = window.MR_AUTH.user;
  if (!profile) {
    root.innerHTML = `<div class="detail">
      <h1>Settings</h1>
      <p style="color: var(--sf);">Couldn't load your profile. Try refreshing.</p>
    </div>`;
    return;
  }

  root.innerHTML = `<div class="detail settings-page">
    <h1>Settings</h1>

    <section class="settings-section">
      <h2>Account</h2>
      <div class="settings-grid">
        <label class="settings-field">
          <span>Email</span>
          <input type="email" value="${escapeHtml(user.email || '')}" disabled>
        </label>
        <label class="settings-field">
          <span>Handle <span class="settings-hint">— letters and numbers, 3+ chars</span></span>
          <div class="settings-handle-row">
            <input type="text" id="settings-handle" value="${escapeHtml(profile.handle)}" minlength="3" maxlength="32" autocomplete="off">
            <button type="button" id="settings-handle-save" class="mr-btn-primary" disabled>Save</button>
            <span id="settings-handle-status" class="settings-inline-status"></span>
          </div>
        </label>
      </div>
    </section>

    <section class="settings-section">
      <h2>Leaderboard</h2>
      <label class="settings-check">
        <input type="checkbox" id="settings-leaderboard" ${profile.on_leaderboard ? 'checked' : ''}>
        <strong>Show me on the Friends leaderboard.</strong>
      </label>
      <p style="color: var(--muted); font-size: 12.5px; margin: 6px 0 0 26px;">When on, you appear on the Friends page for everyone you're friends with — they see your handle, read count, and rank. Your profile page at <code>/u/${escapeHtml(profile.handle)}</code> is public either way.</p>
    </section>

    <section class="settings-section">
      <h2>Session</h2>
      <button type="button" class="mr-btn-ghost" id="settings-signout">Sign out</button>
    </section>

    <section class="settings-section settings-danger">
      <h2>Danger zone</h2>
      <p style="color: var(--muted); font-size: 13px; margin: 0 0 12px;">Delete your Readmore account: your profile, your reads, your friendships, and your auth record. Cannot be undone.</p>
      <button type="button" class="mr-btn-danger" id="settings-delete-account">Delete my account</button>
    </section>

    <div id="settings-msg" class="settings-msg"></div>
  </div>`;

  const msg = $('#settings-msg');
  const setMsg = (text, cls = '') => { msg.textContent = text; msg.className = 'settings-msg ' + cls; };

  // Handle save — explicit button, Enter key, and inline status. Was
  // save-on-blur, but users didn't realize the field auto-saved and thought
  // their edits were lost.
  const handleInput = $('#settings-handle');
  const handleBtn = $('#settings-handle-save');
  const handleStatus = $('#settings-handle-status');
  const setHandleStatus = (text, cls = '') => {
    handleStatus.textContent = text;
    handleStatus.className = 'settings-inline-status ' + cls;
  };
  const refreshHandleBtn = () => {
    const v = handleInput.value.replace(/^@/, '').trim();
    handleBtn.disabled = (v === profile.handle) || !v;
  };
  let handleSaving = false;
  const saveHandle = async () => {
    if (handleSaving) return;
    const newHandle = handleInput.value.replace(/^@/, '').trim();
    if (!newHandle || newHandle === profile.handle) return;
    if (!/^[a-zA-Z0-9_]{3,32}$/.test(newHandle)) {
      setHandleStatus('Letters / numbers / underscore only, 3–32 chars.', 'error');
      return;
    }
    handleSaving = true;
    handleBtn.disabled = true;
    setHandleStatus('Saving…', '');
    try {
      const updated = await window.MR_AUTH.updateProfile({ handle: newHandle });
      profile.handle = updated.handle;
      handleInput.value = updated.handle;
      setHandleStatus('✓ Saved', 'success');
      setTimeout(() => setHandleStatus(''), 2500);
    } catch (err) {
      const msg = String(err?.message || err);
      // Postgres unique_violation comes back as 23505
      const friendly = /23505|duplicate|already/i.test(msg)
        ? `@${newHandle} is taken`
        : 'Save failed: ' + msg;
      setHandleStatus(friendly, 'error');
    }
    handleSaving = false;
    refreshHandleBtn();
  };
  handleInput.addEventListener('input', () => { refreshHandleBtn(); setHandleStatus(''); });
  handleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); saveHandle(); }
  });
  handleBtn.addEventListener('click', saveHandle);
  refreshHandleBtn();

  $('#settings-leaderboard').addEventListener('change', async (e) => {
    try {
      await window.MR_AUTH.updateProfile({ on_leaderboard: e.target.checked });
      setMsg(e.target.checked ? "You're on the leaderboard." : "Removed from leaderboard.", 'success');
    } catch (err) { setMsg('Save failed: ' + err.message, 'error'); }
  });

  $('#settings-signout').addEventListener('click', async () => {
    await window.MR_AUTH.signOut();
    location.hash = '#/';
  });

  $('#settings-delete-account').addEventListener('click', async () => {
    const myHandle = profile.handle;
    // Two-step confirm so this can't be a misclick. The expected string is
    // the user's handle verbatim — common pattern (GitHub, etc).
    const typed = prompt(
      `This permanently deletes your account, all your reads, and your friendships.\n\n` +
      `To confirm, type your handle: @${myHandle}`
    );
    if (typed == null) return;
    if (typed.replace(/^@/, '').trim() !== myHandle) {
      setMsg('Handle did not match — account not deleted.', 'error');
      return;
    }
    setMsg('Deleting…', '');
    try {
      const { error } = await window.MR_AUTH.client.rpc('delete_my_account');
      if (error) throw error;
      // Auth row is gone; the in-flight session is now invalid. Force a
      // sign-out client-side to wipe local tokens, then bounce home.
      await window.MR_AUTH.signOut();
      location.hash = '#/';
      // Optional reload to clear MR_AUTH state entirely.
      setTimeout(() => location.reload(), 200);
    } catch (err) {
      setMsg('Delete failed: ' + (err.message || err), 'error');
    }
  });
}

// ===== Admin page ====================================================
async function renderAdmin() {
  const root = $('#view-admin');
  if (!root) return;
  const me = window.MR_AUTH?.profile;
  if (!window.MR_AUTH?.user || !me?.is_admin) {
    root.innerHTML = `<div class="detail">
      <h1>Admin</h1>
      <p style="color: var(--muted);">This page is admin-only. ${me ? '' : '<button type="button" class="user-status-signin" id="admin-signin">Sign in</button>'}</p>
    </div>`;
    $('#admin-signin')?.addEventListener('click', () => window.MR_AUTH.showSignInModal());
    return;
  }

  root.innerHTML = `<div class="detail"><h1>Admin</h1><p style="color: var(--muted);">Loading…</p></div>`;

  const client = window.MR_AUTH.client;
  const { data: profiles, error } = await client.from('profiles')
    .select('id, handle, profile_visibility, on_leaderboard, is_admin, created_at')
    .order('created_at');
  if (error) {
    root.innerHTML = `<div class="detail"><h1>Admin</h1><p style="color: var(--sf);">Load failed: ${escapeHtml(error.message)}</p></div>`;
    return;
  }

  // user_books counts per profile
  const { data: ubAll } = await client.from('user_books').select('user_id, status');
  const reads = {};
  const totalUb = {};
  for (const r of ubAll || []) {
    totalUb[r.user_id] = (totalUb[r.user_id] || 0) + 1;
    if (r.status === 'read') reads[r.user_id] = (reads[r.user_id] || 0) + 1;
  }

  // Friends count per profile — friendships rows are bidirectional, one
  // row per pair, so each row contributes +1 to BOTH user_id_a and user_id_b.
  const { data: edges } = await client.from('friendships').select('user_id_a, user_id_b');
  const friendsCount = {};
  for (const e of edges || []) {
    friendsCount[e.user_id_a] = (friendsCount[e.user_id_a] || 0) + 1;
    friendsCount[e.user_id_b] = (friendsCount[e.user_id_b] || 0) + 1;
  }

  const row = (p) => `
    <div class="admin-row" data-profile-id="${escapeHtml(p.id)}">
      <div class="admin-handle">
        <a href="#/u/${escapeHtml(p.handle)}">@${escapeHtml(p.handle)}</a>
        ${p.is_admin ? '<span class="admin-pill admin-pill-admin">admin</span>' : ''}
      </div>
      <div class="admin-reads">${reads[p.id] || 0} read · ${totalUb[p.id] || 0} total · ${friendsCount[p.id] || 0} friends</div>
      <div class="admin-controls">
        <select data-field="profile_visibility" data-profile-id="${escapeHtml(p.id)}">
          <option value="private" ${p.profile_visibility === 'private' ? 'selected' : ''}>private</option>
          <option value="public" ${p.profile_visibility === 'public' ? 'selected' : ''}>public</option>
        </select>
        <label><input type="checkbox" data-field="on_leaderboard" data-profile-id="${escapeHtml(p.id)}" ${p.on_leaderboard ? 'checked' : ''}> on board</label>
        <label><input type="checkbox" data-field="is_admin" data-profile-id="${escapeHtml(p.id)}" ${p.is_admin ? 'checked' : ''}> admin</label>
      </div>
    </div>`;

  root.innerHTML = `<div class="detail admin-page">
    <h1>Admin</h1>
    <p style="color: var(--muted);">All profiles. Inline edits save immediately. To change an account's email, do it from the Supabase dashboard → Authentication → Users.</p>
    <div class="admin-table">${profiles.map(row).join('')}</div>
    <div id="admin-msg" class="settings-msg"></div>
  </div>`;

  const adminMsg = $('#admin-msg');
  const setAdminMsg = (t, c = '') => { adminMsg.textContent = t; adminMsg.className = 'settings-msg ' + c; };

  root.querySelectorAll('[data-field]').forEach(el => {
    el.addEventListener('change', async () => {
      const field = el.dataset.field;
      const id = el.dataset.profileId;
      const value = el.type === 'checkbox' ? el.checked : el.value;
      try {
        const { error } = await client.from('profiles').update({ [field]: value }).eq('id', id);
        if (error) throw error;
        setAdminMsg(`Updated ${field} for ${id.slice(0,8)}…`, 'success');
      } catch (err) {
        setAdminMsg(err.message || String(err), 'error');
      }
    });
  });
}

// ===== Public profile page ===========================================
async function renderProfile(handle) {
  const root = $('#view-profile');
  if (!root) return;
  if (!handle) {
    root.innerHTML = `<div class="detail"><a href="#/" class="back">← back</a><h1>Profile</h1><p>No handle specified.</p></div>`;
    return;
  }
  root.innerHTML = `<div class="detail"><a href="#/" class="back">← back</a><p style="color: var(--muted);">Loading @${escapeHtml(handle)}…</p></div>`;
  // Wait for auth bootstrap so MR_AUTH.user / profile / client are all settled
  // before any cross-user query — otherwise the profile RLS check sees a
  // half-initialized state and the page can stall.
  await window.MR_AUTH?.ready;

  const client = window.MR_AUTH?.client;
  if (!client) {
    root.innerHTML = `<div class="detail"><a href="#/" class="back">← back</a><p style="color: var(--sf);">Auth client not ready.</p></div>`;
    return;
  }

  // Race the profile lookup against a timeout so a stuck SDK falls through
  // to an error message instead of parking on "Loading @<handle>…".
  const withTimeout = (p, ms, label) => Promise.race([
    p,
    new Promise(res => setTimeout(() => res({ data: null, error: { message: `${label} timed out after ${ms}ms` } }), ms)),
  ]);
  const { data: profile, error } = await withTimeout(
    client.from('profiles')
      .select('id, handle, profile_visibility, on_leaderboard, created_at, is_admin')
      .ilike('handle', handle).maybeSingle(),
    8000, 'profile lookup');
  if (error || !profile) {
    root.innerHTML = `<div class="detail"><a href="#/" class="back">← back</a><h1>Not found</h1><p>No profile @${escapeHtml(handle)}.</p></div>`;
    return;
  }

  const meId = window.MR_AUTH.user?.id;
  const isMe = meId === profile.id;

  // Visibility gate (client-side hint; RLS is authoritative). If we got the
  // profile back, RLS already let us read it. If it's private + not me + not
  // admin, the read would have returned null.
  const { data: ub } = await client.from('user_books')
    .select('book_id, status, date_read').eq('user_id', profile.id);
  const reads = (ub || []).filter(r => r.status === 'read');
  const nightstand = (ub || []).filter(r => r.status === 'nightstand');
  const started = (ub || []).filter(r => r.status === 'started');
  const totalBooks = DATA.books.length;

  // Are we friends?
  let alreadyFriends = false;
  if (meId && !isMe) {
    const [a, b] = meId < profile.id ? [meId, profile.id] : [profile.id, meId];
    const { data: fr } = await client.from('friendships')
      .select('user_id_a').eq('user_id_a', a).eq('user_id_b', b);
    alreadyFriends = (fr || []).length > 0;
  }

  // Recent reads (intersect with DATA.books for cover/title lookup)
  const byId = Object.fromEntries(DATA.books.map(b => [b.id, b]));
  const readBooksFull = reads
    .map(r => ({ ...byId[r.book_id], date_read: r.date_read }))
    .filter(b => b.id);
  const readBooks = readBooksFull
    .slice()
    .sort((a, b) => (b.date_read || '').localeCompare(a.date_read || '') || (b.year || 0) - (a.year || 0))
    .slice(0, 18);
  const tile = (bk) => `<a class="swimlane-card" href="#/book/${escapeHtml(bk.id)}">
    <div class="swimlane-cover">${bk.cover_url ? `<img src="${escapeHtml(bk.cover_url)}" alt="" loading="lazy" onload="__coverFallback(this)" onerror="__coverFallback(this)">` : '<span class="swimlane-placeholder">📖</span>'}</div>
    <div class="swimlane-title">${escapeHtml(bk.title)}</div>
    <div class="swimlane-meta">${escapeHtml(bk.authors?.[0] || '')} · ${bk.year || ''}</div>
  </a>`;

  // Read-id set so the per-section rollups can ask "did they read this?" cheaply.
  const readIds = new Set(reads.map(r => r.book_id));
  const isProfileRead = (b) => readIds.has(b.id);

  // By award — Hugo / Nebula winners + finalists read
  const awardKeys = ['hugo', 'nebula'];
  const awardLabels = { hugo: 'Hugo', nebula: 'Nebula' };
  const awardRows = awardKeys.map(a => {
    const total = DATA.books.filter(b => (b.awards || {})[a]).length;
    const read = readBooksFull.filter(b => (b.awards || {})[a]).length;
    const pct = total > 0 ? Math.round((read / total) * 100) : 0;
    const color = a === 'hugo' ? 'var(--sf)' : 'var(--fantasy)';
    return `<div class="profile-stat-row">
      <div class="profile-stat-label" style="color:${color}"><strong>${awardLabels[a]}</strong></div>
      <div class="profile-stat-bar"><div class="profile-stat-fill" style="width:${pct}%;background:${color}"></div></div>
      <div class="profile-stat-num"><strong>${read}</strong> <span class="muted">/ ${total}</span> · ${pct}%</div>
    </div>`;
  }).join('');

  // By category — Novel / Novella / Novelette
  const catKeys = ['Novel', 'Novella', 'Novelette'];
  const catRows = catKeys.map(c => {
    const total = DATA.books.filter(b => b.category === c).length;
    const read = readBooksFull.filter(b => b.category === c).length;
    const pct = total > 0 ? Math.round((read / total) * 100) : 0;
    return `<div class="profile-stat-row">
      <div class="profile-stat-label"><strong>${c}</strong></div>
      <div class="profile-stat-bar"><div class="profile-stat-fill" style="width:${pct}%;background:var(--accent)"></div></div>
      <div class="profile-stat-num"><strong>${read}</strong> <span class="muted">/ ${total}</span> · ${pct}%</div>
    </div>`;
  }).join('');

  // By author gender
  const genderKeys = [
    { k: 'female', label: 'Female-authored', color: 'var(--accent-2)' },
    { k: 'male', label: 'Male-authored', color: 'var(--accent)' },
    { k: 'unknown', label: 'Unknown / pen name', color: 'var(--accent-3)' },
  ];
  const genderRows = genderKeys.map(({ k, label, color }) => {
    const total = DATA.books.filter(b => (b.primary_author_gender || 'unknown') === k).length;
    const read = readBooksFull.filter(b => (b.primary_author_gender || 'unknown') === k).length;
    const pct = total > 0 ? Math.round((read / total) * 100) : 0;
    return `<div class="profile-stat-row">
      <div class="profile-stat-label" style="color:${color}"><strong>${label}</strong></div>
      <div class="profile-stat-bar"><div class="profile-stat-fill" style="width:${pct}%;background:${color}"></div></div>
      <div class="profile-stat-num"><strong>${read}</strong> <span class="muted">/ ${total}</span> · ${pct}%</div>
    </div>`;
  }).join('');

  // Avg pub year + most-read decade
  const yearSum = readBooksFull.reduce((s, b) => s + (b.year || 0), 0);
  const yearCount = readBooksFull.filter(b => b.year).length;
  const avgYear = yearCount > 0 ? Math.round(yearSum / yearCount) : null;
  const mrd = mostReadDecade(DATA.books, isProfileRead);

  // Era fingerprint radar
  const profByDecade = bucketBooksByDecade(DATA.books);
  const profDecades = eraRadarAxes(profByDecade);
  const profEraValues = eraReaderValues(profDecades, profByDecade, isProfileRead);
  const profKey = 'profile_' + (profile.handle || 'p');
  const profEraConfig = {
    [profKey]: { label: '@' + profile.handle, colorVar: 'var(--accent)', colorRgb: '29, 78, 216' },
  };
  const profEraRadarHtml = (profDecades.length >= 3 && reads.length > 0)
    ? buildRadar(profDecades.map(eraAxisLabel), { [profKey]: profEraValues }, profEraConfig)
    : '';

  const myHandle = window.MR_AUTH?.profile?.handle;
  const compareBtn = (meId && !isMe)
    ? `<a class="mr-btn-primary" href="#/compare?u=${encodeURIComponent(myHandle || 'me')}&u=${encodeURIComponent(profile.handle)}">Compare with me →</a>`
    : '';
  const friendBtn = (meId && !isMe)
    ? (alreadyFriends
        ? `<span class="profile-friend-tag">✓ Friends</span>`
        : `<button type="button" class="mr-btn-ghost" id="profile-add-friend">+ Add as friend</button>`)
    : '';
  const signInBtn = (!meId)
    ? `<button type="button" class="mr-btn-ghost" id="profile-signin">Sign in to compare / add friend</button>`
    : '';

  const readPct = totalBooks > 0 ? Math.round((reads.length / totalBooks) * 100) : 0;
  const cardsHtml = `<section class="profile-headline-grid">
    <div class="compare-stat-card">
      <div class="compare-stat-card-label">Read</div>
      <div class="compare-stat-card-value" style="color:var(--accent);">${reads.length}<span class="muted" style="font-size:0.55em;font-weight:500;"> / ${totalBooks}</span></div>
      <div class="compare-stat-card-sub">${readPct}% of the canonical list</div>
    </div>
    <div class="compare-stat-card">
      <div class="compare-stat-card-label">Nightstand</div>
      <div class="compare-stat-card-value" style="color:var(--accent-3);">${nightstand.length + started.length}</div>
      <div class="compare-stat-card-sub">Books they have, not finished</div>
    </div>
    <div class="compare-stat-card">
      <div class="compare-stat-card-label">Avg pub year</div>
      <div class="compare-stat-card-value">${avgYear ?? '—'}</div>
      <div class="compare-stat-card-sub">Across the books they've read</div>
    </div>
    <div class="compare-stat-card">
      <div class="compare-stat-card-label">Most-read decade</div>
      <div class="compare-stat-card-value">${mrd ? eraAxisLabel(mrd.decade) : '—'}</div>
      <div class="compare-stat-card-sub">${mrd ? `${mrd.count} books` : 'No reads yet'}</div>
    </div>
  </section>`;

  root.innerHTML = `<div class="detail profile-page">
    <a href="#/" class="back">← back</a>
    <div class="profile-header">
      <h1>@${escapeHtml(profile.handle)}${isMe ? ' <span class="profile-me">you</span>' : ''}${profile.is_admin ? ' <span class="admin-pill admin-pill-admin">admin</span>' : ''}</h1>
      <div class="profile-actions">${compareBtn} ${friendBtn} ${signInBtn}</div>
    </div>

    ${cardsHtml}

    ${readBooks.length === 0
      ? `<p style="color: var(--muted); margin-top: 24px;">No reads yet.</p>`
      : `<section class="profile-section"><h2>Recently read</h2><div class="swimlane-strip">${readBooks.map(tile).join('')}</div></section>`}

    <section class="profile-section">
      <h2>By award</h2>
      <div class="profile-stat-list">${awardRows}</div>
    </section>

    <section class="profile-section">
      <h2>By category</h2>
      <div class="profile-stat-list">${catRows}</div>
    </section>

    <section class="profile-section">
      <h2>By author gender</h2>
      <div class="profile-stat-list">${genderRows}</div>
    </section>

    ${profEraRadarHtml ? `<section class="profile-section radar-hero">
      <h2>Influence by era</h2>
      <p style="color: var(--muted); font-size: 13px;">Each axis = a decade. Distance from center = share of that decade's winners + finalists @${escapeHtml(profile.handle)} has read.</p>
      ${profEraRadarHtml}
    </section>` : ''}
  </div>`;

  $('#profile-add-friend')?.addEventListener('click', async () => {
    try {
      await window.MR_AUTH.addFriendByHandle(profile.handle);
      renderProfile(handle);
    } catch (err) {
      alert(err.message || String(err));
    }
  });
  $('#profile-signin')?.addEventListener('click', () => window.MR_AUTH.showSignInModal());
}

function showView(name) {
  $$('.view').forEach(v => v.classList.add('hidden'));
  $(`#view-${name}`).classList.remove('hidden');
  $$('.nav a').forEach(a => a.classList.toggle('active', a.dataset.route === name));
}

function resetFilterState() {
  state.search = '';
  state.readTom = fullStatusSet();
  state.readNika = fullStatusSet();
  state.readWestdac = fullStatusSet();
  state.readColton = fullStatusSet();
  state.readSchupp = fullStatusSet();
  state.awards = new Set(Object.keys(AWARD_LABELS));
  state.statuses = new Set(['winner', 'nominee']);
  state.categories = new Set(['Novel', 'Novella', 'Novelette']);
  state.yearMin = null;
  state.yearMax = null;
  state.authorGender = new Set(['female', 'male', 'unknown']);
  state.missingFilter = new Set();
  state.meStatus = new Set(['read', 'nightstand', 'neither']);
}

function applyFilterParams(params) {
  resetFilterState();
  // Comma-separated multi-value params (pushFiltersToUrl emits these). Older
  // single-value links (?award=hugo) still work — split with one item.
  const award = params.get('award');
  if (award) {
    const valid = award.split(',').filter(s => Object.keys(AWARD_LABELS).includes(s));
    if (valid.length) state.awards = new Set(valid);
  }
  const status = params.get('status');
  if (status) {
    const valid = status.split(',').filter(s => ['winner', 'nominee'].includes(s));
    if (valid.length) state.statuses = new Set(valid);
  }
  const category = params.get('category');
  if (category) {
    const valid = category.split(',').filter(s => ['Novel', 'Novella', 'Novelette'].includes(s));
    if (valid.length) state.categories = new Set(valid);
  }
  const search = params.get('search');
  if (search) state.search = search;
  const yMin = params.get('yearMin');
  if (yMin) state.yearMin = parseInt(yMin, 10);
  const yMax = params.get('yearMax');
  if (yMax) state.yearMax = parseInt(yMax, 10);
  // readTom param is comma-separated list of states (e.g. ?readTom=read,started)
  const readTom = params.get('readTom');
  if (readTom) {
    const parsed = readTom.split(',').map(s => s.trim()).filter(s => ALL_READ_STATES.includes(s));
    if (parsed.length) state.readTom = new Set(parsed);
  }
  // Author gender filter from "By gender" donut/cards on Home. Comma-separated
  // values, e.g. ?gender=female or ?gender=female,male.
  const gender = params.get('gender');
  if (gender) {
    const valid = gender.split(',').map(s => s.trim()).filter(s => ['female', 'male', 'unknown'].includes(s));
    if (valid.length > 0) state.authorGender = new Set(valid);
  }
  // Missing-data debug filter — comma-separated. Legacy "either" maps to both.
  const missing = params.get('missing');
  if (missing) {
    const set = new Set();
    for (const v of missing.split(',').map(s => s.trim())) {
      if (v === 'desc' || v === 'cover' || v === 'link') set.add(v);
      else if (v === 'either') { set.add('desc'); set.add('cover'); }
    }
    if (set.size > 0) state.missingFilter = set;
  }
  const meStatus = params.get('meStatus');
  if (meStatus) {
    const valid = meStatus.split(',').map(s => s.trim()).filter(s => ['read', 'nightstand', 'neither'].includes(s));
    if (valid.length > 0) state.meStatus = new Set(valid);
  }
  syncFiltersToDom();
}

function syncFiltersToDom() {
  $('#search').value = state.search;
  $('#year-min').value = state.yearMin == null ? '' : String(state.yearMin);
  $('#year-max').value = state.yearMax == null ? '' : String(state.yearMax);
  const readerStateMap = { tom: state.readTom, nika: state.readNika, westdac: state.readWestdac, colton: state.readColton, schupp: state.readSchupp };
  for (const [who, set] of Object.entries(readerStateMap)) {
    $$(`input[name="read-${who}"]`).forEach(el => { el.checked = set.has(el.value); });
  }
  $$('input[name="award"]').forEach(el => { el.checked = state.awards.has(el.value); });
  $$('input[name="status"]').forEach(el => { el.checked = state.statuses.has(el.value); });
  $$('input[name="category"]').forEach(el => { el.checked = state.categories.has(el.value); });
  $$('input[name="author-gender"]').forEach(el => { el.checked = state.authorGender.has(el.value); });
  $$('input[name="missing"]').forEach(el => { el.checked = state.missingFilter.has(el.value); });
  $$('input[name="me-status"]').forEach(el => { el.checked = state.meStatus.has(el.value); });
  // Hide the "Your status" fieldset when nobody's signed in — the filter
  // only makes sense for the logged-in user's own user_books data.
  const meFs = $('#me-status-fieldset');
  if (meFs) meFs.hidden = !window.MR_AUTH?.user;
  $('#sort').value = state.sort;
}

// Serialize filter state back to the URL hash so Books page filters are
// shareable. Only emit params for non-default values to keep URLs short.
// Uses replaceState so checkbox flicks don't pollute history.
function pushFiltersToUrl() {
  // Only sync the URL while we're on the Books page — other routes have
  // their own URL semantics we shouldn't clobber.
  if (!location.hash.startsWith('#/books')) return;
  const p = new URLSearchParams();
  if (state.search) p.set('search', state.search);
  if (state.awards.size && state.awards.size < Object.keys(AWARD_LABELS).length) {
    p.set('award', [...state.awards].join(','));
  }
  if (state.statuses.size && state.statuses.size < 2) {
    p.set('status', [...state.statuses].join(','));
  }
  if (state.categories.size && state.categories.size < 3) {
    p.set('category', [...state.categories].join(','));
  }
  if (state.yearMin != null) p.set('yearMin', state.yearMin);
  if (state.yearMax != null) p.set('yearMax', state.yearMax);
  if (state.authorGender.size > 0 && state.authorGender.size < 3) {
    p.set('gender', [...state.authorGender].join(','));
  }
  if (state.missingFilter.size > 0) {
    p.set('missing', [...state.missingFilter].join(','));
  }
  if (state.meStatus && state.meStatus.size > 0 && state.meStatus.size < 3) {
    p.set('meStatus', [...state.meStatus].join(','));
  }
  const qs = p.toString();
  const target = '#/books' + (qs ? '?' + qs : '');
  if (location.hash !== target) {
    history.replaceState(null, '', target);
  }
}

function route() {
  try {
    return _route();
  } catch (err) {
    console.error('route() threw:', err);
    // Last-resort fallback: surface the error instead of leaving the user
    // staring at whatever stale view was up. Friends/Settings/etc. each
    // have their own try-catches but a synchronous throw inside any of
    // them would otherwise bubble up to here invisibly.
    const main = document.getElementById('main');
    if (main) main.innerHTML = `<div class="detail"><h1>Something went wrong</h1><p style="color: var(--sf);">${escapeHtml(err.message || String(err))}</p><p style="color: var(--muted); font-size: 13px;">Try refreshing the page. If this keeps happening, hit cmd+shift+R to bypass cache.</p></div>`;
  }
}
function _route() {
  const h = location.hash || '#/';
  // Bare in-page anchors like "#hugo2026-section" — not a SPA route, just a
  // native scroll target. Skip the re-render so the browser keeps the scroll
  // position it picked from the matching element id.
  if (h.length > 1 && !h.startsWith('#/')) {
    const target = document.getElementById(h.slice(1));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
  }
  const [path, qs] = h.split('?');
  if (path.startsWith('#/books/')) {
    const id = path.slice('#/books/'.length);
    renderDetail(id);
    showView('detail');
    window.scrollTo(0, 0);
    return;
  }
  if (path === '#/books') {
    const params = new URLSearchParams(qs || '');
    if (qs) applyFilterParams(params);
    renderList();
    showView('list');
    window.scrollTo(0, 0);
    return;
  }
  if (path === '#/genre') {
    renderGenre();
    showView('genre');
    window.scrollTo(0, 0);
    return;
  }
  if (path === '#/hugo2026') {
    renderHugo2026();
    showView('hugo2026');
    window.scrollTo(0, 0);
    return;
  }
  if (path === '#/nebula2026') {
    renderNebula2026();
    showView('nebula2026');
    window.scrollTo(0, 0);
    return;
  }
  if (path === '#/compare') {
    const params = new URLSearchParams(qs || '');
    // Head-to-head requires two u= values. Without them this used to render
    // a friend-picker, which is now part of the Friends page — redirect.
    const hasPair = params.getAll('u').length + params.getAll('reader').length + params.getAll('readers').length >= 2;
    if (!hasPair) {
      location.hash = '#/friends';
      return;
    }
    renderCompare(params);
    showView('compare');
    window.scrollTo(0, 0);
    return;
  }
  if (path === '#/leaderboard') {
    // Legacy URL — Friends absorbed the leaderboard. Rewrite so the address
    // bar reflects the canonical path.
    location.hash = '#/friends';
    return;
  }
  if (path === '#/friends') {
    showView('friends');
    window.scrollTo(0, 0);
    renderFriends().catch(err => {
      console.error('renderFriends threw:', err);
      const root = document.getElementById('view-friends');
      if (root) root.innerHTML = `<div class="detail"><h1>Friends</h1><p style="color: var(--sf);">Couldn't load: ${escapeHtml(err.message || String(err))}</p></div>`;
    });
    return;
  }
  if (path === '#/discover') {
    showView('discover');
    window.scrollTo(0, 0);
    renderDiscover().catch(err => {
      console.error('renderDiscover threw:', err);
      const root = document.getElementById('view-discover');
      if (root) root.innerHTML = `<div class="detail"><h1>Discover</h1><p style="color: var(--sf);">Couldn't load: ${escapeHtml(err.message || String(err))}</p></div>`;
    });
    return;
  }
  if (path === '#/signin') {
    // Shareable sign-in URL — opens the magic-link modal over the home view.
    // Already-signed-in visitors get bounced to settings instead of the modal.
    if (window.MR_AUTH?.user) {
      location.hash = '#/settings';
      return;
    }
    // Render the underlying stats view, then pop the modal.
    renderStats();
    showView('stats');
    window.scrollTo(0, 0);
    const params = new URLSearchParams(qs || location.search || '');
    const email = params.get('email') || '';
    setTimeout(() => window.MR_AUTH?.showSignInModal(email), 50);
    return;
  }
  if (path === '#/settings') {
    showView('settings');
    window.scrollTo(0, 0);
    renderSettings().catch(err => {
      console.error('renderSettings threw:', err);
      const root = document.getElementById('view-settings');
      if (root) root.innerHTML = `<div class="detail"><h1>Settings</h1><p style="color: var(--sf);">Couldn't load: ${escapeHtml(err.message || String(err))}</p></div>`;
    });
    return;
  }
  if (path === '#/admin') {
    renderAdmin();
    showView('admin');
    window.scrollTo(0, 0);
    return;
  }
  if (path.startsWith('#/u/')) {
    const handle = path.slice('#/u/'.length).split('?')[0];
    // Viewing your OWN profile URL shows the full Progress dashboard so
    // /#u/<handle> is a shareable canonical link for the signed-in reader.
    const myHandle = window.MR_AUTH?.profile?.handle;
    if (myHandle && handle.toLowerCase() === myHandle.toLowerCase()) {
      renderStats();
      showView('stats');
      window.scrollTo(0, 0);
      return;
    }
    renderProfile(handle);
    showView('profile');
    window.scrollTo(0, 0);
    return;
  }
  renderStats();
  showView('stats');
  window.scrollTo(0, 0);
}

function applyReaderFilterVisibility() {
  $$('.reader-filter').forEach(fs => {
    const who = fs.dataset.reader;
    fs.style.display = READERS.includes(who) ? '' : 'none';
  });
}

function wireFilters() {
  applyReaderFilterVisibility();

  $('#search').addEventListener('input', e => { state.search = e.target.value.trim(); renderList(); });

  const readerStateKey = { tom: 'readTom', nika: 'readNika', westdac: 'readWestdac', colton: 'readColton', schupp: 'readSchupp' };
  for (const who of ALL_READER_IDS) {
    const key = readerStateKey[who];
    $$(`input[name="read-${who}"]`).forEach(el => el.addEventListener('change', e => {
      if (e.target.checked) state[key].add(e.target.value);
      else state[key].delete(e.target.value);
      renderList();
    }));
  }

  $$('input[name="award"]').forEach(el => el.addEventListener('change', e => {
    if (e.target.checked) state.awards.add(e.target.value); else state.awards.delete(e.target.value);
    renderList();
  }));
  $$('input[name="status"]').forEach(el => el.addEventListener('change', e => {
    if (e.target.checked) state.statuses.add(e.target.value); else state.statuses.delete(e.target.value);
    renderList();
  }));
  $$('input[name="category"]').forEach(el => el.addEventListener('change', e => {
    if (e.target.checked) state.categories.add(e.target.value); else state.categories.delete(e.target.value);
    renderList();
  }));
  $('#year-min').addEventListener('input', e => { state.yearMin = e.target.value ? parseInt(e.target.value, 10) : null; renderList(); });
  $('#year-max').addEventListener('input', e => { state.yearMax = e.target.value ? parseInt(e.target.value, 10) : null; renderList(); });
  $('#sort').addEventListener('change', e => { state.sort = e.target.value; renderList(); });
  $$('input[name="author-gender"]').forEach(el => el.addEventListener('change', e => {
    if (e.target.checked) state.authorGender.add(e.target.value);
    else state.authorGender.delete(e.target.value);
    renderList();
  }));
  $$('input[name="missing"]').forEach(el => el.addEventListener('change', e => {
    if (e.target.checked) state.missingFilter.add(e.target.value);
    else state.missingFilter.delete(e.target.value);
    renderList();
  }));
  $$('input[name="me-status"]').forEach(el => el.addEventListener('change', e => {
    if (e.target.checked) state.meStatus.add(e.target.value);
    else state.meStatus.delete(e.target.value);
    renderList();
  }));
  $('#reset').addEventListener('click', () => {
    state = {
      search: '',
      readTom: fullStatusSet(),
      readNika: fullStatusSet(),
      readWestdac: fullStatusSet(),
      readColton: fullStatusSet(),
      readSchupp: fullStatusSet(),
      awards: new Set(Object.keys(AWARD_LABELS)),
      statuses: new Set(['winner', 'nominee']),
      categories: new Set(['Novel', 'Novella', 'Novelette']),
      yearMin: null, yearMax: null, sort: 'year-desc',
      progressStatus: state.progressStatus,
      progressAward: state.progressAward,
      authorWindow: state.authorWindow,
      genderFilter: null,
      authorGender: new Set(['female', 'male', 'unknown']),
      missingFilter: new Set(),
      meStatus: new Set(['read', 'nightstand', 'neither']),
    };
    $('#search').value = '';
    $('#year-min').value = '';
    $('#year-max').value = '';
    for (const who of ALL_READER_IDS) {
      $$(`input[name="read-${who}"]`).forEach(el => { el.checked = true; });
    }
    $$('input[name="award"]').forEach(el => el.checked = true);
    $$('input[name="status"]').forEach(el => el.checked = true);
    $$('input[name="category"]').forEach(el => el.checked = true);
    $$('input[name="author-gender"]').forEach(el => el.checked = true);
    $$('input[name="missing"]').forEach(el => el.checked = false);
    $$('input[name="me-status"]').forEach(el => el.checked = true);
    $('#sort').value = 'year-desc';
    renderList();
  });
}

function applySoloUI() {
  // Default (just Tom) keeps the plain "Readmore" title. Solo modes hide
  // the other readers via body class; multi-reader keeps everything visible.
  if (SOLO) {
    document.body.classList.add(`solo-${SOLO}`);
    document.title = SOLO === 'tom' ? "Readmore" : `Readmore · ${SOLO[0].toUpperCase()}${SOLO.slice(1)}`;
  } else {
    document.title = "Readmore · " + ACTIVE_READERS.map(r => r.label).join(' + ');
  }
}

// ===== Auth integration (Supabase) =====================================
// Renders the nav pill (Sign in / @handle ▾) and re-renders the active view
// when auth state changes, so the book detail page picks up Mark-as-read
// state without a reload.
function renderAuthPill() {
  const slot = $('#auth-slot');
  if (!slot) return;
  // Progress link uses the signed-in user's profile URL so it's shareable.
  // Signed out → plain "#/" (renders the public Progress page).
  const progressLink = document.querySelector('a[data-route="stats"]');
  const handle = window.MR_AUTH?.profile?.handle;
  if (progressLink) {
    progressLink.setAttribute('href', handle ? `#/u/${encodeURIComponent(handle)}` : '#/');
  }
  // Hide Friends + Discover nav links when signed out — both pages are
  // sign-in-only and the route handlers redirect anon visitors to Home.
  const signedIn = !!window.MR_AUTH?.user;
  const navDiscover = document.getElementById('nav-discover');
  const navFriends = document.getElementById('nav-friends');
  if (navDiscover) navDiscover.hidden = !signedIn;
  if (navFriends) navFriends.hidden = !signedIn;
  if (!window.MR_AUTH) {
    slot.innerHTML = '';
    return;
  }
  const user = window.MR_AUTH.user;
  if (!user) {
    slot.innerHTML = `<button type="button" class="auth-signin" id="auth-signin">Sign in</button>`;
    $('#auth-signin').addEventListener('click', () => window.MR_AUTH.showSignInModal());
    return;
  }
  const handleLabel = handle || user.email || 'me';
  const isAdmin = !!window.MR_AUTH.profile?.is_admin;
  // Sign out + Delete account both live in Settings now — the topbar pill
  // is just identity + admin shortcut.
  slot.innerHTML = `
    <a class="auth-handle" id="auth-handle" href="#/settings" title="Settings">@${escapeHtml(handleLabel)}</a>
    ${isAdmin ? '<a class="auth-admin" href="#/admin" title="Admin">⚙</a>' : ''}
  `;
}

function renderUserStatusControls(bookId) {
  // Returns the HTML for the Mark-as-read button group, or a Sign-in CTA when
  // the user isn't authenticated. The container has data-book-id so we can
  // re-render in place after a status change.
  const auth = window.MR_AUTH;
  if (!auth) return '';
  if (!auth.user) {
    return `<div class="user-status user-status-signed-out">
      <button type="button" class="user-status-signin">Sign in to track your reads</button>
    </div>`;
  }
  // Three-state status: Read, Nightstand, Neither. Neither = no user_books
  // row (status removed). Legacy 'started' rows render as Nightstand
  // active for display, since they live in the same bucket now.
  const rawStatus = auth.statusFor(bookId);
  const current = rawStatus === 'started' ? 'nightstand' : rawStatus;
  const btn = (status, label) =>
    `<button type="button" class="user-status-btn ${current === status ? 'active' : ''}" data-status="${status}">${label}</button>`;
  return `<div class="user-status user-status-signed-in" data-book-id="${escapeHtml(bookId)}">
    <span class="user-status-label">Your status</span>
    <div class="user-status-buttons">
      ${btn('read', '✓ Read')}
      ${btn('nightstand', '📖 Nightstand')}
      <button type="button" class="user-status-btn ${!current ? 'active' : ''} user-status-clear" data-status="neither">○ Neither</button>
    </div>
    <div class="user-status-msg" id="user-status-msg-${escapeHtml(bookId)}"></div>
  </div>`;
}

function wireUserStatusControls() {
  const root = $('#view-detail');
  if (!root) return;
  // Sign-in CTA inside the detail view
  root.querySelectorAll('.user-status-signin').forEach(b => {
    b.addEventListener('click', () => window.MR_AUTH?.showSignInModal());
  });
  // Status buttons
  root.querySelectorAll('.user-status[data-book-id]').forEach(container => {
    const bookId = container.dataset.bookId;
    container.querySelectorAll('.user-status-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ds = btn.dataset.status;
        // "Neither" and the legacy "clear" both map to null (delete the row).
        const status = (ds === 'neither' || ds === 'clear') ? null : ds;
        const msg = $(`#user-status-msg-${CSS.escape(bookId)}`);
        // Optimistic — flip active classes immediately. Neither button
        // keeps its own .active state too so the user sees the choice.
        container.querySelectorAll('.user-status-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (msg) { msg.textContent = 'Saving…'; msg.className = 'user-status-msg'; }
        try {
          await window.MR_AUTH.setBookStatus(bookId, status);
          if (msg) { msg.textContent = '✓ Saved'; msg.className = 'user-status-msg success'; setTimeout(() => { msg.textContent = ''; }, 1500); }
        } catch (err) {
          console.error(err);
          if (msg) { msg.textContent = 'Save failed: ' + err.message; msg.className = 'user-status-msg error'; }
          // Re-render to revert optimistic state
          renderDetail(bookId);
          wireUserStatusControls();
        }
      });
    });
  });
}

function wireAuthGatedNav() {
  // Compare nav link: anon click → sign-in modal; authed → normal navigation.
  const compare = document.getElementById('nav-compare');
  if (compare && !compare.dataset.wired) {
    compare.dataset.wired = '1';
    compare.addEventListener('click', (e) => {
      if (!window.MR_AUTH?.user) {
        e.preventDefault();
        window.MR_AUTH?.showSignInModal();
      }
    });
  }
}

async function init() {
  recomputeReaders();
  wireAuthGatedNav();
  applySoloUI();
  try {
    const res = await fetch('data.json');
    DATA = await res.json();
    // Normalize award statuses — the source CSV occasionally annotates a
    // winner row with a pseudonym ("winner (as lewis padgett)"), which
    // breaks every strict `s === 'winner'` check downstream. Clamp the
    // value to 'winner' / 'nominee' based on prefix, drop anything else.
    for (const b of DATA.books) {
      if (!b.awards) continue;
      for (const k of Object.keys(b.awards)) {
        const v = String(b.awards[k] || '').toLowerCase().trim();
        if (v.startsWith('winner')) b.awards[k] = 'winner';
        else if (v.startsWith('nominee')) b.awards[k] = 'nominee';
        else delete b.awards[k];
      }
    }
  } catch (e) {
    $('#grid').innerHTML = '<p>Failed to load data.</p>';
    return;
  }
  wireFilters();
  renderAuthPill();
  window.addEventListener('hashchange', () => { applySoloUI(); route(); });
  // Re-render on auth change: ACTIVE_READERS flips, then re-route.
  if (window.MR_AUTH) {
    window.MR_AUTH.onChange(() => {
      recomputeReaders();
      applySoloUI();
      applyReaderFilterVisibility();
      renderAuthPill();
      // Identity changed → drop everything that's user-scoped so the next
      // page render sees fresh data for the new (or no) user.
      __invalidateCompareCaches();
      window.MR_AUTH.invalidateFriendsCache?.();
      __discoverState = null;
      route();
    });
  }
  route();
}

init();
