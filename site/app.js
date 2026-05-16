'use strict';

const AWARD_LABELS = {
  hugo: 'Hugo',
  nebula: 'Nebula',
};

let DATA = { books: [], meta: {} };
// Reader visibility — driven by ?reader=tom,nika,westdac (comma-separated).
// Default: just Tom. ?reader=nika hides Tom. ?reader=tom,nika,westdac shows all three.
const READERS = ((new URLSearchParams(window.location.search).get('reader')) || 'tom')
  .split(',').map(r => r.trim().toLowerCase()).filter(Boolean);
const SHOW_TOM = READERS.includes('tom');
const SHOW_NIKA = READERS.includes('nika');
const SHOW_WESTDAC = READERS.includes('westdac');
// SOLO is the single-reader name when only one reader is selected, else null.
const SOLO = (READERS.length === 1) ? READERS[0] : null;

// Canonical config keeps per-reader rendering DRY
const READER_CONFIG = {
  tom: { id: 'tom', label: 'Tom', initial: 'T', cls: 'reader-t', colorVar: 'var(--accent)' },
  nika: { id: 'nika', label: 'Nika', initial: 'N', cls: 'reader-n', colorVar: 'var(--accent-2)' },
  westdac: { id: 'westdac', label: 'Westdac', initial: 'W', cls: 'reader-w', colorVar: 'var(--accent-3)' },
};
const ACTIVE_READERS = READERS.map(r => READER_CONFIG[r]).filter(Boolean);
const showReader = (id) => READERS.includes(id);
let state = {
  search: '',
  readTom: 'all',
  readNika: 'all',
  readWestdac: 'all',
  awards: new Set(Object.keys(AWARD_LABELS)),
  statuses: new Set(['winner', 'nominee']),
  categories: new Set(['Novel', 'Novella', 'Novelette']),
  yearMin: null,
  yearMax: null,
  sort: 'year-desc',
  // Progress-page filter: 'winner' | 'nominee' | 'both'
  progressStatus: 'winner',
};

// Solo mode is in the real query string (?solo=tom). Hash routing preserves it
// automatically as you navigate, so internal href="#/..." links just work.

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function readStatus(book, who = 'tom') {
  const val = (book[who] || '').toLowerCase();
  if (!val) return 'unread';
  if (val.startsWith('read')) return 'read';
  if (/queue|progress|started|struggling/.test(val)) return 'started';
  return 'started';
}

