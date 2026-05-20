// Cloudflare Pages Function: serve the SPA shell at /books/<id> with
// book-specific Open Graph tags so link previews (Slack, iMessage, Twitter/X,
// Discord, LinkedIn, Facebook) show the cover + title + author instead of the
// generic homepage card.
//
// Humans get the same SPA they'd get elsewhere — the JS in index.html notices
// the /books/<id> pathname on bootstrap and renders the book detail. Bots
// parse the meta tags before any JS runs, so they see the rich preview.
//
// On unknown ids we fall through to the unmodified shell (default OG tags).

const escapeAttr = (s) => String(s || '')
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

function stripHtml(s) {
  return String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function buildDescription(book) {
  const parts = [];
  const author = (book.authors && book.authors[0]) || book.author_raw || '';
  const cat = book.category || '';
  const year = book.year || '';
  if (cat && year) parts.push(`${cat} · ${year}`);
  const awardBits = Object.entries(book.awards || {}).map(([a, s]) => {
    const label = a === 'hugo' ? 'Hugo' : a === 'nebula' ? 'Nebula' : a;
    return `${label} ${s === 'winner' ? 'Winner' : 'Nominee'}`;
  });
  if (awardBits.length) parts.push(awardBits.join(' · '));
  const header = parts.join(' — ');
  const desc = stripHtml(book.description || '').slice(0, 240);
  if (header && desc) return `${header}. ${desc}`;
  return header || desc || (author ? `By ${author}.` : 'A Hugo/Nebula short fiction or novel.');
}

export async function onRequest({ params, env, request }) {
  const url = new URL(request.url);
  const origin = url.origin;
  const bookId = String(params.id || '');

  // Always fetch the SPA shell from the deployed asset set. We mutate the
  // string and return it; on errors we just return what came back.
  const htmlResp = await env.ASSETS.fetch(new Request(origin + '/index.html'));
  let html = await htmlResp.text();

  let book = null;
  try {
    const dataResp = await env.ASSETS.fetch(new Request(origin + '/data.json'));
    if (dataResp.ok) {
      const data = await dataResp.json();
      book = (data.books || []).find(b => b.id === bookId) || null;
    }
  } catch (_) { /* ignore — fall through to default OG */ }

  if (book) {
    const author = (book.authors && book.authors[0]) || book.author_raw || '';
    const titleBase = author ? `${book.title} — ${author}` : book.title;
    const title = `${titleBase} · Readmore SFF`;
    const desc = buildDescription(book);
    const imgUrl = book.cover_url || `${origin}/preview.png`;
    const canonicalUrl = `${origin}/books/${bookId}`;
    const isCustomCover = !!book.cover_url;

    const tEscaped = escapeAttr(title);
    const dEscaped = escapeAttr(desc);
    const uEscaped = escapeAttr(canonicalUrl);
    const iEscaped = escapeAttr(imgUrl);

    html = html
      .replace(/<title>[^<]*<\/title>/i, `<title>${tEscaped}</title>`)
      .replace(/<meta name="description" content="[^"]*"\s*\/?>/i,
        `<meta name="description" content="${dEscaped}">`)
      .replace(/<meta property="og:title" content="[^"]*"\s*\/?>/i,
        `<meta property="og:title" content="${tEscaped}">`)
      .replace(/<meta property="og:description" content="[^"]*"\s*\/?>/i,
        `<meta property="og:description" content="${dEscaped}">`)
      .replace(/<meta property="og:url" content="[^"]*"\s*\/?>/i,
        `<meta property="og:url" content="${uEscaped}">`)
      .replace(/<meta property="og:image" content="[^"]*"\s*\/?>/i,
        `<meta property="og:image" content="${iEscaped}">`)
      .replace(/<meta name="twitter:title" content="[^"]*"\s*\/?>/i,
        `<meta name="twitter:title" content="${tEscaped}">`)
      .replace(/<meta name="twitter:description" content="[^"]*"\s*\/?>/i,
        `<meta name="twitter:description" content="${dEscaped}">`)
      .replace(/<meta name="twitter:image" content="[^"]*"\s*\/?>/i,
        `<meta name="twitter:image" content="${iEscaped}">`);

    // Cover images are portrait, not 1200x630. Drop the width/height/alt hints
    // and switch the Twitter card to "summary" so X doesn't crop to widescreen.
    if (isCustomCover) {
      html = html
        .replace(/<meta property="og:image:width" content="\d+"\s*\/?>\s*/i, '')
        .replace(/<meta property="og:image:height" content="\d+"\s*\/?>\s*/i, '')
        .replace(/<meta property="og:image:alt" content="[^"]*"\s*\/?>/i,
          `<meta property="og:image:alt" content="Cover of ${escapeAttr(book.title)}">`)
        .replace(/<meta name="twitter:card" content="summary_large_image"\s*\/?>/i,
          `<meta name="twitter:card" content="summary">`);
    }
  }

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=UTF-8',
      // Short cache — covers + descriptions update with every data.json rebuild.
      'Cache-Control': 'public, max-age=300, must-revalidate',
    },
  });
}
