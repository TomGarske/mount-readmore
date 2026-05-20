// Pages Function: serve the SPA shell at /books/<id> with book-specific Open
// Graph tags so link previews show the cover + title + author. Humans get the
// same SPA (the JS routes /books/<id> to the book detail); bots read the meta
// tags. Unknown ids fall through to the default homepage OG.

import { fetchShell, fetchData, injectOg, stripHtml, htmlResponse } from '../_lib/og.js';

function buildDescription(book) {
  const parts = [];
  const cat = book.category || '';
  const year = book.year || '';
  if (cat && year) parts.push(`${cat} · ${year}`);
  const labels = { hugo: 'Hugo', nebula: 'Nebula', retro_hugo: 'Retro Hugo' };
  const awardBits = Object.entries(book.awards || {}).map(([a, s]) =>
    `${labels[a] || a} ${s === 'winner' ? 'Winner' : 'Nominee'}`);
  if (awardBits.length) parts.push(awardBits.join(' · '));
  const header = parts.join(' — ');
  const desc = stripHtml(book.description || '').slice(0, 240);
  if (header && desc) return `${header}. ${desc}`;
  const author = (book.authors && book.authors[0]) || book.author_raw || '';
  return header || desc || (author ? `By ${author}.` : 'A Hugo/Nebula novel or short fiction.');
}

export async function onRequest({ params, env, request }) {
  const origin = new URL(request.url).origin;
  const bookId = String(params.id || '');
  let html = await fetchShell(env, origin);

  const data = await fetchData(env, origin);
  const book = data && (data.books || []).find(b => b.id === bookId);

  if (book) {
    const author = (book.authors && book.authors[0]) || book.author_raw || '';
    const title = `${author ? `${book.title} — ${author}` : book.title} · Readmore SFF`;
    html = injectOg(html, {
      title,
      description: buildDescription(book),
      url: `${origin}/books/${bookId}`,
      image: book.cover_url || `${origin}/preview.png`,
      summaryCard: !!book.cover_url,
      imageAlt: `Cover of ${book.title}`,
    });
  }
  return htmlResponse(html);
}
