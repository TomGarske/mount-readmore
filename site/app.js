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

function buildRadar(axes, readerValues) {
  // axes: string[]   readerValues: { tom: number[], nika: number[], westdac: number[] }  (each 0..1)
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
    const cfg = READER_CONFIG[id];
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
    const cfg = READER_CONFIG[id];
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
    ? `<img src="${escapeHtml(book.cover_url)}" alt="" loading="lazy">`
    : `<span class="cover-placeholder">📖</span>`;
  return `<div class="card" data-id="${escapeHtml(book.id)}">
    <div class="card-cover">${coverHtml}</div>
    <div class="card-body">
      <div class="title">${escapeHtml(book.title)}</div>
      <div class="author">${escapeHtml(book.author_raw || (book.authors || []).join(', '))}</div>
      <div class="meta">
        <span>${book.year || ''}</span>
        <span class="badge cat">${escapeHtml(book.category)}</span>
      </div>
      <div class="badges">${awardBadges}${readBadges}</div>
    </div>
  </div>`;
}

function renderList() {
  const filtered = DATA.books.filter(matchesFilters);
  const sorted = sortBooks(filtered);
  $('#result-count').textContent = `${sorted.length} of ${DATA.books.length} books`;
  $('#grid').innerHTML = sorted.map(bookCard).join('');
  $$('.card', $('#grid')).forEach(card => {
    card.addEventListener('click', () => {
      location.hash = `#/book/${card.dataset.id}`;
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

  // Goodreads link: use book id if we have one (from Goodreads shelf data we don't capture id directly — use search)
  // Amazon link: ISBN-based if available
  const amazonUrl = book.isbn
    ? `https://www.amazon.com/dp/${encodeURIComponent(book.isbn)}`
    : `https://www.amazon.com/s?k=${searchQ}&i=stripbooks`;
  const goodreadsUrl = `https://www.goodreads.com/search?q=${searchQ}`;

  // Truncate long descriptions and clean up Open Library markup ([source][1] etc)
  let description = book.description || '';
  // Strip OL footnote-style refs like ([source][1]) and [1]: http://... blocks
  description = description.replace(/\(\[[^\]]+\]\[\d+\]\)/g, '').replace(/^\[\d+\]:.*$/gm, '').trim();
  const descHtml = description
    ? `<div class="book-description">${escapeHtml(description).split(/\n\n+/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('')}</div>`
    : '';

  const subjectsHtml = (book.subjects && book.subjects.length > 0)
    ? `<div class="book-subjects"><h3>Tags from Open Library</h3>${book.subjects.slice(0, 12).map(s => `<span class="subject-tag">${escapeHtml(s)}</span>`).join(' ')}</div>`
    : '';

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
          <a href="${escapeHtml(goodreadsUrl)}" target="_blank" rel="noopener">Goodreads</a>
          <a href="${escapeHtml(amazonUrl)}" target="_blank" rel="noopener">Amazon</a>
          <a href="https://app.thestorygraph.com/browse?search_term=${searchQ}" target="_blank" rel="noopener">StoryGraph</a>
          <a href="https://en.wikipedia.org/w/index.php?search=${searchQ}" target="_blank" rel="noopener">Wikipedia</a>
        </div>
      </div>
    </div>
    ${descHtml ? `<div class="book-section"><h2>Description</h2>${descHtml}</div>` : ''}
    ${subjectsHtml ? `<div class="book-section">${subjectsHtml}</div>` : ''}
  </div>`;
  wireUserStatusControls();
}

function renderStats() {
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
  const winnersBoth = winners.filter(b => readStatus(b, 'tom') === 'read' && readStatus(b, 'nika') === 'read');
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
    for (const id of ALL_READER_IDS) b[id] = 0;
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
      for (const id of ALL_READER_IDS) {
        if (readStatus(b, id) === 'read') byAward[a][id]++;
      }
    }
  }
  const byCategory = {};
  for (const b of winners) {
    byCategory[b.category] = byCategory[b.category] || emptyBucket();
    byCategory[b.category].total++;
    for (const id of ALL_READER_IDS) {
      if (readStatus(b, id) === 'read') byCategory[b.category][id]++;
    }
  }

  const dated = winnersTom.filter(b => b.tom_date_read && /^\d{4}/.test(b.tom_date_read))
    .map(b => ({ ...b, _t: new Date(b.tom_date_read.replace(/-/g, '/')) }))
    .sort((a, b) => b._t - a._t);

  // Combined recent reads — union across active readers, deduped, sorted
  const recentEither = [];
  const seenRecent = new Set();
  const recentSources = [];
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
  recentEither.sort((a, b) => {
    // If both have Tom dates, sort by date desc; otherwise by year desc
    if (a.tom_date_read && b.tom_date_read) return b.tom_date_read.localeCompare(a.tom_date_read);
    if (a.tom_date_read && !b.tom_date_read) return -1;
    if (!a.tom_date_read && b.tom_date_read) return 1;
    return (b.year || 0) - (a.year || 0);
  });

  // Combined nightstand across active readers, deduped, sorted
  const nightstandBooks = [];
  const seenShelf = new Set();
  for (const b of DATA.books) {
    if (seenShelf.has(b.id)) continue;
    const anyOn = ACTIVE_READERS.some(r =>
      b[`${r.id}_shelf`] === 'to-read' && readStatus(b, r.id) !== 'read'
    );
    if (anyOn) {
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
      for (const id of ALL_READER_IDS) {
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
    for (const id of ALL_READER_IDS) {
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
        ? `<img src="${escapeHtml(b.cover_url)}" alt="" loading="lazy">`
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
      for (const id of ALL_READER_IDS) comboBuckets[key][`${id}Read`] = 0;
    }
    comboBuckets[key].total++;
    if (Object.values(b.awards || {}).includes('winner')) comboBuckets[key].winners++;
    for (const id of ALL_READER_IDS) {
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
  for (const id of ALL_READER_IDS) genderReadByReader[id] = { male: 0, female: 0, unknown: 0 };
  for (const b of winners) {
    const g = b.primary_author_gender || 'unknown';
    if (!(g in genderBuckets)) continue;
    genderBuckets[g]++;
    for (const id of ALL_READER_IDS) {
      if (readStatus(b, id) === 'read') genderReadByReader[id][g]++;
    }
  }

  // ===== Author leaderboard (last 30 years) =====
  const leaderboardCutoff = new Date().getFullYear() - 30;
  const authorAppearances = {};
  for (const b of DATA.books) {
    if (!b.year || b.year < leaderboardCutoff) continue;
    for (const a of (b.authors || [])) {
      if (!authorAppearances[a]) {
        authorAppearances[a] = { total: 0, winners: 0 };
        for (const id of ALL_READER_IDS) authorAppearances[a][`${id}Read`] = 0;
      }
      authorAppearances[a].total++;
      if (Object.values(b.awards || {}).includes('winner')) authorAppearances[a].winners++;
      for (const id of ALL_READER_IDS) {
        if (readStatus(b, id) === 'read') authorAppearances[a][`${id}Read`]++;
      }
    }
  }
  const topAuthors = Object.entries(authorAppearances)
    .map(([name, s]) => ({ name, ...s }))
    .sort((a, b) => b.total - a.total || b.winners - a.winners)
    .slice(0, 12);
  const maxAppearances = topAuthors[0] ? topAuthors[0].total : 1;

  // ===== Decade heatmap =====
  const decadeBuckets = {};
  for (const b of winners) {
    if (!b.year) continue;
    const decade = Math.floor(b.year / 10) * 10;
    if (!decadeBuckets[decade]) decadeBuckets[decade] = emptyBucket();
    decadeBuckets[decade].total++;
    for (const id of ALL_READER_IDS) {
      if (readStatus(b, id) === 'read') decadeBuckets[decade][id]++;
    }
  }
  const decades = Object.entries(decadeBuckets)
    .map(([d, s]) => ({ decade: parseInt(d, 10), ...s }))
    .sort((a, b) => a.decade - b.decade);

  // ===== Mount Readmore climb =====
  const tomPct = winnersTom.length / winnersTotal;
  const nikaPct = winnersNika.length / winnersTotal;

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
    for (const id of ALL_READER_IDS) {
      if (readStatus(b, id) === 'read') eraBuckets[dec][id]++;
    }
  }
  const eras = Object.entries(eraBuckets).map(([d, v]) => [parseInt(d, 10), v]).sort((a, b) => a[0] - b[0]);
  const maxEra = Math.max(1, ...eras.map(([, v]) => v.total));
  const eraReader = PRIMARY_READER;
  const eraFillColor = eraReader ? READER_CONFIG[eraReader].colorVar : 'transparent';
  const eraBarsHtml = eras.map(([d, v]) => {
    const totalH = (v.total / maxEra) * 100;
    const readCount = eraReader ? v[eraReader] : 0;
    const readH = (HAS_READER && v.total > 0) ? (readCount / v.total) * 100 : 0;
    let tooltip;
    if (!HAS_READER) {
      tooltip = `${d}s: ${v.total} ${SUBSET}`;
    } else if (SOLO) {
      tooltip = `${d}s: ${readCount} / ${v.total} ${SUBSET} read`;
    } else {
      tooltip = `${d}s: ` + ACTIVE_READERS.map(r => `${r.label} ${v[r.id]}/${v.total}`).join(' · ');
    }
    const fillDiv = HAS_READER
      ? `<div style="position:absolute;bottom:0;left:0;right:0;height:${readH}%;background:${eraFillColor};border-radius:3px 3px 0 0;"></div>`
      : '';
    const countLine = HAS_READER ? `${readCount}/${v.total}` : `${v.total}`;
    return `<div class="era-bar-col">
      <div class="era-bar empty" style="height: ${Math.max(2, totalH)}%;">
        <div class="era-bar-tooltip">${tooltip}</div>
        ${fillDiv}
      </div>
      <div class="era-bar-label">${d % 100}s</div>
      <div class="era-bar-count">${countLine}</div>
    </div>`;
  }).join('');

  // Up Next: winners not read by Tom AND not on Tom's shelf, sorted by year desc
  const upNext = winners
    .filter(b => readStatus(b, 'tom') !== 'read' && !b.tom_shelf)
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
      ? `<img src="${escapeHtml(b.cover_url)}" alt="" loading="lazy">`
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

  const recentEitherHtml = recentEither.slice(0, 16).map(b =>
    tile(b, `${escapeHtml(b.authors[0] || '')} · ${b.year || ''}`, readerPills(b, 'read'))
  ).join('');

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

  // Mount Readmore climb SVG — left slope: x = 300*(1-p), y = 280 - 230*p
  const climbPos = (p) => {
    const x = 300 * (1 - Math.max(0.02, p));
    const y = 280 - 230 * Math.max(0.02, p);
    return { x, y };
  };
  const tomClimb = climbPos(tomPct);
  const nikaClimb = climbPos(nikaPct);
  // Nika on right slope mirror
  const nikaClimbR = { x: 600 - nikaClimb.x, y: nikaClimb.y };

  const mountainSvg = `<svg viewBox="0 0 600 320" class="mountain-svg">
    <defs>
      <linearGradient id="mtn" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="#3a4a5e"/>
        <stop offset="100%" stop-color="#1d222c"/>
      </linearGradient>
      <linearGradient id="snow" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="#e6e8ee"/>
        <stop offset="100%" stop-color="#7d8aa3"/>
      </linearGradient>
    </defs>
    <polygon points="0,300 300,30 600,300" fill="url(#mtn)" stroke="#2a3140"/>
    <polygon points="270,60 300,30 330,60 320,75 300,55 280,75" fill="url(#snow)" opacity="0.85"/>
    <line x1="0" y1="280" x2="600" y2="280" stroke="#2a3140" stroke-dasharray="2 4"/>
    <text x="300" y="22" text-anchor="middle" fill="#e6e8ee" font-size="12" font-weight="600">PEAK · ${winnersTotal} winners</text>
    <line x1="${tomClimb.x}" y1="${tomClimb.y}" x2="${tomClimb.x - 80}" y2="${tomClimb.y}" stroke="var(--accent)" stroke-width="1" opacity="0.5"/>
    <circle cx="${tomClimb.x}" cy="${tomClimb.y}" r="9" fill="var(--accent)" stroke="#0f1115" stroke-width="2"/>
    <text x="${tomClimb.x - 86}" y="${tomClimb.y + 4}" text-anchor="end" fill="var(--accent)" font-size="12" font-weight="600">Tom · ${winnersTom.length}/${winnersTotal} (${(tomPct * 100).toFixed(1)}%)</text>
    <line x1="${nikaClimbR.x}" y1="${nikaClimbR.y}" x2="${nikaClimbR.x + 80}" y2="${nikaClimbR.y}" stroke="var(--accent-2)" stroke-width="1" opacity="0.5"/>
    <circle cx="${nikaClimbR.x}" cy="${nikaClimbR.y}" r="9" fill="var(--accent-2)" stroke="#0f1115" stroke-width="2"/>
    <text x="${nikaClimbR.x + 86}" y="${nikaClimbR.y + 4}" text-anchor="start" fill="var(--accent-2)" font-size="12" font-weight="600">Nika · ${winnersNika.length}/${winnersTotal} (${(nikaPct * 100).toFixed(1)}%)</text>
    <text x="300" y="310" text-anchor="middle" fill="var(--muted)" font-size="10">BASE CAMP</text>
  </svg>`;

  // Top authors leaderboard
  const authorRows = topAuthors.map(a => {
    const widthPct = (a.total / maxAppearances) * 100;
    const tomFill = a.total > 0 ? (a.tomRead / a.total) * 100 : 0;
    const nikaFill = a.total > 0 ? (a.nikaRead / a.total) * 100 : 0;
    const westdacFill = a.total > 0 ? (a.westdacRead / a.total) * 100 : 0;
    let countCol;
    if (SOLO) {
      const key = SOLO + 'Read';
      countCol = `${a.total} appearances · <span style="color:${READER_CONFIG[SOLO].colorVar}">read ${a[key] || 0}</span>`;
    } else {
      const parts = ACTIVE_READERS.map(r => `<span style="color:${r.colorVar}">${r.initial} ${a[r.id + 'Read'] || 0}</span>`);
      countCol = `${a.total} · ${parts.join(' · ')}`;
    }
    // Stack the reader fills end-to-end inside the appearance bar
    let leftAcc = 0;
    const fillBars = ACTIVE_READERS.map(r => {
      const fillPct = a.total > 0 ? (a[r.id + 'Read'] / a.total) * 100 : 0;
      const cls = r.id === 'tom' ? 'author-bar-tom' : (r.id === 'nika' ? 'author-bar-nika' : 'author-bar-westdac');
      const html = `<div class="${cls}" style="width: ${fillPct}%; left: ${leftAcc}%;" title="${r.label} read ${a[r.id + 'Read']}"></div>`;
      leftAcc += fillPct;
      return html;
    }).join('');
    return `<div class="author-row">
      <div class="author-name">${escapeHtml(a.name)}</div>
      <div class="author-bar">
        <div class="author-bar-bg" style="width: ${widthPct}%;">${fillBars}</div>
      </div>
      <div class="author-count">${countCol}</div>
    </div>`;
  }).join('');

  // Decade heatmap — color intensity follows the active reader in solo mode, first active reader otherwise
  const heatmapColorRgb = Object.fromEntries(ALL_READER_IDS.map(id => [id, READER_CONFIG[id].colorRgb]));
  const heatmapReader = SOLO || (ACTIVE_READERS[0] ? ACTIVE_READERS[0].id : 'tom');
  const decadeCells = decades.map(d => {
    const activeCount = d[heatmapReader];
    const pct = d.total > 0 ? activeCount / d.total : 0;
    const colorRgb = heatmapColorRgb[heatmapReader];
    let titleText, innerText;
    if (SOLO) {
      titleText = `${d.decade}s: ${activeCount}/${d.total} winners read`;
      innerText = `<span style="color: ${READER_CONFIG[SOLO].colorVar}">${activeCount} / ${d.total}</span>`;
    } else {
      const parts = ACTIVE_READERS.map(r => `${r.label} ${d[r.id]}/${d.total}`).join(', ');
      titleText = `${d.decade}s: ${parts}`;
      innerText = ACTIVE_READERS.map(r => `<span style="color: ${r.colorVar}">${r.initial} ${d[r.id]}</span>`).join(' · ');
    }
    return `<div class="decade-cell" style="background: rgba(${colorRgb}, ${0.1 + pct * 0.8});" title="${titleText}">
      <div class="decade-label">${d.decade % 100}s · ${d.total} ${SUBSET}</div>
      <div class="decade-frac">${innerText}</div>
    </div>`;
  }).join('');

  root.innerHTML = `<div class="detail">
    <section class="awards-intro">
      <h2 class="awards-intro-title">The awards</h2>
      <p><strong style="color: var(--sf)">Hugo Awards</strong> <span class="awards-tag awards-tag-fans">Fans</span> — the oldest annual literary award in science fiction and fantasy, presented since <strong>1953</strong> by members of the World Science Fiction Convention (Worldcon). Voted by the convention's attending and supporting members. Categories cover novels, novellas, novelettes, short stories, plus dramatic presentations, editors, artists, magazines, and fan work. Named after Hugo Gernsback, the editor of <em>Amazing Stories</em>. The current Hugo Awards site: <a href="https://www.thehugoawards.org/" target="_blank" rel="noopener">thehugoawards.org</a>.</p>
      <p><strong style="color: var(--fantasy)">Nebula Awards</strong> <span class="awards-tag awards-tag-writers">Writers</span> — peer-voted award presented annually since <strong>1965</strong> by the <a href="https://www.sfwa.org/" target="_blank" rel="noopener">Science Fiction and Fantasy Writers Association</a> (SFWA). Only SFWA members vote — so this is "what working writers think is best," in contrast to the Hugo's "what fans think." Categories mirror the Hugos (novel through short story plus a few others). Winners often, but not always, overlap with the Hugos.</p>
      <p>Mount Readmore tracks <strong>winners + finalists</strong> across both. A book appearing on either list is on Mount Readmore.</p>
    </section>

    <div class="awards-banner">
      <a class="award-pill nebula" href="https://nebulas.sfwa.org/" target="_blank" rel="noopener">
        <span class="award-pill-date">Jun 6, 2026</span>
        <div class="award-pill-body">
          <div class="award-pill-title">2026 Nebula Awards</div>
          <div class="award-pill-sub">SFWA conference · Chicago</div>
        </div>
      </a>
      <a class="award-pill hugo" href="https://www.thehugoawards.org/" target="_blank" rel="noopener">
        <span class="award-pill-date">Aug 30, 2026</span>
        <div class="award-pill-body">
          <div class="award-pill-title">2026 Hugo Awards</div>
          <div class="award-pill-sub">LAcon V (84th WorldCon) · Anaheim</div>
        </div>
      </a>
    </div>

    <section class="completionist-intro">
      <p>Mount Readmore is a complete list of every <strong>Hugo</strong> and <strong>Nebula</strong> winner and finalist in Novel, Novella, and Novelette. The goal is simple: <strong>read them all</strong>. Every cover you check off is one more in the books — across decades of science fiction and fantasy, the works the field itself decided were worth remembering. Pick a year, pick a genre, pick a reader to follow along with. There's no wrong place to start.</p>
    </section>

    ${HAS_READER ? `<div class="progress-section radar-hero">
      <h2>Subgenre fingerprint</h2>
      <p style="color: var(--muted); font-size: 13px;">Each axis = a subgenre. Distance from center = % of that subgenre's ${SUBSET} this reader has finished. Bigger / more even shape = broader coverage.</p>
      ${radarHtml}
    </div>` : ''}

    <h1>Progress</h1>
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

    ${HAS_READER && recentEither.length > 0 ? `<div class="progress-section">
      <h2>Recent ${SUBSET} read</h2>
      <p style="color: var(--muted); font-size: 13px;">Pills show who read each book. Most recent first.</p>
      <div class="recent-reads">${recentEitherHtml}</div>
    </div>` : ''}


    ${HAS_READER && nightstandBooks.length > 0 ? `<div class="progress-section">
      <h2>On the nightstand (${nightstandBooks.length})</h2>
      <p style="color: var(--muted); font-size: 13px;">Books from this list waiting on a to-read shelf. Pills show whose.</p>
      <div class="recent-reads">${nightstandHtml}</div>
    </div>` : ''}

    ${HAS_READER && upNext.length > 0 ? `<div class="progress-section">
      <h2>Up next — ${SUBSET} on no nightstand yet</h2>
      <p style="color: var(--muted); font-size: 13px;">Recent ${SUBSET} by publication year. Open one to add it to your shelf.</p>
      <div class="recent-reads">${upNextHtml}</div>
    </div>` : ''}

    ${HAS_READER ? `<div class="progress-section">
      <h2>Most-awarded authors (last 30 years)</h2>
      <p style="color: var(--muted); font-size: 13px;">Authors with the most appearances on the list since ${leaderboardCutoff} (winners + nominees). Bar width = appearances.</p>
      <div class="authors-list">${authorRows}</div>
    </div>` : ''}

    <div class="progress-section">
      <h2>Coverage by era (${SUBSET})</h2>
      <p style="color: var(--muted); font-size: 13px;">Bar height = ${SUBSET} that decade${HAS_READER ? ' · filled portion = books ' + escapeHtml(READER_CONFIG[PRIMARY_READER].label) + ' read' : ''}. Hover for details.</p>
      <div class="era-bars">${eraBarsHtml}</div>
    </div>


    <div class="progress-section">
      <h2>By primary genre (${SUBSET})</h2>
      <p style="color: var(--muted); font-size: 13px;">Top-level genre derived from Open Library subjects. "Blend" means the subjects clearly point at both SF and Fantasy.</p>
      <div class="genre-bars">
        ${primaryList.map(g => {
          const activeRead = PRIMARY_READER ? g[PRIMARY_READER] : 0;
          const pct = (HAS_READER && g.total > 0) ? (activeRead / g.total) * 100 : 0;
          const sub = !HAS_READER
            ? ''
            : (SOLO ? `${activeRead} read`
                    : ACTIVE_READERS.map(r => `${r.label} ${g[r.id]}`).join(' · '));
          const countHtml = HAS_READER
            ? `${activeRead} / ${g.total}<span style="color:var(--muted)"> · ${sub}</span>`
            : `${g.total}`;
          return `<div class="genre-row">
            <div class="genre-name">${escapeHtml(g.name)}</div>
            <div class="genre-bar">
              <div class="genre-bar-fill" style="width: ${pct}%;"></div>
            </div>
            <div class="genre-count">${countHtml}</div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <div class="progress-section">
      <h2>By subgenre (${SUBSET})</h2>
      <p style="color: var(--muted); font-size: 13px;">Specific subgenre tags. A book can carry multiple (e.g. Space Opera + Hard SF + Military SF).</p>
      <div class="genre-bars">
        ${Object.entries(subBuckets).map(([name, s]) => ({name, ...s}))
          .sort((a, b) => b.total - a.total)
          .map(g => {
            const activeRead = PRIMARY_READER ? g[PRIMARY_READER] : 0;
            const pct = (HAS_READER && g.total > 0) ? (activeRead / g.total) * 100 : 0;
            const sub = !HAS_READER
              ? ''
              : (SOLO ? `${activeRead} read`
                      : ACTIVE_READERS.map(r => `${r.label} ${g[r.id]}`).join(' · '));
            const countHtml = HAS_READER
              ? `${activeRead} / ${g.total}<span style="color:var(--muted)"> · ${sub}</span>`
              : `${g.total}`;
            return `<div class="genre-row">
              <div class="genre-name">${escapeHtml(g.name)}</div>
              <div class="genre-bar">
                <div class="genre-bar-fill" style="width: ${pct}%;"></div>
              </div>
              <div class="genre-count">${countHtml}</div>
            </div>`;
          }).join('')}
      </div>
    </div>

    ${comparisonHtml}

    <div class="progress-section">
      <h2>By author gender (${SUBSET})</h2>
      <p style="color: var(--muted); font-size: 13px;">Primary author of each winning work, inferred from first name. Lead-character gender isn't tracked yet — no reliable data source.</p>
      <div class="gender-grid">
        ${['female', 'male', 'unknown'].map(g => {
          const total = genderBuckets[g];
          const label = g === 'female' ? 'Female-authored' : g === 'male' ? 'Male-authored' : 'Unknown / non-binary / pen name';
          const readerRows = HAS_READER ? ACTIVE_READERS.map(r => {
            const read = genderReadByReader[r.id][g];
            const pct = total > 0 ? Math.round(read / total * 100) : 0;
            return `<div class="gender-reader-row">
              <span class="gender-reader-name" style="color:${r.colorVar}">${r.label}</span>
              <span class="gender-reader-stat">${read} / ${total} (${pct}%)</span>
              <div class="progress"><div class="progress-bar" style="width: ${pct}%; background: ${r.colorVar};"></div></div>
            </div>`;
          }).join('') : '';
          return `<div class="gender-card gender-${g}">
            <div class="gender-card-label">${label}</div>
            <div class="gender-card-stat"><strong>${total}</strong> ${SUBSET}</div>
            <div class="gender-card-readers">${readerRows}</div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <div class="progress-section">
      <h2>By award (${SUBSET})</h2>
      <p style="color: var(--muted); font-size: 13px;">Tap a card to see those ${SUBSET} in the Books tab.</p>
      <div class="stats-grid">
        ${Object.entries(byAward).map(([a, s]) => {
          if (s.total === 0) return '';
          const activeCount = PRIMARY_READER ? s[PRIMARY_READER] : 0;
          const pct = HAS_READER ? Math.round(activeCount / s.total * 100) : 0;
          const sub = !HAS_READER
            ? ''
            : (SOLO ? `${pct}% complete`
                    : ACTIVE_READERS.map(r => `${r.label}: ${Math.round(s[r.id] / s.total * 100)}%`).join(' · '));
          const statusParam = STATUS === 'both' ? '' : `&status=${STATUS}`;
          const valueText = HAS_READER ? `${activeCount} / ${s.total}` : `${s.total}`;
          return linkCard(`#/books?award=${a}${statusParam}`, AWARD_LABELS[a], valueText, sub, HAS_READER ? activeCount / s.total * 100 : null);
        }).join('')}
      </div>
    </div>

    <div class="progress-section">
      <h2>By category (${SUBSET})</h2>
      <p style="color: var(--muted); font-size: 13px;">Tap a card to see those ${SUBSET} in the Books tab.</p>
      <div class="stats-grid">
        ${Object.entries(byCategory).map(([c, s]) => {
          const activeCount = PRIMARY_READER ? s[PRIMARY_READER] : 0;
          const pct = HAS_READER ? Math.round(activeCount / s.total * 100) : 0;
          const sub = !HAS_READER
            ? ''
            : (SOLO ? `${pct}% complete`
                    : ACTIVE_READERS.map(r => `${r.label}: ${Math.round(s[r.id] / s.total * 100)}%`).join(' · '));
          const statusParam = STATUS === 'both' ? '' : `&status=${STATUS}`;
          const valueText = HAS_READER ? `${activeCount} / ${s.total}` : `${s.total}`;
          return linkCard(`#/books?category=${encodeURIComponent(c)}${statusParam}`, c, valueText, sub, HAS_READER ? activeCount / s.total * 100 : null);
        }).join('')}
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
                ? `<img src="${escapeHtml(b.cover_url)}" alt="" loading="lazy">`
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

  $$('.recent-read, .swimlane-card', root).forEach(el => {
    el.addEventListener('click', () => { location.hash = `#/book/${el.dataset.id}`; });
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
  const cover = match && match.cover_url
    ? `<img src="${escapeHtml(match.cover_url)}" alt="Cover of ${escapeHtml(f.title)}" loading="lazy">`
    : `<span class="hugo-card-placeholder">📖</span>`;
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

function renderHugo2026() {
  const root = $('#view-hugo2026');
  root.innerHTML = `<div class="detail hugo2026">
    <div class="hugo-hero hugo-hero-hugo">
      <div class="hugo-hero-tag hugo-hero-tag-hugo">2026 Hugo Awards · Finalists</div>
      <h1>The ballot is out.</h1>
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

    <p class="hugo-source">Source: <a href="https://www.thehugoawards.org/hugo-history/2026-hugo-awards/" target="_blank" rel="noopener">thehugoawards.org · 2026 Hugo Awards announcement</a></p>
  </div>`;
}

function renderNebula2026() {
  const root = $('#view-nebula2026');
  root.innerHTML = `<div class="detail hugo2026 nebula2026">
    <div class="hugo-hero hugo-hero-nebula">
      <div class="hugo-hero-tag hugo-hero-tag-nebula">2026 Nebula Awards · Finalists</div>
      <h1>What the writers chose.</h1>
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

    <p class="hugo-source">Source: <a href="https://nebulas.sfwa.org/9192-2/" target="_blank" rel="noopener">nebulas.sfwa.org · 2026 Nebula Awards Finalists</a></p>
  </div>`;
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
async function loadCompareSide(id, colorIdx = 0) {
  const PALETTE = ['var(--accent)', 'var(--accent-2)', 'var(--accent-3)', 'var(--accent-4)', 'var(--accent-5)'];
  if (id === 'me') {
    const handle = window.MR_AUTH?.profile?.handle || 'you';
    return {
      handle,
      label: handle,
      colorVar: PALETTE[colorIdx % PALETTE.length],
      statusMap: window.MR_AUTH?.userBooks || {},
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
  return {
    handle: prof.handle,
    label: prof.handle,
    colorVar: legacy?.colorVar || PALETTE[colorIdx % PALETTE.length],
    statusMap,
  };
}

async function renderCompare(params) {
  const root = $('#view-compare');
  if (!root) return;

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

  if (ids.length !== 2) {
    // Anon: sign-in CTA
    if (!window.MR_AUTH?.user) {
      root.innerHTML = `<div class="detail">
        <a href="#/" class="back">← back</a>
        <h1>Compare reads</h1>
        <p style="color: var(--muted); max-width: 620px;">
          Sign in to compare your Mount Readmore progress against another reader
          — see what you've both read, what only one of you has read, and what's
          still waiting for both of you.
        </p>
        <div style="margin-top: 14px;">
          <button type="button" class="user-status-signin" id="compare-signin">Sign in</button>
        </div>
      </div>`;
      $('#compare-signin')?.addEventListener('click', () => window.MR_AUTH?.showSignInModal());
      return;
    }
    // Signed in: show friends list as the picker
    root.innerHTML = `<div class="detail"><h1>Compare reads</h1><p style="color: var(--muted);">Loading friends…</p></div>`;
    const friends = await window.MR_AUTH.listFriends();
    const myHandle = window.MR_AUTH.profile?.handle || 'you';

    if (friends.length === 0) {
      root.innerHTML = `<div class="detail">
        <a href="#/" class="back">← back</a>
        <h1>Compare reads</h1>
        <p style="color: var(--muted); max-width: 620px;">
          You don't have any friends yet. <a href="#/settings">Add some from Settings</a>
          and they'll show up here.
        </p>
      </div>`;
      return;
    }

    // For each friend, fetch a read count (best-effort, no fatal error)
    const client = window.MR_AUTH.client;
    const counts = {};
    for (const f of friends) {
      const { count } = await client.from('user_books')
        .select('book_id', { count: 'exact', head: true })
        .eq('user_id', f.id).eq('status', 'read');
      counts[f.id] = count ?? 0;
    }

    const friendRow = (f) => `
      <a class="compare-friend-row" href="#/compare?u=me&amp;u=${encodeURIComponent(f.handle)}">
        <div class="compare-friend-handle">@${escapeHtml(f.handle)}</div>
        <div class="compare-friend-meta">${counts[f.id] || 0} read · ${f.profile_visibility}</div>
        <div class="compare-friend-cta">Compare →</div>
      </a>`;

    root.innerHTML = `<div class="detail compare-picker-page">
      <a href="#/" class="back">← back</a>
      <h1>Compare reads</h1>
      <p style="color: var(--muted); max-width: 620px;">
        Pick a friend to head-to-head with — you'll see what you've both read,
        what only one of you has read, and the gap.
      </p>
      <div class="compare-self-row">Signed in as <strong>@${escapeHtml(myHandle)}</strong></div>
      <div class="compare-friend-list">${friends.map(friendRow).join('')}</div>
      <p style="color: var(--muted); font-size: 13px; margin-top: 18px;">
        Want to compare with someone not in the list? Add them as a friend in
        <a href="#/settings">Settings</a>, or hit a direct URL like
        <code>#/compare?u=me&amp;u=tom</code>.
      </p>
    </div>`;
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
      <a href="#/compare" class="back">← back</a>
      <h1>Compare reads</h1>
      <p style="color: var(--sf);">Couldn't find one of those readers (${escapeHtml(ids.join(' / '))}).</p>
    </div>`;
    return;
  }

  const both = [], aOnly = [], bOnly = [], neither = [];
  for (const book of DATA.books) {
    const aRead = aSide.statusMap[book.id]?.status === 'read';
    const bRead = bSide.statusMap[book.id]?.status === 'read';
    if (aRead && bRead) both.push(book);
    else if (aRead) aOnly.push(book);
    else if (bRead) bOnly.push(book);
    else neither.push(book);
  }
  [both, aOnly, bOnly, neither].forEach(arr => arr.sort((x, y) => (y.year || 0) - (x.year || 0)));

  const tile = (bk) => {
    const cover = bk.cover_url
      ? `<img src="${escapeHtml(bk.cover_url)}" alt="" loading="lazy">`
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
  root.innerHTML = `<div class="detail compare-page">
    <a href="#/compare" class="back">← compare another</a>
    <div class="compare-header">
      <h1>
        <span style="color: ${aSide.colorVar}">@${escapeHtml(aSide.label)}</span>
        <span style="color: var(--muted)">vs</span>
        <span style="color: ${bSide.colorVar}">@${escapeHtml(bSide.label)}</span>
      </h1>
      <p style="color: var(--muted); font-size: 14px;">Comparing read books across the canonical ${totalBooks} on Mount Readmore.</p>
      <div class="compare-totals">
        <span><span style="color: ${aSide.colorVar}">@${aSide.label}</span> has read <strong>${both.length + aOnly.length}</strong></span>
        <span><span style="color: ${bSide.colorVar}">@${bSide.label}</span> has read <strong>${both.length + bOnly.length}</strong></span>
        <span>Shared: <strong>${both.length}</strong></span>
      </div>
    </div>

    <div class="comparison-block">
      ${section(`<span style="color: ${aSide.colorVar}">@${escapeHtml(aSide.label)}</span> ∩ <span style="color: ${bSide.colorVar}">@${escapeHtml(bSide.label)}</span> — both have read`, both, 'Common ground — shared experience to talk about.')}
      ${section(`<span style="color: ${aSide.colorVar}">@${escapeHtml(aSide.label)}</span> only`, aOnly, `Read by @${escapeHtml(aSide.label)}, not @${escapeHtml(bSide.label)}.`)}
      ${section(`<span style="color: ${bSide.colorVar}">@${escapeHtml(bSide.label)}</span> only`, bOnly, `Read by @${escapeHtml(bSide.label)}, not @${escapeHtml(aSide.label)}.`, 'flip')}
      ${section('Neither has read', neither, 'The gap — books on the list ready to be picked.')}
    </div>
  </div>`;
}

// Mount Readmore leaderboard — public, reads from public.leaderboard_overall
// and public.leaderboard_by_award views in Supabase. Only profiles with
// on_leaderboard = true appear. Each row links to a head-to-head comparison.
let __mrLeaderboardCache = null;
async function fetchLeaderboards() {
  if (__mrLeaderboardCache) return __mrLeaderboardCache;
  if (!window.MR_AUTH?.client) return { overall: [], byAward: [], error: 'auth-not-ready' };
  const client = window.MR_AUTH.client;
  const [overall, byAward] = await Promise.all([
    client.from('leaderboard_overall').select('*').order('rank'),
    client.from('leaderboard_by_award').select('*').order('rank'),
  ]);
  if (overall.error || byAward.error) {
    return { overall: [], byAward: [], error: overall.error || byAward.error };
  }
  __mrLeaderboardCache = { overall: overall.data || [], byAward: byAward.data || [], error: null };
  return __mrLeaderboardCache;
}

let __mrLeaderboardScope = 'overall';   // 'overall' | 'hugo' | 'nebula'

async function renderLeaderboard() {
  const root = $('#view-leaderboard');
  if (!root) return;
  root.innerHTML = `<div class="detail"><h1>Leaderboard</h1><p style="color: var(--muted);">Loading…</p></div>`;

  const { overall, byAward, error } = await fetchLeaderboards();
  if (error) {
    root.innerHTML = `<div class="detail">
      <h1>Leaderboard</h1>
      <p style="color: var(--sf);">Couldn't load the leaderboard: ${escapeHtml(String(error.message || error))}</p>
    </div>`;
    return;
  }

  const meHandle = window.MR_AUTH?.profile?.handle || null;
  const myUserId = window.MR_AUTH?.user?.id || null;
  const scope = __mrLeaderboardScope;
  const rows = scope === 'overall'
    ? overall
    : byAward.filter(r => r.award === scope);

  const totalLabel = scope === 'overall'
    ? `${overall[0]?.total_books ?? 0} canonical books`
    : `${rows[0]?.total_books ?? 0} ${scope === 'hugo' ? 'Hugo' : 'Nebula'} books`;

  const onLeaderboard = window.MR_AUTH?.profile?.on_leaderboard;
  const isAuthed = !!window.MR_AUTH?.user;

  const rowHtml = rows.map(r => {
    const isMe = r.user_id === myUserId;
    const canCompare = isAuthed && !isMe;
    const compareHref = canCompare ? `#/compare?u=me&u=${encodeURIComponent(r.handle)}` : '#';
    const tag = canCompare
      ? `<a class="lb-compare" href="${compareHref}">Compare →</a>`
      : isMe
        ? `<span class="lb-me">you</span>`
        : `<span class="lb-compare lb-compare-disabled" data-tooltip="Sign in to compare">Compare</span>`;
    return `<div class="lb-row${isMe ? ' lb-row-me' : ''}">
      <div class="lb-rank">#${r.rank}</div>
      <div class="lb-handle">@${escapeHtml(r.handle)}</div>
      <div class="lb-stat"><strong>${r.read_count}</strong> <span class="lb-of">/ ${r.total_books}</span></div>
      <div class="lb-pct">${r.pct ?? 0}%</div>
      <div class="lb-action">${tag}</div>
    </div>`;
  }).join('');

  const tab = (id, label) => `<button type="button" class="status-tab${scope === id ? ' active' : ''}" data-lb-scope="${id}">${label}</button>`;

  const meOnly = isAuthed && rows.length === 1 && rows[0].user_id === myUserId;

  const emptyState = !isAuthed
    ? `<div class="lb-empty">
        <p><strong>Leaderboards are friends-only.</strong></p>
        <p style="color: var(--muted);">Sign in to see how you stack up against your friends — and against @tom, who's auto-friends with everyone.</p>
        <p><button type="button" class="user-status-signin" id="lb-signin-empty">Sign in</button></p>
      </div>`
    : !onLeaderboard
      ? `<div class="lb-empty">
          <p><strong>You're not on the leaderboard yet.</strong></p>
          <p style="color: var(--muted);">Opt in from <a href="#/settings">Settings</a> to compare your reads with your friends.</p>
        </div>`
      : `<div class="lb-empty">
          <p><strong>No friends on the leaderboard yet.</strong></p>
          <p style="color: var(--muted);">Add friends from <a href="#/settings">Settings</a> — they need to be opted into the leaderboard too. @tom should show up automatically once he's on.</p>
        </div>`;

  root.innerHTML = `<div class="detail leaderboard-page">
    <h1>Leaderboard</h1>
    <p style="color: var(--muted);">You and your friends, ranked by how many of the ${totalLabel} you've read. Friends-only — add friends and opt in from <a href="#/settings">Settings</a>.</p>

    <div class="status-toggle leaderboard-toggle">
      ${tab('overall', 'Overall')}
      ${tab('hugo', 'Hugo')}
      ${tab('nebula', 'Nebula')}
    </div>

    ${rows.length === 0
      ? emptyState
      : `<div class="lb-table">${rowHtml}</div>`}

    ${meOnly
      ? `<p style="margin-top: 22px; color: var(--muted);">It's just you for now. <a href="#/settings">Add friends</a> to fill out the board.</p>`
      : ''}

    ${rows.length > 0 && !isAuthed
      ? `<p style="margin-top: 22px; color: var(--muted);"><button type="button" class="user-status-signin" id="lb-signin">Sign in</button> &nbsp; to compare your reads against anyone on the leaderboard.</p>`
      : rows.length > 0 && !onLeaderboard
        ? `<p style="margin-top: 22px; color: var(--muted);">You're signed in but not on the leaderboard yet. <a href="#/settings">Opt in from Settings</a>.</p>`
        : ''}
  </div>`;

  $$('.leaderboard-toggle .status-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      __mrLeaderboardScope = btn.dataset.lbScope;
      renderLeaderboard();
    });
  });
  $('#lb-signin')?.addEventListener('click', () => window.MR_AUTH?.showSignInModal());
  $('#lb-signin-empty')?.addEventListener('click', () => window.MR_AUTH?.showSignInModal());
  // Disabled-Compare hover hint: clicking prompts sign-in.
  root.querySelectorAll('.lb-compare-disabled').forEach(el => {
    el.addEventListener('click', () => window.MR_AUTH?.showSignInModal());
  });
}

// ===== Settings page ==================================================
async function renderSettings() {
  const root = $('#view-settings');
  if (!root) return;
  if (!window.MR_AUTH?.user) {
    root.innerHTML = `<div class="detail">
      <h1>Settings</h1>
      <p style="color: var(--muted);">Sign in to manage your profile.</p>
      <div style="margin-top: 14px;"><button type="button" class="user-status-signin" id="settings-signin">Sign in</button></div>
    </div>`;
    $('#settings-signin')?.addEventListener('click', () => window.MR_AUTH.showSignInModal());
    return;
  }

  root.innerHTML = `<div class="detail"><h1>Settings</h1><p style="color: var(--muted);">Loading…</p></div>`;

  const profile = window.MR_AUTH.profile;
  const user = window.MR_AUTH.user;
  const friends = await window.MR_AUTH.listFriends();

  const visOpt = (val, label, desc) => `
    <label class="settings-radio">
      <input type="radio" name="profile_visibility" value="${val}" ${profile.profile_visibility === val ? 'checked' : ''}>
      <span><strong>${label}</strong> — ${desc}</span>
    </label>`;

  const friendRow = (f) => `
    <div class="settings-friend-row" data-friend-id="${escapeHtml(f.id)}">
      <a class="settings-friend-handle" href="#/u/${escapeHtml(f.handle)}">@${escapeHtml(f.handle)}</a>
      <span class="settings-friend-meta">${f.on_leaderboard ? 'on leaderboard' : 'off leaderboard'}</span>
      <button type="button" class="settings-friend-remove" data-friend-id="${escapeHtml(f.id)}">Remove</button>
    </div>`;

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
          <input type="text" id="settings-handle" value="${escapeHtml(profile.handle)}" minlength="3" maxlength="32">
        </label>
      </div>
    </section>

    <section class="settings-section">
      <h2>Visibility</h2>
      ${visOpt('private', 'Private', "Only you can see your profile and reads.")}
      ${visOpt('link', 'Link-only', "People with your share link can see your profile. Bring your own social graph.")}
      ${visOpt('public', 'Public', "Anyone can view your profile at /u/" + escapeHtml(profile.handle) + ".")}
      <div style="margin-top: 12px;">
        <label class="settings-check">
          <input type="checkbox" id="settings-leaderboard" ${profile.on_leaderboard ? 'checked' : ''}>
          Show me on the leaderboard (friends only — you and your friends see each other)
        </label>
      </div>
    </section>

    <section class="settings-section">
      <h2>Friends <span class="settings-count">${friends.length}</span></h2>
      <p style="color: var(--muted); font-size: 13px;">Your friends appear together on your leaderboard. <strong>@tom is auto-friends with everyone.</strong></p>
      <form id="settings-add-friend" class="settings-add-friend">
        <input type="text" id="settings-friend-handle" placeholder="@handle" autocomplete="off">
        <button type="submit" class="mr-btn-primary">Add friend</button>
      </form>
      <div class="settings-friend-list">
        ${friends.length === 0 ? '<p style="color: var(--muted); font-size: 13px;">No friends yet. Tom should be here automatically — if not, add him: @tom.</p>' : friends.map(friendRow).join('')}
      </div>
    </section>

    <section class="settings-section">
      <h2>Session</h2>
      <button type="button" class="mr-btn-ghost" id="settings-signout">Sign out</button>
    </section>

    <div id="settings-msg" class="settings-msg"></div>
  </div>`;

  const msg = $('#settings-msg');
  const setMsg = (text, cls = '') => { msg.textContent = text; msg.className = 'settings-msg ' + cls; };

  // Save-on-blur for the handle field
  let handleSaving = false;
  $('#settings-handle').addEventListener('blur', async (e) => {
    const newHandle = e.target.value.replace(/^@/, '').trim();
    if (!newHandle || newHandle === profile.handle) return;
    if (!/^[a-zA-Z0-9_]{3,32}$/.test(newHandle)) {
      setMsg('Handle must be 3–32 chars, letters/numbers/underscore only.', 'error');
      e.target.value = profile.handle;
      return;
    }
    if (handleSaving) return;
    handleSaving = true;
    try {
      await window.MR_AUTH.updateProfile({ handle: newHandle });
      setMsg(`Handle saved as @${newHandle}.`, 'success');
    } catch (err) {
      setMsg('Save failed: ' + (err.message || err), 'error');
      e.target.value = profile.handle;
    }
    handleSaving = false;
  });

  $$('input[name="profile_visibility"]').forEach(r => {
    r.addEventListener('change', async (e) => {
      try {
        await window.MR_AUTH.updateProfile({ profile_visibility: e.target.value });
        setMsg(`Visibility set to ${e.target.value}.`, 'success');
      } catch (err) { setMsg('Save failed: ' + err.message, 'error'); }
    });
  });

  $('#settings-leaderboard').addEventListener('change', async (e) => {
    try {
      await window.MR_AUTH.updateProfile({ on_leaderboard: e.target.checked });
      setMsg(e.target.checked ? "You're on the leaderboard." : "Removed from leaderboard.", 'success');
    } catch (err) { setMsg('Save failed: ' + err.message, 'error'); }
  });

  $('#settings-add-friend').addEventListener('submit', async (e) => {
    e.preventDefault();
    const handle = $('#settings-friend-handle').value;
    try {
      const target = await window.MR_AUTH.addFriendByHandle(handle);
      setMsg(`Added @${target.handle} as a friend.`, 'success');
      $('#settings-friend-handle').value = '';
      renderSettings();
    } catch (err) {
      setMsg(err.message || String(err), 'error');
    }
  });

  $$('.settings-friend-remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      const friendId = btn.dataset.friendId;
      if (!confirm('Remove this friend?')) return;
      try {
        await window.MR_AUTH.removeFriend(friendId);
        setMsg('Friend removed.', 'success');
        renderSettings();
      } catch (err) { setMsg(err.message || String(err), 'error'); }
    });
  });

  $('#settings-signout').addEventListener('click', async () => {
    await window.MR_AUTH.signOut();
    location.hash = '#/';
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

  const row = (p) => `
    <div class="admin-row" data-profile-id="${escapeHtml(p.id)}">
      <div class="admin-handle">
        <a href="#/u/${escapeHtml(p.handle)}">@${escapeHtml(p.handle)}</a>
        ${p.is_admin ? '<span class="admin-pill admin-pill-admin">admin</span>' : ''}
      </div>
      <div class="admin-reads">${reads[p.id] || 0} read · ${totalUb[p.id] || 0} total</div>
      <div class="admin-controls">
        <select data-field="profile_visibility" data-profile-id="${escapeHtml(p.id)}">
          <option value="private" ${p.profile_visibility === 'private' ? 'selected' : ''}>private</option>
          <option value="link" ${p.profile_visibility === 'link' ? 'selected' : ''}>link</option>
          <option value="public" ${p.profile_visibility === 'public' ? 'selected' : ''}>public</option>
        </select>
        <label><input type="checkbox" data-field="on_leaderboard" data-profile-id="${escapeHtml(p.id)}" ${p.on_leaderboard ? 'checked' : ''}> on board</label>
        <label><input type="checkbox" data-field="is_admin" data-profile-id="${escapeHtml(p.id)}" ${p.is_admin ? 'checked' : ''}> admin</label>
      </div>
    </div>`;

  root.innerHTML = `<div class="detail admin-page">
    <h1>Admin</h1>
    <p style="color: var(--muted);">All profiles. Inline edits save immediately. To change an account's email, run <code>scripts/migrate_demo_to_real.py</code> (it has the service-role context required by Supabase auth).</p>
    <div class="admin-table">${profiles.map(row).join('')}</div>
    <div id="admin-msg" class="settings-msg"></div>
    <section class="settings-section" style="margin-top: 24px;">
      <h2>Reassign a sleeping demo to a friend</h2>
      <p style="color: var(--muted); font-size: 13px;">
        The four hidden demos (@SappySaffron / @Westdac / @Colt45 / @Isobat) have
        Tom-synced reading history but fake emails. To give them to Nika / Westdac
        / Colton / Schupp, run locally:
      </p>
      <pre style="background: var(--bg); padding: 14px; border-radius: 8px; overflow:auto; font-size: 12.5px;">cd ~/Projects/Personal/award-books-tracker
set -a && . ./.env && set +a
python3 -c "
from scripts.migrate_demo_to_real import *
import os
from supabase import create_client
sb = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_KEY'])
# replace handle + email below
HANDLE = 'SappySaffron'
EMAIL = 'nika@example.com'
NEW_HANDLE = 'nika'
prof = sb.table('profiles').select('id').eq('handle', HANDLE).execute().data[0]
sb.auth.admin.update_user_by_id(prof['id'], {'email': EMAIL, 'email_confirm': True})
sb.table('profiles').update({'handle': NEW_HANDLE, 'profile_visibility': 'public', 'on_leaderboard': True}).eq('id', prof['id']).execute()
"</pre>
    </section>
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

  const client = window.MR_AUTH?.client;
  if (!client) {
    root.innerHTML = `<div class="detail"><a href="#/" class="back">← back</a><p style="color: var(--sf);">Auth client not ready.</p></div>`;
    return;
  }

  const { data: profile, error } = await client.from('profiles')
    .select('id, handle, profile_visibility, on_leaderboard, created_at, is_admin')
    .eq('handle', handle).maybeSingle();
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
  const readBooks = reads
    .map(r => ({ ...byId[r.book_id], date_read: r.date_read }))
    .filter(b => b.id)
    .sort((a, b) => (b.date_read || '').localeCompare(a.date_read || '') || (b.year || 0) - (a.year || 0))
    .slice(0, 12);
  const tile = (bk) => `<a class="swimlane-card" href="#/book/${escapeHtml(bk.id)}">
    <div class="swimlane-cover">${bk.cover_url ? `<img src="${escapeHtml(bk.cover_url)}" alt="" loading="lazy">` : '<span class="swimlane-placeholder">📖</span>'}</div>
    <div class="swimlane-title">${escapeHtml(bk.title)}</div>
    <div class="swimlane-meta">${escapeHtml(bk.authors?.[0] || '')} · ${bk.year || ''}</div>
  </a>`;

  const compareBtn = (meId && !isMe)
    ? `<a class="mr-btn-primary" href="#/compare?u=me&u=${encodeURIComponent(profile.handle)}">Compare with me →</a>`
    : '';
  const friendBtn = (meId && !isMe)
    ? (alreadyFriends
        ? `<span class="profile-friend-tag">✓ Friends</span>`
        : `<button type="button" class="mr-btn-ghost" id="profile-add-friend">+ Add as friend</button>`)
    : '';
  const signInBtn = (!meId)
    ? `<button type="button" class="mr-btn-ghost" id="profile-signin">Sign in to compare / add friend</button>`
    : '';

  root.innerHTML = `<div class="detail profile-page">
    <a href="#/" class="back">← back</a>
    <div class="profile-header">
      <h1>@${escapeHtml(profile.handle)}${isMe ? ' <span class="profile-me">you</span>' : ''}${profile.is_admin ? ' <span class="admin-pill admin-pill-admin">admin</span>' : ''}</h1>
      <div class="profile-stats">
        <span><strong>${reads.length}</strong> read <span class="muted">of ${totalBooks}</span></span>
        <span><strong>${nightstand.length}</strong> on nightstand</span>
        <span><strong>${started.length}</strong> started</span>
        <span class="muted">${profile.profile_visibility} profile</span>
      </div>
      <div class="profile-actions">${compareBtn} ${friendBtn} ${signInBtn}</div>
    </div>

    ${readBooks.length === 0
      ? `<p style="color: var(--muted); margin-top: 24px;">No reads yet.</p>`
      : `<section class="settings-section"><h2>Recently read</h2><div class="swimlane-strip">${readBooks.map(tile).join('')}</div></section>`}
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
}

function applyFilterParams(params) {
  resetFilterState();
  const award = params.get('award');
  if (award) state.awards = new Set([award]);
  const status = params.get('status');
  if (status) state.statuses = new Set([status]);
  const category = params.get('category');
  if (category) state.categories = new Set([category]);
  // readTom param is comma-separated list of states (e.g. ?readTom=read,started)
  const readTom = params.get('readTom');
  if (readTom) {
    const parsed = readTom.split(',').map(s => s.trim()).filter(s => ALL_READ_STATES.includes(s));
    if (parsed.length) state.readTom = new Set(parsed);
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
  $('#sort').value = state.sort;
}

function route() {
  const h = location.hash || '#/';
  const [path, qs] = h.split('?');
  if (path.startsWith('#/book/')) {
    const id = path.slice('#/book/'.length);
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
    renderCompare(params);
    showView('compare');
    window.scrollTo(0, 0);
    return;
  }
  if (path === '#/leaderboard') {
    renderLeaderboard();
    showView('leaderboard');
    window.scrollTo(0, 0);
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
    renderSettings();
    showView('settings');
    window.scrollTo(0, 0);
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
    $('#sort').value = 'year-desc';
    renderList();
  });
}

function applySoloUI() {
  // Default (just Tom) keeps the plain "Mount Readmore" title. Solo modes hide
  // the other readers via body class; multi-reader keeps everything visible.
  if (SOLO) {
    document.body.classList.add(`solo-${SOLO}`);
    document.title = SOLO === 'tom' ? "Mount Readmore" : `Mount Readmore · ${SOLO[0].toUpperCase()}${SOLO.slice(1)}`;
  } else {
    document.title = "Mount Readmore · " + ACTIVE_READERS.map(r => r.label).join(' + ');
  }
}

// ===== Auth integration (Supabase) =====================================
// Renders the nav pill (Sign in / @handle ▾) and re-renders the active view
// when auth state changes, so the book detail page picks up Mark-as-read
// state without a reload.
function renderAuthPill() {
  const slot = $('#auth-slot');
  if (!slot) return;
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
  const handle = window.MR_AUTH.profile?.handle || user.email || 'me';
  const isAdmin = !!window.MR_AUTH.profile?.is_admin;
  slot.innerHTML = `
    <a class="auth-handle" id="auth-handle" href="#/settings" title="Settings">@${escapeHtml(handle)}</a>
    ${isAdmin ? '<a class="auth-admin" href="#/admin" title="Admin">⚙</a>' : ''}
    <button type="button" class="auth-signout" id="auth-signout" title="Sign out">Sign out</button>
  `;
  $('#auth-signout').addEventListener('click', async () => {
    await window.MR_AUTH.signOut();
  });
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
  const current = auth.statusFor(bookId);
  const btn = (status, label) =>
    `<button type="button" class="user-status-btn ${current === status ? 'active' : ''}" data-status="${status}">${label}</button>`;
  return `<div class="user-status user-status-signed-in" data-book-id="${escapeHtml(bookId)}">
    <span class="user-status-label">Your status</span>
    <div class="user-status-buttons">
      ${btn('read', '✓ Read')}
      ${btn('nightstand', '📖 Nightstand')}
      ${btn('started', '▶ Started')}
      ${current ? `<button type="button" class="user-status-btn user-status-clear" data-status="clear">Clear</button>` : ''}
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
        const status = btn.dataset.status === 'clear' ? null : btn.dataset.status;
        const msg = $(`#user-status-msg-${CSS.escape(bookId)}`);
        // Optimistic — flip active classes immediately
        container.querySelectorAll('.user-status-btn').forEach(b => b.classList.remove('active'));
        if (status) btn.classList.add('active');
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
  } catch (e) {
    $('#grid').innerHTML = '<p>Failed to load data.</p>';
    return;
  }
  wireFilters();
  renderList();
  renderAuthPill();
  window.addEventListener('hashchange', () => { applySoloUI(); route(); });
  // Re-render on auth change: ACTIVE_READERS flips, then re-route.
  if (window.MR_AUTH) {
    window.MR_AUTH.onChange(() => {
      recomputeReaders();
      applySoloUI();
      applyReaderFilterVisibility();
      renderAuthPill();
      __mrLeaderboardCache = null;  // re-fetch so "you" highlight is fresh
      route();
    });
  }
  route();
}

init();
