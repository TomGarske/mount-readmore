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
  categories: new Set(['Novel', 'Novella', 'Novelette', 'Series']),
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
  const bookAwards = Object.keys(book.awards || {});
  if (!bookAwards.some(a => state.awards.has(a))) return false;
  const bookStatuses = Object.values(book.awards || {});
  if (!bookStatuses.some(s => state.statuses.has(s))) return false;
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
  const tomLine = book.tom ? `<dt>Tom</dt><dd><span class="badge ${tomRs === 'read' ? 'read' : 'queued'}">${escapeHtml(book.tom)}</span>${book.tom_date_read ? ` · ${escapeHtml(book.tom_date_read)}` : ''}</dd>` : '';
  const nikaLine = book.nika ? `<dt>Nika</dt><dd><span class="badge ${nikaRs === 'read' ? 'read' : 'queued'} reader-n">${escapeHtml(book.nika)}</span></dd>` : '';
  const publisherLine = book.publisher ? `<dt>Publisher</dt><dd>${escapeHtml(book.publisher)}</dd>` : '';

  const searchQ = encodeURIComponent(`${book.title} ${book.authors[0] || ''}`);
  const coverUrl = book.cover_url || '';
  const coverHtml = coverUrl
    ? `<img src="${escapeHtml(coverUrl)}" alt="Cover of ${escapeHtml(book.title)}" loading="lazy">`
    : '📖';

  root.innerHTML = `<div class="detail">
    <a href="#/" class="back">← back to list</a>
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
          ${nikaLine}
        </dl>
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
  const total = DATA.books.length;
  const tomRead = DATA.books.filter(b => readStatus(b, 'tom') === 'read');
  const nikaRead = DATA.books.filter(b => readStatus(b, 'nika') === 'read');
  const bothRead = DATA.books.filter(b => readStatus(b, 'tom') === 'read' && readStatus(b, 'nika') === 'read');
  const eitherRead = DATA.books.filter(b => readStatus(b, 'tom') === 'read' || readStatus(b, 'nika') === 'read');
  const read = tomRead.length;
  const started = DATA.books.filter(b => readStatus(b, 'tom') === 'started').length;

  const byAward = {};
  for (const a of Object.keys(AWARD_LABELS)) byAward[a] = { total: 0, tom: 0, nika: 0 };
  for (const b of DATA.books) {
    for (const a of Object.keys(b.awards || {})) {
      byAward[a].total++;
      if (readStatus(b, 'tom') === 'read') byAward[a].tom++;
      if (readStatus(b, 'nika') === 'read') byAward[a].nika++;
    }
  }
  const byCategory = {};
  for (const b of DATA.books) {
    byCategory[b.category] = byCategory[b.category] || { total: 0, tom: 0, nika: 0 };
    byCategory[b.category].total++;
    if (readStatus(b, 'tom') === 'read') byCategory[b.category].tom++;
    if (readStatus(b, 'nika') === 'read') byCategory[b.category].nika++;
  }
  const winners = DATA.books.filter(b => Object.values(b.awards || {}).includes('winner'));
  const winnersRead = winners.filter(b => readStatus(b, 'tom') === 'read').length;
  const winnersReadNika = winners.filter(b => readStatus(b, 'nika') === 'read').length;

  const dated = tomRead.filter(b => b.tom_date_read && /^\d{4}/.test(b.tom_date_read))
    .map(b => ({ ...b, _t: new Date(b.tom_date_read.replace(/-/g, '/')) }))
    .sort((a, b) => b._t - a._t);

  // Reading pace: books per year over the last 5 years (longer window since dated reads are sparse)
  const now = new Date();
  const windowYears = 5;
  const windowStart = new Date(now.getFullYear() - windowYears, now.getMonth(), 1);
  const recentReads = dated.filter(b => b._t >= windowStart);
  const monthsCovered = windowYears * 12;
  const perMonth = recentReads.length / monthsCovered;
  const perYear = perMonth * 12;

  // ETA at current pace
  const remaining = total - read;
  const remainingWinners = winners.length - winnersRead;
  const yearsToComplete = perYear > 0 ? remaining / perYear : null;
  const yearsForWinners = perYear > 0 ? remainingWinners / perYear : null;

  const card = (h, v, sub, pct) => `<div class="stat-card">
    <h3>${h}</h3>
    <div class="stat-value">${v}</div>
    <div class="stat-sub">${sub}</div>
    ${pct != null ? `<div class="progress"><div class="progress-bar" style="width: ${Math.min(100, pct)}%"></div></div>` : ''}
  </div>`;

  // Reads-per-publish-year bars (last ~25 years, since older years have spotty Date Read data)
  const yearStart = Math.min(...DATA.books.map(b => b.year).filter(y => y));
  const yearEnd = Math.max(...DATA.books.map(b => b.year).filter(y => y));
  const yearBuckets = {};
  for (let y = yearStart; y <= yearEnd; y++) yearBuckets[y] = { total: 0, read: 0 };
  for (const b of DATA.books) {
    if (b.year && yearBuckets[b.year]) {
      yearBuckets[b.year].total++;
      if (readStatus(b, 'tom') === 'read') yearBuckets[b.year].read++;
    }
  }
  // Render bars from the last 30 award years
  const recentYears = Object.entries(yearBuckets)
    .map(([y, v]) => [parseInt(y, 10), v])
    .filter(([y]) => y >= yearEnd - 29 && y <= yearEnd)
    .sort((a, b) => a[0] - b[0]);
  const maxBucket = Math.max(1, ...recentYears.map(([, v]) => v.total));
  const yearBarsHtml = recentYears.map(([y, v]) => {
    const totalH = (v.total / maxBucket) * 100;
    const readH = v.total > 0 ? (v.read / v.total) * totalH : 0;
    return `<div class="year-bar empty" style="height: ${totalH}%;">
      <div class="year-bar-tooltip">${y}: ${v.read}/${v.total} read</div>
      <div style="position:absolute;bottom:0;left:0;right:0;height:${(v.read/Math.max(1,v.total))*100}%;background:var(--accent);border-radius:3px 3px 0 0;"></div>
    </div>`;
  }).join('');

  // Up-next: recent winners not yet read by either, sorted by award year desc
  const upNext = DATA.books
    .filter(b => Object.values(b.awards || {}).includes('winner') && readStatus(b, 'tom') !== 'read' && readStatus(b, 'nika') !== 'read')
    .sort((a, b) => (b.year || 0) - (a.year || 0))
    .slice(0, 8);

  const recentReadsHtml = dated.slice(0, 8).map(b => {
    const coverHtml = b.cover_url
      ? `<img src="${escapeHtml(b.cover_url)}" alt="" loading="lazy">`
      : '📖';
    return `<div class="recent-read" data-id="${escapeHtml(b.id)}">
      <div class="recent-read-cover">${coverHtml}</div>
      <div class="recent-read-info">
        <div class="rr-title">${escapeHtml(b.title)}</div>
        <div class="rr-meta">${escapeHtml(b.authors[0] || '')} · read ${escapeHtml(b.tom_date_read)}</div>
      </div>
    </div>`;
  }).join('');

  const upNextHtml = upNext.map(b => {
    const coverHtml = b.cover_url
      ? `<img src="${escapeHtml(b.cover_url)}" alt="" loading="lazy">`
      : '📖';
    const awardNames = Object.entries(b.awards).filter(([, s]) => s === 'winner').map(([a]) => AWARD_LABELS[a]).join(' · ');
    return `<div class="recent-read" data-id="${escapeHtml(b.id)}">
      <div class="recent-read-cover">${coverHtml}</div>
      <div class="recent-read-info">
        <div class="rr-title">${escapeHtml(b.title)}</div>
        <div class="rr-meta">${escapeHtml(b.authors[0] || '')} · ${b.year} ${awardNames} winner</div>
      </div>
    </div>`;
  }).join('');

  const fmtYears = y => y == null ? 'unknown pace' : y > 100 ? `${Math.round(y)} years (yikes)` : `${y.toFixed(1)} years`;
  const lastReadDate = dated[0] ? dated[0].tom_date_read : 'none';

  const root = $('#view-stats');
  root.innerHTML = `<div class="detail">
    <h1>Progress</h1>

    <div class="headline-grid">
      ${card('Books on the list', total, `${winners.length} winners · ${total - winners.length} nominees`)}
      ${card('Tom read', read, `${(read / total * 100).toFixed(1)}% of list`, read / total * 100)}
      ${card('Nika read', nikaRead.length, `${(nikaRead.length / total * 100).toFixed(1)}% of list`, nikaRead.length / total * 100)}
      ${card('Both read', bothRead.length, `${eitherRead.length} read by either`)}
    </div>

    <div class="headline-grid" style="margin-top: 12px;">
      ${card('Tom: winners read', winnersRead, `${(winnersRead / winners.length * 100).toFixed(1)}% of winners`, winnersRead / winners.length * 100)}
      ${card('Nika: winners read', winnersReadNika, `${(winnersReadNika / winners.length * 100).toFixed(1)}% of winners`, winnersReadNika / winners.length * 100)}
      ${card('Tom queued / started', started, 'on the to-read pile')}
    </div>

    <div class="eta-card">
      <div class="eta-headline">At your recent pace of ${perYear.toFixed(1)} award books/year…</div>
      <div class="eta-sub">based on ${recentReads.length} reads from this list in the last ${windowYears} years · only counting Goodreads entries with a Date Read · last dated read: ${lastReadDate}</div>
      <ul>
        <li>Read everything (${remaining} books left): <strong>${fmtYears(yearsToComplete)}</strong></li>
        <li>Read just remaining winners (${remainingWinners} left): <strong>${fmtYears(yearsForWinners)}</strong></li>
        <li>Read 1 winner per month → done with winners in <strong>${(remainingWinners / 12).toFixed(1)} years</strong></li>
        <li>Read 1 book from this list per month → done in <strong>${(remaining / 12).toFixed(1)} years</strong></li>
      </ul>
    </div>

    <div class="progress-section">
      <h2>Coverage by award year (last 30 years)</h2>
      <p style="color: var(--muted); font-size: 13px;">Each bar = number of nominees+winners that year, filled portion = books you've read. Hover for details.</p>
      <div class="year-bars">${yearBarsHtml}</div>
      <div class="year-axis"><span>${recentYears[0] ? recentYears[0][0] : ''}</span><span>${yearEnd}</span></div>
    </div>

    ${dated.length > 0 ? `<div class="progress-section">
      <h2>Recent reads from this list</h2>
      <div class="recent-reads">${recentReadsHtml}</div>
    </div>` : ''}

    ${upNext.length > 0 ? `<div class="progress-section">
      <h2>Up next — recent winners you haven't read</h2>
      <div class="recent-reads">${upNextHtml}</div>
    </div>` : ''}

    <div class="progress-section">
      <h2>By award</h2>
      <div class="stats-grid">
        ${Object.entries(byAward).map(([a, s]) => s.total > 0
          ? card(AWARD_LABELS[a], `${s.tom} / ${s.total}`,
              `Tom: ${Math.round(s.tom / s.total * 100)}% · Nika: ${s.nika} (${Math.round(s.nika / s.total * 100)}%)`,
              s.tom / s.total * 100)
          : '').join('')}
      </div>
    </div>

    <div class="progress-section">
      <h2>By category</h2>
      <div class="stats-grid">
        ${Object.entries(byCategory).map(([c, s]) =>
          card(c, `${s.tom} / ${s.total}`,
            `Tom: ${Math.round(s.tom / s.total * 100)}% · Nika: ${s.nika} (${Math.round(s.nika / s.total * 100)}%)`,
            s.tom / s.total * 100)
        ).join('')}
      </div>
    </div>
  </div>`;

  // Wire up clicks on recent-read tiles
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
    <h2>Update cadence</h2>
    <p>New winners are added when they're announced. Hugo Awards are presented at the World Science Fiction Convention each August; Nebulas are announced at the SFWA conference in May or June.</p>
    <h2>Source</h2>
    <p>The project lives on <a href="https://github.com/TomGarske/mount-readmore" target="_blank">GitHub</a>.</p>
  </div>`;
}

function showView(name) {
  $$('.view').forEach(v => v.classList.add('hidden'));
  $(`#view-${name}`).classList.remove('hidden');
  $$('.nav a').forEach(a => a.classList.toggle('active', a.dataset.route === name));
}

function route() {
  const h = location.hash || '#/';
  if (h.startsWith('#/book/')) {
    const id = h.slice('#/book/'.length);
    renderDetail(id);
    showView('detail');
    window.scrollTo(0, 0);
    return;
  }
  if (h === '#/stats') {
    renderStats();
    showView('stats');
    window.scrollTo(0, 0);
    return;
  }
  if (h === '#/about') {
    renderAbout();
    showView('about');
    window.scrollTo(0, 0);
    return;
  }
  showView('list');
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
      categories: new Set(['Novel', 'Novella', 'Novelette', 'Series']),
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
