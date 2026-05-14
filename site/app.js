'use strict';

const AWARD_LABELS = {
  hugo: 'Hugo',
  nebula: 'Nebula',
};

let DATA = { books: [], meta: {} };
let state = {
  search: '',
  readTom: 'all',
  readNika: 'all',
  awards: new Set(Object.keys(AWARD_LABELS)),
  statuses: new Set(['winner', 'nominee']),
  categories: new Set(['Novel', 'Novella', 'Novelette']),
  yearMin: null,
  yearMax: null,
  sort: 'year-desc',
};

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
  for (const [who, key] of [['tom', 'readTom'], ['nika', 'readNika']]) {
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
  const rs = readStatus(book, who);
  const initial = who === 'tom' ? 'T' : 'N';
  const cls = who === 'tom' ? 'reader-t' : 'reader-n';
  if (rs === 'read') {
    return `<span class="badge read ${cls}"><span class="reader-initial">${initial}</span>${escapeHtml(book[who])}</span>`;
  }
  if (rs === 'started') {
    return `<span class="badge queued ${cls}"><span class="reader-initial">${initial}</span>${escapeHtml(book[who])}</span>`;
  }
  return '';
}

function bookCard(book) {
  const awardBadges = Object.entries(book.awards || {})
    .filter(([a]) => state.awards.has(a))
    .map(([a, s]) => `<span class="badge ${s}">${AWARD_LABELS[a]} ${s === 'winner' ? '★' : ''}</span>`)
    .join('');
  const readBadges = readerBadge(book, 'tom') + readerBadge(book, 'nika');
  return `<div class="card" data-id="${escapeHtml(book.id)}">
    <div class="title">${escapeHtml(book.title)}</div>
    <div class="author">${escapeHtml(book.author_raw || (book.authors || []).join(', '))}</div>
    <div class="meta">
      <span>${book.year || ''}</span>
      <span class="badge cat">${escapeHtml(book.category)}</span>
    </div>
    <div class="badges">${awardBadges}${readBadges}</div>
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
  const tomLine = book.tom ? `<dt>Tom</dt><dd><span class="badge ${tomRs === 'read' ? 'read' : 'queued'}">${escapeHtml(book.tom)}</span></dd>` : '';
  const nikaLine = book.nika ? `<dt>Nika</dt><dd><span class="badge ${nikaRs === 'read' ? 'read' : 'queued'} reader-n">${escapeHtml(book.nika)}</span></dd>` : '';
  const publisherLine = book.publisher ? `<dt>Publisher</dt><dd>${escapeHtml(book.publisher)}</dd>` : '';

  const searchQ = encodeURIComponent(`${book.title} ${book.authors[0] || ''}`);
  const coverUrl = book.cover_url || '';
  const coverHtml = coverUrl
    ? `<img src="${escapeHtml(coverUrl)}" alt="Cover of ${escapeHtml(book.title)}" loading="lazy">`
    : '📖';

  const shelfLine = book.tom_shelf ? `<dt>On Tom's shelf</dt><dd><span class="badge ${book.tom_shelf === 'to-read' ? 'queued' : 'read'}">${book.tom_shelf}</span></dd>` : '';
  const addToShelfBtn = (!book.tom_shelf && tomRs !== 'read')
    ? `<a class="btn-primary" href="https://www.goodreads.com/search?q=${searchQ}" target="_blank" rel="noopener" title="Opens Goodreads search — click 'Want to Read' on the result">+ Add to Goodreads shelf</a>`
    : '';

  root.innerHTML = `<div class="detail">
    <a href="#/books" class="back">← back to books</a>
    <h1>${escapeHtml(book.title)}</h1>
    <div class="author-line">by ${escapeHtml(book.author_raw || book.authors.join(', '))}</div>
    <div class="detail-grid">
      <div class="detail-cover">${coverHtml}</div>
      <div class="detail-info">
        <dl>
          <dt>Category</dt><dd>${escapeHtml(book.category)}</dd>
          ${publisherLine}
          ${awardRows}
          ${tomLine}
          ${shelfLine}
          ${nikaLine}
        </dl>
        ${addToShelfBtn ? `<div style="margin-top: 16px;">${addToShelfBtn}</div>` : ''}
        <div class="detail-links">
          <a href="https://www.goodreads.com/search?q=${searchQ}" target="_blank" rel="noopener">Goodreads</a>
          <a href="https://app.thestorygraph.com/browse?search_term=${searchQ}" target="_blank" rel="noopener">StoryGraph</a>
          <a href="https://openlibrary.org/search?q=${searchQ}" target="_blank" rel="noopener">Open Library</a>
          <a href="https://en.wikipedia.org/w/index.php?search=${searchQ}" target="_blank" rel="noopener">Wikipedia</a>
        </div>
      </div>
    </div>
  </div>`;
}

