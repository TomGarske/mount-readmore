'use strict';

const AWARD_LABELS = {
  hugo: 'Hugo',
  nebula: 'Nebula',
  retro_hugo: 'Retro Hugo',
};

// Canonical magazine names — maps publisher field variants to a display name.
// Only magazines appear here; book publishers are absent so no swimlane shows.
const MAGAZINE_CANONICAL = {
  "Asimov's Science Fiction": "Asimov's Science Fiction",
  "Analog Science Fact & Fiction": "Analog / Astounding",
  "Analog Science Fiction and Fact": "Analog / Astounding",
  "Astounding Science-Fiction": "Analog / Astounding",
  "Astounding Science Fiction": "Analog / Astounding",
  "The Magazine of Fantasy & Science Fiction": "The Magazine of Fantasy & Science Fiction",
  "Galaxy Science Fiction": "Galaxy Science Fiction",
  "Tor.com Publishing": "Tor.com",
  "Tor.com": "Tor.com",
  "Clarkesworld": "Clarkesworld",
  "Strange Horizons": "Strange Horizons",
  "Lightspeed Magazine": "Lightspeed Magazine",
  "Fantasy & Science Fiction": "The Magazine of Fantasy & Science Fiction",
};

// Per-magazine display metadata for the home page Magazines section.
const MAGAZINE_DATA = [
  {
    canonical: "Asimov's Science Fiction",
    short: "Asimov's",
    founded: 1977,
    status: 'active',
    accent: '#c6444f',
    coverUrl: "https://upload.wikimedia.org/wikipedia/en/3/3d/IASFM.jpg",
    coverCaption: "First issue, Spring 1977",
    description: "America's premier science fiction magazine, publishing continuously since 1977. Named in honor of Isaac Asimov, it has been home to some of the most celebrated SF novellas and novelettes ever written — and holds a record 55 Hugo Awards for its stories.",
    url: "https://asimovs.com/",
    editorialUrl: "https://asimovs.com/more-stuff/all-archives/#ArchivedEditorials",
    wikiUrl: "https://en.wikipedia.org/wiki/Asimov%27s_Science_Fiction",
  },
  {
    canonical: "Analog / Astounding",
    short: "Analog",
    founded: 1930,
    status: 'active',
    accent: '#2c5d96',
    coverUrl: "https://upload.wikimedia.org/wikipedia/commons/a/a6/ASTJAN1930.jpg",
    coverCaption: "First issue, January 1930",
    description: "The longest-running English-language SF magazine. Founded in 1930 as Astounding Stories, it became Astounding Science Fiction under editor John W. Campbell — shaping the Golden Age of SF. Published today as Analog Science Fiction and Fact.",
    url: "https://www.analogsf.com/",
    wikiUrl: "https://en.wikipedia.org/wiki/Analog_Science_Fiction_and_Fact",
  },
  {
    canonical: "The Magazine of Fantasy & Science Fiction",
    short: "F&SF",
    founded: 1949,
    status: 'active',
    accent: '#5a7a4a',
    coverUrl: "https://upload.wikimedia.org/wikipedia/en/8/85/Cover_of_October_1952_issue_of_The_Magazine_of_Fantasy_%26_Science_Fiction.jpg",
    coverCaption: "October 1952",
    description: "Founded in 1949, F&SF is known for its literary approach to speculative fiction and has published some of the genre's landmark works, including stories by Harlan Ellison, Daniel Keyes, and Ursula K. Le Guin.",
    url: "https://www.sfsite.com/fsf/",
    wikiUrl: "https://en.wikipedia.org/wiki/The_Magazine_of_Fantasy_%26_Science_Fiction",
  },
  {
    canonical: "Galaxy Science Fiction",
    short: "Galaxy",
    founded: 1950,
    defunct: 1980,
    status: 'defunct',
    accent: '#8b6020',
    coverUrl: "https://upload.wikimedia.org/wikipedia/en/1/1b/Galaxy_cover_layouts.jpg",
    coverCaption: "A selection of Galaxy covers",
    description: "Published from 1950 to 1980, Galaxy was one of the leading SF magazines of its era — a rival to Astounding that favored social satire and soft science fiction. It published foundational work by Pohl, Bester, Sturgeon, and more.",
    wikiUrl: "https://en.wikipedia.org/wiki/Galaxy_Science_Fiction",
  },
  {
    canonical: "Clarkesworld",
    short: "Clarkesworld",
    founded: 2006,
    status: 'active',
    accent: '#3a6a8a',
    coverUrl: "https://clarkesworldmagazine.com/covers/cw_236_large.jpg",
    coverCaption: "Issue 236, May 2026",
    description: "An online-only magazine founded in 2006, Clarkesworld publishes original SF and fantasy short fiction and makes every story freely available. Multiple Hugo Award winner for Best Semiprozine.",
    url: "https://clarkesworldmagazine.com/",
    wikiUrl: "https://en.wikipedia.org/wiki/Clarkesworld_Magazine",
  },
  {
    canonical: "Tor.com",
    short: "Reactor",
    founded: 2008,
    status: 'active',
    accent: '#7a3a6a',
    coverUrl: "https://upload.wikimedia.org/wikipedia/en/7/71/Logo_of_Reactor_%28formerly_Tor.com%29_online_magazine.jpg",
    coverCaption: "Reactor (formerly Tor.com)",
    description: "Launched as Tor.com in 2008 and now known as Reactor, this online platform publishes free original SF fiction alongside news and reviews. Its publishing imprint pioneered the Hugo-winning standalone novella format.",
    url: "https://reactormag.com/",
    wikiUrl: "https://en.wikipedia.org/wiki/Reactor_(magazine)",
  },
  {
    canonical: "Lightspeed Magazine",
    short: "Lightspeed",
    founded: 2010,
    status: 'active',
    accent: '#c08020',
    coverUrl: "https://www.lightspeedmagazine.com/wp-content/files_mf/cache/th_364f27d0a9e0903ba4ca66b270091c81_lightspeed_47_april_201431.jpg",
    coverCaption: "Issue 47, April 2014",
    description: "Founded in 2010 by John Joseph Adams, Lightspeed publishes SF and fantasy short fiction online, with many stories freely available. It regularly features Hugo and Nebula Award nominees.",
    url: "https://www.lightspeedmagazine.com/",
    wikiUrl: "https://en.wikipedia.org/wiki/Lightspeed_(magazine)",
  },
];

// Retrospective Hugo Awards. Real Hugos began in 1953; these honor works from
// Worldcon years that gave no Hugo, awarded 50/75/100 years later. `year` is
// the award year, `works` the publication year honored. Ceremony details from
// thehugoawards.org/hugo-history.
const RETRO_HUGO_SESSIONS = [
  { year: 1939, works: 1938, held: 'August 14, 2014',   con: 'Loncon 3',              city: 'London, UK' },
  { year: 1941, works: 1940, held: 'August 18, 2016',   con: 'MidAmeriCon II',        city: 'Kansas City, MO' },
  { year: 1943, works: 1942, held: 'August 16, 2018',   con: 'Worldcon 76',           city: 'San José, CA' },
  { year: 1944, works: 1943, held: 'August 15, 2019',   con: 'Dublin 2019',           city: 'Dublin, Ireland' },
  { year: 1945, works: 1944, held: 'July 30, 2020',     con: 'CoNZealand',            city: 'Wellington, NZ' },
  { year: 1946, works: 1945, held: 'August 30, 1996',   con: 'L.A. Con III',          city: 'Anaheim, CA' },
  { year: 1951, works: 1950, held: 'August 31, 2001',   con: 'The Millennium Philcon', city: 'Philadelphia, PA' },
  { year: 1954, works: 1953, held: 'September 2–6, 2004', con: 'Noreascon 4',          city: 'Boston, MA' },
];

// Shared swimlane card builder used in publication/author swimlanes on the
// detail page and the magazines section on the home page.
function makeSwimlaneCard(b) {
  const cover = b.cover_url
    ? `<img src="${escapeHtml(b.cover_url)}" alt="" loading="lazy" onload="__coverFallback(this)" onerror="__coverFallback(this)">`
    : `<span class="swimlane-placeholder">📖</span>`;
  const isWinner = Object.values(b.awards || {}).includes('winner');
  const awardPills = Object.entries(b.awards || {}).map(([a, s]) =>
    `<span class="rr-pill rr-pill-${a}">${AWARD_LABELS[a]}${s === 'winner' ? ' ★' : ''}</span>`
  ).join('');
  const readerPillsList = SOLO
    ? (() => {
        const rs = readStatus(b, SOLO);
        return rs === 'read' ? `<span class="rr-pill rr-pill-${SOLO[0]}">read</span>` : '';
      })()
    : ACTIVE_READERS.map(r => {
        const rs = readStatus(b, r.id);
        return rs === 'read' ? `<span class="rr-pill rr-pill-${r.id[0]}">${r.initial} read</span>` : '';
      }).join('');
  const pills = awardPills + readerPillsList;
  return `<div class="swimlane-card" data-id="${escapeHtml(b.id)}">
    <div class="swimlane-cover${isWinner ? ' is-winner' : ''}">${cover}</div>
    <div class="swimlane-title">${escapeHtml(b.title)}</div>
    <div class="swimlane-meta">${b.year || ''} · ${escapeHtml(b.category)}</div>
    ${pills ? `<div class="swimlane-pills">${pills}</div>` : ''}
  </div>`;
}

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
  if (state.viewingProfile) {
    // Rendering someone else's Stats — treat them as the sole 'me' reader.
    READERS = ['me'];
    READER_CONFIG.me.label = state.viewingProfile.handle;
  } else if (URL_READERS.length) {
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
const ALL_DECADES = [1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];

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
  decades: new Set(ALL_DECADES),
  sort: 'year-desc',
  // Progress-page status filter (multi-select): subset of {'winner','nominee'}.
  progressStatuses: new Set(['winner']),
  // Progress-page award scope (multi-select): subset of {'hugo','nebula','retro_hugo'}.
  progressAwards: new Set(['hugo', 'nebula', 'retro_hugo']),
  // Progress-page category scope (multi-select).
  progressCategories: new Set(['Novel', 'Novella', 'Novelette']),
  // Include nightstand books in stats projections everywhere — always on.
  // Charts render two polygons (actual reads + grey nightstand-projection
  // ghost). The user-facing toggle was removed; this stays true as the
  // standard behavior.
  includeNightstand: true,
  // Home page: time-window for most-awarded authors (years back)
  authorWindow: 30,
  // Home page: which gender slice is currently selected (null = all)
  genderFilter: null,
  // Books page: author-gender multi-filter. Set of {'female','male','unknown'}.
  // Full set (size 3) = no filter; smaller set = restrict to those gender(s).
  authorGender: new Set(['female', 'male', 'unknown']),
  // Books page: show only books with a free read link (publication_url set).
  readFree: false,
  // Books page: missing-data debug filter. Set of {'desc','cover'}.
  // Empty = no filter; any checked = books missing at least one selected.
  missingFilter: new Set(),
  // Books page: filter by the signed-in user's status. Set of
  // {'read','nightstand','neither'}. Full set (size 3) = no filter.
  // 'neither' matches books the user hasn't marked at all.
  meStatus: new Set(['read', 'nightstand', 'neither']),
  // Search view: which sub-tab is active. 'books' | 'authors'.
  searchMode: 'books',
  // When non-null, render the Stats page as if viewing another user's data.
  // Shape: { id, handle, userBooksById, profile }. The 'me' reader's
  // readStatus/onNightstand/shelfStatus look here instead of MR_AUTH.
  viewingProfile: null,
};

// Solo mode is in the real query string (?solo=tom). Hash routing preserves it
// automatically as you navigate, so internal href="#/..." links just work.

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// Status for the 'me' reader. When state.viewingProfile is set we're rendering
// someone else's Stats page, so resolve against their loaded user_books map
// instead of the signed-in user's MR_AUTH.
function meStatusFor(bookId) {
  if (state.viewingProfile) {
    return state.viewingProfile.userBooksById?.[bookId]?.status || null;
  }
  return window.MR_AUTH?.statusFor?.(bookId) || null;
}

// Full user_books map for the 'me' reader. Either the signed-in user's books
// (default) or the viewed profile's books (when state.viewingProfile is set).
// Used by renderStats sections that iterate the whole map rather than ask per
// book — e.g. "Recently read" and "Nightstand" swimlanes.
function meUserBooks() {
  if (state.viewingProfile) return state.viewingProfile.userBooksById || {};
  return window.MR_AUTH?.userBooks || {};
}

function readStatus(book, who = 'tom') {
  if (who === 'me') {
    const status = meStatusFor(book.id);
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
    return meStatusFor(book.id) === 'nightstand';
  }
  return book[`${who}_shelf`] === 'to-read';
}

