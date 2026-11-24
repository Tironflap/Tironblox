const USER_TTL = 20 * 60 * 1000;
const BADGE_TTL = 12 * 60 * 60 * 1000;
const VISIT_GAP = 30 * 60 * 1000;
const DEFAULT_FEATURES = {
  gamerscore: true,
  signature: true,
  shelf: true,
  dossier: true,
  inventory: true,
  weather: true,
  ledger: true,
};

let generation = 0;
let settingsState = null;
let observer = null;
let inventoryTimer = null;
let inventoryPoll = null;
const chips = new Set();

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function alive(gen) {
  return gen === generation;
}

async function loadSettings(gen) {
  const stored = await chrome.storage.local.get('tironSettings');
  if (gen != null && gen !== generation) return settingsState;
  const saved = stored.tironSettings || {};
  settingsState = {
    features: Object.assign({}, DEFAULT_FEATURES, saved.features || {}),
    collapsed: Boolean(saved.collapsed),
    anchor: saved.anchor || null,
  };
  return settingsState;
}

async function saveSettings(next) {
  settingsState = next;
  await chrome.storage.local.set({ tironSettings: next });
}

function classify(href) {
  let url;
  try { url = new URL(href); } catch (error) { return { kind: 'none' }; }
  const path = url.pathname;
  const badge = path.match(/\/badges\/(\d+)/);
  if (badge) return { kind: 'badge', id: badge[1] };
  const game = path.match(/\/games\/(\d+)/);
  if (game) return { kind: 'game', id: game[1] };
  const user = path.match(/\/users\/(\d+)/);
  if (!user) return { kind: 'none' };
  if (path.includes('/inventory')) return { kind: 'inventory', id: user[1] };
  if (/\/users\/\d+\/?$/.test(path) || /\/users\/\d+\/profile\/?$/.test(path)) {
    return { kind: 'profile', id: user[1] };
  }
  return { kind: 'none' };
}

function fromApiBadge(raw) {
  const score = TironScore.scoreBadge((raw && raw.statistics) || {});
  return {
    id: String(raw && raw.id || ''),
    name: (raw && (raw.displayName || raw.name)) || 'Badge',
    score: score,
  };
}

async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Math.min(limit, items.length);
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index], index);
    }
  }
  const jobs = [];
  for (let i = 0; i < workers; i += 1) jobs.push(worker());
  await Promise.all(jobs);
  return results;
}

function stripChips() {
  for (const chip of chips) chip.remove();
  chips.clear();
}

function cleanup() {
  if (observer) observer.disconnect();
  observer = null;
  clearTimeout(inventoryTimer);
  clearInterval(inventoryPoll);
  inventoryPoll = null;
  stripChips();
  TironUi.remove();
}

function panelHandlers() {
  return {
    onCollapsed: function (collapsed) {
      const next = Object.assign({}, settingsState, { collapsed: collapsed });
      saveSettings(next);
    },
    onDragEnd: function (anchor) {
      const next = Object.assign({}, settingsState, { anchor: anchor });
      saveSettings(next);
    },
  };
}

function loadingModel(kicker, sub) {
  return { kicker: kicker, headline: '…', tone: 'calm', sub: sub };
}

function errorModel(kicker, message) {
  return { kicker: kicker, headline: '—', tone: 'bad', sub: message, retry: function () { route(); } };
}

async function readUserCache(userId) {
  const stored = await chrome.storage.local.get('tironUserCache');
  const row = stored.tironUserCache && stored.tironUserCache[userId];
  if (!row || Date.now() - row.at > USER_TTL) return null;
  return row;
}

async function writeUserCache(userId, payload) {
  const stored = await chrome.storage.local.get('tironUserCache');
  const cache = stored.tironUserCache || {};
  cache[userId] = Object.assign({}, payload, { at: Date.now() });
  await chrome.storage.local.set({ tironUserCache: cache });
}

