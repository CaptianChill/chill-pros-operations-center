#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const files = {
  html: new URL('../iphone.html', import.meta.url),
  command: new URL('../iphone-command.css', import.meta.url),
  structure: new URL('../iphone-command-structure.css', import.meta.url),
};

const [html, commandCss, structureCss] = await Promise.all([
  readFile(files.html, 'utf8'),
  readFile(files.command, 'utf8'),
  readFile(files.structure, 'utf8'),
]);

const failures = [];
const requirePattern = (source, message, pattern) => {
  if (!pattern.test(source)) failures.push(message);
};
const requireText = (source, message, text) => {
  if (!source.includes(text)) failures.push(message);
};

requirePattern(html, 'viewport-fit=cover must remain enabled', /viewport-fit=cover/i);
requirePattern(html, 'loading state must remain accessible', /id=["']loading["'][^>]*role=["']status["'][^>]*aria-live=["']polite["']/i);
requirePattern(html, 'retry control must remain available', /id=["']retryLoad["'][^>]*hidden/i);
requirePattern(html, 'load timeout must remain bounded at 12 seconds', /showLoadError[\s\S]*?12000/);
requirePattern(html, 'iframe must retain an accessible title', /<iframe[^>]*title=["'][^"']+["']/i);
requireText(html, 'iPhone mode hook must remain present', "iphone-field-mode");
requireText(html, 'owner banner role must remain present', "ownerStrip.setAttribute('role','banner')");
requireText(html, 'Owner tools navigation label must remain present', "ownerMenu.setAttribute('aria-label','Owner tools')");
requireText(html, 'closed owner menu must remain inert', 'ownerMenu.inert = true');
requireText(html, 'open owner menu must restore keyboard access', 'ownerMenu.inert = false');
requireText(html, 'Escape dismissal must remain present', "event.key === 'Escape'");
requireText(html, 'Tab containment must remain present', "event.key !== 'Tab'");
requireText(html, 'Direction C setup must remain present', 'setupCommandDashboard');
requireText(html, 'Today’s Jobs must remain a primary operation', 'jobsCard');
requireText(html, 'Office Queue must remain a primary operation', 'queueCard');
requireText(html, 'primary operations container must remain present', 'mobile-command-primary');
requireText(html, 'owner metrics label must remain present', 'Owner operating metrics');

for (const stylesheet of [
  'iphone.css',
  'iphone-polish.css',
  'iphone-finish.css',
  'iphone-command.css',
  'iphone-command-structure.css',
]) {
  requireText(html, `${stylesheet} must remain loaded`, stylesheet);
}

requirePattern(commandCss, '44px touch targets must remain defined', /min-height:\s*44px/);
requirePattern(commandCss, '16px form text must remain defined', /font-size:\s*16px/);
requirePattern(commandCss, 'safe-area top padding must remain defined', /safe-area-inset-top/);
requirePattern(commandCss, 'KPI ribbon must retain horizontal scrolling', /metrics-grid[\s\S]*?overflow-x:\s*auto/);
requirePattern(commandCss, 'visible focus treatment must remain defined', /:focus-visible[\s\S]*?outline:/);
requirePattern(commandCss, 'table overflow containment must remain defined', /table-wrap[\s\S]*?overflow-x:\s*auto/);
requirePattern(commandCss, 'reduced-motion support must remain defined', /prefers-reduced-motion:\s*reduce/);
requirePattern(commandCss, 'forced-colors support must remain defined', /forced-colors:\s*active/);
requirePattern(commandCss, 'invalid-control presentation must remain defined', /aria-invalid=["']true["']/);

requirePattern(structureCss, 'primary command region must remain a grid', /mobile-command-primary[\s\S]*?display:\s*grid/);
requirePattern(structureCss, 'quick actions must retain two columns', /mobile-quick-actions[\s\S]*?grid-template-columns:\s*1fr\s+1fr/);
requirePattern(structureCss, 'small-phone fallback must remain defined', /max-width:\s*359px/);
requirePattern(structureCss, 'structure forced-colors support must remain defined', /forced-colors:\s*active/);

const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]);
const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
if (duplicates.length) failures.push(`duplicate static IDs found: ${duplicates.join(', ')}`);

if (failures.length) {
  console.error('Mobile UI contract v2 failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Mobile UI contract v2 passed.');