function shelfStatus(book, who) {
  // Returns the raw shelf label string (e.g., 'to-read', 'currently-reading')
  // or 'nightstand' / 'started' / 'read' for 'me'. Used where the existing UI
  // wants to render a label or compare to a specific shelf.
  if (who === 'me') {
    return meStatusFor(book.id);
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
  if (state.decades.size < ALL_DECADES.length) {
    if (book.year == null) return false;
    if (!state.decades.has(Math.floor(book.year / 10) * 10)) return false;
  }
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
  // Read-free filter: only show books with a direct publication_url.
  if (state.readFree && !book.publication_url) return false;
  // Missing-data filter (Books mode): any checked → book must be missing
  // at least one of the checked criteria. Empty set = no filter.
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
  // Update Books/Authors toggle active state
  const booksTab = document.getElementById('search-tab-books');
  const authorsTab = document.getElementById('search-tab-authors');
  if (booksTab) booksTab.classList.toggle('active', state.searchMode !== 'authors');
  if (authorsTab) authorsTab.classList.toggle('active', state.searchMode === 'authors');
  // Toggle sidebar visibility via class on the view container
  const listView = document.getElementById('view-list');
  if (listView) listView.classList.toggle('mode-authors', state.searchMode === 'authors');
  // Sync URL on every render so filter changes are persistent regardless
  // of which mode (books or authors) the user is in.
  pushFiltersToUrl();
  if (state.searchMode === 'authors') {
    // Hide book-specific result controls, keep filter sidebar visible
    const rcEl = document.getElementById('result-count');
    const sortEl = document.getElementById('sort');
    if (rcEl) rcEl.style.display = 'none';
    if (sortEl) sortEl.style.display = 'none';
    // Build set of book IDs that pass the current filters so authors mode
    // stays in sync with whatever filters are checked in the sidebar.
    const filteredIds = new Set(DATA.books.filter(matchesFilters).map(b => b.id));
    renderAuthors(document.getElementById('grid'), filteredIds);
    return;
  }
  // Restore book controls (in case we switched back from authors mode)
  const rcEl = document.getElementById('result-count');
  const sortEl = document.getElementById('sort');
  if (rcEl) rcEl.style.display = '';
  if (sortEl) sortEl.style.display = '';
  const filtered = DATA.books.filter(matchesFilters);
  const sorted = sortBooks(filtered);
  const activeFilters = [];
  if (state.authorGender && state.authorGender.size > 0 && state.authorGender.size < 3) {
    const names = { female: 'Female-authored', male: 'Male-authored', unknown: 'Unknown / pen name' };
    const label = [...state.authorGender].map(g => names[g]).join(' + ');
    activeFilters.push({ label, clear: 'gender' });
  }
  if (state.readFree) {
    activeFilters.push({ label: 'Read free online', clear: 'readFree' });
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
    if (w === 'readFree') {
      state.readFree = false;
      const el = $('#filter-read-free'); if (el) el.checked = false;
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

// Shared share/copy control. Real-path URLs (/books, /authors, /collections)
// are served by Pages Functions that inject page-specific OG tags, so a shared
// link renders a rich preview. "Share" uses the native sheet where available;
// "Copy link" is always present.
function shareRowHtml(shareUrl, shareTitle) {
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const u = escapeHtml(shareUrl);
  const t = escapeHtml(shareTitle || 'Readmore SFF');
  return `<div class="detail-share-row">
    ${canNativeShare ? `<button type="button" class="detail-share-btn" data-share-url="${u}" data-share-title="${t}" title="Share">Share</button>` : ''}
    <button type="button" class="detail-copy-btn" data-share-url="${u}" title="Copy a link">Copy link</button>
  </div>`;
}

function wireShareRow(root) {
  const shareBtn = $('.detail-share-btn', root);
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      try { await navigator.share({ title: shareBtn.dataset.shareTitle || 'Readmore SFF', url: shareBtn.dataset.shareUrl }); }
      catch (_) { /* user cancelled the share sheet — no-op */ }
    });
  }
  const copyBtn = $('.detail-copy-btn', root);
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const url = copyBtn.dataset.shareUrl;
      try {
        await navigator.clipboard.writeText(url);
      } catch (_) {
        const ta = document.createElement('textarea');
        ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); } catch (_) {}
        ta.remove();
      }
      const prev = copyBtn.textContent;
      copyBtn.textContent = '✓ Copied';
      copyBtn.classList.add('copied');
      setTimeout(() => { copyBtn.textContent = prev; copyBtn.classList.remove('copied'); }, 1800);
    });
  }
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
      <div class="swimlane-strip">${moreByAuthor.map(b => makeSwimlaneCard(b)).join('')}</div>
    </div>`;

  // Same-publication swimlane — only for magazine-published works.
  const pubCanonical = MAGAZINE_CANONICAL[book.publisher];
  const fromSamePub = pubCanonical
    ? DATA.books
        .filter(b => b.id !== book.id && MAGAZINE_CANONICAL[b.publisher] === pubCanonical)
        .sort((a, b) => (b.year || 0) - (a.year || 0))
    : [];
  const fromSamePubHtml = fromSamePub.length === 0 ? '' : `
    <div class="book-section">
      <h2>Also from ${escapeHtml(pubCanonical)} <span class="more-by-count">${fromSamePub.length}</span></h2>
      <div class="swimlane-strip">${fromSamePub.map(b => makeSwimlaneCard(b)).join('')}</div>
    </div>`;

  const shareUrl = `${location.origin}/books/${encodeURIComponent(book.id)}`;

  root.innerHTML = `<div class="detail">
    <a href="#/search" class="back">← back to search</a>
    <h1>${escapeHtml(book.title)}</h1>
    <div class="author-line">by ${(book.authors || []).map(a => `<a href="#/authors/${encodeURIComponent(a)}" class="author-link">${escapeHtml(a)}</a>`).join(', ') || escapeHtml(book.author_raw || '')}${book.series ? ` · <span class="series-inline">${escapeHtml(book.series)}</span>` : ''}</div>
    ${shareRowHtml(shareUrl, book.title)}
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
          ${(() => {
            const readUrl = book.publication_url || `https://bookshop.org/search?keywords=${searchQ}`;
            const host = new URL(readUrl).hostname.replace(/^www\./, '');
            const favicon = `https://www.google.com/s2/favicons?domain=${host}&sz=32`;
            const magazine = book.publication_label || MAGAZINE_CANONICAL[book.publisher] || null;
            let cta, label;
            if (book.publication_url) {
              cta = 'Read Free Online';
              label = magazine
                ? `Originally published in <strong>${escapeHtml(magazine)}</strong> — read free online`
                : 'Available to read free online';
            } else {
              cta = 'Find on Bookshop';
              label = magazine
                ? `Originally published in <strong>${escapeHtml(magazine)}</strong>`
                : 'Find or purchase this book on Bookshop.org';
            }
            return `<div class="detail-link-read-label">${label}</div><div class="detail-links-buttons"><a href="${escapeHtml(readUrl)}" target="_blank" rel="noopener" class="detail-link-read">${cta} <img src="${favicon}" alt="${escapeHtml(host)}" class="detail-link-favicon"></a><a href="${escapeHtml(goodreadsUrl)}" target="_blank" rel="noopener">Goodreads</a><a href="https://app.thestorygraph.com/browse?search_term=${searchQ}" target="_blank" rel="noopener">StoryGraph</a></div>`;
          })()}
        </div>
      </div>
    </div>
    ${descHtml ? `<div class="book-section"><h2>Description</h2>${descHtml}</div>` : ''}
    ${subjectsHtml ? `<div class="book-section">${subjectsHtml}</div>` : ''}
    ${moreByAuthorHtml}
    ${fromSamePubHtml}
    ${book.authors && book.authors.length > 0 ? `<div id="detail-author-bio" class="book-section author-bio-section"></div>` : ''}
  </div>`;
  wireUserStatusControls();
  wireShareRow(root);
  $$('.swimlane-card', root).forEach(el => {
    el.addEventListener('click', () => { location.hash = `#/books/${el.dataset.id}`; });
  });
  // Async: populate About the Author from Wikipedia
  if (book.authors && book.authors.length > 0) {
    fetchWikiAuthor(book.authors[0]).then(wiki => {
      const bioEl = $('#detail-author-bio');
      if (!wiki || !bioEl || wiki.type === 'disambiguation') return;
      const photo = wiki.thumbnail
        ? `<img src="${escapeHtml(wiki.thumbnail.source)}" alt="${escapeHtml(book.authors[0])}" class="author-bio-photo">`
        : '';
      const extract = wiki.extract
        ? escapeHtml(wiki.extract.slice(0, 500)) + (wiki.extract.length > 500 ? '…' : '')
        : '';
      const wikiUrl = wiki.content_urls && wiki.content_urls.desktop && wiki.content_urls.desktop.page
        ? wiki.content_urls.desktop.page : null;
      const wikiLink = wikiUrl
        ? `<a href="${escapeHtml(wikiUrl)}" target="_blank" rel="noopener" class="author-bio-wiki-link">Full article on Wikipedia →</a>`
        : '';
      const authorHref = `#/authors/${encodeURIComponent(book.authors[0])}`;
      bioEl.innerHTML = `
        <h2><a href="${authorHref}" class="author-link">About ${escapeHtml(book.authors[0])}</a></h2>
        <div class="author-bio-body">
          ${photo ? `<a href="${authorHref}" class="author-bio-photo-link">${photo}</a>` : ''}
          <div class="author-bio-text"><p>${extract}</p>${wikiLink}</div>
        </div>`;
    });
  }
}

// ─── Wikipedia helper ──────────────────────────────────────────────────────
// Explicit display-name → Wikipedia title overrides for authors whose
// display name doesn't resolve directly (pen names, parenthetical
// clarifications, non-English name ordering, etc.). Keys are the exact
// display name as it appears in DATA.books[].authors.
const AUTHOR_WIKI_ALIASES = {
  'Ursula Vernon (as T. Kingfisher)': 'T._Kingfisher',
  'Robert A. Heinlein (as Anson MacDonald)': 'Robert_A._Heinlein',
  'John W. Campbell (as Don A. Stuart)': 'John_W._Campbell',
  'Cixin Liu (Chinese)': 'Liu_Cixin',
  'Ken Liu (translator)': 'Ken_Liu_(American_writer)',
};

// Try a Wikipedia summary URL and return parsed JSON or null.
async function _fetchWikiTitle(title) {
  try {
    const r = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { headers: { 'Api-User-Agent': 'Readmore/1.0 (https://readmore.tomgarske.com)' } }
    );
    if (!r.ok) return null;
    const data = await r.json();
    // Disambiguation pages don't have author photos and confuse downstream
    // code. Reject them so the fallback path runs.
    if (data?.type === 'disambiguation') return null;
    return data;
  } catch { return null; }
}

const _wikiCache = new Map();
async function fetchWikiAuthor(name) {
  if (_wikiCache.has(name)) return _wikiCache.get(name);
  // 1. Explicit alias mapping (highest priority)
  const aliased = AUTHOR_WIKI_ALIASES[name];
  if (aliased) {
    const data = await _fetchWikiTitle(aliased);
    if (data && data.thumbnail) { _wikiCache.set(name, data); return data; }
  }
  // 2. Try the display name directly
  let data = await _fetchWikiTitle(name.replace(/ /g, '_'));
  if (data && data.thumbnail) { _wikiCache.set(name, data); return data; }
  // 3. Fallback: strip parenthetical clarifications (e.g. "Cixin Liu (Chinese)"
  //    → "Cixin Liu") and retry.
  const stripped = name.replace(/\s*\([^)]+\)\s*$/g, '').trim();
  if (stripped && stripped !== name) {
    const data2 = await _fetchWikiTitle(stripped.replace(/ /g, '_'));
    if (data2 && data2.thumbnail) { _wikiCache.set(name, data2); return data2; }
  }
  // Cache the last (likely null/no-thumbnail) result anyway to avoid retrying
  _wikiCache.set(name, data);
  return data;
}

// ─── Authors view ──────────────────────────────────────────────────────────
// When called without a root, renders into #view-authors (standalone authors tab).
// When called with a DOM element (e.g. #grid), renders authors into that container
// so the Search view can show authors inline without a separate full-page view.
// allowedBookIds: optional Set of book IDs to restrict author stats to (for filter sync).
function renderAuthors(root = null, allowedBookIds = null) {
  root = root || $('#view-authors');
  if (!root) return;

  // Build per-author stats from DATA.books (optionally filtered)
  const map = new Map();
  for (const b of DATA.books) {
    if (allowedBookIds && !allowedBookIds.has(b.id)) continue;
    const isWin = Object.values(b.awards || {}).includes('winner');
    const isNom = !isWin && Object.keys(b.awards || {}).length > 0;
    for (const name of (b.authors || [])) {
      if (!map.has(name)) map.set(name, { name, wins: 0, noms: 0, books: [] });
      const rec = map.get(name);
      if (isWin) rec.wins++;
      else if (isNom) rec.noms++;
      rec.books.push(b);
    }
  }

  let authors = [...map.values()].filter(a => a.books.length > 0);
  const sortSel = root.querySelector && root.querySelector('#author-sort');
  const sortVal = sortSel ? sortSel.value : 'wins';
  const searchSel = root.querySelector && root.querySelector('#author-search');
  const searchVal = searchSel ? searchSel.value : '';

  const sort = (val) => {
    if (val === 'wins') authors.sort((a, b) => (b.wins * 10 + b.noms) - (a.wins * 10 + a.noms));
    else if (val === 'books') authors.sort((a, b) => b.books.length - a.books.length);
    else authors.sort((a, b) => a.name.localeCompare(b.name));
  };
  sort(sortVal);

  const renderGrid = async (filterQ) => {
    const q = (filterQ || '').toLowerCase().trim();
    let visible = q ? authors.filter(a => a.name.toLowerCase().includes(q)) : authors;
    const grid = root.querySelector('#authors-grid');
    if (!grid) return;
    const countEl = root.querySelector('#authors-count');

    grid.innerHTML = visible.map(a => {
      const slug = a.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      const winBadge = a.wins ? `<span class="author-badge wins">${a.wins}W</span>` : '';
      const nomBadge = a.noms ? `<span class="author-badge noms">${a.noms}N</span>` : '';
      const bookCount = `<span class="author-book-count">${a.books.length} book${a.books.length !== 1 ? 's' : ''}</span>`;
      return `<a class="author-card" href="#/authors/${encodeURIComponent(a.name)}" data-author="${escapeHtml(a.name)}">
        <div class="author-card-photo-wrap">
          <div class="author-card-photo" id="author-photo-${escapeHtml(slug)}" data-name="${escapeHtml(a.name)}">
            <span class="author-card-initials">${escapeHtml(a.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase())}</span>
          </div>
        </div>
        <div class="author-card-info">
          <div class="author-card-name">${escapeHtml(a.name)}</div>
          <div class="author-card-badges">${winBadge}${nomBadge}${bookCount}</div>
        </div>
      </a>`;
    }).join('');
    if (countEl) countEl.textContent = visible.length;
    // Lazy-load Wikipedia thumbnails as cards scroll into view.
    const obs2 = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        obs2.unobserve(entry.target);
        const el = entry.target;
        const name = el.dataset.name;
        if (!name || el.dataset.loaded) continue;
        el.dataset.loaded = '1';
        fetchWikiAuthor(name).then(wiki => {
          if (!wiki || !wiki.thumbnail) return;
          el.innerHTML = `<img src="${escapeHtml(wiki.thumbnail.source)}" alt="${escapeHtml(name)}" loading="lazy">`;
          el.classList.add('has-photo');
        });
      }
    }, { rootMargin: '200px' });
    grid.querySelectorAll('.author-card-photo').forEach(el => obs2.observe(el));
  };

  root.innerHTML = `
    <div class="authors-page">
      <div class="authors-header">
        <h1>Authors <span class="authors-count" id="authors-count">${authors.length}</span></h1>
        <input type="search" id="author-search" class="author-search-input" placeholder="Search authors…" autocomplete="off" value="${escapeHtml(searchVal)}">
        <select id="author-sort" class="author-sort-select">
          <option value="wins">Most wins</option>
          <option value="books">Most books</option>
          <option value="alpha">A – Z</option>
        </select>
      </div>
      <div class="authors-grid" id="authors-grid"></div>
    </div>`;

  renderGrid(searchVal);

  // Wire sort dropdown
  root.querySelector('#author-sort').addEventListener('change', e => {
    sort(e.target.value);
    renderGrid(root.querySelector('#author-search').value);
  });
  // Wire search input (live filter, no re-render of outer HTML)
  root.querySelector('#author-search').addEventListener('input', e => {
    renderGrid(e.target.value);
  });

}

// ─── Author detail page ────────────────────────────────────────────────────
// Renders at #/authors/{encodeURIComponent(name)}.
// Reuses the #view-authors div, so no extra HTML div needed.
function renderAuthorDetail(name) {
  const root = $('#view-authors');
  if (!root) return;

  // All books by this author, newest first.
  const books = DATA.books
    .filter(b => (b.authors || []).some(a => a.toLowerCase() === name.toLowerCase()))
    .sort((a, b) => (b.year || 0) - (a.year || 0));

  if (books.length === 0) {
    root.innerHTML = `<div class="author-detail"><a href="#/authors" class="back">← all authors</a><h1>${escapeHtml(name)}</h1><p style="color:var(--muted)">No books found for this author.</p></div>`;
    return;
  }

  // Stats
  const wins = books.filter(b => Object.values(b.awards || {}).includes('winner')).length;
  const noms = books.filter(b => !Object.values(b.awards || {}).includes('winner') && Object.keys(b.awards || {}).length > 0).length;
  const statPills = [
    wins  ? `<span class="ad-stat ad-stat-wins">${wins} win${wins !== 1 ? 's' : ''}</span>` : '',
    noms  ? `<span class="ad-stat ad-stat-noms">${noms} nomination${noms !== 1 ? 's' : ''}</span>` : '',
    `<span class="ad-stat ad-stat-books">${books.length} book${books.length !== 1 ? 's' : ''}</span>`,
  ].filter(Boolean).join('');

  const initials = name.split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase();

  root.innerHTML = `<div class="author-detail">
    <a href="#/authors" class="back">← all authors</a>
    <div class="author-detail-header">
      <div class="author-detail-photo" id="author-detail-photo" data-name="${escapeHtml(name)}">
        <span class="author-detail-initials">${escapeHtml(initials)}</span>
      </div>
      <div class="author-detail-meta">
        <h1 class="author-detail-name">${escapeHtml(name)}</h1>
        <div class="author-detail-stats">${statPills}</div>
        ${shareRowHtml(`${location.origin}/authors/${encodeURIComponent(name)}`, name)}
        <div id="author-detail-bio" class="author-detail-bio">
          <p class="author-detail-bio-loading" style="color:var(--muted);font-size:13px;">Loading bio…</p>
        </div>
      </div>
    </div>
    <div class="author-detail-books">
      <h2>${books.length} book${books.length !== 1 ? 's' : ''} on the list</h2>
      <div class="grid">${books.map(b => bookCard(b)).join('')}</div>
    </div>
  </div>`;

  // Wire book card clicks
  $$('.card', root).forEach(el =>
    el.addEventListener('click', () => { location.hash = `#/books/${el.dataset.id}`; })
  );
  wireShareRow(root);

  // Async: Wikipedia photo + bio
  fetchWikiAuthor(name).then(wiki => {
    if (!wiki || wiki.type === 'disambiguation') {
      const bioEl = $('#author-detail-bio');
      if (bioEl) bioEl.innerHTML = '';
      return;
    }

    // Replace initials with photo
    if (wiki.thumbnail) {
      const photoEl = $('#author-detail-photo');
      if (photoEl) {
        photoEl.innerHTML = `<img src="${escapeHtml(wiki.thumbnail.source)}" alt="${escapeHtml(name)}" loading="eager">`;
        photoEl.classList.add('has-photo');
      }
    }

    // Bio text + Wikipedia link
    const bioEl = $('#author-detail-bio');
    if (!bioEl) return;
    const extract = wiki.extract || '';
    const wikiUrl = wiki.content_urls?.desktop?.page || null;
    const wikiLink = wikiUrl
      ? `<a href="${escapeHtml(wikiUrl)}" target="_blank" rel="noopener" class="author-bio-wiki-link">Full article on Wikipedia →</a>`
      : '';
    bioEl.innerHTML = `<p class="author-detail-bio-text">${escapeHtml(extract)}</p>${wikiLink}`;
  });
}