async function readBadgeCache(ids) {
  const stored = await chrome.storage.local.get('tironBadgeCache');
  const cache = stored.tironBadgeCache || {};
  const hit = {};
  const miss = [];
  const now = Date.now();
  for (const id of ids) {
    const row = cache[id];
    if (row && now - row.at < BADGE_TTL) hit[id] = row;
    else miss.push(id);
  }
  return { hit: hit, miss: miss, cache: cache };
}

async function writeBadgeCache(cache, rows) {
  const now = Date.now();
  for (const row of rows) {
    cache[row.id] = {
      id: row.id,
      name: row.name,
      score: row.score,
      at: now,
    };
  }
  const keys = Object.keys(cache);
  if (keys.length > 1500) {
    keys.sort(function (a, b) { return (cache[a].at || 0) - (cache[b].at || 0); });
    for (const key of keys.slice(0, keys.length - 1500)) delete cache[key];
  }
  await chrome.storage.local.set({ tironBadgeCache: cache });
}

async function attachIcons(rarest) {
  if (!rarest.length) return rarest;
  try {
    const body = await TironApi.badgeIcons(rarest.map(function (badge) { return badge.id; }));
    const byId = new Map();
    for (const row of (body && body.data) || []) byId.set(String(row.targetId), row.imageUrl);
    return rarest.map(function (badge) {
      const iconUrl = byId.get(badge.id);
      return Object.assign({}, badge, { iconUrl: TironScore.isRobloxCdn(iconUrl) ? iconUrl : null });
    });
  } catch (error) {
    return rarest;
  }
}

function profileModel(summary, settings) {
  const features = settings.features;
  const scored = summary.scored || 0;
  const showScore = features.gamerscore && scored > 0;
  const model = {
    kicker: summary.username ? summary.username : 'Profile',
    headline: showScore ? TironScore.formatCount(summary.points) : (scored ? TironScore.formatCount(scored) : '—'),
    tone: 'good',
    sub: scored
      ? (summary.scope === 'page'
        ? scored + (scored === 1 ? ' badge on this page' : ' badges on this page')
        : scored + (scored === 1 ? ' badge scored' : ' badges scored'))
      : 'No scored badges yet',
    rows: [],
    signature: features.signature ? summary.tiers : null,
    shelf: null,
    note: '',
  };
  if (!showScore && features.gamerscore) model.sub = 'No scored badges yet';
  const unknown = (summary.tiers && summary.tiers.unknown) || 0;
  if (unknown > 0) model.rows.push({ label: 'No win rate', value: TironScore.formatCount(unknown) });
  if (features.shelf && summary.rarest) {
    model.shelf = summary.rarest.map(function (badge) {
      return {
        name: badge.name,
        iconUrl: badge.iconUrl || null,
        meta: TironScore.tierLabel(badge.score.tier) + ' · ' + TironScore.percentLabel(badge.score.percent) + ' · ' + badge.score.points + ' pts',
      };
    });
  }
  if (summary.scope === 'page') {
    model.note = 'Sign in to Roblox and reload to score the whole collection. This pass uses the badges shown on the profile.';
  } else if (summary.partial) {
    model.note = 'This score stops after the first pages of badges.';
  }
  return model;
}

async function materialize(rawBadges) {
  const hasField = rawBadges.some(function (badge) {
    return badge.statistics && Object.prototype.hasOwnProperty.call(badge.statistics, 'winRatePercentage');
  });
  if (hasField || rawBadges.length === 0) {
    return { badges: rawBadges.map(fromApiBadge), repaired: false };
  }
  const slice = rawBadges.slice(0, 40);
  const detailed = await mapPool(slice, 4, async function (badge) {
    try { return fromApiBadge(await TironApi.badge(badge.id)); }
    catch (error) { return fromApiBadge(badge); }
  });
  return { badges: detailed, repaired: rawBadges.length > slice.length };
}

function collectBadgeIds() {
  const ids = [];
  const seen = new Set();
  for (const item of collectBadgeLinks()) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    ids.push(item.id);
  }
  return ids;
}

async function waitForBadgeIds(gen, ms) {
  const start = Date.now();
  let ids = collectBadgeIds();
  while (alive(gen) && ids.length === 0 && Date.now() - start < ms) {
    await sleep(400);
    ids = collectBadgeIds();
  }
  return ids;
}

