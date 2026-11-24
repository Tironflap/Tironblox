const FEATURES = [
  ['gamerscore', 'Badge gamerscore'],
  ['signature', 'Rarity signature'],
  ['shelf', 'Rarest shelf'],
  ['dossier', 'Badge dossier'],
  ['inventory', 'Inventory chips'],
  ['weather', 'Lobby weather'],
  ['ledger', 'Visit ledger'],
];

const toggles = document.getElementById('toggles');
const ledgerList = document.getElementById('ledger');
const clearLedger = document.getElementById('clear-ledger');
const clearCache = document.getElementById('clear-cache');
const armed = { ledger: 0, cache: 0 };

for (const feature of FEATURES) {
  const label = document.createElement('label');
  const text = document.createElement('span');
  text.textContent = feature[1];
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.dataset.feature = feature[0];
  input.addEventListener('change', async function () {
    const stored = await chrome.storage.local.get('tironSettings');
    const settings = stored.tironSettings || {};
    const features = Object.assign({}, settings.features || {});
    features[feature[0]] = input.checked;
    settings.features = features;
    await chrome.storage.local.set({ tironSettings: settings });
  });
  label.append(text, input);
  toggles.appendChild(label);
}

function renderLedger(ledger) {
  ledgerList.replaceChildren();
  const rows = Object.values(ledger || {}).sort(function (a, b) {
    return (b.lastSeen || 0) - (a.lastSeen || 0);
  }).slice(0, 6);
  if (!rows.length) {
    const item = document.createElement('li');
    item.className = 'empty';
    item.textContent = 'Game pages you open will show up here.';
    ledgerList.appendChild(item);
    return;
  }
  for (const row of rows) {
    const item = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = row.name || 'Game';
    const count = document.createElement('em');
    count.textContent = row.visits === 1 ? '1 time' : row.visits + ' times';
    item.append(name, count);
    ledgerList.appendChild(item);
  }
}

async function refresh() {
  const stored = await chrome.storage.local.get(['tironSettings', 'tironLedger']);
  const features = (stored.tironSettings && stored.tironSettings.features) || {};
  toggles.querySelectorAll('input').forEach(function (input) {
    const key = input.dataset.feature;
    input.checked = features[key] !== false;
  });
  renderLedger(stored.tironLedger);
}

function arm(button, key, label, action) {
  button.addEventListener('click', async function () {
    const now = Date.now();
    if (now - armed[key] > 3000) {
      armed[key] = now;
      button.textContent = 'Click again to clear';
      return;
    }
    armed[key] = 0;
    button.textContent = label;
    await action();
    refresh();
  });
}

arm(clearLedger, 'ledger', 'Clear visit ledger', function () {
  return chrome.storage.local.remove('tironLedger');
});

arm(clearCache, 'cache', 'Clear score cache', function () {
  return chrome.storage.local.remove(['tironBadgeCache', 'tironUserCache']);
});

chrome.storage.onChanged.addListener(refresh);
refresh();
