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
const commandCssPath = new URL('../iphone-command.css', import.meta.url);
const structureCssPath = new URL('../iphone-command-structure.css', import.meta.url);
const [html, commandCss, structureCss] = await Promise.all([
  readFile(htmlPath, 'utf8'),
  readFile(commandCssPath, 'utf8'),
  readFile(structureCssPath, 'utf8'),
]);
const failures = [];

function requireMatch(source, description, pattern) {
  if (!pattern.test(source)) failures.push(description);
}

requireMatch(
  html,
  'viewport must retain viewport-fit=cover for iPhone safe areas',
  /<meta\s+name=["']viewport["'][^>]*content=["'][^"']*viewport-fit=cover/i,
);
requireMatch(
  html,
  'mobile theme color must remain defined',
  /<meta\s+name=["']theme-color["'][^>]*content=["']#071018["']/i,
);
requireMatch(
  html,
  'loading state must remain announced to assistive technology',
  /id=["']loading["'][^>]*role=["']status["'][^>]*aria-live=["']polite["']/i,
);
requireMatch(
  html,
  'iframe must retain an accessible title',
  /<iframe\b[^>]*id=["']phoneApp["'][^>]*title=["'][^"']+["']/i,
);
requireMatch(
  html,
  'mobile mode class must still be applied to the embedded application',
  /classList\.add\([^)]*["']iphone-field-mode["']/,
);
requireMatch(
  html,
  'owner command-center banner must remain a semantic banner',
  /ownerStrip\.setAttribute\(["']role["'],["']banner["']\)/,
);
requireMatch(
  html,
  'More button must remain connected to the owner menu',
  /aria-controls="ownerMobileMenu"/,
);
requireMatch(
  html,
  'More button must announce that it opens additional controls',
  /aria-haspopup="true"/,
);
requireMatch(
  html,
  'owner tools must remain exposed as labeled navigation',
  /createElement\(["']nav["']\)[\s\S]*?aria-label["'],["']Owner tools["']/,
);
requireMatch(
  html,
  'owner menu must move focus into its first control when opened',
  /menuButtons\[0\]\?\.focus\(\)/,
);
requireMatch(
  html,
  'owner menu must retain Escape-key dismissal',
  /event\.key\s*===\s*["']Escape["']/,
);
requireMatch(
  html,
  'owner menu must retain keyboard focus containment',
  /event\.key\s*!==\s*["']Tab["'][\s\S]*?lastButton\.focus\(\)[\s\S]*?firstButton\.focus\(\)/,
);
requireMatch(
  html,
  'Direction C owner command-center setup must remain present',
  /setupCommandDashboard[\s\S]*?mobile-command-dashboard/,
);
requireMatch(
  html,
  'primary operations must retain Today’s Jobs and Office Queue ordering',
  /\[jobsCard, queueCard\][\s\S]*?mobile-command-primary/,
);
requireMatch(
  html,
  'owner metrics must retain an accessible label',
  /Owner operating metrics/,
);

for (const stylesheet of ['iphone.css', 'iphone-polish.css', 'iphone-finish.css', 'iphone-command.css', 'iphone-command-structure.css']) {
  if (!html.includes(`'${stylesheet}'`) && !html.includes(`"${stylesheet}"`)) {
    failures.push(`${stylesheet} must remain loaded by iphone.html`);
  }
}

requireMatch(
  commandCss,
  'mobile controls must retain a minimum 44px touch target',
  /button,[\s\S]*?\[role=["']button["']\][\s\S]*?min-height:\s*44px/,
);
requireMatch(
  commandCss,
  'mobile form controls must retain 16px text to avoid iOS focus zoom',
  /input,[\s\S]*?select,[\s\S]*?textarea[\s\S]*?font-size:\s*16px/,
);
requireMatch(
  commandCss,
  'safe-area top padding must remain applied to the owner strip',
  /owner-mobile-strip[\s\S]*?env\(safe-area-inset-top/,
);
requireMatch(
  commandCss,
  'KPI ribbon must retain contained horizontal scrolling',
  /metrics-grid[\s\S]*?overflow-x:\s*auto[\s\S]*?scroll-snap-type:\s*x\s+proximity/,
);
requireMatch(
  commandCss,
  'keyboard users must retain a visible focus treatment',
  /:focus-visible[\s\S]*?outline:\s*3px\s+solid/,
);
requireMatch(
  commandCss,
  'dense tables must remain horizontally contained on narrow screens',
  /table-wrap[\s\S]*?overflow-x:\s*auto/,
);
requireMatch(
  commandCss,
  'reduced-motion support must remain defined',
  /@media\(prefers-reduced-motion:reduce\)/,
);
requireMatch(
  commandCss,
  'forced-colors support must remain defined',
  /@media\(forced-colors:active\)/,
);
requireMatch(
  commandCss,
  'invalid form controls must retain a visible error state',
  /aria-invalid=["']true["']/,
);
requireMatch(
  structureCss,
  'primary mobile operations must remain a distinct command-center region',
  /mobile-command-primary[\s\S]*?display:\s*grid/,
);
requireMatch(
  structureCss,
  'quick actions must retain a compact two-column mobile layout',
  /mobile-quick-actions[\s\S]*?grid-template-columns:\s*1fr\s+1fr/,
);
requireMatch(
  structureCss,
  'Direction C structure must retain narrow-screen fallback behavior',
  /@media\(max-width:359px\)[\s\S]*?grid-template-columns:\s*1fr/,
);
requireMatch(
  structureCss,
  'Direction C structure must retain forced-colors support',
  /@media\(forced-colors:active\)/,
);

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