async function scoreVisibleBadges(gen) {
  const ids = await waitForBadgeIds(gen, 4000);
  const capped = ids.slice(0, 30);
  const detailed = await mapPool(capped, 4, async function (id) {
    try { return fromApiBadge(await TironApi.badge(id)); }
    catch (error) { return null; }
  });
  return {
    badges: detailed.filter(Boolean),
    partial: ids.length > capped.length,
    scope: 'page',
  };
}

async function renderProfile(gen, userId) {
  if (!alive(gen)) return;
  const settings = settingsState || await loadSettings(gen);
  if (!alive(gen) || !settings) return;
  const features = settings.features;
  if (!features.gamerscore && !features.signature && !features.shelf) return;
  TironUi.mount(settings, panelHandlers());
  TironUi.render(loadingModel('Profile', 'Reading badges'));

  const cached = await readUserCache(userId);
  if (!alive(gen)) return;
  if (cached) {
    TironUi.render(profileModel(cached, settings));
    return;
  }

  const userPromise = TironApi.user(userId).catch(function () { return null; });
  let packed;
  try {
    const page = await TironApi.userBadges(userId, function (count) {
      if (alive(gen)) TironUi.render(loadingModel('Profile', 'Read ' + TironScore.formatCount(count) + ' badges'));
    });
    const made = await materialize(page.badges);
    packed = { badges: made.badges, partial: page.partial || made.repaired, scope: 'full' };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      if (alive(gen)) TironUi.render(loadingModel('Profile', 'Reading badges on this page'));
      packed = await scoreVisibleBadges(gen);
    } else {
      if (alive(gen)) TironUi.render(errorModel('Profile', 'Roblox did not return this collection.'));
      return;
    }
  }
  if (!alive(gen) || !packed) return;
  const user = await userPromise;
  const summary = TironScore.summarize(packed.badges);
  summary.rarest = await attachIcons(summary.rarest);
  summary.partial = packed.partial;
  summary.scope = packed.scope;
  summary.username = user && (user.displayName || user.name) || '';
  if (packed.scope === 'full') await writeUserCache(userId, summary);
  if (!alive(gen)) return;
  TironUi.render(profileModel(summary, settings));
}

function gameModel(report, settings) {
  const features = settings.features;
  const rows = [];
  if (features.weather) {
    rows.push({ label: 'Playing now', value: TironScore.formatCount(report.playingNow) });
    if (report.likeRatio != null) {
      rows.push({ label: 'Liked', value: Math.round(report.likeRatio * 100) + '%' });
    }
    if (report.fillRatio != null) {
      rows.push({
        label: 'Server fill',
        value: Math.round(report.fillRatio * 100) + '% · ' + report.serverCount,
      });
    }
    const updated = report.updatedDays == null ? null : TironScore.updatedLabel(
      new Date(Date.now() - report.updatedDays * 86400000).toISOString()
    );
    if (updated) rows.push({ label: 'Updated', value: updated.replace('Updated ', '') });
    if (report.medianPing != null) rows.push({ label: 'Ping', value: Math.round(report.medianPing) + ' ms' });
    if (report.medianFps != null) rows.push({ label: 'Frame rate', value: Math.round(report.medianFps) + ' fps' });
  }
  if (features.ledger) {
    rows.push({
      label: 'This browser',
      value: report.visits === 1 ? 'Seen once' : 'Seen ' + report.visits + ' times',
    });
  }
  const weatherOn = features.weather;
  return {
    kicker: report.name,
    headline: weatherOn ? report.forecast.word : TironScore.formatCount(report.visits),
    tone: weatherOn ? report.forecast.tone : 'calm',
    sub: weatherOn ? 'Lobby weather' : 'Seen in this browser',
    rows: rows,
  };
}

