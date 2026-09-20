// =============================================
// Roblox Badge Gamerscore - FIXED STABLE VERSION
// Fixed: rarity order, CSS loading, badge page, profile calculation
// =============================================

console.log("🚀 Gamerscore script loaded - FIXED stable version");

const RARITY_SCORES = {
  common: 5,
  uncommon: 15,
  rare: 25,
  epic: 50,
  legendary: 100
};

const processed = new Set();

async function getRarity(badgeId) {
  try {
    const res = await fetch(`https://badges.roproxy.com/v1/badges/${badgeId}`);
    if (!res.ok) return 'common';
    const data = await res.json();
    const winRate = data.statistics?.winRatePercentage;

    // Correct ordered thresholds (lowest % = rarest)
    if (typeof winRate === 'number' && winRate >= 0) {
      if (winRate <= 0.05) return 'legendary';
      if (winRate <= 0.10) return 'epic';
      if (winRate <= 0.20) return 'rare';
      if (winRate <= 0.50) return 'uncommon';
      return 'common';
    }

    // Fallback to awarded count when winRate is missing
    const awarded = data.awardedCount || 0;
    if (awarded <= 500) return 'legendary';
    if (awarded <= 5000) return 'epic';
    if (awarded <= 25000) return 'rare';
    if (awarded <= 100000) return 'uncommon';
    return 'common';
  } catch {
    return 'common';
  }
}

function createPill(score) {
  const pill = document.createElement('div');
  pill.className = 'gamerscore-pill';
  pill.style.cssText = `
    background:#121215; border:1px solid #2a2a2f; border-radius:4px; 
    padding:3px 10px; display:inline-flex; align-items:center; gap:6px; 
    font-family:"Builder Sans",Helvetica,Arial,sans-serif; font-size:13px; 
    color:#F7F7F8; margin:4px 0 2px 0; flex-shrink:0;
  `;
  pill.innerHTML = `<span style="font-size:16px;">🏆</span><span style="font-weight:600;color:#00ff9d;">${score}</span>`;
  return pill;
}

function getCurrentUserId() {
  const match = window.location.pathname.match(/\/users\/(\d+)/);
  return match ? match[1] : null;
}

async function getAllUserBadges(userId) {
  let allBadges = [];
  let cursor = null;

  while (true) {
    const params = new URLSearchParams({ limit: '100', sortOrder: 'Asc' });
    if (cursor) params.append('cursor', cursor);

    const res = await fetch(`https://badges.roproxy.com/v1/users/${userId}/badges?${params}`);
    if (!res.ok) throw new Error('Failed to fetch badges');

    const data = await res.json();
    allBadges = allBadges.concat(data.data || []);

    if (!data.nextPageCursor) break;
    cursor = data.nextPageCursor;
    await new Promise(r => setTimeout(r, 180)); // rate limit
  }
  return allBadges;
}

async function loadSavedData(userId) {
  return new Promise(resolve => {
    chrome.storage.sync.get([`gamerscore_${userId}`], (result) => {
      resolve(result[`gamerscore_${userId}`] || null);
    });
  });
}

async function saveData(userId, totalGamerscore, badgeCount) {
  chrome.storage.sync.set({
    [`gamerscore_${userId}`]: {
      totalGamerscore,
      badgeCount,
      lastUpdated: Date.now()
    }
  });
}