function renderStats() {
  // Winners-only universe for the main stats
  const winners = DATA.books.filter(b => Object.values(b.awards || {}).includes('winner'));
  const winnersTotal = winners.length;
  const winnersTom = winners.filter(b => readStatus(b, 'tom') === 'read');
  const winnersNika = winners.filter(b => readStatus(b, 'nika') === 'read');
  const winnersBoth = winners.filter(b => readStatus(b, 'tom') === 'read' && readStatus(b, 'nika') === 'read');
  const winnersEither = winners.filter(b => readStatus(b, 'tom') === 'read' || readStatus(b, 'nika') === 'read');

  // Tom shelf overlap (books that are on his Goodreads to-read shelf AND in our list)
  const onShelf = DATA.books.filter(b => b.tom_shelf === 'to-read' && readStatus(b, 'tom') !== 'read');
  const currentlyReading = DATA.books.filter(b => b.tom_shelf === 'currently-reading');

  // "Books to go this year" — books with year = current calendar year that Tom hasn't read
  const currentYear = new Date().getFullYear();
  const thisYearAll = DATA.books.filter(b => b.year === currentYear);
  const thisYearWinners = thisYearAll.filter(b => Object.values(b.awards || {}).includes('winner'));
  const thisYearUnread = thisYearAll.filter(b => readStatus(b, 'tom') !== 'read');
  const thisYearWinnersUnread = thisYearWinners.filter(b => readStatus(b, 'tom') !== 'read');

  const byAward = {};
  for (const a of Object.keys(AWARD_LABELS)) byAward[a] = { total: 0, tom: 0, nika: 0 };
  for (const b of winners) {
    for (const a of Object.keys(b.awards || {})) {
      if (b.awards[a] !== 'winner') continue;
      byAward[a].total++;
      if (readStatus(b, 'tom') === 'read') byAward[a].tom++;
      if (readStatus(b, 'nika') === 'read') byAward[a].nika++;
    }
  }
  const byCategory = {};
  for (const b of winners) {
    byCategory[b.category] = byCategory[b.category] || { total: 0, tom: 0, nika: 0 };
    byCategory[b.category].total++;
    if (readStatus(b, 'tom') === 'read') byCategory[b.category].tom++;
    if (readStatus(b, 'nika') === 'read') byCategory[b.category].nika++;
  }

  const dated = winnersTom.filter(b => b.tom_date_read && /^\d{4}/.test(b.tom_date_read))
    .map(b => ({ ...b, _t: new Date(b.tom_date_read.replace(/-/g, '/')) }))
    .sort((a, b) => b._t - a._t);

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

  // Year bars — winners only
  const yearEnd = Math.max(...DATA.books.map(b => b.year).filter(y => y));
  const yearBuckets = {};
  for (let y = yearEnd - 29; y <= yearEnd; y++) yearBuckets[y] = { total: 0, read: 0 };
  for (const b of winners) {
    if (b.year && yearBuckets[b.year]) {
      yearBuckets[b.year].total++;
      if (readStatus(b, 'tom') === 'read') yearBuckets[b.year].read++;
    }
  }
  const recentYears = Object.entries(yearBuckets)
    .map(([y, v]) => [parseInt(y, 10), v])
    .sort((a, b) => a[0] - b[0]);
  const maxBucket = Math.max(1, ...recentYears.map(([, v]) => v.total));
  const yearBarsHtml = recentYears.map(([y, v]) => {
    const totalH = (v.total / maxBucket) * 100;
    return `<div class="year-bar empty" style="height: ${Math.max(2, totalH)}%;">
      <div class="year-bar-tooltip">${y}: ${v.read}/${v.total} winners read</div>
      <div style="position:absolute;bottom:0;left:0;right:0;height:${(v.read/Math.max(1,v.total))*100}%;background:var(--accent);border-radius:3px 3px 0 0;"></div>
    </div>`;
  }).join('');

  // Up Next: winners not read by Tom AND not on Tom's shelf, sorted by year desc
  const upNext = winners
    .filter(b => readStatus(b, 'tom') !== 'read' && !b.tom_shelf)
    .sort((a, b) => (b.year || 0) - (a.year || 0))
    .slice(0, 12);

  const tile = (b, metaLine) => {
    const coverHtml = b.cover_url
      ? `<img src="${escapeHtml(b.cover_url)}" alt="" loading="lazy">`
      : '📖';
    return `<div class="recent-read" data-id="${escapeHtml(b.id)}">
      <div class="recent-read-cover">${coverHtml}</div>
      <div class="recent-read-info">
        <div class="rr-title">${escapeHtml(b.title)}</div>
        <div class="rr-meta">${metaLine}</div>
      </div>
    </div>`;
  };

  const onShelfHtml = onShelf
    .sort((a, b) => (b.year || 0) - (a.year || 0))
    .map(b => tile(b, `${escapeHtml(b.authors[0] || '')} · ${b.year} ${Object.entries(b.awards).map(([a, s]) => `${AWARD_LABELS[a]}${s === 'winner' ? ' ★' : ''}`).join(' · ')}`))
    .join('');

  const upNextHtml = upNext.map(b => tile(b, `${escapeHtml(b.authors[0] || '')} · ${b.year} ${Object.entries(b.awards).filter(([, s]) => s === 'winner').map(([a]) => AWARD_LABELS[a]).join(' · ')} winner`)).join('');

  const recentReadsHtml = dated.slice(0, 12).map(b => tile(b, `${escapeHtml(b.authors[0] || '')} · ${b.year || ''}`)).join('');

  const root = $('#view-stats');
  root.innerHTML = `<div class="detail">
    <h1>Progress</h1>
    <p style="color: var(--muted); font-size: 14px; margin-top: -8px;">Counting <strong>winners only</strong> on this page. Browse all nominees on the Books tab.</p>

    <div class="headline-grid">
      ${card('Winners on the list', winnersTotal, 'Hugo + Nebula combined')}
      ${card('Tom read', winnersTom.length, `${(winnersTom.length / winnersTotal * 100).toFixed(1)}% of winners`, winnersTom.length / winnersTotal * 100)}
      ${card('Nika read', winnersNika.length, `${(winnersNika.length / winnersTotal * 100).toFixed(1)}% of winners`, winnersNika.length / winnersTotal * 100)}
      ${card('Both read', winnersBoth.length, `${winnersEither.length} read by either`)}
    </div>

    ${dated.length > 0 ? `<div class="progress-section">
      <h2>Recent winners Tom has read</h2>
      <div class="recent-reads">${recentReadsHtml}</div>
    </div>` : ''}

    <div class="eta-card">
      <div class="eta-headline">${currentYear} on Mount Readmore</div>
      <div class="eta-sub">${thisYearAll.length} books on the list this year (${thisYearWinners.length} winners · ${thisYearAll.length - thisYearWinners.length} nominees so far). Hugo winners announced Aug 30, Nebulas Jun 6.</div>
      <ul>
        <li>${currentYear} books Tom hasn't read: <strong>${thisYearUnread.length} of ${thisYearAll.length}</strong></li>
        <li>${currentYear} winners Tom hasn't read: <strong>${thisYearWinnersUnread.length} of ${thisYearWinners.length}</strong></li>
        <li>Currently reading: <strong>${currentlyReading.length === 0 ? 'none from this list' : currentlyReading.map(b => escapeHtml(b.title)).join(', ')}</strong></li>
      </ul>
    </div>

    ${onShelf.length > 0 ? `<div class="progress-section">
      <h2>On your shelf, not yet read (${onShelf.length})</h2>
      <p style="color: var(--muted); font-size: 13px;">Books from this list that are on your Goodreads to-read shelf.</p>
      <div class="recent-reads">${onShelfHtml}</div>
    </div>` : ''}

    ${upNext.length > 0 ? `<div class="progress-section">
      <h2>Up next — winners not on your shelf yet</h2>
      <p style="color: var(--muted); font-size: 13px;">Recent winners by publication year. Open a book to add it to your shelf.</p>
      <div class="recent-reads">${upNextHtml}</div>
    </div>` : ''}

    <div class="progress-section">
      <h2>Coverage by year (winners only · last 30 years)</h2>
      <p style="color: var(--muted); font-size: 13px;">Each bar = number of Hugo+Nebula winners that year, filled green = books Tom has read. Hover for details.</p>
      <div class="year-bars">${yearBarsHtml}</div>
      <div class="year-axis"><span>${recentYears[0] ? recentYears[0][0] : ''}</span><span>${yearEnd}</span></div>
    </div>

    <div class="progress-section">
      <h2>By award (winners)</h2>
      <p style="color: var(--muted); font-size: 13px;">Tap a card to see those winners in the Books tab.</p>
      <div class="stats-grid">
        ${Object.entries(byAward).map(([a, s]) => s.total > 0
          ? linkCard(`#/books?award=${a}&status=winner`, AWARD_LABELS[a], `${s.tom} / ${s.total}`,
              `Tom: ${Math.round(s.tom / s.total * 100)}% · Nika: ${s.nika} (${Math.round(s.nika / s.total * 100)}%)`,
              s.tom / s.total * 100)
          : '').join('')}
      </div>
    </div>

    <div class="progress-section">
      <h2>By category (winners)</h2>
      <p style="color: var(--muted); font-size: 13px;">Tap a card to see those winners in the Books tab.</p>
      <div class="stats-grid">
        ${Object.entries(byCategory).map(([c, s]) =>
          linkCard(`#/books?category=${encodeURIComponent(c)}&status=winner`, c, `${s.tom} / ${s.total}`,
            `Tom: ${Math.round(s.tom / s.total * 100)}% · Nika: ${s.nika} (${Math.round(s.nika / s.total * 100)}%)`,
            s.tom / s.total * 100)
        ).join('')}
      </div>
    </div>
  </div>`;

  $$('.recent-read', root).forEach(el => {
    el.addEventListener('click', () => { location.hash = `#/book/${el.dataset.id}`; });
  });
}

