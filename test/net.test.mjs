import test from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedUrl } from '../lib/net.mjs';

test('allows only the Roblox API hosts this extension calls', function () {
  assert.equal(isAllowedUrl('https://badges.roblox.com/v1/badges/196198137'), true);
  assert.equal(isAllowedUrl('https://games.roblox.com/v1/games/1818/servers/Public?limit=100'), true);
  assert.equal(isAllowedUrl('https://users.roblox.com/v1/users/261'), true);
  assert.equal(isAllowedUrl('https://apis.roblox.com/universes/v1/places/1818/universe'), true);
  assert.equal(isAllowedUrl('https://thumbnails.roblox.com/v1/badges/icons?badgeIds=1'), true);
});

test('rejects other origins, insecure URLs, and embedded credentials', function () {
  assert.equal(isAllowedUrl('http://badges.roblox.com/v1/badges/1'), false);
  assert.equal(isAllowedUrl('https://badges.roproxy.com/v1/badges/1'), false);
  assert.equal(isAllowedUrl('https://evil.com/'), false);
  assert.equal(isAllowedUrl('https://badges.roblox.com.evil.com/v1/badges/1'), false);
  assert.equal(isAllowedUrl('https://user:pass@badges.roblox.com/v1/badges/1'), false);
  assert.equal(isAllowedUrl('not a url'), false);
  assert.equal(isAllowedUrl(12), false);
});