// Profile - now actually calculates
async function injectProfile() {
  const container = document.querySelector('#user-profile-header-bg > div > div.flex-nowrap.gap-small.flex') ||
                    document.querySelector('div.flex.flex-wrap.gap-2') ||
                    document.querySelector('div[class*="flex"][class*="gap"]');
  if (!container || container.querySelector('.gamerscore-pill')) return;

  const userId = getCurrentUserId();
  if (!userId) return;

  const pill = document.createElement('div');
  pill.className = 'gamerscore-pill';
  pill.style.cssText = `
    background:#121215; border:1px solid #2a2a2f; border-radius:4px;
    padding:4px 12px; display:inline-flex; align-items:center; gap:8px;
    font-family:"Builder Sans",Helvetica,Arial,sans-serif; font-size:14px;
    color:#F7F7F8; margin:4px 0 2px 0; flex-shrink:0;
  `;
  pill.innerHTML = `
    <span style="font-size:18px;">🏆</span>
    <div>
      <div style="font-size:12px;color:#a3a3a6;">Badge Gamerscore</div>
      <div style="font-size:15px;font-weight:600;color:#00ff9d;" id="gc-value">—</div>
    </div>
  `;
  container.appendChild(pill);

  const valueEl = pill.querySelector('#gc-value');

  // Show cached value instantly
  const saved = await loadSavedData(userId);
  if (saved?.totalGamerscore) {
    valueEl.textContent = saved.totalGamerscore.toLocaleString();
  }

  try {
    const badges = await getAllUserBadges(userId);
    const newCount = badges.length;

    if (saved && newCount === saved.badgeCount) {
      return; // up to date
    }

    valueEl.textContent = 'Calculating...';

    let total = 0;
    for (let i = 0; i < newCount; i++) {
      const rarity = await getRarity(badges[i].id);
      total += RARITY_SCORES[rarity] || 10;
      await new Promise(r => setTimeout(r, 100));
    }

    valueEl.textContent = total.toLocaleString();
    await saveData(userId, total, newCount);
    console.log(`✅ Profile Gamerscore: ${total} (${newCount} badges)`);
  } catch (err) {
    console.error(err);
    if (!saved?.totalGamerscore) valueEl.textContent = 'Error';
  }
}

// Single badge page
async function injectBadgePage() {
  const container = document.getElementById('item-details') ||
                    document.querySelector('.item-details-info') ||
                    document.querySelector('[class*="item-details"]');
  if (!container || container.querySelector('.gamerscore-pill')) return;

  const match = location.pathname.match(/\/badges\/(\d+)/);
  if (!match) return;

  const rarity = await getRarity(match[1]);
  const score = RARITY_SCORES[rarity] || 10;
  container.appendChild(createPill(score));
}

// Inventory
async function injectInventory() {
  const items = document.querySelectorAll('li.list-item.item-card, li[ng-repeat*="item in $ctrl.assets"], .item-card');

  for (const li of items) {
    const link = li.querySelector('a[href*="/badges/"]');
    if (!link) continue;

    const match = link.href.match(/\/badges\/(\d+)/);
    if (!match) continue;

    const badgeId = match[1];
    if (processed.has(badgeId)) continue;

    const pills = li.querySelectorAll('.gamerscore-pill');
    if (pills.length >= 1) {
      processed.add(badgeId);
      continue;
    }

    const rarity = await getRarity(badgeId);
    const score = RARITY_SCORES[rarity] || 10;

    const pill = createPill(score);

    const container = li.querySelector('.item-card-container') || li;
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';

    const nameArea = link.querySelector('div, span, h3') || link;
    if (nameArea) nameArea.style.marginBottom = '10px';

    container.appendChild(pill);
    processed.add(badgeId);

    // small delay to avoid hammering the API on large inventories
    await new Promise(r => setTimeout(r, 80));
  }
}

function updateAll() {
  const url = location.href;
  if (url.includes('/inventory') && url.includes('badges')) {
    injectInventory();
  } else if (url.includes('/profile') || /\/users\/\d+\/?$/.test(location.pathname)) {
    injectProfile();
  } else if (url.includes('/badges/')) {
    injectBadgePage();
  }
}

// Run immediately + periodically (handles SPA navigation)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', updateAll);
} else {
  updateAll();
}

setTimeout(updateAll, 1500);
setInterval(updateAll, 7000);

// Also react to URL changes (Roblox is SPA-ish)
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    processed.clear(); // reset on navigation
    setTimeout(updateAll, 800);
  }
}).observe(document, { subtree: true, childList: true });

console.log("✅ Fixed no-duplicate + rarity + profile calculation active");
