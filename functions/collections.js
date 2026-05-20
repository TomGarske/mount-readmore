// Pages Function: serve the SPA shell at /collections with a Collections-
// specific Open Graph card so the page previews as more than the generic
// homepage. Uses the landscape preview image (summary_large_image card).

import { fetchShell, injectOg, htmlResponse } from './_lib/og.js';

export async function onRequest({ env, request }) {
  const origin = new URL(request.url).origin;
  let html = await fetchShell(env, origin);
  html = injectOg(html, {
    title: 'Collections · Readmore SFF',
    description: 'Curated views of the Hugo + Nebula canon — Retro Hugos, Hugo/Nebula double winners, the genre magazines that published the field, and books grouped by genre.',
    url: `${origin}/collections`,
    image: `${origin}/preview.png`,
    summaryCard: false,
  });
  return htmlResponse(html);
}
