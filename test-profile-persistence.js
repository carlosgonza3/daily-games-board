// Regression tests for the remembered-profile contract.
// These execute the storage helpers directly from template.html so the test
// fails if production behavior changes without updating the contract.
const assert = require('node:assert/strict');
const fs = require('node:fs');

const template = fs.readFileSync('template.html', 'utf8');

function extractFunction(name) {
  const marker = `function ${name}(`;
  const start = template.indexOf(marker);
  assert.notEqual(start, -1, `${name} must exist in template.html`);

  const bodyStart = template.indexOf('{', start);
  let depth = 0;
  for (let i = bodyStart; i < template.length; i += 1) {
    if (template[i] === '{') depth += 1;
    if (template[i] === '}') depth -= 1;
    if (depth === 0) return template.slice(start, i + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

function storageFor(backing) {
  return {
    getItem(key) { return backing.has(key) ? backing.get(key) : null; },
    setItem(key, value) { backing.set(key, String(value)); },
    removeItem(key) { backing.delete(key); },
  };
}

function productionStorageHelpers(localStorage) {
  const source = `${extractFunction('lsGet')}\n${extractFunction('lsSet')}\nreturn { lsGet, lsSet };`;
  return Function('localStorage', source)(localStorage);
}

const backing = new Map();
const firstPage = productionStorageHelpers(storageFor(backing));
const profile = { id: 'carlos', name: 'Carlos' };

firstPage.lsSet('dgb.me', profile);
assert.deepEqual(firstPage.lsGet('dgb.me'), profile, 'selected profile is stored immediately');

// A reload/new day creates fresh application state but retains browser storage.
const reloadedPage = productionStorageHelpers(storageFor(backing));
assert.deepEqual(reloadedPage.lsGet('dgb.me'), profile, 'selected profile survives a fresh page session');

// The profile key is global to the board, not scoped to a calendar day.
for (const day of ['2026-10-28', '2026-10-29', '2027-01-01']) {
  const session = productionStorageHelpers(storageFor(backing));
  assert.deepEqual(session.lsGet('dgb.me'), profile, `selected profile remains available on ${day}`);
}

assert.match(
  template,
  /function setMe\(p\)\s*\{\s*state\.me = p;\s*lsSet\('dgb\.me', p\);/,
  'selecting a profile must persist it under dgb.me',
);
assert.match(
  template,
  /function boot\(\)\s*\{\s*state\.me = lsGet\('dgb\.me'\);/,
  'startup must restore the remembered profile',
);
assert.doesNotMatch(template, /removeItem\(['"]dgb\.me['"]\)/, 'normal app code must not clear the profile');

console.log('all profile persistence tests passed');
