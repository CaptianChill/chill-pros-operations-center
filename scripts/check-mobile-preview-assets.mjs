#!/usr/bin/env node

/**
 * Static preview-readiness check for the iPhone owner shell.
 *
 * This verifies that every presentation asset injected by iphone.html exists,
 * is non-empty, is loaded once, and remains ordered from base styles through
 * Direction C structure styles. It does not access application data, Firebase,
 * authentication, or role routing.
 */

import { access, readFile, stat } from 'node:fs/promises';
import { constants } from 'node:fs';

const repoRoot = new URL('../', import.meta.url);
const htmlPath = new URL('../iphone.html', import.meta.url);
const html = await readFile(htmlPath, 'utf8');
const failures = [];

const requiredOrder = [
  'iphone.css',
  'iphone-polish.css',
  'iphone-finish.css',
  'iphone-command.css',
  'iphone-command-structure.css',
];

const loaderMatch = html.match(/\[([^\]]*iphone\.css[^\]]*)\]\.forEach\(href\s*=>/s);
if (!loaderMatch) {
  failures.push('iphone.html must retain the ordered mobile stylesheet loader');
} else {
  const loadedAssets = [...loaderMatch[1].matchAll(/["']([^"']+\.css)["']/g)].map((match) => match[1]);
  const duplicates = [...new Set(loadedAssets.filter((asset, index) => loadedAssets.indexOf(asset) !== index))];

  if (duplicates.length) failures.push(`duplicate mobile stylesheet references: ${duplicates.join(', ')}`);
  if (loadedAssets.join('|') !== requiredOrder.join('|')) {
    failures.push(`mobile stylesheets must load in this exact order: ${requiredOrder.join(' -> ')}`);
  }
}

for (const asset of requiredOrder) {
  const assetUrl = new URL(asset, repoRoot);
  try {
    await access(assetUrl, constants.R_OK);
    const assetStat = await stat(assetUrl);
    if (!assetStat.isFile() || assetStat.size < 100) {
      failures.push(`${asset} must exist as a non-empty stylesheet`);
    }
  } catch {
    failures.push(`${asset} is missing or unreadable`);
  }
}

for (const entryPoint of ['index.html', 'iphone.html']) {
  try {
    const entryStat = await stat(new URL(entryPoint, repoRoot));
    if (!entryStat.isFile() || entryStat.size < 100) failures.push(`${entryPoint} must be a non-empty file`);
  } catch {
    failures.push(`${entryPoint} is missing or unreadable`);
  }
}

if (!/frame\.src\s*=\s*`index\.html\?retry=\$\{Date\.now\(\)\}`/.test(html)) {
  failures.push('retry loading must retain a cache-busting timestamp');
}

if (failures.length) {
  console.error('Mobile preview asset readiness check failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log('Mobile preview asset readiness check passed.');
}