async function bumpLedger(placeId, name) {
  const stored = await chrome.storage.local.get('tironLedger');
  const ledger = stored.tironLedger || {};
  const now = Date.now();
  const prev = ledger[placeId] || { visits: 0, firstSeen: now, name: name };
  const trimmed = String(name || prev.name || 'Game').slice(0, 80);
  prev.name = trimmed;
  prev.lastSeen = now;
  if (!prev.lastCounted || now - prev.lastCounted >= VISIT_GAP) {
    prev.visits += 1;
    prev.lastCounted = now;
  }
  ledger[placeId] = prev;
  const entries = Object.entries(ledger);
  if (entries.length > 200) {
    entries.sort(function (a, b) { return (a[1].lastSeen || 0) - (b[1].lastSeen || 0); });
    for (const entry of entries.slice(0, entries.length - 200)) delete ledger[entry[0]];
  }
  await chrome.storage.local.set({ tironLedger: ledger });
  return prev;
}

async function renderGame(gen, placeId) {
  if (!alive(gen)) return;
  const settings = settingsState || await loadSettings(gen);
  if (!alive(gen) || !settings) return;
  if (!settings.features.weather && !settings.features.ledger) return;
  TironUi.mount(settings, panelHandlers());
  TironUi.render(loadingModel('Game', 'Checking the lobby'));
  try {
    const universe = await TironApi.universeForPlace(placeId);
    const universeId = universe && universe.universeId;
    if (!universeId) throw new Error('Missing universe');
    const settled = await Promise.all([
      TironApi.game(universeId),
      TironApi.votes(universeId).catch(function () { return null; }),
      TironApi.servers(placeId).catch(function () { return null; }),
    ]);
    const game = settled[0] && settled[0].data && settled[0].data[0];
    if (!game) throw new Error('Missing game');
    const ledger = settings.features.ledger ? await bumpLedger(placeId, game.name) : null;
    const report = TironScore.lobbyReport({
      game: game,
      votes: settled[1] && settled[1].data && settled[1].data[0],
      servers: settled[2] && settled[2].data,
      ledger: ledger,
    });
    if (!alive(gen)) return;
    TironUi.render(gameModel(report, settings));
  } catch (error) {
    if (alive(gen)) TironUi.render(errorModel('Game', 'Roblox did not return this lobby.'));
  }
}

function badgeModel(badge) {
  const score = badge.score;
  return {
    kicker: 'Badge',
    headline: score.points > 0 ? String(score.points) : '—',
    tone: score.tier === 'legendary' || score.tier === 'epic' ? 'hot' : 'good',
    sub: badge.name,
    rows: [
      { label: 'Tier', value: TironScore.tierLabel(score.tier) },
      { label: 'Win rate', value: TironScore.percentLabel(score.percent) },
      { label: 'Odds', value: TironScore.rarityLine(score) },
      { label: 'Pace', value: TironScore.paceLabel(score.pastDay) },
      { label: 'Awarded', value: TironScore.formatCount(score.awarded) },
    ],
  };
}

async function renderBadge(gen, badgeId) {
  if (!alive(gen)) return;
  const settings = settingsState || await loadSettings(gen);
  if (!alive(gen) || !settings) return;
  if (!settings.features.dossier) return;
  TironUi.mount(settings, panelHandlers());
  TironUi.render(loadingModel('Badge', 'Reading this badge'));
  try {
    const cached = await readBadgeCache([badgeId]);
    let row = cached.hit[badgeId];
    if (!row) {
      row = fromApiBadge(await TironApi.badge(badgeId));
      await writeBadgeCache(cached.cache, [row]);
    }
    if (!alive(gen)) return;
    TironUi.render(badgeModel(row));
  } catch (error) {
    if (alive(gen)) TironUi.render(errorModel('Badge', 'Roblox did not return this badge.'));
  }
}

function collectBadgeLinks() {
  const found = [];
  const seen = new Set();
  function visit(node) {
    if (!node || !node.querySelectorAll) return;
    if (node.host && node.host.id === 'tironblox-host') return;
    node.querySelectorAll('a[href*="/badges/"]').forEach(function (link) {
      if (seen.has(link)) return;
      const match = link.href && link.href.match(/\/badges\/(\d+)/);
      if (!match) return;
      seen.add(link);
      found.push({ link: link, id: match[1] });
    });
    node.querySelectorAll('*').forEach(function (element) {
      if (element.id === 'tironblox-host') return;
      if (element.shadowRoot) visit(element.shadowRoot);
    });
  }
  visit(document);
  return found;
}