function matchesFilters(book) {
  if (state.search) {
    const q = state.search.toLowerCase();
    const hay = (book.title + ' ' + (book.author_raw || '')).toLowerCase();
    if (!hay.includes(q)) return false;
  }
  const readerKeyMap = { tom: 'readTom', nika: 'readNika', westdac: 'readWestdac' };
  for (const r of ACTIVE_READERS) {
    const who = r.id, key = readerKeyMap[who];
    if (!key) continue;
    const wanted = state[key];
    if (wanted === 'all') continue;
    const rs = readStatus(book, who);
    if (wanted === 'read' && rs !== 'read') return false;
    if (wanted === 'unread' && rs !== 'unread') return false;
    if (wanted === 'started' && rs !== 'started') return false;
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

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function readerBadge(book, who) {
  if (!showReader(who)) return '';
  const cfg = READER_CONFIG[who];
  if (!cfg) return '';
  const rs = readStatus(book, who);
  if (!book[who]) return '';
  // In solo mode, drop the initial prefix since there's only one reader
  const label = SOLO ? escapeHtml(book[who]) : `<span class="reader-initial">${cfg.initial}</span>${escapeHtml(book[who])}`;
  if (rs === 'read') return `<span class="badge read ${cfg.cls}">${label}</span>`;
  if (rs === 'started') return `<span class="badge queued ${cfg.cls}">${label}</span>`;
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
}

function renderStats() {
  // Status filter for everything on this page
  const STATUS = state.progressStatus;  // 'winner' | 'nominee' | 'both'
  const isWinner = (b) => Object.values(b.awards || {}).includes('winner');
  const winnersAll = DATA.books.filter(isWinner);
  const nomineesAll = DATA.books.filter(b => !isWinner(b));
  const allWinnersCount = winnersAll.length;
  const allNomineesCount = nomineesAll.length;
  const allBooksCount = DATA.books.length;

  // Which subset drives this render
  const winners = STATUS === 'winner' ? winnersAll
    : STATUS === 'nominee' ? nomineesAll
    : DATA.books;
  const winnersTotal = winners.length;
  // Labels that adapt to filter
  const SUBSET = STATUS === 'winner' ? 'winners'
    : STATUS === 'nominee' ? 'nominees'
    : 'books';
  const SUBSET_CAP = SUBSET.charAt(0).toUpperCase() + SUBSET.slice(1);

  const winnersTom = winners.filter(b => readStatus(b, 'tom') === 'read');
  const winnersNika = winners.filter(b => readStatus(b, 'nika') === 'read');
  const winnersWestdac = winners.filter(b => readStatus(b, 'westdac') === 'read');
  const winnersBoth = winners.filter(b => readStatus(b, 'tom') === 'read' && readStatus(b, 'nika') === 'read');
  const winnersEither = winners.filter(b => ACTIVE_READERS.some(r => readStatus(b, r.id) === 'read'));
  const winnersByReader = { tom: winnersTom, nika: winnersNika, westdac: winnersWestdac };

  // Tom shelf overlap (books that are on his Goodreads to-read shelf AND in our list)
  const onShelf = DATA.books.filter(b => b.tom_shelf === 'to-read' && readStatus(b, 'tom') !== 'read');
  const currentlyReading = DATA.books.filter(b => b.tom_shelf === 'currently-reading');

  // Nika shelf count for solo headline
  const nikaOnShelfCount = DATA.books.filter(b => b.nika_shelf === 'to-read' && readStatus(b, 'nika') !== 'read').length;
  const westdacOnShelfCount = DATA.books.filter(b => b.westdac_shelf === 'to-read' && readStatus(b, 'westdac') !== 'read').length;

  // This year (2026) — all readers
  const currentYear = new Date().getFullYear();
  const thisYearAll = DATA.books.filter(b => b.year === currentYear);
  const thisYearTomRead = thisYearAll.filter(b => readStatus(b, 'tom') === 'read');
  const thisYearNikaRead = thisYearAll.filter(b => readStatus(b, 'nika') === 'read');
  const thisYearWestdacRead = thisYearAll.filter(b => readStatus(b, 'westdac') === 'read');
  const thisYearTomShelf = thisYearAll.filter(b => b.tom_shelf === 'to-read');
  const thisYearNikaShelf = thisYearAll.filter(b => b.nika_shelf === 'to-read');
  const thisYearWestdacShelf = thisYearAll.filter(b => b.westdac_shelf === 'to-read');

  const emptyBucket = () => ({ total: 0, tom: 0, nika: 0, westdac: 0 });
  const byAward = {};
  for (const a of Object.keys(AWARD_LABELS)) byAward[a] = emptyBucket();
  for (const b of winners) {
    for (const a of Object.keys(b.awards || {})) {
      // When filtering to 'winner', only count this award if it was a winner status.
      // For 'nominee' subset, only count nominee statuses. For 'both', count any award.
      const s = b.awards[a];
      if (STATUS === 'winner' && s !== 'winner') continue;
      if (STATUS === 'nominee' && s !== 'nominee') continue;
      byAward[a].total++;
      if (readStatus(b, 'tom') === 'read') byAward[a].tom++;
      if (readStatus(b, 'nika') === 'read') byAward[a].nika++;
      if (readStatus(b, 'westdac') === 'read') byAward[a].westdac++;
    }
  }
  const byCategory = {};
  for (const b of winners) {
    byCategory[b.category] = byCategory[b.category] || emptyBucket();
    byCategory[b.category].total++;
    if (readStatus(b, 'tom') === 'read') byCategory[b.category].tom++;
    if (readStatus(b, 'nika') === 'read') byCategory[b.category].nika++;
    if (readStatus(b, 'westdac') === 'read') byCategory[b.category].westdac++;
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
    const tomOn = SHOW_TOM && b.tom_shelf === 'to-read' && readStatus(b, 'tom') !== 'read';
    const nikaOn = SHOW_NIKA && b.nika_shelf === 'to-read' && readStatus(b, 'nika') !== 'read';
    const westdacOn = SHOW_WESTDAC && b.westdac_shelf === 'to-read' && readStatus(b, 'westdac') !== 'read';
    if (tomOn || nikaOn || westdacOn) {
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
  const genres = Object.entries(genreBuckets)
    .map(([name, s]) => ({ name, ...s }))
    .sort((a, b) => b.total - a.total);

  // ===== Genre-combination "vectors" =====
  const comboBuckets = {};
  for (const b of DATA.books) {
    const gs = (b.genres || []).slice().sort();
    if (gs.length === 0) continue;
    const key = gs.join(' + ');
    if (!comboBuckets[key]) comboBuckets[key] = { total: 0, winners: 0, tomRead: 0, nikaRead: 0, westdacRead: 0 };
    comboBuckets[key].total++;
    if (Object.values(b.awards || {}).includes('winner')) comboBuckets[key].winners++;
    if (readStatus(b, 'tom') === 'read') comboBuckets[key].tomRead++;
    if (readStatus(b, 'nika') === 'read') comboBuckets[key].nikaRead++;
    if (readStatus(b, 'westdac') === 'read') comboBuckets[key].westdacRead++;
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
  // When multiple readers are active, prefer Tom for the read counts; in solo mode pick that reader
  const genderBuckets = { male: 0, female: 0, unknown: 0 };
  const genderRead = { male: 0, female: 0, unknown: 0 };
  const genderReadActive = SOLO || (SHOW_TOM ? 'tom' : (SHOW_NIKA ? 'nika' : 'westdac'));
  for (const b of winners) {
    const g = b.primary_author_gender || 'unknown';
    if (!(g in genderBuckets)) continue;
    genderBuckets[g]++;
    if (readStatus(b, genderReadActive) === 'read') genderRead[g]++;
  }

  // ===== Author leaderboard (last 30 years) =====
  const leaderboardCutoff = new Date().getFullYear() - 30;
  const authorAppearances = {};
  for (const b of DATA.books) {
    if (!b.year || b.year < leaderboardCutoff) continue;
    for (const a of (b.authors || [])) {
      if (!authorAppearances[a]) authorAppearances[a] = { total: 0, winners: 0, tomRead: 0, nikaRead: 0, westdacRead: 0 };
      authorAppearances[a].total++;
      if (Object.values(b.awards || {}).includes('winner')) authorAppearances[a].winners++;
      if (readStatus(b, 'tom') === 'read') authorAppearances[a].tomRead++;
      if (readStatus(b, 'nika') === 'read') authorAppearances[a].nikaRead++;
      if (readStatus(b, 'westdac') === 'read') authorAppearances[a].westdacRead++;
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
    if (readStatus(b, 'tom') === 'read') decadeBuckets[decade].tom++;
    if (readStatus(b, 'nika') === 'read') decadeBuckets[decade].nika++;
    if (readStatus(b, 'westdac') === 'read') decadeBuckets[decade].westdac++;
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
  for (let d = firstDecade; d <= lastDecade; d += 10) eraBuckets[d] = { total: 0, tom: 0, nika: 0, westdac: 0 };
  for (const b of winners) {
    if (!b.year) continue;
    const dec = Math.floor(b.year / 10) * 10;
    if (!eraBuckets[dec]) continue;
    eraBuckets[dec].total++;
    if (readStatus(b, 'tom') === 'read') eraBuckets[dec].tom++;
    if (readStatus(b, 'nika') === 'read') eraBuckets[dec].nika++;
    if (readStatus(b, 'westdac') === 'read') eraBuckets[dec].westdac++;
  }
  const eras = Object.entries(eraBuckets).map(([d, v]) => [parseInt(d, 10), v]).sort((a, b) => a[0] - b[0]);
  const maxEra = Math.max(1, ...eras.map(([, v]) => v.total));
  const eraReader = SOLO || (SHOW_TOM ? 'tom' : (SHOW_NIKA ? 'nika' : 'westdac'));
  const eraFillColor = READER_CONFIG[eraReader].colorVar;
  const eraBarsHtml = eras.map(([d, v]) => {
    const totalH = (v.total / maxEra) * 100;
    const readCount = v[eraReader];
    const readH = v.total > 0 ? (readCount / v.total) * 100 : 0;
    const tooltip = SOLO
      ? `${d}s: ${readCount} / ${v.total} winners read`
      : `${d}s: ` + ACTIVE_READERS.map(r => `${r.label} ${v[r.id]}/${v.total}`).join(' · ');
    return `<div class="era-bar-col">
      <div class="era-bar empty" style="height: ${Math.max(2, totalH)}%;">
        <div class="era-bar-tooltip">${tooltip}</div>
        <div style="position:absolute;bottom:0;left:0;right:0;height:${readH}%;background:${eraFillColor};border-radius:3px 3px 0 0;"></div>
      </div>
      <div class="era-bar-label">${d % 100}s</div>
      <div class="era-bar-count">${readCount}/${v.total}</div>
    </div>`;
  }).join('');

  // Up Next: winners not read by Tom AND not on Tom's shelf, sorted by year desc
  const upNext = winners
    .filter(b => readStatus(b, 'tom') !== 'read' && !b.tom_shelf)
    .sort((a, b) => (b.year || 0) - (a.year || 0))
    .slice(0, 12);

  const readerPills = (b, mode) => {
    // mode = 'read' or 'shelf'. In solo mode, drop reader prefix.
    const pillClass = { tom: 'rr-pill-t', nika: 'rr-pill-n', westdac: 'rr-pill-w' };
    const shelfField = { tom: 'tom_shelf', nika: 'nika_shelf', westdac: 'westdac_shelf' };
    if (SOLO) {
      const r = SOLO;
      if (mode === 'read' && readStatus(b, r) === 'read') return `<span class="rr-pill ${pillClass[r]}">read</span>`;
      if (mode === 'shelf' && b[shelfField[r]] === 'to-read' && readStatus(b, r) !== 'read') return `<span class="rr-pill ${pillClass[r]}">on nightstand</span>`;
      return '';
    }
    const pills = [];
    for (const r of ACTIVE_READERS) {
      if (mode === 'read' && readStatus(b, r.id) === 'read') {
        pills.push(`<span class="rr-pill ${pillClass[r.id]}">${r.initial} read</span>`);
      } else if (mode === 'shelf' && b[shelfField[r.id]] === 'to-read' && readStatus(b, r.id) !== 'read') {
        pills.push(`<span class="rr-pill ${pillClass[r.id]}">${r.initial} nightstand</span>`);
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

  const upNextHtml = upNext.map(b =>
    tile(b, `${escapeHtml(b.authors[0] || '')} · ${b.year} ${Object.entries(b.awards).filter(([, s]) => s === 'winner').map(([a]) => AWARD_LABELS[a]).join(' · ')} winner`)
  ).join('');

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

  // Decade heatmap — color intensity follows the active reader in solo mode, Tom otherwise
  const heatmapColorRgb = { tom: '125, 211, 192', nika: '180, 142, 173', westdac: '212, 160, 112' };
  const heatmapReader = SOLO || (SHOW_TOM ? 'tom' : (SHOW_NIKA ? 'nika' : 'westdac'));
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
    <div class="awards-banner">
      <a class="award-pill nebula" href="https://events.sfwa.org/" target="_blank" rel="noopener">
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

    <h1>Progress</h1>
    <div class="status-toggle" data-status="${STATUS}">
      <button class="status-tab${STATUS === 'winner' ? ' active' : ''}" data-status="winner">Winners <span class="status-count">${allWinnersCount}</span></button>
      <button class="status-tab${STATUS === 'nominee' ? ' active' : ''}" data-status="nominee">Nominees <span class="status-count">${allNomineesCount}</span></button>
      <button class="status-tab${STATUS === 'both' ? ' active' : ''}" data-status="both">Both <span class="status-count">${allBooksCount}</span></button>
    </div>

    <div class="headline-grid">
      ${(() => {
        const totalLabel = STATUS === 'both' ? 'Books on the list' : `${SUBSET_CAP} on the list`;
        const totalSub = STATUS === 'both' ? `${allWinnersCount} winners + ${allNomineesCount} nominees` : 'Hugo + Nebula combined';
        if (SOLO) {
          const r = SOLO;
          const readBooks = winnersByReader[r];
          const shelfCount = r === 'tom' ? onShelf.length : (r === 'nika' ? nikaOnShelfCount : westdacOnShelfCount);
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

    ${recentEither.length > 0 ? `<div class="progress-section">
      <h2>Recent ${SUBSET} read</h2>
      <p style="color: var(--muted); font-size: 13px;">Pills show who read each book. Most recent first.</p>
      <div class="recent-reads">${recentEitherHtml}</div>
    </div>` : ''}

    <div class="year-progress-grid${SOLO ? ' solo' : ''}">
      ${SHOW_TOM ? `<div class="year-card">
        <div class="year-card-header">
          <span class="year-card-name">${SOLO === 'tom' ? `${currentYear} on the list` : 'Tom'}</span>
          <span class="year-card-year">${currentYear}</span>
        </div>
        <div class="year-card-stat"><strong>${thisYearTomRead.length}</strong> of ${thisYearAll.length} on the ${currentYear} list read</div>
        <div class="year-card-stat"><strong>${thisYearTomShelf.length}</strong> on the nightstand from ${currentYear}</div>
        <div class="year-card-stat">Currently reading: <strong>${currentlyReading.length === 0 ? 'nothing from this list' : currentlyReading.map(b => escapeHtml(b.title)).join(', ')}</strong></div>
      </div>` : ''}
      ${SHOW_NIKA ? `<div class="year-card">
        <div class="year-card-header">
          <span class="year-card-name nika">${SOLO === 'nika' ? `${currentYear} on the list` : 'Nika'}</span>
          <span class="year-card-year">${currentYear}</span>
        </div>
        <div class="year-card-stat"><strong>${thisYearNikaRead.length}</strong> of ${thisYearAll.length} on the ${currentYear} list read</div>
        <div class="year-card-stat"><strong>${thisYearNikaShelf.length}</strong> on the nightstand from ${currentYear}</div>
        <div class="year-card-stat" style="color: var(--muted); font-size: 12px;">StoryGraph doesn't expose currently-reading</div>
      </div>` : ''}
      ${SHOW_WESTDAC ? `<div class="year-card">
        <div class="year-card-header">
          <span class="year-card-name westdac">${SOLO === 'westdac' ? `${currentYear} on the list` : 'Westdac'}</span>
          <span class="year-card-year">${currentYear}</span>
        </div>
        <div class="year-card-stat"><strong>${thisYearWestdacRead.length}</strong> of ${thisYearAll.length} on the ${currentYear} list read</div>
        <div class="year-card-stat"><strong>${thisYearWestdacShelf.length}</strong> on the nightstand from ${currentYear}</div>
      </div>` : ''}
    </div>

    ${nightstandBooks.length > 0 ? `<div class="progress-section">
      <h2>On the nightstand (${nightstandBooks.length})</h2>
      <p style="color: var(--muted); font-size: 13px;">Books from this list waiting on a to-read shelf. Pills show whose.</p>
      <div class="recent-reads">${nightstandHtml}</div>
    </div>` : ''}

    ${upNext.length > 0 ? `<div class="progress-section">
      <h2>Up next — ${SUBSET} on no nightstand yet</h2>
      <p style="color: var(--muted); font-size: 13px;">Recent ${SUBSET} by publication year. Open one to add it to your shelf.</p>
      <div class="recent-reads">${upNextHtml}</div>
    </div>` : ''}

    <div class="progress-section">
      <h2>Most-awarded authors (last 30 years)</h2>
      <p style="color: var(--muted); font-size: 13px;">Authors with the most appearances on the list since ${leaderboardCutoff} (winners + nominees). Bar width = appearances.</p>
      <div class="authors-list">${authorRows}</div>
    </div>

    <div class="progress-section">
      <h2>Coverage by era (${SUBSET})</h2>
      <p style="color: var(--muted); font-size: 13px;">Bar height = ${SUBSET} that decade · filled portion = books ${SOLO === 'nika' ? 'Nika' : (SOLO === 'tom' ? '' : (SOLO === 'westdac' ? 'Westdac' : 'Tom'))} read. Hover for details.</p>
      <div class="era-bars">${eraBarsHtml}</div>
    </div>


    <div class="progress-section">
      <h2>By genre (${SUBSET})</h2>
      <p style="color: var(--muted); font-size: 13px;">Genre tags inferred from Open Library subject lists. A book can be tagged with multiple (e.g. Space Opera + Hard SF).</p>
      <div class="genre-bars">
        ${genres.map(g => {
          const activeRead = SOLO ? g[SOLO] : g.tom;
          const pct = g.total > 0 ? (activeRead / g.total) * 100 : 0;
          const sub = SOLO
            ? `${activeRead} read`
            : ACTIVE_READERS.map(r => `${r.label} ${g[r.id]}`).join(' · ');
          return `<div class="genre-row">
            <div class="genre-name">${escapeHtml(g.name)}</div>
            <div class="genre-bar">
              <div class="genre-bar-fill" style="width: ${pct}%;"></div>
            </div>
            <div class="genre-count">${activeRead} / ${g.total}<span style="color:var(--muted)"> · ${sub}</span></div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <div class="progress-section">
      <h2>Genre vectors — which combinations win most?</h2>
      <p style="color: var(--muted); font-size: 13px;">Every book on the list (winners + nominees) bucketed by its sorted genre tuple. Win rate = winners ÷ (winners + nominees). Filtered to combos with at least 3 books and sorted by win rate.</p>
      <div class="vector-table">
        <div class="vector-row vector-head">
          <div>Genre vector</div>
          <div>Books</div>
          <div>Winners</div>
          <div>Nominees</div>
          <div>Win rate</div>
          <div>${ACTIVE_READERS.map(r => `${r.initial} read`).join(' · ')}</div>
        </div>
        ${genreVectors.map(v => {
          const winRatePct = Math.round(v.winRate * 100);
          const nominees = v.total - v.winners;
          const readCol = ACTIVE_READERS.map(r => `<span style="color:${r.colorVar}">${r.initial} ${v[r.id + 'Read']}</span>`).join(' · ');
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
              const readPill = readStatus(b, 'tom') === 'read' || readStatus(b, 'nika') === 'read'
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

    <div class="progress-section">
      <h2>By author gender (${SUBSET})</h2>
      <p style="color: var(--muted); font-size: 13px;">Primary author of each winning work, inferred from first name. Lead-character gender isn't tracked yet — no reliable data source.</p>
      <div class="gender-grid">
        ${['female', 'male', 'unknown'].map(g => {
          const total = genderBuckets[g];
          const read = genderRead[g];
          const pct = total > 0 ? Math.round(read / total * 100) : 0;
          const label = g === 'female' ? 'Female-authored' : g === 'male' ? 'Male-authored' : 'Unknown / non-binary / pen name';
          const readerLabel = SOLO ? '' : (READER_CONFIG[genderReadActive] ? READER_CONFIG[genderReadActive].label : 'Reader');
          return `<div class="gender-card gender-${g}">
            <div class="gender-card-label">${label}</div>
            <div class="gender-card-stat"><strong>${total}</strong> ${SUBSET}</div>
            <div class="gender-card-sub">${readerLabel} read ${read} (${pct}%)</div>
            <div class="progress"><div class="progress-bar" style="width: ${pct}%; background: ${g === 'female' ? 'var(--accent-2)' : g === 'male' ? 'var(--accent)' : 'var(--muted)'};"></div></div>
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
          const activeCount = SOLO ? s[SOLO] : s.tom;
          const pct = Math.round(activeCount / s.total * 100);
          const sub = SOLO
            ? `${pct}% complete`
            : ACTIVE_READERS.map(r => `${r.label}: ${Math.round(s[r.id] / s.total * 100)}%`).join(' · ');
          const statusParam = STATUS === 'both' ? '' : `&status=${STATUS}`;
          return linkCard(`#/books?award=${a}${statusParam}`, AWARD_LABELS[a], `${activeCount} / ${s.total}`, sub, activeCount / s.total * 100);
        }).join('')}
      </div>
    </div>

    <div class="progress-section">
      <h2>By category (${SUBSET})</h2>
      <p style="color: var(--muted); font-size: 13px;">Tap a card to see those ${SUBSET} in the Books tab.</p>
      <div class="stats-grid">
        ${Object.entries(byCategory).map(([c, s]) => {
          const activeCount = SOLO ? s[SOLO] : s.tom;
          const pct = Math.round(activeCount / s.total * 100);
          const sub = SOLO
            ? `${pct}% complete`
            : ACTIVE_READERS.map(r => `${r.label}: ${Math.round(s[r.id] / s.total * 100)}%`).join(' · ');
          const statusParam = STATUS === 'both' ? '' : `&status=${STATUS}`;
          return linkCard(`#/books?category=${encodeURIComponent(c)}${statusParam}`, c, `${activeCount} / ${s.total}`, sub, activeCount / s.total * 100);
        }).join('')}
      </div>
    </div>
  </div>`;

  $$('.recent-read, .swimlane-card', root).forEach(el => {
    el.addEventListener('click', () => { location.hash = `#/book/${el.dataset.id}`; });
  });
  $$('.status-tab', root).forEach(btn => {
    btn.addEventListener('click', () => {
      const newStatus = btn.dataset.status;
      if (state.progressStatus !== newStatus) {
        state.progressStatus = newStatus;
        renderStats();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });
}

function renderAbout() {
  const root = $('#view-about');
  root.innerHTML = `<div class="about">
    <h1>About Mount Readmore</h1>
    <p>A personal reading mountain of Hugo and Nebula winners and finalists, with read status overlaid from Goodreads and StoryGraph.</p>
    <h2>Tom's reading profiles</h2>
    <p>
      <a href="https://www.goodreads.com/user/show/71075928-tom-garske" target="_blank" rel="noopener" class="about-profile-link"><span class="profile-dot gr"></span>Goodreads</a>
      &nbsp;&nbsp;
      <a href="https://app.thestorygraph.com/profile/tdgarske" target="_blank" rel="noopener" class="about-profile-link"><span class="profile-dot sg"></span>StoryGraph</a>
    </p>
    <h2>How it works</h2>
    <p>A Python pipeline reads an awards spreadsheet and exported reader CSVs, matches them by title and author, and produces a static JSON file the site reads. There's no backend, no tracking, no login — just a list of books rendered in the browser.</p>
    <h2>Multiple readers</h2>
    <p>The site defaults to Tom's view. Add another reader via the URL query string: <code>?reader=tom,nika</code> shows both readers side by side; <code>?reader=nika</code> shows just Nika.</p>
    <h2>Upcoming award dates</h2>
    <ul>
      <li><strong>2026 Nebula Awards</strong> — Saturday, <strong>June 6, 2026</strong> at the SFWA conference in Chicago · <a href="https://events.sfwa.org/" target="_blank" rel="noopener">events.sfwa.org</a> · <a href="https://en.wikipedia.org/wiki/Nebula_Award" target="_blank" rel="noopener">Nebula on Wikipedia</a></li>
      <li><strong>2026 Hugo Awards</strong> — Sunday, <strong>August 30, 2026</strong> at LAcon V (84th WorldCon) in Anaheim · <a href="https://www.thehugoawards.org/" target="_blank" rel="noopener">thehugoawards.org</a> · <a href="https://www.lacon.org/hugos/" target="_blank" rel="noopener">lacon.org/hugos</a></li>
    </ul>
    <p style="color: var(--muted); font-size: 13px;">Hugo finalists this year were <a href="https://www.thehugoawards.org/2026/04/2026-hugo-award-lodestar-award-and-astounding-finalists-announced/" target="_blank" rel="noopener">announced April 21, 2026</a>. Voting closes August 8.</p>
    <h2>Source</h2>
    <p>The project lives on <a href="https://github.com/TomGarske/mount-readmore" target="_blank">GitHub</a>.</p>
  </div>`;
}

function showView(name) {
  $$('.view').forEach(v => v.classList.add('hidden'));
  $(`#view-${name}`).classList.remove('hidden');
  $$('.nav a').forEach(a => a.classList.toggle('active', a.dataset.route === name));
}

function resetFilterState() {
  state.search = '';
  state.readTom = 'all';
  state.readNika = 'all';
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
  const readTom = params.get('readTom');
  if (readTom) state.readTom = readTom;
  syncFiltersToDom();
}

function syncFiltersToDom() {
  $('#search').value = state.search;
  $('#year-min').value = state.yearMin == null ? '' : String(state.yearMin);
  $('#year-max').value = state.yearMax == null ? '' : String(state.yearMax);
  $$('input[name="read-tom"]').forEach(el => { el.checked = el.value === state.readTom; });
  $$('input[name="read-nika"]').forEach(el => { el.checked = el.value === state.readNika; });
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
  if (path === '#/about') {
    renderAbout();
    showView('about');
    window.scrollTo(0, 0);
    return;
  }
  renderStats();
  showView('stats');
  window.scrollTo(0, 0);
}

function wireFilters() {
  $('#search').addEventListener('input', e => { state.search = e.target.value.trim(); renderList(); });
  $$('input[name="read-tom"]').forEach(el => el.addEventListener('change', e => { state.readTom = e.target.value; renderList(); }));
  $$('input[name="read-nika"]').forEach(el => el.addEventListener('change', e => { state.readNika = e.target.value; renderList(); }));
  $$('input[name="read-westdac"]').forEach(el => el.addEventListener('change', e => { state.readWestdac = e.target.value; renderList(); }));
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
      search: '', readTom: 'all', readNika: 'all', readWestdac: 'all',
      awards: new Set(Object.keys(AWARD_LABELS)),
      statuses: new Set(['winner', 'nominee']),
      categories: new Set(['Novel', 'Novella', 'Novelette']),
      yearMin: null, yearMax: null, sort: 'year-desc',
    };
    $('#search').value = '';
    $('#year-min').value = '';
    $('#year-max').value = '';
    $('input[name="read-tom"][value="all"]').checked = true;
    $('input[name="read-nika"][value="all"]').checked = true;
    $('input[name="read-westdac"][value="all"]').checked = true;
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

async function init() {
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
  window.addEventListener('hashchange', () => { applySoloUI(); route(); });
  route();
}

init();
