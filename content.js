// =============================================
// Roblox Extension - Gamerscore + Anti-Brainrot (Charts FIXED)
// =============================================

const RARITY_SCORES = {
  common: 5,
  uncommon: 15,
  rare: 25,
  epic: 50,
  legendary: 100
};

// ====================== BRAINROT FILTER ======================
const BRAINROT_KEYWORDS = [
  "brainrot", "skibidi", "sigma", "rizz", "gyatt", "mog", "fanum", "ohio",
  "looksmax", "grimace", "bussin", "goon", "edge", "capcut", "tiktok",
  "steal a", "for a brainrot", "only in ohio", "sigma boy", "mogging", "rizzler",
  "walk for", "run for", "survive for", "kiss a", "date a", "rob a", "escape a",
  "free robux", "robux generator", "admin commands"
].map(k => k.toLowerCase());

function isBrainrotGame(title) {
  if (!title) return false;
  const lower = title.toLowerCase();
  return BRAINROT_KEYWORDS.some(keyword => lower.includes(keyword));
}

function hideBrainrotGames() {
  // === CHARTS-SPECIFIC + GENERAL SELECTORS ===
  const gameCards = document.querySelectorAll(`
    .game-card, 
    .game-tile, 
    .container-list .list-item, 
    .game-carousel .slide-item,
    .game-card-container,
    .hlist .list-item,
    [class*="game-card"],
    [class*="carousel-item"],
    [data-testid*="game"],
    .experience-card
  `);

  gameCards.forEach(card => {
    // Try multiple possible title locations
    const titleSelectors = [
      '.game-card-name',
      '.game-name-title',
      '.text-overflow',
      '.slide-item-name',
      '.font-header-2',
      '.font-body',
      'h3', 'h4', 'span'
    ];

    let titleText = '';
    for (const sel of titleSelectors) {
      const el = card.querySelector(sel);
      if (el && el.textContent.trim()) {
        titleText = el.textContent.trim();
        break;
      }
    }

    // Fallback: check the whole card text
    if (!titleText) {
      titleText = card.textContent.trim();
    }

    if (isBrainrotGame(titleText)) {
      card.style.display = 'none';
      card.style.visibility = 'hidden';
      card.style.opacity = '0';
      card.style.height = '0';
      card.style.margin = '0';
      card.style.padding = '0';
      card.style.pointerEvents = 'none';
    }
  });
}

function startBrainrotFilter() {
  hideBrainrotGames();

  // Run again after 1 second (Charts loads slowly)
  setTimeout(hideBrainrotGames, 1000);

  // Watch for any new cards being added
  const observer = new MutationObserver(() => {
    hideBrainrotGames();
  });

  observer.observe(document.body, { 
    childList: true, 
    subtree: true 
  });
}

// ====================== GAMERSCORE (unchanged) ======================
function getCurrentUserId() {
  const match = window.location.pathname.match(/\/users\/(\d+)/);
  return match ? match[1] : null;
}

async function estimateRarity(badgeId) {
  try {
    const res = await fetch(`https://badges.roproxy.com/v1/badges/${badgeId}`);
    if (!res.ok) return 'common';
    const data = await res.json();

    const winRate = data.statistics?.winRatePercentage;
    const awarded = data.awardedCount || 0;

    if (typeof winRate === 'number' && winRate >= 0) {
      if (winRate <= 0.05) return 'legendary';
      if (winRate <= 0.20) return 'epic';
      if (winRate <= 0.10) return 'rare';
      if (winRate <= 0.50) return 'uncommon';
      return 'common';
    } else {
      if (awarded <= 500) return 'legendary';
      if (awarded <= 5000) return 'epic';
      if (awarded <= 25000) return 'rare';
      if (awarded <= 100000) return 'uncommon';
      return 'common';
    }
  } catch {
    return 'common';
  }
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
    await new Promise(r => setTimeout(r, 180));
  }
  return allBadges;
}

function createGamerscorePill() {
  const pill = document.createElement('div');
  pill.className = 'gamerscore-pill';
  pill.innerHTML = `
    <span class="icon">🏆</span>
    <div>
      <div class="label">Badge Gamerscore</div>
      <div class="value" id="gc-value">—</div>
    </div>
  `;
  return pill;
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

async function injectGamerscore() {
  const userId = getCurrentUserId();
  if (!userId) return;

  let statsRow = document.querySelector('#user-profile-header-bg > div > div.flex-nowrap.gap-small.flex') ||
                 document.querySelector('div.flex.flex-wrap.gap-2') ||
                 Array.from(document.querySelectorAll('div')).find(div => {
                   const text = div.textContent || '';
                   return text.includes('Friends') && text.includes('Followers');
                 });

  if (!statsRow) return;

  const pill = createGamerscorePill();
  const valueEl = pill.querySelector('#gc-value');
  statsRow.appendChild(pill);

  const status = document.createElement('div');
  status.className = 'gamerscore-status';
  status.textContent = 'Loading...';
  pill.appendChild(status);

  const saved = await loadSavedData(userId);
  if (saved && saved.totalGamerscore) {
    valueEl.textContent = saved.totalGamerscore.toLocaleString();
    status.textContent = 'Loaded';
  }

  try {
    const badges = await getAllUserBadges(userId);
    const newCount = badges.length;

    if (saved && newCount === saved.badgeCount) {
      status.textContent = `${newCount} badges • Up to date`;
      return;
    }

    status.textContent = `Processing ${newCount} badges...`;

    let total = 0;
    for (let i = 0; i < newCount; i++) {
      status.textContent = `Analyzing ${i + 1}/${newCount}`;
      const rarity = await estimateRarity(badges[i].id);
      total += RARITY_SCORES[rarity] || 10;
      await new Promise(r => setTimeout(r, 100));
    }

    valueEl.textContent = total.toLocaleString();
    status.textContent = `${newCount} badges • Saved`;

    await saveData(userId, total, newCount);

  } catch (err) {
    console.error(err);
    status.textContent = 'Error • Refresh';
  }
}

// ==================== START BOTH FEATURES ====================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    injectGamerscore();
    startBrainrotFilter();
  });
} else {
  injectGamerscore();
  startBrainrotFilter();
}