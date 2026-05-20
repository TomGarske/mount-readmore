// Pages Function: serve the SPA shell at /authors/<name> with author-specific
// Open Graph tags (name, award tally, a representative cover) so link previews
// are meaningful. Unknown authors fall through to the default homepage OG.

import { fetchShell, fetchData, injectOg, htmlResponse } from '../_lib/og.js';

export async function onRequest({ params, env, request }) {
  const origin = new URL(request.url).origin;
  const name = decodeURIComponent(String(params.name || ''));
  let html = await fetchShell(env, origin);

  const data = await fetchData(env, origin);
  const books = data
    ? (data.books || []).filter(b => (b.authors || []).some(a => a.toLowerCase() === name.toLowerCase()))
    : [];

  if (books.length) {
    const isWin = b => Object.values(b.awards || {}).includes('winner');
    const wins = books.filter(isWin).length;
    const noms = books.length - wins;
    const bits = [];
    if (wins) bits.push(`${wins} win${wins === 1 ? '' : 's'}`);
    if (noms) bits.push(`${noms} nomination${noms === 1 ? '' : 's'}`);
    bits.push(`${books.length} book${books.length === 1 ? '' : 's'} on the Hugo + Nebula list`);
    // Representative cover: a winner with a cover, else any book with a cover.
    const cover = (books.find(b => isWin(b) && b.cover_url) || books.find(b => b.cover_url) || {}).cover_url;
    // Use the canonical-cased name from the data rather than the URL casing.
    const displayName = (books[0].authors || []).find(a => a.toLowerCase() === name.toLowerCase()) || name;

    html = injectOg(html, {
      title: `${displayName} · Readmore SFF`,
      description: `${displayName} — ${bits.join(' · ')}.`,
      url: `${origin}/authors/${encodeURIComponent(displayName)}`,
      image: cover || `${origin}/preview.png`,
      summaryCard: !!cover,
      imageAlt: `Books by ${displayName}`,
    });
  }
  return htmlResponse(html);
}
