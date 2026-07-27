#!/usr/bin/env node

/**
 * Presentation-contract check for the iPhone shell.
 *
 * This intentionally avoids browser automation and application data. It verifies
 * that the mobile entry point keeps the structural hooks required by the visual
 * polish branch without touching authentication, Firestore, routing, or jobs.
 *
 * Run from the repository root:
 *   node scripts/check-mobile-ui-contract.mjs
 */

import { readFile } from 'node:fs/promises';

const htmlPath = new URL('../iphone.html', import.meta.url);
const html = await readFile(htmlPath, 'utf8');
const failures = [];

function requireMatch(description, pattern) {
  if (!pattern.test(html)) failures.push(description);
}

requireMatch(
  'viewport must retain viewport-fit=cover for iPhone safe areas',
  /<meta\s+name=["']viewport["'][^>]*content=["'][^"']*viewport-fit=cover/i,
);
requireMatch(
  'mobile theme color must remain defined',
  /<meta\s+name=["']theme-color["'][^>]*content=["']#071018["']/i,
);
requireMatch(
  'loading state must remain announced to assistive technology',
  /id=["']loading["'][^>]*role=["']status["'][^>]*aria-live=["']polite["']/i,
);
requireMatch(
  'iframe must retain an accessible title',
  /<iframe\b[^>]*id=["']phoneApp["'][^>]*title=["'][^"']+["']/i,
);
requireMatch(
  'mobile mode class must still be applied to the embedded application',
  /classList\.add\([^)]*["']iphone-field-mode["']/,
);

for (const stylesheet of ['iphone.css', 'iphone-polish.css', 'iphone-finish.css']) {
  if (!html.includes(`'${stylesheet}'`) && !html.includes(`"${stylesheet}"`)) {
    failures.push(`${stylesheet} must remain loaded by iphone.html`);
  }
}

const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]);
const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
if (duplicates.length) {
  failures.push(`duplicate static IDs found: ${duplicates.join(', ')}`);
}

if (failures.length) {
  console.error('Mobile UI contract check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('Mobile UI contract check passed.');
}
