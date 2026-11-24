const test = require('node:test');
const assert = require('node:assert/strict');
const score = require('../lib/score.js');

test('treats Roblox winRatePercentage as a fraction of players', function () {
  assert.equal(score.percentFromApi(0.026), 2.6);
  assert.equal(score.percentFromApi(1), 100);
  assert.equal(score.percentFromApi(2.6), 2.6);
  assert.equal(score.percentFromApi(-1), null);
});

test('scores a mass-awarded badge as uncommon, not legendary', function () {
  const scored = score.scoreBadge({
    winRatePercentage: 0.026,
    awardedCount: 312935336,
    pastDayAwardedCount: 90835,
  });
  assert.equal(scored.percent, 2.6);
  assert.equal(scored.tier, 'uncommon');
  assert.equal(scored.points, 25);
  assert.equal(scored.oneIn, 38);
  assert.equal(score.paceLabel(scored.pastDay), '90,835 awarded in the last day');
});

test('keeps the rare band reachable', function () {
  const scored = score.scoreBadge({ winRatePercentage: 0.01, awardedCount: 10, pastDayAwardedCount: 1 });
  assert.equal(scored.tier, 'rare');
  assert.equal(scored.points, 32);
  assert.equal(score.tierForPercent(0.05), 'legendary');
  assert.equal(score.tierForPercent(0.051), 'epic');
  assert.equal(score.tierForPercent(0.5), 'epic');
  assert.equal(score.tierForPercent(0.501), 'rare');
  assert.equal(score.tierForPercent(2), 'rare');
  assert.equal(score.tierForPercent(2.01), 'uncommon');
  assert.equal(score.tierForPercent(10), 'uncommon');
  assert.equal(score.tierForPercent(10.01), 'common');
});

test('does not treat a zero win rate as a rare trophy', function () {
  const owned = score.scoreBadge({ winRatePercentage: 0, awardedCount: 12, pastDayAwardedCount: 0 });
  const empty = score.scoreBadge({ winRatePercentage: 0, awardedCount: 0, pastDayAwardedCount: 0 });
  assert.equal(owned.tier, 'unknown');
  assert.equal(owned.points, 0);
  assert.equal(empty.tier, 'unranked');
  assert.equal(score.rarityLine(owned), 'Win rate unavailable');
  assert.equal(score.rarityLine(empty), 'Nobody has earned this yet');
});

test('gives rarer badges more points, with a cap', function () {
  const common = score.pointsForPercent(50);
  const rare = score.pointsForPercent(1);
  const legendary = score.pointsForPercent(0.02);
  assert.equal(common, 5);
  assert.equal(rare, 32);
  assert.equal(legendary, 59);
  assert.ok(common < rare && rare < legendary);
  assert.equal(score.pointsForPercent(1e-8), 120);
  assert.equal(score.pointsForPercent(100), 1);
});

test('summarizes a collection and ranks the rarest first', function () {
  const summary = score.summarize([
    { id: '1', name: 'Zebra', score: score.scoreBadge({ winRatePercentage: 0.5, awardedCount: 3 }) },
    { id: '2', name: 'Alpha', score: score.scoreBadge({ winRatePercentage: 0.0002, awardedCount: 3 }) },
    { id: '3', name: 'Mid', score: score.scoreBadge({ winRatePercentage: 0.01, awardedCount: 3 }) },
    { id: '4', name: 'Blank', score: score.scoreBadge({ winRatePercentage: 0, awardedCount: 3 }) },
  ]);
  assert.equal(summary.counted, 4);
  assert.equal(summary.scored, 3);
  assert.equal(summary.tiers.legendary, 1);
  assert.equal(summary.tiers.rare, 1);
  assert.equal(summary.tiers.common, 1);
  assert.equal(summary.tiers.unknown, 1);
  assert.deepEqual(summary.rarest.map(function (badge) { return badge.name; }), ['Alpha', 'Mid', 'Zebra']);
  assert.equal(summary.points, 59 + 32 + 5);
});

test('names lobby weather from likes, fill, freshness, and ping', function () {
  assert.deepEqual(score.weather({ likeRatio: 0.5, fillRatio: 0.99, updatedDays: 1, medianPing: 40 }), { word: 'Stormy', tone: 'bad' });
  assert.deepEqual(score.weather({ likeRatio: 0.9, fillRatio: 0.9, updatedDays: 1, medianPing: 40 }), { word: 'Packed', tone: 'hot' });
  assert.deepEqual(score.weather({ likeRatio: 0.85, fillRatio: 0.5, updatedDays: 3, medianPing: 40 }), { word: 'Fresh', tone: 'good' });
  assert.deepEqual(score.weather({ likeRatio: 0.9, fillRatio: 0.1, updatedDays: 40, medianPing: 40 }), { word: 'Quiet', tone: 'calm' });
  assert.deepEqual(score.weather({ likeRatio: 0.9, fillRatio: 0.5, updatedDays: 40, medianPing: 200 }), { word: 'Laggy', tone: 'bad' });
  assert.deepEqual(score.weather({ likeRatio: 0.75, fillRatio: 0.5, updatedDays: 40, medianPing: 80 }), { word: 'Breezy', tone: 'good' });
  assert.equal(score.weather({ likeRatio: null, fillRatio: null, updatedDays: null, medianPing: null }).word, 'Breezy');
});

test('builds a lobby report from public game payloads', function () {
  const report = score.lobbyReport({
    now: Date.parse('2026-11-24T00:00:00Z'),
    game: { name: 'Crossroads', updated: '2026-09-24T00:00:00Z', playing: 14 },
    votes: { upVotes: 90, downVotes: 10 },
    servers: [
      { playing: 6, maxPlayers: 15, ping: 160, fps: 59.9 },
      { playing: 5, maxPlayers: 15, ping: 80, fps: 60 },
      { playing: 2, maxPlayers: 15, ping: 75, fps: 59 },
    ],
    ledger: { visits: 4 },
  });
  assert.equal(report.name, 'Crossroads');
  assert.equal(report.likeRatio, 0.9);
  assert.ok(Math.abs(report.fillRatio - (13 / 45)) < 1e-9);
  assert.equal(report.medianPing, 80);
  assert.equal(report.medianFps, 59.9);
  assert.equal(report.forecast.word, 'Quiet');
  assert.equal(report.visits, 4);
  assert.equal(score.updatedLabel('2026-09-24T00:00:00Z', Date.parse('2026-11-24T00:00:00Z')), 'Updated 2 months ago');
  assert.equal(score.updatedLabel('2026-11-24T00:00:00Z', Date.parse('2026-11-24T00:00:00Z')), 'Updated today');
});

test('accepts only Roblox CDN thumbnails', function () {
  assert.equal(score.isRobloxCdn('https://tr.rbxcdn.com/abc/150/150/Image/Png/noFilter'), true);
  assert.equal(score.isRobloxCdn('https://evil.example/tr.rbxcdn.com/abc'), false);
  assert.equal(score.isRobloxCdn('http://tr.rbxcdn.com/abc'), false);
  assert.equal(score.rarityLine({ tier: 'common', oneIn: 2, percent: 50 }), 'Almost everyone earns this');
  assert.equal(score.percentLabel(2.6), '2.6%');
  assert.equal(score.percentLabel(0.02), '0.02%');
  assert.equal(score.formatCount(12480), '12,480');
});
