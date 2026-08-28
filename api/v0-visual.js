const SOURCE = 'https://chill-pros-operation-ceneter-v2.vercel.app';

export default async function handler(req, res) {
  try {
    const response = await fetch(`${SOURCE}/`, {
      headers: { 'user-agent': 'ChillProsCanonicalVisualProxy/1.0' },
    });
    if (!response.ok) {
      res.status(response.status).send('Approved Operations Center visual source is unavailable.');
      return;
    }

    let html = await response.text();

    // Keep the browser on the Chill Pros recovery origin while loading the exact
    // preserved v0 markup/assets. Do not regenerate or reinterpret the UI.
    html = html
      .replace(/(src|href)="\/(?!\/)/g, `$1="${SOURCE}/`)
      .replace(/(src|href)='\/(?!\/)/g, `$1='${SOURCE}/`)
      .replace(/"\/_next\//g, `"${SOURCE}/_next/`)
      .replace(/'\/_next\//g, `'${SOURCE}/_next/`)
      .replace('</head>', '<meta name="chill-pros-visual-contract" content="dpl_FUSXSKKJ2USpEMMf4q1nCQR6qQ3T"></head>');

    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.setHeader('cache-control', 'no-store, max-age=0');
    res.setHeader('x-chill-pros-visual-source', 'dpl_FUSXSKKJ2USpEMMf4q1nCQR6qQ3T');
    res.status(200).send(html);
  } catch (error) {
    res.status(502).send(`Unable to load approved Operations Center visual source: ${error?.message || 'unknown error'}`);
  }
}
