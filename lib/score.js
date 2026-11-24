// Pure scoring and lobby math. No DOM, no network.
// Roblox names winRatePercentage a percentage, but the live API returns a
// fraction of players: 1 means everyone, 0.026 means 2.6 percent.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TironScore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const TIER_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  const TIER_LABELS = {
    common: 'Common',
    uncommon: 'Uncommon',
    rare: 'Rare',
    epic: 'Epic',
    legendary: 'Legendary',
    unknown: 'Unknown',
    unranked: 'Unranked',
  };

  function percentFromApi(winRatePercentage) {
    const value = Number(winRatePercentage);
    if (!Number.isFinite(value) || value < 0) return null;
    if (value <= 1) return value * 100;
    return value;
  }

  function tierForPercent(percent) {
    if (percent == null || percent <= 0) return 'unknown';
    if (percent <= 0.05) return 'legendary';
    if (percent <= 0.5) return 'epic';
    if (percent <= 2) return 'rare';
    if (percent <= 10) return 'uncommon';
    return 'common';
  }

  function pointsForPercent(percent) {
    if (percent == null || percent <= 0) return 0;
    const clamped = Math.min(100, Math.max(percent, 1e-6));
    const raw = Math.round(16 * Math.log10(100 / clamped));
    return Math.max(1, Math.min(120, raw));
  }

  function scoreBadge(statistics) {
    const awarded = Number(statistics && statistics.awardedCount) || 0;
    const pastDay = Number(statistics && statistics.pastDayAwardedCount) || 0;
    const percent = percentFromApi(statistics && statistics.winRatePercentage);
    if (percent == null || percent <= 0) {
      return {
        percent: null,
        tier: awarded > 0 ? 'unknown' : 'unranked',
        points: 0,
        awarded,
        pastDay,
        oneIn: null,
      };
    }
    return {
      percent,
      tier: tierForPercent(percent),
      points: pointsForPercent(percent),
      awarded,
      pastDay,
      oneIn: Math.max(1, Math.round(100 / percent)),
    };
  }

  function summarize(badges) {
    const tiers = {
      common: 0,
      uncommon: 0,
      rare: 0,
      epic: 0,
      legendary: 0,
      unknown: 0,
      unranked: 0,
    };
    let points = 0;
    const ranked = [];
    for (const badge of badges) {
      const score = badge.score;
      if (Object.prototype.hasOwnProperty.call(tiers, score.tier)) tiers[score.tier] += 1;
      if (score.points > 0 && score.percent != null) {
        points += score.points;
        ranked.push(badge);
      }
    }
    ranked.sort(function (a, b) {
      return a.score.percent - b.score.percent || String(a.name).localeCompare(String(b.name));
    });
    return {
      points,
      counted: badges.length,
      scored: ranked.length,
      tiers,
      rarest: ranked.slice(0, 3),
    };
  }

  function weather(input) {
    const likeRatio = input.likeRatio;
    const fillRatio = input.fillRatio;
    const updatedDays = input.updatedDays;
    const medianPing = input.medianPing;
    if (likeRatio != null && likeRatio < 0.6) return { word: 'Stormy', tone: 'bad' };
    if (fillRatio != null && fillRatio >= 0.85) return { word: 'Packed', tone: 'hot' };
    if (updatedDays != null && updatedDays <= 7 && likeRatio != null && likeRatio >= 0.8) {
      return { word: 'Fresh', tone: 'good' };
    }
    if (fillRatio != null && fillRatio < 0.3) return { word: 'Quiet', tone: 'calm' };
    if (medianPing != null && medianPing >= 180) return { word: 'Laggy', tone: 'bad' };
    return { word: 'Breezy', tone: 'good' };
  }

  function median(values) {
    if (!values.length) return null;
    const sorted = values.slice().sort(function (a, b) { return a - b; });
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2) return sorted[mid];
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function lobbyReport(input) {
    const now = input.now == null ? Date.now() : input.now;
    const game = input.game || {};
    const votes = input.votes || {};
    const up = Number(votes.upVotes) || 0;
    const down = Number(votes.downVotes) || 0;
    const likeRatio = up + down > 0 ? up / (up + down) : null;
    const servers = Array.isArray(input.servers) ? input.servers : [];
    let playing = 0;
    let capacity = 0;
    const pings = [];
    const fps = [];
    for (const server of servers) {
      playing += Number(server.playing) || 0;
      capacity += Number(server.maxPlayers) || 0;
      if (Number.isFinite(Number(server.ping)) && Number(server.ping) > 0) pings.push(Number(server.ping));
      if (Number.isFinite(Number(server.fps)) && Number(server.fps) > 0) fps.push(Number(server.fps));
    }
    const updatedAt = Date.parse(game.updated);
    const updatedDays = Number.isFinite(updatedAt) ? Math.max(0, (now - updatedAt) / 86400000) : null;
    const fillRatio = capacity > 0 ? playing / capacity : null;
    const medianPing = median(pings);
    return {
      name: game.name || 'Game',
      playingNow: Number(game.playing) || 0,
      likeRatio,
      up,
      down,
      fillRatio,
      serverCount: servers.length,
      medianPing,
      medianFps: median(fps),
      updatedDays,
      forecast: weather({
        likeRatio,
        fillRatio,
        updatedDays,
        medianPing,
      }),
      visits: input.ledger && input.ledger.visits ? input.ledger.visits : 0,
    };
  }

  function formatCount(value) {
    const rounded = Math.round(Number(value) || 0);
    const sign = rounded < 0 ? '-' : '';
    return sign + String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function percentLabel(percent) {
    if (percent == null || !Number.isFinite(percent)) return '—';
    if (percent >= 10) return Math.round(percent) + '%';
    if (percent >= 1) return percent.toFixed(1) + '%';
    if (percent >= 0.01) return percent.toFixed(2) + '%';
    return percent.toFixed(3) + '%';
  }

  function tierLabel(tier) {
    return TIER_LABELS[tier] || 'Unknown';
  }

  function rarityLine(score) {
    if (!score || score.tier === 'unknown') return 'Win rate unavailable';
    if (score.tier === 'unranked') return 'Nobody has earned this yet';
    if (score.oneIn != null && score.oneIn <= 2) return 'Almost everyone earns this';
    return '1 in ' + formatCount(score.oneIn) + ' players';
  }

  function paceLabel(pastDay) {
    const count = Number(pastDay) || 0;
    if (count <= 0) return 'None awarded in the last day';
    if (count === 1) return '1 awarded in the last day';
    return formatCount(count) + ' awarded in the last day';
  }

  function updatedLabel(iso, now) {
    const stamp = Date.parse(iso);
    if (!Number.isFinite(stamp)) return null;
    const days = Math.max(0, ((now == null ? Date.now() : now) - stamp) / 86400000);
    if (days < 1) return 'Updated today';
    if (days < 2) return 'Updated yesterday';
    if (days < 30) return 'Updated ' + Math.floor(days) + ' days ago';
    if (days < 365) {
      const months = Math.floor(days / 30);
      return 'Updated ' + months + (months === 1 ? ' month ago' : ' months ago');
    }
    const years = Math.floor(days / 365);
    return 'Updated ' + years + (years === 1 ? ' year ago' : ' years ago');
  }

  function isRobloxCdn(value) {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'https:' &&
        (parsed.hostname === 'rbxcdn.com' || parsed.hostname.endsWith('.rbxcdn.com'));
    } catch (error) {
      return false;
    }
  }

  return {
    TIER_ORDER,
    percentFromApi,
    tierForPercent,
    pointsForPercent,
    scoreBadge,
    summarize,
    weather,
    lobbyReport,
    formatCount,
    percentLabel,
    tierLabel,
    rarityLine,
    paceLabel,
    updatedLabel,
    isRobloxCdn,
  };
});
