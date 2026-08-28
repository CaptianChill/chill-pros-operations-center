const SOURCE_ID = 'dpl_FUSXSKKJ2USpEMMf4q1nCQR6qQ3T';
const SOURCE = 'https://chill-pros-operation-ceneter-v2-qv0by9k5v-chill-pros.vercel.app';

export default async function handler(req, res) {
  try {
    const response = await fetch(`${SOURCE}/`, {
      headers: { 'user-agent': 'ChillProsCanonicalVisualProxy/4.0' },
      cache: 'no-store',
    });
    if (!response.ok) {
      res.status(response.status).send('Approved Operations Center visual source is unavailable.');
      return;
    }

    let html = await response.text();

    // SOURCE is the immutable Vercel deployment URL for SOURCE_ID. Do not replace it
    // with the mutable project alias. Preserve the approved v0 HTML/CSS/assets and
    // inject only scoped auth/billing/Chill Bro behavior after the v0 app has loaded.
    // Delaying the overlay runtime avoids mutating React-managed nodes during Next.js
    // hydration, which can otherwise cause a visually-correct SSR shell to break once
    // the browser takes over.
    const overlayBootstrap = `<script src="/canonical-auth.js?v=20260828-authretry1"></script><script src="/canonical-auth-retry.js?v=20260828-authretry1"></script><script>(function(){var boot=function(){requestAnimationFrame(function(){requestAnimationFrame(function(){setTimeout(function(){var s=document.createElement('script');s.src='/canonical-top-level.js?v=20260828-authretry1';s.dataset.cpHydrationSafe='1';document.body.appendChild(s);},0);});});};if(document.readyState==='complete'){boot();}else{window.addEventListener('load',boot,{once:true});}})();</script>`;

    html = html
      .replace(/(src|href)="\/(?!\/)/g, `$1="${SOURCE}/`)
      .replace(/(src|href)='\/(?!\/)/g, `$1='${SOURCE}/`)
      .replace(/"\/_next\//g, `"${SOURCE}/_next/`)
      .replace(/'\/_next\//g, `'${SOURCE}/_next/`)
      .replace('</head>', `<meta name="chill-pros-visual-contract" content="${SOURCE_ID}"><link rel="stylesheet" href="/canonical-overlay.css?v=20260828-authretry1"></head>`)
      .replace('</body>', `${overlayBootstrap}</body>`);

    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.setHeader('cache-control', 'no-store, max-age=0');
    res.setHeader('x-chill-pros-visual-source', SOURCE_ID);
    res.setHeader('x-chill-pros-render-mode', 'top-level-v0');
    res.setHeader('x-chill-pros-overlay-boot', 'post-load-hydration-safe');
    res.status(200).send(html);
  } catch (error) {
    res.status(502).send(`Unable to load approved Operations Center visual source: ${error?.message || 'unknown error'}`);
  }
}
