// =============================================
// Roblox Badge Gamerscore - Ultra Strict No-Duplicate Version
// =============================================

console.log("🚀 Gamerscore script loaded - ultra strict duplicate fix");

const RARITY_SCORES = {
  common: 5,
  uncommon: 15,
  rare: 25,
  epic: 50,
  legendary: 100
};

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
    background:#121215; 
    border:1px solid #2a2a2f; 
    border-radius:4px; 
    padding:3px 10px; 
    display:inline-flex; 
    align-items:center; 
    gap:6px; 
    font-family:"Builder Sans", "Helvetica Neue", Helvetica, Arial, "Lucida Grande", sans-serif; 
    font-size:13px; 
    color:#F7F7F8; 
    margin:4px 0 2px 0;
    flex-shrink: 0;
  `;
  pill.innerHTML = `
    <span style="font-size:16px;">🏆</span>
    <span style="font-weight:600;color:#00ff9d;">${score}</span>
  `;
  return pill;
}

// Very strict check - count ALL pills in the entire item
function hasAnyGamerscorePill(element) {
  return element.querySelectorAll('.gamerscore-pill').length > 0;
}

// Profile
function injectProfile() {
  const container = document.querySelector('#user-profile-header-bg > div > div.flex-nowrap.gap-small.flex') ||
                    document.querySelector('div.flex.flex-wrap.gap-2');

  if (!container || hasAnyGamerscorePill(container)) return;

  container.appendChild(createPill('—', true));
}

// Single badge page
async function injectBadgePage() {
  const container = document.getElementById('item-details');
  if (!container || hasAnyGamerscorePill(container)) return;

  const match = location.pathname.match(/\/badges\/(\d+)/);
  if (!match) return;

  const rarity = await getRarity(match[1]);
  const score = RARITY_SCORES[rarity] || 10;

  container.appendChild(createPill(score));
}

// Inventory - strongest duplicate protection
async function injectInventory() {
  const items = document.querySelectorAll('li[ng-repeat*="item in $ctrl.assets"], .list-item.item-card');

  for (const li of items) {
    if (hasAnyGamerscorePill(li)) continue;

    const link = li.querySelector('a.item-card-link[href*="/badges/"]');
    if (!link) continue;

    const match = link.href.match(/\/badges\/(\d+)/);
    if (!match) continue;

    const rarity = await getRarity(match[1]);
    const score = RARITY_SCORES[rarity] || 10;

    const pill = createPill(score);

    const container = li.querySelector('.item-card-container') || li;
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';

    const nameArea = link.querySelector('div, span, h3') || link;
    if (nameArea) nameArea.style.marginBottom = '10px';

    container.appendChild(pill);
  }
}

function updateAll() {
  const url = location.href;

  if (url.includes('/users/') && url.includes('/profile')) {
    injectProfile();
  } else if (url.includes('/badges/') && !url.includes('/inventory')) {
    injectBadgePage();
  } else if (url.includes('/inventory') && url.includes('badges')) {
    injectInventory();
  }
}

// Run immediately + every 7 seconds
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', updateAll);
} else {
  updateAll();
}

setTimeout(updateAll, 1500);
setInterval(updateAll, 7000);

console.log("✅ Ultra strict duplicate protection active");