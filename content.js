// =============================================
// Roblox Badge Gamerscore - FINAL STABLE VERSION
// No more duplicates, no more removing good pills
// =============================================

console.log("🚀 Gamerscore script loaded - FINAL stable version");

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
    const winRate = data.statistics?.winRatePercentage || 0;
    if (winRate <= 0.05) return 'legendary';
    if (winRate <= 0.20) return 'epic';
    if (winRate <= 0.10) return 'rare';
    if (winRate <= 0.50) return 'uncommon';
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

// Profile
function injectProfile() {
  const container = document.querySelector('#user-profile-header-bg > div > div.flex-nowrap.gap-small.flex') ||
                    document.querySelector('div.flex.flex-wrap.gap-2');
  if (!container || container.querySelector('.gamerscore-pill')) return;

  const pill = createPill('—');
  pill.style.padding = '4px 12px';
  pill.style.fontSize = '14px';
  pill.innerHTML = `<span style="font-size:18px;">🏆</span><div><div style="font-size:13px;color:#a3a3a6;">Badge Gamerscore</div><div style="font-size:15px;font-weight:600;color:#00ff9d;">—</div></div>`;
  container.appendChild(pill);
}

// Single badge page
async function injectBadgePage() {
  const container = document.getElementById('item-details');
  if (!container || container.querySelector('.gamerscore-pill')) return;

  const match = location.pathname.match(/\/badges\/(\d+)/);
  if (!match) return;

  const rarity = await getRarity(match[1]);
  const score = RARITY_SCORES[rarity] || 10;
  container.appendChild(createPill(score));
}

// Inventory - rewritten logic (this is the fix)
async function injectInventory() {
  const items = document.querySelectorAll('li.list-item.item-card, li[ng-repeat*="item in $ctrl.assets"]');

  for (const li of items) {
    const link = li.querySelector('a[href*="/badges/"]');
    if (!link) continue;

    const match = link.href.match(/\/badges\/(\d+)/);
    if (!match) continue;

    const badgeId = match[1];

    if (processed.has(badgeId)) continue;

    // Count current pills
    const pills = li.querySelectorAll('.gamerscore-pill');

    if (pills.length >= 1) {
      processed.add(badgeId);
      continue; // already has pill(s) — do nothing
    }

    // Add the pill
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
  }
}

function updateAll() {
  const url = location.href;
  if (url.includes('/inventory') && url.includes('badges')) injectInventory();
  else if (url.includes('/profile')) injectProfile();
}

// Run immediately + every 7 seconds
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', updateAll);
} else {
  updateAll();
}

setTimeout(updateAll, 1500);
setInterval(updateAll, 7000);

console.log("✅ Stable no-duplicate logic active");