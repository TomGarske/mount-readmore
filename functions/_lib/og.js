// Shared Open Graph injection for Cloudflare Pages Functions. Each route
// (books / authors / collections) fetches the SPA shell and rewrites its meta
// tags so link previews show page-specific title/description/image instead of
// the generic homepage card. Files under _lib are not treated as routes.

export const escapeAttr = (s) => String(s || '')
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

export function stripHtml(s) {
  return String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

// Fetch the deployed index.html shell.
export async function fetchShell(env, origin) {
  const resp = await env.ASSETS.fetch(new Request(origin + '/index.html'));
  return resp.text();
}

// Fetch + parse the deployed data.json (or null on failure).
export async function fetchData(env, origin) {
  try {
    const resp = await env.ASSETS.fetch(new Request(origin + '/data.json'));
    if (resp.ok) return await resp.json();
  } catch (_) { /* fall through */ }
  return null;
}

// Rewrite the shell's OG/Twitter/title/description tags from a config object:
//   { title, description, url, image, summaryCard, imageAlt }
// When summaryCard is true (portrait images like book covers), the Twitter
// card switches to "summary" and the 1200x630 width/height hints are dropped.
export function injectOg(html, { title, description, url, image, summaryCard, imageAlt }) {
  const t = escapeAttr(title);
  const d = escapeAttr(description);
  const u = escapeAttr(url);
  const i = escapeAttr(image);
  html = html
    .replace(/<title>[^<]*<\/title>/i, `<title>${t}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/i, `<meta name="description" content="${d}">`)
    .replace(/<meta property="og:title" content="[^"]*"\s*\/?>/i, `<meta property="og:title" content="${t}">`)
    .replace(/<meta property="og:description" content="[^"]*"\s*\/?>/i, `<meta property="og:description" content="${d}">`)
    .replace(/<meta property="og:url" content="[^"]*"\s*\/?>/i, `<meta property="og:url" content="${u}">`)
    .replace(/<meta property="og:image" content="[^"]*"\s*\/?>/i, `<meta property="og:image" content="${i}">`)
    .replace(/<meta name="twitter:title" content="[^"]*"\s*\/?>/i, `<meta name="twitter:title" content="${t}">`)
    .replace(/<meta name="twitter:description" content="[^"]*"\s*\/?>/i, `<meta name="twitter:description" content="${d}">`)
    .replace(/<meta name="twitter:image" content="[^"]*"\s*\/?>/i, `<meta name="twitter:image" content="${i}">`);
  if (summaryCard) {
    html = html
      .replace(/<meta property="og:image:width" content="\d+"\s*\/?>\s*/i, '')
      .replace(/<meta property="og:image:height" content="\d+"\s*\/?>\s*/i, '')
      .replace(/<meta property="og:image:alt" content="[^"]*"\s*\/?>/i,
        `<meta property="og:image:alt" content="${escapeAttr(imageAlt || title)}">`)
      .replace(/<meta name="twitter:card" content="summary_large_image"\s*\/?>/i,
        `<meta name="twitter:card" content="summary">`);
  }
  return html;
}

export function htmlResponse(html) {
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=UTF-8',
      // Short cache — data.json changes with each rebuild.
      'Cache-Control': 'public, max-age=300, must-revalidate',
    },
  });
}