async function tagBadges(gen) {
  const links = collectBadgeLinks().filter(function (item) {
    return item.link.dataset.tironblox !== '1' && item.link.isConnected;
  });
  if (!links.length || !alive(gen)) return;
  const ids = [];
  const seen = new Set();
  for (const item of links) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    ids.push(item.id);
  }
  const cached = await readBadgeCache(ids);
  if (!alive(gen)) return;
  const waiting = new Map();
  for (const item of links) {
    if (!alive(gen) || !item.link.isConnected || item.link.dataset.tironblox === '1') continue;
    item.link.dataset.tironblox = '1';
    const known = cached.hit[item.id];
    const chip = TironUi.chip(known ? known.score : null);
    item.link.insertAdjacentElement('afterend', chip);
    chips.add(chip);
    if (!known) {
      const list = waiting.get(item.id) || [];
      list.push(chip);
      waiting.set(item.id, list);
    }
  }
  const missing = Array.from(waiting.keys());
  if (!missing.length) return;
  const rows = await mapPool(missing, 4, async function (id) {
    try { return fromApiBadge(await TironApi.badge(id)); }
    catch (error) { return { id: id, name: 'Badge', score: TironScore.scoreBadge({}), failed: true }; }
  });
  if (!alive(gen)) return;
  const saved = [];
  for (const row of rows) {
    for (const chip of waiting.get(row.id) || []) {
      if (!chip.isConnected) continue;
      const fresh = TironUi.chip(row.failed ? { tier: 'unknown', points: 0, percent: null, oneIn: null } : row.score);
      if (row.failed) fresh.title = 'Could not score this badge';
      chip.replaceWith(fresh);
      chips.delete(chip);
      chips.add(fresh);
    }
    if (!row.failed) saved.push(row);
  }
  if (saved.length) await writeBadgeCache(cached.cache, saved);
}

function watchInventory(gen) {
  if (observer) observer.disconnect();
  observer = new MutationObserver(function (mutations) {
    let relevant = false;
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.id === 'tironblox-host' || node.classList.contains('tironblox-chip')) continue;
        relevant = true;
        break;
      }
      if (relevant) break;
    }
    if (!relevant) return;
    clearTimeout(inventoryTimer);
    inventoryTimer = setTimeout(function () {
      if (alive(gen)) tagBadges(gen);
    }, 600);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  clearInterval(inventoryPoll);
  inventoryPoll = setInterval(function () {
    if (alive(gen)) tagBadges(gen);
  }, 2500);
}

async function renderInventory(gen) {
  if (!alive(gen)) return;
  const settings = settingsState || await loadSettings(gen);
  if (!alive(gen) || !settings) return;
  if (!settings.features.inventory) return;
  watchInventory(gen);
  await tagBadges(gen);
}

async function route() {
  const gen = ++generation;
  cleanup();
  const target = classify(location.href);
  if (target.kind === 'none') return;
  await loadSettings(gen);
  if (!alive(gen)) return;
  if (target.kind === 'profile') await renderProfile(gen, target.id);
  else if (target.kind === 'game') await renderGame(gen, target.id);
  else if (target.kind === 'badge') await renderBadge(gen, target.id);
  else if (target.kind === 'inventory') await renderInventory(gen);
}

let currentHref = '';
function tick() {
  if (location.href === currentHref) return;
  currentHref = location.href;
  route();
}

tick();
setInterval(tick, 800);
chrome.storage.onChanged.addListener(function (changes, area) {
  if (area !== 'local' || !changes.tironSettings) return;
  const before = JSON.stringify(changes.tironSettings.oldValue && changes.tironSettings.oldValue.features);
  const after = JSON.stringify(changes.tironSettings.newValue && changes.tironSettings.newValue.features);
  if (before === after) return;
  currentHref = '';
  tick();
});