// ─── Magazines tab ─────────────────────────────────────────────────────────
function renderMagazines() {
  const root = $('#view-magazines');
  if (!root) return;

  const HAS_READER = ACTIVE_READERS.length > 0;

  // Genre swimlanes (moved here from Genre tab)
  const swimlaneGenres = ['Time Travel', 'Horror', 'Military SF', 'Space Opera', 'Hard SF', 'Dystopian', 'First Contact', 'Cyberpunk'];
  const swimlanes = swimlaneGenres.map(g => {
    const books = DATA.books
      .filter(b => (b.genres || []).includes(g))
      .sort((a, b) => (b.year || 0) - (a.year || 0));
    return { genre: g, books };
  }).filter(s => s.books.length > 0);

  const genreSwimlanesHtml = `<div id="genres" class="progress-section collections-genre-section">
    <h2 class="collections-section-head">Browse by genre</h2>
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
  </div>`;

  const magBlocksHtml = MAGAZINE_DATA.map(mag => {
    const magBooks = DATA.books.filter(b => MAGAZINE_CANONICAL[b.publisher] === mag.canonical);
    if (magBooks.length === 0) return '';
    magBooks.sort((a, b) => (b.year || 0) - (a.year || 0));

    const winCount = magBooks.filter(b => Object.values(b.awards || {}).includes('winner')).length;
    const nomCount = magBooks.length - winCount;

    const statusText = mag.status === 'defunct'
      ? `${mag.founded}–${mag.defunct}`
      : `Est. ${mag.founded}`;
    const statusLabel = mag.status === 'defunct' ? 'Defunct' : 'Active';

    const coverHtml = mag.coverUrl
      ? `<figure class="mag-card-cover">
           <img src="${escapeHtml(mag.coverUrl)}" alt="${escapeHtml(mag.canonical)} cover" loading="lazy">
           ${mag.coverCaption ? `<figcaption>${escapeHtml(mag.coverCaption)}</figcaption>` : ''}
         </figure>`
      : '';

    const links = [
      mag.url        && `<a href="${escapeHtml(mag.url)}" target="_blank" rel="noopener" class="mag-pill-link">${escapeHtml(mag.short)} website ↗</a>`,
      mag.wikiUrl    && `<a href="${escapeHtml(mag.wikiUrl)}" target="_blank" rel="noopener" class="mag-pill-link">Wikipedia ↗</a>`,
      mag.editorialUrl && `<a href="${escapeHtml(mag.editorialUrl)}" target="_blank" rel="noopener" class="mag-pill-link">Issue archive ↗</a>`,
    ].filter(Boolean).join('');

    return `<div class="mag-card" style="--mag-accent: ${escapeHtml(mag.accent || '#888')};">
      <div class="mag-card-header">
        ${coverHtml}
        <div class="mag-card-body">
          <div class="mag-card-eyebrow">
            <span class="mag-status-pill mag-status-${mag.status}">${statusLabel}</span>
            <span class="mag-era">${statusText}</span>
          </div>
          <h2 class="mag-card-name">${escapeHtml(mag.canonical)}</h2>
          <p class="mag-card-description">${escapeHtml(mag.description)}</p>
          <div class="mag-card-stats">
            <div class="mag-stat"><span class="mag-stat-value">${winCount}</span><span class="mag-stat-label">wins</span></div>
            <div class="mag-stat"><span class="mag-stat-value">${nomCount}</span><span class="mag-stat-label">nominations</span></div>
            <div class="mag-stat"><span class="mag-stat-value">${magBooks.length}</span><span class="mag-stat-label">total</span></div>
          </div>
          <div class="mag-card-links">${links}</div>
        </div>
      </div>
      <div class="mag-card-swimlane">
        <div class="mag-swimlane-label">Stories on the list</div>
        <div class="swimlane-strip">${magBooks.map(b => makeSwimlaneCard(b)).join('')}</div>
      </div>
    </div>`;
  }).join('');

  // Super winners — books that took BOTH the Hugo AND the Nebula. The rare
  // double-crown. Computed inline so it stays in sync with DATA.books.
  const superWinners = DATA.books
    .filter(b => (b.awards || {}).hugo === 'winner' && (b.awards || {}).nebula === 'winner')
    .sort((a, b) => (b.year || 0) - (a.year || 0));
  const superWinnersHtml = superWinners.length === 0 ? '' : `
    <div id="super-winners" class="progress-section collections-superwinners-section">
      <h2 class="collections-section-head">Super Winners <span class="collections-section-count">${superWinners.length}</span></h2>
      <p style="color: var(--muted); font-size: 13px;">Books that won <strong>both</strong> the Hugo and the Nebula — the rare double crown.</p>
      <div class="swimlane">
        <div class="swimlane-strip">${superWinners.map(b => makeSwimlaneCard(b)).join('')}</div>
      </div>
    </div>`;

  // Retro Hugos — one card per retrospective session, each with ceremony
  // details and the books that took that year's Retro Hugo.
  const retroHugosHtml = (() => {
    const sessions = RETRO_HUGO_SESSIONS
      .map(s => ({ ...s, books: DATA.books
        .filter(b => (b.awards || {}).retro_hugo && b.year === s.year)
        .sort((a, b) => {
          const aw = (b.awards.retro_hugo === 'winner') - (a.awards.retro_hugo === 'winner');
          return aw || a.title.localeCompare(b.title);
        }) }))
      .filter(s => s.books.length > 0);
    if (sessions.length === 0) return '';
    const total = sessions.reduce((n, s) => n + s.books.length, 0);
    const cards = sessions.map(s => {
      const wins = s.books.filter(b => b.awards.retro_hugo === 'winner').length;
      return `<div class="retro-session">
        <div class="retro-session-head">
          <h3>${s.year} Retro Hugos <span class="rr-pill rr-pill-retro_hugo">${s.books.length} on the list</span></h3>
          <p class="retro-session-meta">Honoring works first published in ${s.works}. Awarded ${escapeHtml(s.held)} at <strong>${escapeHtml(s.con)}</strong>, ${escapeHtml(s.city)} — ${wins} winner${wins === 1 ? '' : 's'}.</p>
        </div>
        <div class="swimlane-strip">${s.books.map(b => makeSwimlaneCard(b)).join('')}</div>
      </div>`;
    }).join('');
    return `<div id="retro-hugos" class="progress-section collections-retro-section">
      <h2 class="collections-section-head">Retro Hugos <span class="collections-section-count">${total}</span></h2>
      <p style="color: var(--muted); font-size: 13px;">The <strong>Retrospective Hugo Awards</strong> honor science fiction and fantasy from Worldcon years that never gave a Hugo — voted decades later, 50, 75, or 100 years on. <a href="https://www.thehugoawards.org/hugo-history/" target="_blank" rel="noopener">Hugo Awards history ↗</a></p>
      ${cards}
    </div>`;
  })();

  // Anchorable sections: each top-level group gets a stable id so links
  // like #/collections?section=super-winners scroll directly to it after
  // route render. Section ids:
  //   nominees      — This Year's Nominees!
  //   super-winners — Hugo + Nebula double crown
  //   retro-hugos   — Retrospective Hugo sessions
  //   magazines     — Genre magazines block
  //   genres        — Browse by genre swimlanes
  root.innerHTML = `<div class="detail magazines-page">
    <h1>Collections</h1>
    ${shareRowHtml(`${location.origin}/collections`, 'Collections · Readmore SFF')}
    <div class="collections-toc">
      <span class="collections-toc-label">Jump to:</span>
      <a href="#/collections?section=nominees">Nominees</a>
      ${superWinners.length ? `<a href="#/collections?section=super-winners">Super Winners</a>` : ''}
      ${retroHugosHtml ? `<a href="#/collections?section=retro-hugos">Retro Hugos</a>` : ''}
      <a href="#/collections?section=magazines">Magazines</a>
      <a href="#/collections?section=genres">Genres</a>
    </div>
    <h2 id="nominees" class="collections-section-head collections-section-head-first">This Year's Nominees!</h2>
    ${awardFeaturedBannersHtml()}
    ${freeReadBannerHtml()}
    ${superWinnersHtml}
    ${retroHugosHtml}
    <h2 id="magazines" class="collections-section-head">Magazines</h2>
    <p class="magazines-intro">Hugo and Nebula award-winning short fiction overwhelmingly originated in a handful of genre magazines — some running for nearly a century, others born in the age of the internet.</p>
    <div class="mag-grid">${magBlocksHtml}</div>
    ${genreSwimlanesHtml}
  </div>`;

  $$('.swimlane-card', root).forEach(el =>
    el.addEventListener('click', () => { location.hash = `#/books/${el.dataset.id}`; })
  );
  wireShareRow(root);
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
    return `<a class="spine" data-id="${escapeHtml(b.id)}" href="#/books/${escapeHtml(b.id)}"
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

// Two-up nightstand: horizontal "books laying on their side" stack on the
// left, swimlane of book covers on the right. Same data, two renderings.
function buildNightstandTwoUp(books) {
  if (!books || books.length === 0) return '';
  const hueFor = (id) => {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
    return Math.abs(h) % 360;
  };
  // Horizontal "lay-flat" spines, stacked vertically — feels like a pile of
  // books sitting on a nightstand, viewed from above.
  const buildStack = (subset) => subset.map(b => {
    const hue = hueFor(b.id);
    const bodyHsl = `hsl(${hue}, 38%, 32%)`;
    const bandHsl = `hsl(${hue}, 42%, 22%)`;
    const textHsl = `hsl(${hue}, 35%, 92%)`;
    const author = (b.authors && b.authors[0]) || '';
    return `<a class="spine-flat" data-id="${escapeHtml(b.id)}" href="#/books/${escapeHtml(b.id)}"
        style="--body: ${bodyHsl}; --band: ${bandHsl}; --ink: ${textHsl};"
        title="${escapeHtml(b.title)} — ${escapeHtml(author)}">
      <span class="spine-flat-band"></span>
      <span class="spine-flat-title">${escapeHtml(b.title)}</span>
      <span class="spine-flat-author">${escapeHtml(author)}</span>
    </a>`;
  }).join('');
  // Two even stacks of books — split deterministically by index so the same
  // books always end up in the same pile across renders.
  const half = Math.ceil(books.length / 2);
  const leftStack = buildStack(books.slice(0, half));
  const rightStack = buildStack(books.slice(half));
  return `<div class="nightstand-twoup">
    <div class="nightstand-flat" role="list">${leftStack}</div>
    <div class="nightstand-flat" role="list">${rightStack || '<span class="nightstand-flat-empty"></span>'}</div>
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
  const { theme, name, audience, since, descriptionHtml, ceremonyDate, ceremonyLoc, finalistsTagline, finalists, href, howToVote } = opts;

  // Build a cover strip for one category, with a label above it.
  const makeCoverRow = (books, rowLabel) => {
    if (!books || books.length === 0) return '';
    const covers = books.map(f => {
      const match = findBook(f.title, f.author, 'Novel')
        || findBook(f.title, f.author, 'Novella');
      if (match && match.cover_url) {
        return `<a class="featured-cover" href="#/books/${escapeHtml(match.id)}" title="${escapeHtml(f.title)} — ${escapeHtml(f.author)}">
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
    return `<div class="featured-category-label">${escapeHtml(rowLabel)} <span class="featured-category-count">· ${books.length}</span></div>
      <div class="featured-cover-strip">${covers}</div>`;
  };

  // Optional "How to vote" section (always expanded).
  const howToVoteHtml = howToVote ? `
    <div class="featured-how-to-vote">
      <div class="featured-htv-label">How to vote</div>
      <div class="featured-htv-body">
        <ol class="featured-htv-steps">
          ${howToVote.steps.map(s =>
            `<li><strong>${escapeHtml(s.title)}</strong> ${s.bodyHtml}</li>`
          ).join('')}
        </ol>
        <div class="featured-htv-ctas">
          ${howToVote.links.map(l =>
            `<a href="${escapeHtml(l.href)}" target="_blank" rel="noopener"
                class="${l.primary ? 'featured-htv-cta-primary' : 'featured-htv-cta-secondary'}">${escapeHtml(l.label)} →</a>`
          ).join('')}
        </div>
      </div>
    </div>` : '';

  return `<div class="featured-banner featured-full featured-${theme}">
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
    ${makeCoverRow(finalists.Novel,   'Novel')}
    ${makeCoverRow(finalists.Novella, 'Novella')}
    ${howToVoteHtml}
  </div>`;
}

function renderStats() {
  // Per-reader loops inside this function must include 'me' so signed-in
  // users (whose reader id is 'me') don't crash on map lookups.
  const READER_KEYS = [...ALL_READER_IDS, 'me'];
  // Multi-select filters: each is a Set. Empty set = no books in scope.
  // For backwards-compat with derived flags below (winners-only, both, etc.)
  // we recompute simple bools from the sets.
  const STATUSES = state.progressStatuses;            // Set<'winner','nominee'>
  const AWARDS = state.progressAwards;                // Set<'hugo','nebula'>
  const CATEGORIES = state.progressCategories;        // Set<'Novel','Novella','Novelette'>
  const STATUS_BOTH = STATUSES.has('winner') && STATUSES.has('nominee');
  const STATUS = STATUS_BOTH ? 'both' : (STATUSES.has('winner') ? 'winner' : (STATUSES.has('nominee') ? 'nominee' : 'none'));
  // "All awards selected" vs a single-award focus. Generalized to any number of
  // award types (hugo / nebula / retro_hugo).
  const AWARD_BOTH = Object.keys(AWARD_LABELS).every(a => AWARDS.has(a));
  const AWARD = AWARDS.size === 1 ? [...AWARDS][0] : (AWARDS.size === 0 ? 'none' : 'both');

  // Award scope: a book is in scope if it carries at least one of the
  // checked awards AND falls in one of the checked categories.
  const inAwardScope = (b) => {
    if (CATEGORIES.size && !CATEGORIES.has(b.category)) return false;
    const aw = b.awards || {};
    return [...AWARDS].some(a => aw[a]);
  };
  const isWinnerInScope = (b) => {
    const aw = b.awards || {};
    return [...AWARDS].some(a => aw[a] === 'winner');
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
  const retroHugoCount = DATA.books.filter(b => (b.awards || {}).retro_hugo).length;

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

  // Projection helper — when "Include nightstand" is ON, treat books on the
  // reader's nightstand as read for chart purposes (Era bars, radars, genre
  // breakdowns, etc.). MUST be declared before any chart bucket-fill block
  // references it.
  const isProjectedRead = (b, id) => {
    if (readStatus(b, id) === 'read') return true;
    if (state.includeNightstand && onNightstand(b, id)) return true;
    return false;
  };

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
      if (!AWARDS.has(a)) continue;
      byAward[a].total++;
      for (const id of READER_KEYS) {
        if (isProjectedRead(b, id)) byAward[a][id]++;
      }
    }
  }
  const byCategory = {};
  for (const b of winners) {
    byCategory[b.category] = byCategory[b.category] || emptyBucket();
    byCategory[b.category].total++;
    for (const id of READER_KEYS) {
      if (isProjectedRead(b, id)) byCategory[b.category][id]++;
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
    const myBooks = meUserBooks();
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
  // 'me' uses MR_AUTH.userBooks status of 'nightstand' OR 'started' — both
  // count as "on the nightstand" (matches the headline card's label
  // "nightstand + in progress"); legacy readers use the CSV `<reader>_shelf`
  // === 'to-read' columns.
  const nightstandBooks = [];
  const seenShelf = new Set();
  const myBooksForShelf = meUserBooks();
  for (const b of DATA.books) {
    if (seenShelf.has(b.id)) continue;
    let on = false;
    if (showReader('me')) {
      const s = myBooksForShelf[b.id]?.status;
      if (s === 'nightstand' || s === 'started') on = true;
    }
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
        if (isProjectedRead(b, id)) subBuckets[g][id]++;
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
      if (isProjectedRead(b, id)) primaryBuckets[p][id]++;
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
  const radarConfigOverride = {};
  // Projected polygon first (drawn underneath) when nightstand toggle is on.
  // The pre-computed subBuckets already include nightstand reads in [r.id]
  // when projection is on, so those values are the projected ones.
  if (state.includeNightstand) {
    for (const r of ACTIVE_READERS) {
      const projKey = r.id + '__proj';
      radarValues[projKey] = RADAR_AXES.map(g => {
        const bucket = subBuckets[g] || { total: 0 };
        return bucket.total > 0 ? bucket[r.id] / bucket.total : 0;
      });
      radarConfigOverride[projKey] = { label: r.label + ' (with nightstand)', colorVar: 'var(--muted)', colorRgb: '120, 120, 120' };
    }
  }
  // Actual-reads polygon. When projection is OFF the buckets already match
  // actual reads. When ON we recompute by walking winners so this stays the
  // honest "what you've read" shape.
  for (const r of ACTIVE_READERS) {
    radarValues[r.id] = RADAR_AXES.map(g => {
      if (!state.includeNightstand) {
        const bucket = subBuckets[g] || { total: 0 };
        return bucket.total > 0 ? bucket[r.id] / bucket.total : 0;
      }
      let actual = 0, total = 0;
      for (const b of winners) {
        if (!(b.subgenres || []).includes(g)) continue;
        total++;
        if (readStatus(b, r.id) === 'read') actual++;
      }
      return total > 0 ? actual / total : 0;
    });
  }
  const radarHtml = RADAR_AXES.length >= 3 ? buildRadar(RADAR_AXES, radarValues, radarConfigOverride) : '<p style="color:var(--muted)">Not enough subgenre coverage in this view.</p>';
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
      if (isProjectedRead(b, id)) comboBuckets[key][`${id}Read`]++;
    }
  }
  // Keep combos with >= 3 samples; sort by win rate desc, then by total desc
  const genreVectors = Object.entries(comboBuckets)
    .filter(([, v]) => v.total >= 3)
    .map(([combo, v]) => ({ combo, ...v, winRate: v.winners / v.total }))
    .sort((a, b) => b.winRate - a.winRate || b.total - a.total)
    .slice(0, 15);

  // ===== Genre section — primary radar, subgenre fingerprint, vector table =====
  const PRIMARY_RADAR_AXES = primaryList.map(g => g.name);
  const primaryRadarValues = {};
  const primaryRadarConfigOverride = {};
  if (state.includeNightstand) {
    for (const r of ACTIVE_READERS) {
      const projKey = r.id + '__proj';
      primaryRadarValues[projKey] = PRIMARY_RADAR_AXES.map(g => {
        const bucket = primaryBuckets[g] || { total: 0 };
        return bucket.total > 0 ? bucket[r.id] / bucket.total : 0;
      });
      primaryRadarConfigOverride[projKey] = { label: r.label + ' (with nightstand)', colorVar: 'var(--muted)', colorRgb: '120, 120, 120' };
    }
  }
  for (const r of ACTIVE_READERS) {
    primaryRadarValues[r.id] = PRIMARY_RADAR_AXES.map(g => {
      if (!state.includeNightstand) {
        const bucket = primaryBuckets[g] || { total: 0 };
        return bucket.total > 0 ? bucket[r.id] / bucket.total : 0;
      }
      let actual = 0, total = 0;
      for (const b of winners) {
        if ((b.primary_genre || 'Unclassified') !== g) continue;
        total++;
        if (readStatus(b, r.id) === 'read') actual++;
      }
      return total > 0 ? actual / total : 0;
    });
  }
  const primaryRadarHtml = (HAS_READER && PRIMARY_RADAR_AXES.length >= 3)
    ? buildRadar(PRIMARY_RADAR_AXES, primaryRadarValues, primaryRadarConfigOverride)
    : '';

  const subList = Object.entries(subBuckets)
    .map(([name, s]) => ({ name, ...s }))
    .sort((a, b) => b.total - a.total);

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
      if (isProjectedRead(b, id)) genderReadByReader[id][g]++;
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
          if (isProjectedRead(b, id)) buckets[a][`${id}Read`]++;
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
      if (isProjectedRead(b, id)) eraBuckets[dec][id]++;
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
  const meBooksUpNext = meUserBooks();
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
    return `<a class="swimlane-card" href="#/books/${escapeHtml(b.id)}">
      <div class="swimlane-cover${isWinner ? ' is-winner' : ''}">${cover}</div>
      <div class="swimlane-title">${escapeHtml(b.title)}</div>
      <div class="swimlane-meta">${escapeHtml(b.authors[0] || '')} · ${b.year || ''}</div>
    </a>`;
  };
  const recentEitherHtml = recentEither.slice(0, 18).map(swimlaneTile).join('');

    // Nightstand swimlane — plain cards, no per-book checkboxes. A single
  // "Include nightstand" toggle near the filter pills controls whether
  // these books are folded into the projected stats.
  const nightstandHtml = nightstandBooks.map(b => {
    const ws = Object.entries(b.awards || {}).filter(([, s]) => s === 'winner').map(([a]) => AWARD_LABELS[a]);
    const ns = Object.entries(b.awards || {}).filter(([, s]) => s === 'nominee').map(([a]) => AWARD_LABELS[a]);
    const awardLabel = ws.length ? `${ws.join(' · ')} winner` : (ns.length ? `${ns.join(' · ')} nominee` : '');
    return tile(b, `${escapeHtml(b.authors?.[0] || '')} · ${b.year || ''}${awardLabel ? ` · ${awardLabel}` : ''}`.trim());
  }).join('');

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

  // Compare widget — suggest friends. Use friends list (all friends regardless
  // of leaderboard opt-in) and fall back to leaderboardOverall if friends
  // list is empty (e.g. auth not yet bootstrapped).
  const dashMyHandle = window.MR_AUTH?.profile?.handle || null;
  const rawFriends = window.MR_AUTH?.friends?.length
    ? window.MR_AUTH.friends.map(f => f.handle)
    : (window.MR_AUTH?.leaderboardOverall || []).map(r => r.handle);
  const dashFriendHandles = rawFriends.filter(h => h && h !== dashMyHandle);
  // Compare widget only makes sense on the viewer's OWN dashboard — when
  // viewing another user we hide it to avoid the confusing "compare WITH me"
  // semantics from someone else's page.
  const compareWidgetHtml = state.viewingProfile ? '' : `<div class="dashboard-compare">
    <input type="text" id="dashboard-compare-input" class="dashboard-compare-input"
      placeholder="Compare with a friend by @handle…"
      list="dashboard-compare-list"
      autocomplete="off">
    <datalist id="dashboard-compare-list">
      ${dashFriendHandles.map(h => `<option value="${escapeHtml(h)}">`).join('')}
    </datalist>
    <button type="button" id="dashboard-compare-btn" class="mr-btn-primary">Compare →</button>
  </div>`;

  // Profile header — show whose stats you're viewing.
  // SOLO is set by the #/stats?u= router for hardcoded readers; 'me' or null
  // means own stats (use the signed-in handle if available). When
  // state.viewingProfile is set, we're rendering another user's stats — use
  // their handle and drop the "your stats" framing.
  const myHandleForHeader = window.MR_AUTH?.profile?.handle || null;
  const headerHandle = state.viewingProfile
    ? state.viewingProfile.handle
    : ((SOLO && SOLO !== 'me') ? SOLO : (myHandleForHeader || null));
  const isOwnHeader = !state.viewingProfile && (!SOLO || SOLO === 'me' || (myHandleForHeader && SOLO?.toLowerCase() === myHandleForHeader.toLowerCase()));
  const titleHtml = headerHandle
    ? `<h1 class="stats-title">@${escapeHtml(headerHandle)}${isOwnHeader ? ' <span class="stats-title-tag">your stats</span>' : ' <span class="stats-title-tag">stats</span>'}</h1>`
    : `<h1 class="stats-title">Stats</h1>`;

  root.innerHTML = `<div class="detail">
    ${titleHtml}
    ${state.viewingProfile ? '' : `<p class="dashboard-intro"><strong>Readmore SFF</strong> is a complete list of every <strong>Hugo</strong> and <strong>Nebula</strong> winner and finalist in Novel, Novella, and Novelette. I wanted to set the goal of reading more of the books that set the trends and define my favorite genre of <strong>Sci-Fiction and Fantasy</strong> across the decades. Every year these are the works the field itself decided were worth remembering. The goal is simple: <strong>to read them all</strong>.</p>`}
    ${compareWidgetHtml}
    ${!HAS_READER ? `<p class="dashboard-sort-cta">New here? Use the <a href="#/discover"><strong>Discover</strong></a> tab to rapidly label every book as Read, Nightstand, or Skip — builds your reading list in minutes.</p>` : ''}
    <div class="stats-filter-row">
      <fieldset class="stats-filter-group">
        <legend>Status</legend>
        <label><input type="checkbox" data-progress-status="winner" ${STATUSES.has('winner') ? 'checked' : ''}> Winners <span class="status-count">${allWinnersCount}</span></label>
        <label><input type="checkbox" data-progress-status="nominee" ${STATUSES.has('nominee') ? 'checked' : ''}> Nominees <span class="status-count">${allNomineesCount}</span></label>
      </fieldset>
      <fieldset class="stats-filter-group">
        <legend>Award</legend>
        <label><input type="checkbox" data-progress-award="hugo" ${AWARDS.has('hugo') ? 'checked' : ''}> Hugo <span class="status-count">${hugoCount}</span></label>
        <label><input type="checkbox" data-progress-award="nebula" ${AWARDS.has('nebula') ? 'checked' : ''}> Nebula <span class="status-count">${nebulaCount}</span></label>
        <label><input type="checkbox" data-progress-award="retro_hugo" ${AWARDS.has('retro_hugo') ? 'checked' : ''}> Retro Hugo <span class="status-count">${retroHugoCount}</span></label>
      </fieldset>
      <fieldset class="stats-filter-group">
        <legend>Category</legend>
        <label><input type="checkbox" data-progress-category="Novel" ${CATEGORIES.has('Novel') ? 'checked' : ''}> Novel</label>
        <label><input type="checkbox" data-progress-category="Novella" ${CATEGORIES.has('Novella') ? 'checked' : ''}> Novella</label>
        <label><input type="checkbox" data-progress-category="Novelette" ${CATEGORIES.has('Novelette') ? 'checked' : ''}> Novelette</label>
      </fieldset>
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
          const nightstandTotal = shelfCount + startedCount;
          // Avg pub year + most-read decade — both computed from the books
          // this reader has read in the current STATUS subset.
          const yearedReads = readBooks.filter(b => b.year);
          const avgYear = yearedReads.length > 0
            ? Math.round(yearedReads.reduce((s, b) => s + b.year, 0) / yearedReads.length)
            : null;
          const mrd = mostReadDecade(winners, (b) => readStatus(b, r) === 'read');
          // ── Projection ──: if the user has flipped "Include nightstand"
          // ON, fold every nightstand book in the current filter scope into
          // the projected stats. The single global toggle replaces the
          // per-book checklist.
          const readBookIds = new Set(readBooks.map(b => b.id));
          const winnerIds = new Set(winners.map(b => b.id));
          const plannedInScope = state.includeNightstand
            ? (typeof nightstandBooks !== 'undefined' ? nightstandBooks : [])
                .filter(b => winnerIds.has(b.id) && !readBookIds.has(b.id))
            : [];
          const hasProj = plannedInScope.length > 0;
          const projectedReadCount = readBooks.length + plannedInScope.length;
          const projectedYeared = [...yearedReads, ...plannedInScope.filter(b => b.year)];
          const projectedAvgYear = projectedYeared.length > 0
            ? Math.round(projectedYeared.reduce((s, b) => s + b.year, 0) / projectedYeared.length)
            : null;
          const projectedReadIds = new Set([...readBookIds, ...plannedInScope.map(b => b.id)]);
          const projectedMrd = mostReadDecade(winners, (b) => projectedReadIds.has(b.id));
          const readSub = `${(readBooks.length / winnersTotal * 100).toFixed(1)}% of ${SUBSET}`
            + (hasProj ? ` → <span class="stat-projection">${projectedReadCount} (+${plannedInScope.length}) projected, ${(projectedReadCount / winnersTotal * 100).toFixed(1)}%</span>` : '');
          const avgYearSub = !avgYear ? 'No reads yet'
            : (hasProj && projectedAvgYear !== avgYear
                ? `Now ${avgYear} → <span class="stat-projection">${projectedAvgYear} projected</span>`
                : (state.viewingProfile ? "Across the books they've read" : "Across the books you've read"));
          const mrdSub = !mrd ? 'No reads yet'
            : (hasProj && projectedMrd && projectedMrd.decade !== mrd.decade
                ? `${mrd.count} now → <span class="stat-projection">${eraAxisLabel(projectedMrd.decade)} with ${projectedMrd.count} projected</span>`
                : (hasProj && projectedMrd && projectedMrd.count !== mrd.count
                    ? `${mrd.count} now → <span class="stat-projection">${projectedMrd.count} projected</span>`
                    : `${mrd.count} ${SUBSET}`));
          return `
            ${card('Read', readBooks.length, readSub, readBooks.length / winnersTotal * 100)}
            ${card('On Nightstand', nightstandTotal, 'nightstand + in progress')}
            ${card('Avg pub year', avgYear ?? '—', avgYearSub)}
            ${card('Most-read decade', mrd ? eraAxisLabel(mrd.decade) : '—', mrdSub)}
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
      </div>
      <div class="swimlane-strip">${recentEitherHtml}</div>
    </section>` : ''}

    ${HAS_READER && nightstandBooks.length > 0 ? `<section class="featured-shelf featured-shelf-nightstand">
      <div class="featured-shelf-head">
        <div>
          <h2>On the nightstand <span class="featured-shelf-count">${nightstandBooks.length}</span></h2>
          <p style="color: var(--muted); font-size: 13px; margin: 4px 0 0;">${state.viewingProfile ? "Books they have, but haven't finished yet." : "Books you have, but haven't finished yet. Toggle <strong>Include nightstand</strong> in the filter row above to project your stats as if you'd read them all."}</p>
        </div>
      </div>
      <div class="recent-reads">${nightstandHtml}</div>
    </section>` : ''}

    ${HAS_READER && upNext.length > 0 ? `<section class="featured-shelf featured-shelf-upnext">
      <div class="featured-shelf-head">
        <div>
          <h2>Up next</h2>
          <p style="color: var(--muted); font-size: 13px; margin: 4px 0 0;">${state.viewingProfile ? "Recent winners not yet on their nightstand." : "Recent winners on no nightstand yet. Open one to add it to your shelf."}</p>
        </div>
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

    <div class="era-twoup">
      <div class="progress-section era-coverage-section">
        <h2>Coverage by era</h2>
        <p style="color: var(--muted); font-size: 13px;">Bar width = ${SUBSET} that decade${HAS_READER ? ' · filled portion = ' + escapeHtml(READER_CONFIG[PRIMARY_READER].label) + ' read' : ''}.</p>
        <div class="era-rows">${eraBarsHtml}</div>
      </div>

      ${HAS_READER ? (() => {
        // Influence by era — spider chart over DATA.books (winners + nominees,
        // not the SUBSET). Each axis = a decade with at least 3 books.
        // Actual reads = colored polygon. When "Include nightstand" is on, a
        // second grey ghost polygon shows where you'd be if you finished the
        // nightstand.
        const byDecade = bucketBooksByDecade(DATA.books);
        const decades = eraRadarAxes(byDecade);
        if (decades.length < 3) return '';
        const axes = decades.map(eraAxisLabel);
        const values = {};
        const configOverride = {};
        // Projected polygon first (drawn underneath); actual second (on top).
        if (state.includeNightstand) {
          for (const r of ACTIVE_READERS) {
            const projKey = r.id + '__proj';
            values[projKey] = eraReaderValues(decades, byDecade, (b) => isProjectedRead(b, r.id));
            configOverride[projKey] = { label: r.label + ' (with nightstand)', colorVar: 'var(--muted)', colorRgb: '120, 120, 120' };
          }
        }
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
          <p style="color: var(--muted); font-size: 13px;">Each axis = a decade. Distance from center = % of that decade's winners + finalists this reader has read.${state.includeNightstand ? ' Grey overlay = where you\'d land after finishing your nightstand.' : ''}</p>
          ${buildRadar(axes, values, configOverride)}
          ${mrd ? `<p class="era-radar-stats">${mrd}</p>` : ''}
        </div>`;
      })() : ''}
    </div>

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

    ${(() => {
      const auth = window.MR_AUTH;
      if (!auth?.user) return '';
      // Don't render the signed-in user's friends list on someone else's page.
      if (state.viewingProfile) return '';
      const overall = auth.leaderboardOverall || [];
      const byAward = auth.leaderboardByAward || [];
      const meHandle = auth.profile?.handle || null;
      const myUserId = auth.user?.id || null;
      const hugoByUser = {};
      const nebulaByUser = {};
      for (const r of byAward) {
        if (r.award === 'hugo') hugoByUser[r.user_id] = r.read_count;
        else if (r.award === 'nebula') nebulaByUser[r.user_id] = r.read_count;
      }
      // When the leaderboard view returned no rows (e.g. user hasn't added
      // friends yet, or hasn't opted in), synthesize a self-row from the
      // signed-in user's local data so the section always has something.
      let rows = overall;
      if (rows.length === 0 && meHandle && myUserId) {
        const ub = auth.userBooks || {};
        const readIds = Object.keys(ub).filter(id => ub[id]?.status === 'read');
        const total = DATA.books.length;
        const readCount = readIds.length;
        let hugoRead = 0, nebRead = 0;
        for (const id of readIds) {
          const b = DATA.books.find(x => x.id === id);
          if (!b) continue;
          if ((b.awards || {}).hugo) hugoRead++;
          if ((b.awards || {}).nebula) nebRead++;
        }
        hugoByUser[myUserId] = hugoRead;
        nebulaByUser[myUserId] = nebRead;
        rows = [{
          user_id: myUserId,
          handle: meHandle,
          read_count: readCount,
          total_books: total,
          pct: total > 0 ? Math.round((readCount / total) * 100) : 0,
          rank: 1,
        }];
      }
      const totalLabel = rows[0]?.total_books ?? DATA.books.length;
      const meHandleSlug = meHandle ? encodeURIComponent(meHandle) : 'me';
      const rowHtml = rows.map(r => {
        const isMeRow = r.user_id === myUserId;
        const compareTag = !isMeRow
          ? `<a class="lb-compare" href="#/stats?u=${meHandleSlug}&u=${encodeURIComponent(r.handle)}">Compare →</a>`
          : `<span class="lb-me">you</span>`;
        return `<div class="lb-row${isMeRow ? ' lb-row-me' : ''}">
          <div class="lb-rank">#${r.rank}</div>
          <div class="lb-handle"><a href="#/u/${escapeHtml(r.handle)}">@${escapeHtml(r.handle)}</a></div>
          <div class="lb-stat"><strong>${r.read_count}</strong> <span class="lb-of">/ ${r.total_books}</span></div>
          <div class="lb-stat-sub" style="color:var(--sf)"><strong>${hugoByUser[r.user_id] ?? 0}</strong> Hugo</div>
          <div class="lb-stat-sub" style="color:var(--fantasy)"><strong>${nebulaByUser[r.user_id] ?? 0}</strong> Nebula</div>
          <div class="lb-pct">${r.pct ?? 0}%</div>
          <div class="lb-action">${compareTag}</div>
        </div>`;
      }).join('');
      const onLeaderboard = auth.profile?.on_leaderboard;
      const noFriendsNote = overall.length === 0
        ? `<p style="color:var(--muted);font-size:13px;">No friends yet — add one above to start comparing reads.</p>`
        : '';
      return `<div class="progress-section" id="stats-friends-section">
        <h2>Friends</h2>
        <p style="color:var(--muted);font-size:13px;">You and your friends, ranked by reads from the ${totalLabel} canonical books. Tap Compare for a head-to-head.</p>
        ${!onLeaderboard ? `<p style="color:var(--muted);font-size:13px;">You're not on the leaderboard yet. <a href="#/settings">Opt in from Settings</a>.</p>` : ''}
        <form id="stats-friends-add-form" class="friends-add-form">
          <input type="text" id="stats-friends-add-handle" placeholder="@handle to add" autocomplete="off">
          <button type="submit" class="mr-btn-primary">Add friend</button>
          <span id="stats-friends-add-status" class="settings-inline-status"></span>
        </form>
        <div class="lb-table">${rowHtml}</div>
        ${noFriendsNote}
      </div>`;
    })()}

  </div>`;

  // Dashboard compare widget
  const dashCompareInput = document.getElementById('dashboard-compare-input');
  const dashCompareBtn = document.getElementById('dashboard-compare-btn');
  const doCompare = async () => {
    const handle = (dashCompareInput?.value || '').trim().replace(/^@/, '');
    if (!handle) return;
    // Wait for the auth bootstrap so we have a real handle. Without this,
    // a rapid click after page load constructs ?u=me&u=<friend>; then
    // renderCompare's "drop 'me' if not signed in" filter trims the URL
    // to one id and redirects to #/, looking like "first click didn't work."
    await window.MR_AUTH?.ready;
    const me = window.MR_AUTH?.profile?.handle || 'me';
    location.hash = `#/stats?u=${encodeURIComponent(me)}&u=${encodeURIComponent(handle)}`;
  };
  dashCompareBtn?.addEventListener('click', doCompare);
  dashCompareInput?.addEventListener('keydown', e => { if (e.key === 'Enter') doCompare(); });

  // Friends add-form in the stats friends section
  const statsFriendsForm = document.getElementById('stats-friends-add-form');
  if (statsFriendsForm) {
    const addStatus = document.getElementById('stats-friends-add-status');
    statsFriendsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('stats-friends-add-handle');
      const v = (input?.value || '').trim();
      if (!v) return;
      if (addStatus) { addStatus.textContent = 'Adding…'; addStatus.className = 'settings-inline-status'; }
      try {
        const target = await window.MR_AUTH.addFriendByHandle(v);
        if (addStatus) { addStatus.textContent = `✓ Added @${target.handle}`; addStatus.className = 'settings-inline-status success'; }
        if (input) input.value = '';
        setTimeout(() => renderStats(), 200);
      } catch (err) {
        if (addStatus) { addStatus.textContent = err.message || String(err); addStatus.className = 'settings-inline-status error'; }
      }
    });
  }

  $$('.recent-read, .swimlane-card', root).forEach(el => {
    el.addEventListener('click', (e) => {
      // If the click landed on an inner anchor, let that anchor handle it.
      if (e.target.closest('a')) return;
      location.hash = `#/books/${el.dataset.id}`;
    });
  });
  // Multi-select progress filters: Status / Award / Category / Projection.
  // Each checkbox flips a Set entry, then we re-render. Don't allow the
  // user to uncheck the LAST item in Status, Award, or Category (would
  // empty the page) — we revert the checkbox in that case.
  function toggleSet(set, key, cb) {
    if (cb.checked) { set.add(key); }
    else {
      if (set.size <= 1) { cb.checked = true; return false; }
      set.delete(key);
    }
    return true;
  }
  $$('[data-progress-status]', root).forEach(cb => {
    cb.addEventListener('change', () => {
      if (toggleSet(state.progressStatuses, cb.dataset.progressStatus, cb)) renderStats();
    });
  });
  $$('[data-progress-award]', root).forEach(cb => {
    cb.addEventListener('change', () => {
      if (toggleSet(state.progressAwards, cb.dataset.progressAward, cb)) renderStats();
    });
  });
  $$('[data-progress-category]', root).forEach(cb => {
    cb.addEventListener('change', () => {
      if (toggleSet(state.progressCategories, cb.dataset.progressCategory, cb)) renderStats();
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
  return `<a class="hugo-card hugo-card-${theme}" href="#/books/${escapeHtml(match.id)}">${body}</a>`;
}

function finalistSection(catLabel, items, theme) {
  return `<section class="hugo-section">
    <h2>Best ${escapeHtml(catLabel)}</h2>
    <div class="hugo-grid">${items.map(f => finalistCard(f, catLabel, theme)).join('')}</div>
  </section>`;
}

// Body HTML for the 2026 Hugo Awards page — hero, voting steps, finalist
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
  const root = $('#view-stats');
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
    location.hash = '#/';
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
      <a href="#/stats" class="back">← back to Stats</a>
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
  const emptyAward = () => Object.fromEntries(Object.keys(AWARD_LABELS).map(a => [a, 0]));
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

  // Projection = read OR nightstand. Drawn as a grey ghost polygon under the
  // actual-reads polygon to show where each reader lands after finishing
  // their nightstand. Mirrors the main Stats page behavior.
  const isReadStatus = (side, id) => side.statusMap[id]?.status === 'read';
  const isProjStatus = (side, id) => {
    const s = side.statusMap[id]?.status;
    return s === 'read' || s === 'nightstand';
  };
  for (const book of DATA.books) {
    const aRead = isReadStatus(aSide, book.id);
    const bRead = isReadStatus(bSide, book.id);
    const aProj = isProjStatus(aSide, book.id);
    const bProj = isProjStatus(bSide, book.id);
    if (aRead && bRead) both.push(book);
    else if (aRead) aOnly.push(book);
    else if (bRead) bOnly.push(book);
    else neither.push(book);
    if (aRead) tallyOne(stats.a, book);
    if (bRead) tallyOne(stats.b, book);
    for (const g of (book.subgenres || [])) {
      if (!subBuckets[g]) subBuckets[g] = { total: 0, a: 0, b: 0, aProj: 0, bProj: 0 };
      subBuckets[g].total++;
      if (aRead) subBuckets[g].a++;
      if (bRead) subBuckets[g].b++;
      if (aProj) subBuckets[g].aProj++;
      if (bProj) subBuckets[g].bProj++;
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
  const eraValsA = eraReaderValues(eraDecades, decadeBuckets, (b) => isReadStatus(aSide, b.id));
  const eraValsB = eraReaderValues(eraDecades, decadeBuckets, (b) => isReadStatus(bSide, b.id));
  const eraValsAProj = eraReaderValues(eraDecades, decadeBuckets, (b) => isProjStatus(aSide, b.id));
  const eraValsBProj = eraReaderValues(eraDecades, decadeBuckets, (b) => isProjStatus(bSide, b.id));
  // Shared keys for both era radar and per-side subgenre radar below — must
  // be declared before either object literal references them (TDZ). __proj
  // suffixed keys render as grey ghost polygons under the colored actual-reads
  // polygons.
  const aKey = 'compare_a';
  const bKey = 'compare_b';
  const aProjKey = aKey + '__proj';
  const bProjKey = bKey + '__proj';
  const eraRadarConfig = {
    [aProjKey]: { label: '@' + aSide.label + ' (with nightstand)', colorVar: 'var(--muted)', colorRgb: '120, 120, 120' },
    [bProjKey]: { label: '@' + bSide.label + ' (with nightstand)', colorVar: 'var(--muted)', colorRgb: '120, 120, 120' },
    [aKey]: { label: '@' + aSide.label, colorVar: aSide.colorVar, colorRgb: aSide.colorRgb },
    [bKey]: { label: '@' + bSide.label, colorVar: bSide.colorVar, colorRgb: bSide.colorRgb },
  };
  // Order matters: __proj entries first so they render underneath.
  const eraRadarValues = {
    [aProjKey]: eraValsAProj,
    [bProjKey]: eraValsBProj,
    [aKey]: eraValsA,
    [bKey]: eraValsB,
  };
  const eraRadarHtml = eraDecades.length >= 3
    ? buildRadar(eraAxes, eraRadarValues, eraRadarConfig)
    : '';

  // Build per-side radars — top 8 most-populated subgenres, dropping axes
  // where neither side has any reads (keeps the chart legible).
  const radarAxes = Object.entries(subBuckets)
    .sort((x, y) => y[1].total - x[1].total)
    .slice(0, 8)
    .map(([name]) => name)
    .filter(g => (subBuckets[g].a + subBuckets[g].b) > 0);
  const valsFor = key => radarAxes.map(g => {
    const bucket = subBuckets[g];
    return bucket.total > 0 ? bucket[key] / bucket.total : 0;
  });
  const radarConfig = {
    [aProjKey]: { label: '@' + aSide.label + ' (with nightstand)', colorVar: 'var(--muted)', colorRgb: '120, 120, 120' },
    [bProjKey]: { label: '@' + bSide.label + ' (with nightstand)', colorVar: 'var(--muted)', colorRgb: '120, 120, 120' },
    [aKey]: { label: '@' + aSide.label, colorVar: aSide.colorVar, colorRgb: aSide.colorRgb },
    [bKey]: { label: '@' + bSide.label, colorVar: bSide.colorVar, colorRgb: bSide.colorRgb },
  };
  // Order matters: __proj entries first so they render as grey ghosts
  // underneath the colored actual-reads polygons.
  const radarHtml = radarAxes.length >= 3
    ? `<div class="compare-radar-grid">
        <div class="compare-radar-card">
          <h3 style="color: ${aSide.colorVar}">@${escapeHtml(aSide.label)}</h3>
          ${buildRadar(radarAxes, { [aProjKey]: valsFor('aProj'), [aKey]: valsFor('a') }, radarConfig)}
        </div>
        <div class="compare-radar-card">
          <h3 style="color: ${bSide.colorVar}">@${escapeHtml(bSide.label)}</h3>
          ${buildRadar(radarAxes, { [bProjKey]: valsFor('bProj'), [bKey]: valsFor('b') }, radarConfig)}
        </div>
      </div>`
    : '';

  const tile = (bk) => {
    const cover = bk.cover_url
      ? `<img src="${escapeHtml(bk.cover_url)}" alt="" loading="lazy" onload="__coverFallback(this)" onerror="__coverFallback(this)">`
      : `<span class="swimlane-placeholder">📖</span>`;
    const isWinner = Object.values(bk.awards || {}).includes('winner');
    return `<a class="swimlane-card" href="#/books/${escapeHtml(bk.id)}">
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
  const awardTotals = {};
  for (const a of Object.keys(AWARD_LABELS)) awardTotals[a] = 0;
  for (const b of DATA.books) {
    for (const a of Object.keys(b.awards || {})) {
      if (awardTotals[a] != null) awardTotals[a]++;
    }
  }
  const awardRows = Object.keys(AWARD_LABELS)
    .map(a => pctRow(AWARD_LABELS[a], stats.a.byAward[a] || 0, stats.b.byAward[a] || 0, awardTotals[a], { showPct: true }))
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
    <a href="#/stats" class="back">← back to Stats</a>
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
      <p style="color: var(--muted); font-size: 13px; margin-top: 4px;">Each axis = a decade. Distance from center = share of that decade's winners + finalists each reader has read. Grey overlay = where each reader lands after finishing their nightstand.</p>
      ${eraRadarHtml}
      <div class="era-radar-stats">
        <span style="color:${aSide.colorVar}"><strong>@${escapeHtml(aSide.label)}</strong> · avg ${avgYearA ?? '—'}${mrdA ? ` · most-read ${eraAxisLabel(mrdA.decade)} (${mrdA.count})` : ''}</span>
        <span style="color:${bSide.colorVar}"><strong>@${escapeHtml(bSide.label)}</strong> · avg ${avgYearB ?? '—'}${mrdB ? ` · most-read ${eraAxisLabel(mrdB.decade)} (${mrdB.count})` : ''}</span>
      </div>
    </section>` : ''}

    ${radarHtml ? `<section class="compare-radar-section">
      <h2>Subgenre fingerprint</h2>
      <p style="color: var(--muted); font-size: 13px; margin-top: 4px;">Each axis = a subgenre. Distance from center = % of that subgenre this reader has finished. Grey overlay = where they land after finishing their nightstand.</p>
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
    const compareHref = canCompare ? `#/stats?u=${myHandleSlug}&u=${encodeURIComponent(r.handle)}` : '#';
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

// Tracks the last-seen signed-in user id so the MR_AUTH.onChange handler can
// tell an identity change (sign in/out) from a plain data refresh. undefined
// until the first notify so the initial fire counts as an identity change.
let __lastUserId = undefined;

// Nightstand planner: set of book IDs the user has UN-checked on the Stats
// page's nightstand checklist. Default state is "all checked" (planning to
// read everything on the nightstand), so we store the negative space.
// Persisted to localStorage keyed by user id.
const __nightstandUnplanned = new Set();
let __nightstandUnplannedLoaded = false;
function _nightPlanKey() {
  const uid = window.MR_AUTH?.user?.id;
  return uid ? `mr-nightplan-${uid}` : null;
}
function loadNightPlan() {
  const k = _nightPlanKey();
  if (!k) return;
  try {
    const raw = localStorage.getItem(k) || '[]';
    const arr = JSON.parse(raw);
    __nightstandUnplanned.clear();
    for (const id of arr) __nightstandUnplanned.add(id);
  } catch { __nightstandUnplanned.clear(); }
  __nightstandUnplannedLoaded = true;
}
function saveNightPlan() {
  const k = _nightPlanKey();
  if (!k) return;
  try { localStorage.setItem(k, JSON.stringify([...__nightstandUnplanned])); } catch {}
}

function buildDiscoverQueue() {
  const auth = window.MR_AUTH;
  if (!auth || !auth.user) return [];
  const statuses = __discoverState?.statuses || new Set(['winner']);
  const awards = __discoverState?.awards || new Set(['hugo', 'nebula', 'retro_hugo']);
  const categories = __discoverState?.categories || new Set(['Novel', 'Novella', 'Novelette']);
  // Unrated only — anything in user_books (read/nightstand/started) is
  // already categorized and shouldn't reappear in the swipe queue. Then apply
  // the Status/Award/Category checkbox filters (all multi-select).
  return DATA.books
    .filter(b => {
      if (auth.statusFor(b.id) !== null) return false;
      if (!categories.has(b.category)) return false;
      const aw = b.awards || {};
      // Must carry at least one of the selected awards.
      if (![...awards].some(a => aw[a])) return false;
      // A book counts as a winner if any of its selected awards is a winner;
      // otherwise it's a nominee. Filter by the checked Status boxes.
      const isWinner = [...awards].some(a => aw[a] === 'winner');
      if (isWinner && !statuses.has('winner')) return false;
      if (!isWinner && !statuses.has('nominee')) return false;
      return true;
    })
    .sort(discoverComparator(__discoverState?.sort || 'year-desc'))
    .map(b => b.id);
}

// Queue ordering for the Sort page — mirrors the Search tab's sort options.
function discoverComparator(sort) {
  const author = b => (b.authors && b.authors[0]) || b.author_raw || '';
  switch (sort) {
    case 'year-asc':    return (a, b) => (a.year || 0) - (b.year || 0) || a.title.localeCompare(b.title);
    case 'author-asc':  return (a, b) => author(a).localeCompare(author(b)) || (b.year || 0) - (a.year || 0);
    case 'author-desc': return (a, b) => author(b).localeCompare(author(a)) || (b.year || 0) - (a.year || 0);
    case 'year-desc':
    default:            return (a, b) => (b.year || 0) - (a.year || 0) || a.title.localeCompare(b.title);
  }
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

// Mission statement moved to the Dashboard (renderStats). Discover no longer shows it.
function discoverIntroHtml() {
  return '';
}

// "Read Free Online" spotlight banner — pinned featured book + strip of others.
// Appears on the Home page between the H1 and the stat toggles.
function freeReadBannerHtml() {
  const FEATURED_ID = 'the-day-the-world-turned-upside-down-dutch-2015-novelette';
  const featured = DATA.books.find(b => b.id === FEATURED_ID);
  if (!featured) return '';

  const allFree = DATA.books.filter(b => b.publication_url);
  const otherFree = allFree
    .filter(b => b.id !== FEATURED_ID)
    .sort((a, b) => (b.year || 0) - (a.year || 0));

  const awardPills = Object.entries(featured.awards || {}).map(([a, s]) =>
    `<span class="rr-pill rr-pill-${a}">${AWARD_LABELS[a]}${s === 'winner' ? ' ★' : ''}</span>`
  ).join('');

  const coverHtml = featured.cover_url
    ? `<img src="${escapeHtml(featured.cover_url)}" alt="${escapeHtml(featured.title)}" class="free-banner-cover-img">`
    : `<div class="free-banner-cover-placeholder">📖</div>`;

  const sourceLabel = featured.publication_label || MAGAZINE_CANONICAL[featured.publisher] || null;
  const metaParts = [
    featured.year,
    featured.category,
    sourceLabel ? `Free at ${sourceLabel}` : null,
  ].filter(Boolean).join(' · ');

  const otherStrip = otherFree.length === 0 ? '' : `
    <div class="free-banner-others">
      <div class="free-banner-others-label">More free reads</div>
      <div class="swimlane-strip">${otherFree.map(b => makeSwimlaneCard(b)).join('')}</div>
    </div>`;

  return `<div class="free-banner">
    <div class="free-banner-eyebrow">Read Free Online</div>
    <div class="free-banner-body">
      <a class="free-banner-cover" href="#/books/${escapeHtml(featured.id)}">${coverHtml}</a>
      <div class="free-banner-info">
        <div class="free-banner-pills">${awardPills}</div>
        <h2 class="free-banner-title"><a href="#/books/${escapeHtml(featured.id)}">${escapeHtml(featured.title)}</a></h2>
        <div class="free-banner-author">by ${escapeHtml(featured.author_raw || (featured.authors || []).join(', '))}</div>
        <div class="free-banner-meta">${escapeHtml(metaParts)}</div>
        <div class="free-banner-ctas">
          <a href="${escapeHtml(featured.publication_url)}" target="_blank" rel="noopener" class="free-banner-cta-primary">Read Free Online →</a>
          <a href="#/books?readFree=1" class="free-banner-cta-secondary">Browse all ${allFree.length} free reads</a>
        </div>
      </div>
    </div>
    ${otherStrip}
  </div>`;
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
        howToVote: {
          steps: [
            {
              title: 'You need a LAcon V membership.',
              bodyHtml: 'Only attending and supporting members of the 2026 WorldCon can vote on the final ballot. Register at <a href="https://laconv.org" target="_blank" rel="noopener">laconv.org</a> (a "WSFS-only" supporting membership is the cheapest path if you\'re not attending).',
            },
            {
              title: 'Read the Hugo Voter Packet.',
              bodyHtml: 'LAcon V will release a free packet of digital copies of (most) finalists to members ahead of the voting deadline. Watch your member email.',
            },
            {
              title: 'Rank the finalists.',
              bodyHtml: 'Voting uses instant-runoff: rank the works you\'ve read in order of preference. You can leave the rest blank. "No Award" is a legitimate ranking.',
            },
            {
              title: 'Submit by the deadline.',
              bodyHtml: 'Voting typically closes in mid-to-late July 2026 — exact dates posted on the <a href="https://www.thehugoawards.org/hugo-voting/" target="_blank" rel="noopener">official Hugo voting page</a>.',
            },
          ],
          links: [
            { label: 'Hugo voting instructions', href: 'https://www.thehugoawards.org/hugo-voting/', primary: true },
            { label: 'LAcon V membership', href: 'https://laconv.org', primary: false },
          ],
        },
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
    </div>`;
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
      queue: [],
      history: [],
      skipped: new Set(),
      tab: 'cover',
      // Multi-select filters (match the Stats page). All feed the swipe queue.
      statuses: new Set(['winner']),
      awards: new Set(['hugo', 'nebula', 'retro_hugo']),
      categories: new Set(['Novel', 'Novella', 'Novelette']),
      // Queue order — mirrors the Search tab's sort options.
      sort: 'year-desc',
    };
    __discoverState.queue = buildDiscoverQueue();
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
  // 'unread' = explicit "Not read" click (new status that lives in user_books).
  // 'skipped' is a legacy alias accepted for the same bucket.
  const unreadCount = DATA.books.filter(b => {
    const s = auth.statusFor(b.id);
    return s === 'unread' || s === 'skipped';
  }).length;
  const sortedCount = readCount + nightstandCount + unreadCount;
  const unsortedCount = total - sortedCount;
  const sortedPct = total > 0 ? Math.round((sortedCount / total) * 100) : 0;

  const book = discoverNextBook();

  // Status / Award / Category filter checkboxes — same shape as the Stats
  // page. All three feed buildDiscoverQueue. Rendered in BOTH the active-card
  // view and the empty state so the user can re-scope the queue without
  // leaving the Sort page.
  const togglesHtml = (() => {
    const statuses = __discoverState.statuses;
    const awards = __discoverState.awards;
    const categories = __discoverState.categories;
    const sort = __discoverState.sort || 'year-desc';
    const allW = DATA.books.filter(b => Object.values(b.awards||{}).includes('winner')).length;
    const allN = DATA.books.filter(b => !Object.values(b.awards||{}).includes('winner') && Object.keys(b.awards||{}).length > 0).length;
    const hugoAll = DATA.books.filter(b => (b.awards||{}).hugo).length;
    const nebAll  = DATA.books.filter(b => (b.awards||{}).nebula).length;
    const retroAll = DATA.books.filter(b => (b.awards||{}).retro_hugo).length;
    const catCount = (c) => DATA.books.filter(b => b.category === c).length;
    const sortOpt = (v, label) => `<option value="${v}"${sort===v?' selected':''}>${label}</option>`;
    return `<div class="stats-filter-row discover-filter-row">
      <fieldset class="stats-filter-group">
        <legend>Status</legend>
        <label><input type="checkbox" data-discover-status="winner" ${statuses.has('winner')?'checked':''}> Winners <span class="status-count">${allW}</span></label>
        <label><input type="checkbox" data-discover-status="nominee" ${statuses.has('nominee')?'checked':''}> Nominees <span class="status-count">${allN}</span></label>
      </fieldset>
      <fieldset class="stats-filter-group">
        <legend>Award</legend>
        <label><input type="checkbox" data-discover-award="hugo" ${awards.has('hugo')?'checked':''}> Hugo <span class="status-count">${hugoAll}</span></label>
        <label><input type="checkbox" data-discover-award="nebula" ${awards.has('nebula')?'checked':''}> Nebula <span class="status-count">${nebAll}</span></label>
        <label><input type="checkbox" data-discover-award="retro_hugo" ${awards.has('retro_hugo')?'checked':''}> Retro Hugo <span class="status-count">${retroAll}</span></label>
      </fieldset>
      <fieldset class="stats-filter-group">
        <legend>Category</legend>
        <label><input type="checkbox" data-discover-category="Novel" ${categories.has('Novel')?'checked':''}> Novel <span class="status-count">${catCount('Novel')}</span></label>
        <label><input type="checkbox" data-discover-category="Novella" ${categories.has('Novella')?'checked':''}> Novella <span class="status-count">${catCount('Novella')}</span></label>
        <label><input type="checkbox" data-discover-category="Novelette" ${categories.has('Novelette')?'checked':''}> Novelette <span class="status-count">${catCount('Novelette')}</span></label>
      </fieldset>
      <fieldset class="stats-filter-group">
        <legend>Sort by</legend>
        <select id="discover-sort" class="discover-sort-select">
          ${sortOpt('year-desc', 'Publication date ↓')}
          ${sortOpt('year-asc', 'Publication date ↑')}
          ${sortOpt('author-asc', 'Author A–Z')}
          ${sortOpt('author-desc', 'Author Z–A')}
        </select>
      </fieldset>
    </div>`;
  })();

  const statsRow = `<div class="discover-stats-card">
    <div class="discover-stats-row">
      <div class="discover-stat">
        <div class="discover-stat-value">${readCount}</div>
        <div class="discover-stat-label">Read</div>
      </div>
      <div class="discover-stat">
        <div class="discover-stat-value">${nightstandCount}</div>
        <div class="discover-stat-label">Nightstand</div>
      </div>
      <div class="discover-stat">
        <div class="discover-stat-value">${unreadCount}</div>
        <div class="discover-stat-label">Unread</div>
      </div>
      <div class="discover-stat">
        <div class="discover-stat-value">${unsortedCount}</div>
        <div class="discover-stat-label">Unsorted</div>
      </div>
    </div>
    <div class="discover-progress-row">
      <div class="discover-progress-label">
        <span>Sorted</span>
        <span class="discover-progress-count">${sortedCount} of ${total} · ${sortedPct}%</span>
      </div>
      <div class="discover-progress-bar discover-progress-bar-seg">
        ${total > 0 ? `<div class="seg seg-read" style="width:${(readCount / total * 100).toFixed(2)}%" title="Read · ${readCount}"></div>` : ''}
        ${total > 0 ? `<div class="seg seg-nightstand" style="width:${(nightstandCount / total * 100).toFixed(2)}%" title="Nightstand · ${nightstandCount}"></div>` : ''}
        ${total > 0 ? `<div class="seg seg-unread" style="width:${(unreadCount / total * 100).toFixed(2)}%" title="Unread · ${unreadCount}"></div>` : ''}
      </div>
    </div>
  </div>`;

  if (!book) {
    // Message reflects whether the filters are narrowed at all. With the
    // multi-select checkboxes, "everything in this filter" is the honest line.
    const narrowed = __discoverState.statuses.size < 2
      || __discoverState.awards.size < 2
      || __discoverState.categories.size < 3;
    const headline = narrowed ? "You've sorted everything in this filter." : "You've labeled every book.";
    root.innerHTML = `<div class="detail discover-page">
      ${togglesHtml}
      ${statsRow}
      <div class="discover-empty">
        <p style="font-size: 18px;"><strong>${headline}</strong></p>
        <p style="color: var(--muted);">${narrowed ? 'Adjust the filters above to keep sorting, or hit' : 'Nice work. Hit'} <a href="#/search">Search</a> to browse and <a href="#/">Home</a> for your progress.</p>
        ${__discoverState && __discoverState.skipped.size > 0
          ? `<p style="margin-top: 18px;"><button type="button" id="discover-replay" class="user-status-btn">Replay ${__discoverState.skipped.size} skipped</button></p>`
          : ''}
      </div>
    </div>`;
    wireDiscover();
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
    `<span class="rr-pill rr-pill-${a}">${AWARD_LABELS[a]}${s === 'winner' ? ' ★' : ''}</span>`
  ).join('');

  const authorList = moreByAuthor.length === 0
    ? `<p style="color: var(--muted);">No other Hugo/Nebula-listed books by ${escapeHtml(author)}.</p>`
    : `<ul class="discover-author-list">${moreByAuthor.slice(0, 12).map(b => {
        const myS = auth.statusFor(b.id);
        const tag = myS === 'read' ? `<span class="discover-mini-tag read">Read</span>`
          : (myS === 'nightstand' || myS === 'started') ? `<span class="discover-mini-tag night">Nightstand</span>`
          : '';
        return `<li><a href="#/books/${escapeHtml(b.id)}">${escapeHtml(b.title)}</a> <span style="color: var(--muted);">· ${b.year || ''} · ${escapeHtml(b.category)}</span> ${tag}</li>`;
      }).join('')}</ul>`;

  // Combined card content (cover left, info right). Used for both the top
  // card and the peek cards behind so the stack looks consistent.
  const combinedCardContent = (b, opts = {}) => {
    const linkTitle = opts.linkTitle !== false;
    const linkAuthor = opts.linkAuthor !== false;
    const img = b.cover_url
      ? `<img src="${escapeHtml(b.cover_url)}" alt="" draggable="false" onload="__coverFallback(this)" onerror="__coverFallback(this)">`
      : `<span class="discover-cover-placeholder">📖</span>`;
    const bookAuthor = (b.authors || [])[0] || b.author_raw || '';
    const categoryPill = b.category
      ? `<span class="rr-pill rr-pill-cat">${escapeHtml(b.category)}</span>`
      : '';
    const awardPills = Object.entries(b.awards || {}).map(([a, s]) =>
      `<span class="rr-pill rr-pill-${a} rr-pill-${s}">${AWARD_LABELS[a]} ${s === 'winner' ? 'Winner ★' : 'Nominee'}</span>`
    ).join('');
    const pills = categoryPill + awardPills;
    let descTxt = (b.description || '').replace(/\(\[[^\]]+\]\[\d+\]\)/g, '').replace(/^\[\d+\]:.*$/gm, '').trim();
    const descHtml = descTxt
      ? escapeHtml(descTxt).split(/\n\n+/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('')
      : `<p style="color: var(--muted);">No description on file for this one.</p>`;
    const titleHtml = linkTitle
      ? `<a href="#/books/${escapeHtml(b.id)}">${escapeHtml(b.title)}</a>`
      : escapeHtml(b.title);
    const authorHtml = bookAuthor
      ? (linkAuthor
          ? `<a href="#/authors/${encodeURIComponent(bookAuthor)}" class="author-link">${escapeHtml(bookAuthor)}</a>`
          : escapeHtml(bookAuthor))
      : '';
    return `<div class="discover-card-combined">
      <div class="discover-cover-wrap">${img}</div>
      <div class="discover-card-info">
        <div class="discover-title">${titleHtml}</div>
        <div class="discover-meta">${authorHtml}${b.year ? ` · ${b.year}` : ''}</div>
        ${pills ? `<div class="discover-pills">${pills}</div>` : ''}
        <div class="discover-desc">${descHtml}</div>
      </div>
    </div>`;
  };
  const peekCard = (b, idx) => {
    if (!b) return '';
    // Peek cards render the full combined layout so the stack looks like
    // consistent cards behind the top one, not bare cover placeholders.
    // Plain text (no links) since pointer-events is disabled on peeks.
    return `<div class="discover-card discover-card-peek" data-peek="${idx}">${combinedCardContent(b, { linkTitle: false, linkAuthor: false })}</div>`;
  };

  root.innerHTML = `<div class="detail discover-page">
    ${togglesHtml}
    <div class="discover-actionbar">
      <div class="discover-actions">
        <button type="button" class="discover-action discover-action-read" data-action="read">✓ Read</button>
        <button type="button" class="discover-action discover-action-night" data-action="nightstand">📖 Nightstand</button>
        <button type="button" class="discover-action discover-action-neither" data-action="neither">○ Not read</button>
      </div>
      <button type="button" class="discover-undo-btn discover-undo" title="Undo last decision" aria-label="Undo" ${__discoverState.history.length === 0 ? 'disabled' : ''}>↶</button>
    </div>
    <div class="discover-cardstack">
      ${peekCard(peek2, 2)}
      ${peekCard(peek1, 1)}
      <div class="discover-card discover-card-top" id="discover-top-card" data-book-id="${escapeHtml(book.id)}">
        <div class="discover-swipe-hint discover-swipe-hint-left">Read</div>
        <div class="discover-swipe-hint discover-swipe-hint-right">Unread</div>
        <div class="discover-swipe-hint discover-swipe-hint-up">Nightstand</div>
        ${combinedCardContent(book)}
      </div>
    </div>
    ${statsRow}
    <p class="discover-instructions">Rapidly label every book on the list. <strong>Swipe left</strong> (or ✓ Read) to mark as Read · <strong>Swipe right</strong> (or ○ Not read) to mark Unread · <strong>Swipe up</strong> (or 📖 Nightstand) to queue it.</p>
  </div>`;

  wireDiscover();
}

function wireDiscover() {
  const root = $('#view-discover');
  if (!root) return;

  // Status / Award / Category filter checkboxes — multi-select, all feed the
  // swipe queue. Toggling any rebuilds the queue and re-renders.
  const onDiscoverFilter = (setName, key, checked) => {
    const set = __discoverState[setName];
    if (checked) set.add(key); else set.delete(key);
    __discoverState.skipped = new Set();
    __discoverState.queue = buildDiscoverQueue();
    drawDiscover();
  };
  root.querySelectorAll('input[data-discover-status]').forEach(cb => {
    cb.addEventListener('change', () => onDiscoverFilter('statuses', cb.dataset.discoverStatus, cb.checked));
  });
  root.querySelectorAll('input[data-discover-award]').forEach(cb => {
    cb.addEventListener('change', () => onDiscoverFilter('awards', cb.dataset.discoverAward, cb.checked));
  });
  root.querySelectorAll('input[data-discover-category]').forEach(cb => {
    cb.addEventListener('change', () => onDiscoverFilter('categories', cb.dataset.discoverCategory, cb.checked));
  });
  // Sort select — reorders the queue without changing which books are in it,
  // so the skipped set is preserved (unlike the filter checkboxes).
  root.querySelector('#discover-sort')?.addEventListener('change', (e) => {
    __discoverState.sort = e.target.value;
    __discoverState.queue = buildDiscoverQueue();
    drawDiscover();
  });

  // Action buttons. "Not read" = explicit Unread (status='unread' in DB) so
  // the book never reappears in the queue and counts in the Unread stat.
  root.querySelectorAll('.discover-action').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      const status = action === 'neither' ? 'unread' : action;
      const card = $('#discover-top-card');
      const dir = action === 'read' ? 'left' : action === 'nightstand' ? 'up' : 'right';
      animateAndCommit(card, dir, status);
    });
  });

  // Undo button — Skip button removed in the redesign.
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
    if (e.target.closest('a') || e.target.closest('button')) return;
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
    if (leftHint) leftHint.style.opacity = (dx < 0 && absX > absY) ? Math.min(1, absX / 120) : 0;
    if (rightHint) rightHint.style.opacity = (dx > 0 && absX > absY) ? Math.min(1, absX / 120) : 0;
    if (upHint) upHint.style.opacity = (dy < 0 && absY >= absX) ? Math.min(1, absY / 120) : 0;
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
    else { dir = 'right'; status = 'unread'; }
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
  // Record in history for undo (optimistic — assume save succeeds).
  const prevStatus = auth.statusFor(bookId);
  __discoverState.history.push({ bookId, prevStatus });
  if (__discoverState.history.length > 50) __discoverState.history.shift();
  // Optimistically advance the queue so the UI moves immediately — don't
  // block on the DB round-trip. On network failure the book reappears on refresh.
  __discoverState.skipped.delete(bookId);
  __discoverState.queue = __discoverState.queue.filter(id => id !== bookId);
  // Show next card after animation — fire before the save resolves.
  setTimeout(() => drawDiscover(), 220);
  // Background save — silent on failure so rapid swiping isn't interrupted.
  auth.setBookStatus(bookId, status).catch(err => {
    console.error('setBookStatus failed in Discover:', err);
  });
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

// ===== Public profile as Stats =======================================
// Render the full Stats dashboard for another Supabase user. Loads their
// profile + user_books, populates state.viewingProfile so the 'me' reader
// resolves against their data, then calls renderStats(). On error or
// not-found, falls back to a friendly message in the Stats view.
async function viewStatsForHandle(handle) {
  const root = $('#view-stats');
  if (!root) return;
  root.innerHTML = `<div class="detail"><a href="#/" class="back">← back</a><p style="color: var(--muted);">Loading @${escapeHtml(handle)}…</p></div>`;
  showView('stats');

  await window.MR_AUTH?.ready;
  const client = window.MR_AUTH?.client;
  if (!client) {
    root.innerHTML = `<div class="detail"><a href="#/" class="back">← back</a><p style="color: var(--sf);">Auth client not ready.</p></div>`;
    return;
  }
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
  const { data: ub } = await withTimeout(
    client.from('user_books').select('book_id, status, date_read').eq('user_id', profile.id),
    8000, 'user_books lookup');
  const userBooksById = {};
  for (const row of (ub || [])) {
    userBooksById[row.book_id] = { status: row.status, date_read: row.date_read };
  }
  state.viewingProfile = { id: profile.id, handle: profile.handle, userBooksById, profile };
  // Recompute reader state so the viewed user becomes the sole 'me' reader.
  recomputeReaders();
  renderStats();
}

// ===== Public profile page (legacy condensed view) ===================
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
  const tile = (bk) => `<a class="swimlane-card" href="#/books/${escapeHtml(bk.id)}">
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
    ? `<a class="mr-btn-primary" href="#/stats?u=${encodeURIComponent(myHandle || 'me')}&u=${encodeURIComponent(profile.handle)}">Compare with me →</a>`
    : '';
  const friendBtn = (meId && !isMe)
    ? (alreadyFriends
        ? `<button type="button" class="mr-btn-ghost mr-btn-unfriend" id="profile-remove-friend">✓ Friends · Remove</button>`
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

    ${isMe ? (() => {
      const overall = window.MR_AUTH?.leaderboardOverall || [];
      const byAward = window.MR_AUTH?.leaderboardByAward || [];
      const hugoByUser = {};
      const nebulaByUser = {};
      for (const r of byAward) {
        if (r.award === 'hugo') hugoByUser[r.user_id] = r.read_count;
        else if (r.award === 'nebula') nebulaByUser[r.user_id] = r.read_count;
      }
      const totalLabel = overall[0]?.total_books ?? 0;
      const onLeaderboard = window.MR_AUTH?.profile?.on_leaderboard;
      const rowHtml = overall.map(r => {
        const isMeRow = r.user_id === meId;
        const compareTag = !isMeRow
          ? `<a class="lb-compare" href="#/stats?u=${encodeURIComponent(myHandle || 'me')}&u=${encodeURIComponent(r.handle)}">Compare →</a>`
          : `<span class="lb-me">you</span>`;
        const hCount = hugoByUser[r.user_id] ?? 0;
        const nCount = nebulaByUser[r.user_id] ?? 0;
        return `<div class="lb-row${isMeRow ? ' lb-row-me' : ''}">
          <div class="lb-rank">#${r.rank}</div>
          <div class="lb-handle"><a href="#/u/${escapeHtml(r.handle)}">@${escapeHtml(r.handle)}</a></div>
          <div class="lb-stat"><strong>${r.read_count}</strong> <span class="lb-of">/ ${r.total_books}</span></div>
          <div class="lb-stat-sub" style="color:var(--sf)"><strong>${hCount}</strong> Hugo</div>
          <div class="lb-stat-sub" style="color:var(--fantasy)"><strong>${nCount}</strong> Nebula</div>
          <div class="lb-pct">${r.pct ?? 0}%</div>
          <div class="lb-action">${compareTag}</div>
        </div>`;
      }).join('');
      const noLeaderboardNote = !onLeaderboard
        ? `<p style="color:var(--muted);font-size:13px;">You're not on the leaderboard yet. <a href="#/settings">Opt in from Settings</a>.</p>`
        : '';
      return `<section class="profile-section" id="profile-friends-section">
        <h2>Friends</h2>
        <p style="color:var(--muted);font-size:13px;">You and your friends, ranked by reads from the ${totalLabel} canonical books. Tap <strong>Compare</strong> to see a head-to-head.</p>
        ${noLeaderboardNote}
        <form id="profile-friends-add-form" class="friends-add-form">
          <input type="text" id="profile-friends-add-handle" placeholder="@handle to add" autocomplete="off">
          <button type="submit" class="mr-btn-primary">Add friend</button>
          <span id="profile-friends-add-status" class="settings-inline-status"></span>
        </form>
        ${overall.length > 0
          ? `<div class="lb-table">${rowHtml}</div>`
          : `<p style="color:var(--muted);">No friends yet — add one above.</p>`}
      </section>`;
    })() : ''}
  </div>`;

  $('#profile-add-friend')?.addEventListener('click', async () => {
    try {
      await window.MR_AUTH.addFriendByHandle(profile.handle);
      renderProfile(handle);
    } catch (err) {
      alert(err.message || String(err));
    }
  });
  $('#profile-remove-friend')?.addEventListener('click', async () => {
    if (!confirm(`Remove @${profile.handle} as a friend?`)) return;
    try {
      await window.MR_AUTH.removeFriend(profile.id);
      renderProfile(handle);
    } catch (err) {
      alert(err.message || String(err));
    }
  });
  $('#profile-signin')?.addEventListener('click', () => window.MR_AUTH.showSignInModal());

  // Friends add-form (isMe only)
  const friendsAddForm = $('#profile-friends-add-form');
  if (friendsAddForm) {
    const addStatus = $('#profile-friends-add-status');
    friendsAddForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = $('#profile-friends-add-handle');
      const v = (input.value || '').trim();
      if (!v) return;
      if (addStatus) { addStatus.textContent = 'Adding…'; addStatus.className = 'settings-inline-status'; }
      try {
        const target = await window.MR_AUTH.addFriendByHandle(v);
        if (addStatus) { addStatus.textContent = `✓ Added @${target.handle}`; addStatus.className = 'settings-inline-status success'; }
        input.value = '';
        setTimeout(() => renderProfile(handle), 200);
      } catch (err) {
        if (addStatus) { addStatus.textContent = err.message || String(err); addStatus.className = 'settings-inline-status error'; }
      }
    });
  }
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
  state.decades = new Set(ALL_DECADES);
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
  const decades = params.get('decades');
  if (decades) {
    const valid = decades.split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => ALL_DECADES.includes(n));
    if (valid.length) state.decades = new Set(valid);
  }
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
  if (params.get('readFree') === '1') state.readFree = true;
  syncFiltersToDom();
}

function syncFiltersToDom() {
  $('#search').value = state.search;
  const readerStateMap = { tom: state.readTom, nika: state.readNika, westdac: state.readWestdac, colton: state.readColton, schupp: state.readSchupp };
  for (const [who, set] of Object.entries(readerStateMap)) {
    $$(`input[name="read-${who}"]`).forEach(el => { el.checked = set.has(el.value); });
  }
  $$('input[name="award"]').forEach(el => { el.checked = state.awards.has(el.value); });
  $$('input[name="status"]').forEach(el => { el.checked = state.statuses.has(el.value); });
  $$('input[name="category"]').forEach(el => { el.checked = state.categories.has(el.value); });
  $$('input[name="decade"]').forEach(el => { el.checked = state.decades.has(parseInt(el.value, 10)); });
  $$('input[name="author-gender"]').forEach(el => { el.checked = state.authorGender.has(el.value); });
  $$('input[name="missing"]').forEach(el => { el.checked = state.missingFilter.has(el.value); });
  $$('input[name="me-status"]').forEach(el => { el.checked = state.meStatus.has(el.value); });
  const rfEl = $('#filter-read-free'); if (rfEl) rfEl.checked = !!state.readFree;
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
  // Only sync the URL while we're on the Search page — other routes have
  // their own URL semantics we shouldn't clobber.
  if (!location.hash.startsWith('#/search') && !location.hash.startsWith('#/books')) return;
  const p = new URLSearchParams();
  // searchMode persists across reloads — 'authors' explicit, 'books' default.
  if (state.searchMode === 'authors') p.set('mode', 'authors');
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
  if (state.decades.size > 0 && state.decades.size < ALL_DECADES.length) {
    p.set('decades', [...state.decades].sort((a, b) => a - b).join(','));
  }
  if (state.authorGender.size > 0 && state.authorGender.size < 3) {
    p.set('gender', [...state.authorGender].join(','));
  }
  if (state.readFree) p.set('readFree', '1');
  if (state.missingFilter.size > 0) {
    p.set('missing', [...state.missingFilter].join(','));
  }
  if (state.meStatus && state.meStatus.size > 0 && state.meStatus.size < 3) {
    p.set('meStatus', [...state.meStatus].join(','));
  }
  const qs = p.toString();
  const target = '#/search' + (qs ? '?' + qs : '');
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
  // Default: clear any cross-user viewing context. The Supabase-stats branch
  // below repopulates it after loading the target user's books.
  state.viewingProfile = null;
  const [path, qs] = h.split('?');
  if (path.startsWith('#/books/')) {
    const id = path.slice('#/books/'.length);
    renderDetail(id);
    showView('detail');
    window.scrollTo(0, 0);
    return;
  }
  // #/search is the canonical Search route (books + authors toggle).
  // ?mode=authors switches the Books/Authors toggle; default is books.
  if (path === '#/search') {
    const params = new URLSearchParams(qs || '');
    state.searchMode = params.get('mode') === 'authors' ? 'authors' : 'books';
    if (qs) applyFilterParams(params);
    renderList();
    showView('list');
    window.scrollTo(0, 0);
    return;
  }
  // #/books redirects to #/search (backward compat)
  if (path === '#/books') {
    state.searchMode = 'books';
    location.hash = '#/search' + (qs ? '?' + qs : '');
    return;
  }
  if (path.startsWith('#/authors/')) {
    const authorName = decodeURIComponent(path.slice('#/authors/'.length));
    renderAuthorDetail(authorName);
    showView('authors');
    window.scrollTo(0, 0);
    return;
  }
  // #/authors redirects to #/search in authors mode (backward compat)
  if (path === '#/authors') {
    state.searchMode = 'authors';
    location.hash = '#/search';
    return;
  }
  if (path === '#/collections') {
    renderMagazines();
    showView('magazines');
    // If the URL specifies ?section=<id>, scroll to that anchor inside
    // the page; otherwise scroll to the top. Section ids: nominees /
    // super-winners / magazines / genres.
    const params = new URLSearchParams(qs || '');
    const section = params.get('section');
    if (section) {
      // Wait a beat for the layout to settle (covers lazy-load etc.).
      setTimeout(() => {
        const el = document.getElementById(section);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        else window.scrollTo(0, 0);
      }, 30);
    } else {
      window.scrollTo(0, 0);
    }
    return;
  }
  // #/magazines → #/collections (backward compat)
  if (path === '#/magazines') {
    location.hash = '#/collections';
    return;
  }
  // Canonical stats + compare route.
  // #/stats                  → stats for current user
  // #/stats?u=tom            → same (u= is the named identity in the URL)
  // #/stats?u=tom&u=Saffron  → head-to-head compare (renders into view-stats)
  if (path === '#/stats') {
    const params = new URLSearchParams(qs || '');
    const uVals = params.getAll('u');
    if (uVals.length >= 2) {
      // #/stats?u=tom&u=SappySaffron → head-to-head compare
      renderCompare(params);
      showView('stats');
    } else {
      const uHandle = (uVals[0] || '').toLowerCase();
      const myHandle = (window.MR_AUTH?.profile?.handle || '').toLowerCase();
      if (uHandle && ALL_READER_IDS.includes(uHandle) && uHandle !== myHandle) {
        // Known hardcoded reader (tom/nika/westdac/etc) that isn't the signed-in user
        SOLO = uHandle;
        ACTIVE_READERS = [READER_CONFIG[uHandle]].filter(Boolean);
        renderStats();
        showView('stats');
      } else if (uHandle && (!myHandle || uHandle !== myHandle) && !ALL_READER_IDS.includes(uHandle)) {
        // Supabase user that is neither a hardcoded reader nor the signed-in
        // user → render the full Stats dashboard as if viewing their data.
        viewStatsForHandle(uHandle);
      } else {
        // Own handle, no handle, or signed-in user's handle → own stats
        recomputeReaders();
        renderStats();
        showView('stats');
      }
    }
    window.scrollTo(0, 0);
    return;
  }
  // Legacy #/compare → rewrite to #/stats preserving u= params
  if (path === '#/compare') {
    location.hash = '#/stats' + (qs ? '?' + qs : '');
    return;
  }
  if (path === '#/leaderboard') {
    // Legacy URL — Friends absorbed the leaderboard. Rewrite so the address
    // bar reflects the canonical path.
    location.hash = '#/';
    return;
  }
  if (path === '#/friends') {
    // Friends section now lives inside the Stats page — redirect there.
    const myHandle = window.MR_AUTH?.profile?.handle;
    location.hash = myHandle ? `#/stats?u=${encodeURIComponent(myHandle)}` : '#/stats';
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
    // #/u/<handle> is a legacy URL — the canonical public profile is
    // #/stats?u=<handle>. Redirect everyone there.
    const rawHandle = decodeURIComponent(path.slice('#/u/'.length).split('?')[0]);
    location.hash = `#/stats?u=${encodeURIComponent(rawHandle)}`;
    return;
  }
  // When signed in, give the home route a canonical identity URL.
  const myHandleFallback = window.MR_AUTH?.profile?.handle;
  if (myHandleFallback && path === '#/') {
    location.hash = `#/stats?u=${encodeURIComponent(myHandleFallback)}`;
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
  // "Your status" (Read/Nightstand/Neither) only makes sense for the signed-in
  // user. Toggle it here so it tracks auth state on init AND on sign-in/out —
  // syncFiltersToDom only runs on filtered routes, so a bare #/search would
  // otherwise leave it stuck hidden.
  const meFs = $('#me-status-fieldset');
  if (meFs) meFs.hidden = !window.MR_AUTH?.user;
}

// Collapsible filter sections — fold state is keyed by legend text and
// persisted so it survives reloads. The filters aside is static HTML (not
// re-rendered on SPA navigation), so we wire this once in wireFilters.
const COLLAPSED_FILTERS_KEY = 'mr_collapsed_filters';
function loadCollapsedFilters() {
  try {
    const raw = localStorage.getItem(COLLAPSED_FILTERS_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch (_) { return new Set(); }
}
function saveCollapsedFilters(set) {
  try { localStorage.setItem(COLLAPSED_FILTERS_KEY, JSON.stringify([...set])); } catch (_) {}
}
function wireFilterCollapse() {
  const collapsed = loadCollapsedFilters();
  $$('.filters fieldset').forEach(fs => {
    const legend = fs.querySelector('legend');
    if (!legend) return;
    const key = legend.textContent.trim();
    if (collapsed.has(key)) fs.classList.add('collapsed');
    legend.addEventListener('click', () => {
      const isCollapsed = fs.classList.toggle('collapsed');
      const cur = loadCollapsedFilters();
      if (isCollapsed) cur.add(key); else cur.delete(key);
      saveCollapsedFilters(cur);
    });
  });
}

function wireFilters() {
  applyReaderFilterVisibility();
  wireFilterCollapse();

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
  $$('input[name="decade"]').forEach(el => el.addEventListener('change', e => {
    const dec = parseInt(e.target.value, 10);
    if (e.target.checked) state.decades.add(dec); else state.decades.delete(dec);
    renderList();
  }));
  $('#sort').addEventListener('change', e => { state.sort = e.target.value; renderList(); });
  $$('input[name="author-gender"]').forEach(el => el.addEventListener('change', e => {
    if (e.target.checked) state.authorGender.add(e.target.value);
    else state.authorGender.delete(e.target.value);
    renderList();
  }));
  const rfEl2 = $('#filter-read-free');
  if (rfEl2) rfEl2.addEventListener('change', e => { state.readFree = e.target.checked; renderList(); });
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
  // Books / Authors toggle tabs — renderList() calls pushFiltersToUrl()
  // internally, which now serializes searchMode too so the URL persists.
  document.getElementById('search-tab-books')?.addEventListener('click', () => {
    if (state.searchMode === 'books') return;
    state.searchMode = 'books';
    renderList();
    pushFiltersToUrl();
  });
  document.getElementById('search-tab-authors')?.addEventListener('click', () => {
    if (state.searchMode === 'authors') return;
    state.searchMode = 'authors';
    renderList();
    pushFiltersToUrl();
  });

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
      decades: new Set(ALL_DECADES),
      sort: 'year-desc',
      progressStatuses: new Set(state.progressStatuses),
      progressAwards: new Set(state.progressAwards),
      progressCategories: new Set(state.progressCategories),
      includeNightstand: state.includeNightstand,
      authorWindow: state.authorWindow,
      genderFilter: null,
      authorGender: new Set(['female', 'male', 'unknown']),
      readFree: false,
      missingFilter: new Set(),
      meStatus: new Set(['read', 'nightstand', 'neither']),
      searchMode: 'books',
    };
    $('#search').value = '';
    for (const who of ALL_READER_IDS) {
      $$(`input[name="read-${who}"]`).forEach(el => { el.checked = true; });
    }
    $$('input[name="award"]').forEach(el => el.checked = true);
    $$('input[name="status"]').forEach(el => el.checked = true);
    $$('input[name="category"]').forEach(el => el.checked = true);
    $$('input[name="decade"]').forEach(el => el.checked = true);
    $$('input[name="author-gender"]').forEach(el => el.checked = true);
    $$('input[name="missing"]').forEach(el => el.checked = false);
    $$('input[name="me-status"]').forEach(el => el.checked = true);
    const rfReset = $('#filter-read-free'); if (rfReset) rfReset.checked = false;
    $('#sort').value = 'year-desc';
    renderList();
  });
}

function applySoloUI() {
  // Default keeps the plain "Readmore SFF" title. Solo modes hide
  // the other readers via body class; multi-reader keeps everything visible.
  if (SOLO) {
    document.body.classList.add(`solo-${SOLO}`);
    document.title = 'Readmore SFF';
  } else {
    document.title = 'Readmore SFF';
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
    progressLink.setAttribute('href', handle ? `#/stats?u=${encodeURIComponent(handle)}` : '#/stats');
  }
  // Hide Friends + Discover nav links when signed out — both pages are
  // sign-in-only and the route handlers redirect anon visitors to Home.
  const signedIn = !!window.MR_AUTH?.user;
  const navDiscover = document.getElementById('nav-discover');
  if (navDiscover) navDiscover.hidden = !signedIn;
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
  // Four-state status: Read, Nightstand, Unread, Unknown.
  //   Read       = status='read' in user_books
  //   Nightstand = status='nightstand' (also covers legacy 'started')
  //   Unread     = status='unread' (explicit "I won't read this")
  //   Unknown    = no row at all in user_books (default for every book)
  // For the Sort queue, only Unknown books appear. For stats, Unread and
  // Unknown collapse into the same bucket everywhere else.
  const rawStatus = auth.statusFor(bookId);
  const current =
      rawStatus === 'started' ? 'nightstand'
    : rawStatus === 'skipped' ? 'unread'
    : rawStatus || 'unknown';
  const btn = (status, label) =>
    `<button type="button" class="user-status-btn ${current === status ? 'active' : ''}" data-status="${status}">${label}</button>`;
  return `<div class="user-status user-status-signed-in" data-book-id="${escapeHtml(bookId)}">
    <span class="user-status-label">Your status</span>
    <div class="user-status-buttons">
      ${btn('read', '✓ Read')}
      ${btn('nightstand', '📖 Nightstand')}
      ${btn('unread', '○ Unread')}
      ${btn('unknown', '— Unknown')}
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
        // "Unknown" (and legacy "neither" / "clear") map to null — that
        // deletes the row, returning the book to the "never touched" state.
        // "Unread" writes status='unread' (explicit pass).
        const status = (ds === 'unknown' || ds === 'neither' || ds === 'clear') ? null : ds;
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
  // Direct-path entry: shareable URLs like /books/<id>, /authors/<name>, and
  // /collections are served by Cloudflare Pages Functions that inject
  // page-specific OG tags before any JS runs. We don't change the SPA's hash
  // routing — just convert the entry pathname to the equivalent hash route so
  // route() picks it up normally.
  if (!location.hash) {
    const p = location.pathname;
    let bookM, authorM;
    if ((bookM = p.match(/^\/books\/([^/?#]+)\/?$/))) {
      history.replaceState({}, '', '/#/books/' + encodeURIComponent(decodeURIComponent(bookM[1])));
    } else if ((authorM = p.match(/^\/authors\/([^/?#]+)\/?$/))) {
      history.replaceState({}, '', '/#/authors/' + encodeURIComponent(decodeURIComponent(authorM[1])));
    } else if (/^\/collections\/?$/.test(p)) {
      history.replaceState({}, '', '/#/collections');
    }
  }
  recomputeReaders();
  wireAuthGatedNav();
  applySoloUI();
  try {
    const res = await fetch('/data.json');
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
  // onChange is self-priming: if bootstrap already finished by the time we
  // subscribe (common when data.json is the slowest network call), the
  // callback fires once on a microtask with the current snapshot.
  if (window.MR_AUTH) {
    window.MR_AUTH.onChange((snapshot) => {
      recomputeReaders();
      applySoloUI();
      applyReaderFilterVisibility();
      renderAuthPill();
      // notify() fires for BOTH identity changes (sign in/out) AND data
      // mutations (e.g. setBookStatus while sorting a card). Only blow away
      // user-scoped session state when the identity actually changed —
      // otherwise sorting a card would reset the Discover queue + filter and
      // re-route mid-swipe.
      const newUserId = snapshot?.user?.id || null;
      const identityChanged = newUserId !== __lastUserId;
      __lastUserId = newUserId;
      if (identityChanged) {
        __invalidateCompareCaches();
        window.MR_AUTH.invalidateFriendsCache?.();
        __discoverState = null;
        __nightstandUnplanned.clear();
        __nightstandUnplannedLoaded = false;
        route();
      } else if (!location.hash.startsWith('#/discover')) {
        // Same user, just a data refresh (leaderboards loaded, a status saved).
        // Re-render the current view so it picks up fresh data — but skip
        // Discover, which manages its own incremental re-render.
        route();
      }
    });
  }
  // Race-safe initial render: wait for the auth bootstrap so the FIRST
  // route() sees a fully-populated MR_AUTH (user, profile, friends,
  // leaderboards). Cap the wait so a stuck Supabase doesn't park the page
  // forever — onChange will fire later if/when bootstrap eventually finishes.
  try {
    await Promise.race([
      window.MR_AUTH?.ready,
      new Promise(res => setTimeout(res, 4000)),
    ]);
  } catch (_) { /* ignore — render below with whatever state we have */ }
  recomputeReaders();
  applySoloUI();
  route();
}

init();