function renderAbout() {
  const root = $('#view-about');
  root.innerHTML = `<div class="about">
    <h1>About Mount Readmore</h1>
    <p>A personal reading mountain of Hugo and Nebula winners and finalists, tracking Tom's and Nika's progress side by side. Read status comes from a long-running spreadsheet plus Tom's Goodreads "read" shelf, matched by title and author.</p>
    <h2>How it works</h2>
    <p>A Python pipeline reads the awards spreadsheet and an exported Goodreads CSV, matches them up by title and author, and produces a static JSON the site reads. There's no backend, no tracking, no login — just a list of books rendered in the browser.</p>
    <h2>Upcoming award dates</h2>
    <ul>
      <li><strong>2026 Nebula Awards</strong> — Saturday, <strong>June 6, 2026</strong> at the SFWA conference in Chicago · <a href="https://nebulas.sfwa.org/" target="_blank" rel="noopener">nebulas.sfwa.org</a> · <a href="https://events.sfwa.org/" target="_blank" rel="noopener">events.sfwa.org</a></li>
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
      search: '', readTom: 'all', readNika: 'all',
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
    $$('input[name="award"]').forEach(el => el.checked = true);
    $$('input[name="status"]').forEach(el => el.checked = true);
    $$('input[name="category"]').forEach(el => el.checked = true);
    $('#sort').value = 'year-desc';
    renderList();
  });
}

async function init() {
  try {
    const res = await fetch('data.json');
    DATA = await res.json();
  } catch (e) {
    $('#grid').innerHTML = '<p>Failed to load data.</p>';
    return;
  }
  wireFilters();
  renderList();
  window.addEventListener('hashchange', route);
  route();
}

init();
