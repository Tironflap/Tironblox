const ALLOWED_HOSTS = new Set([
  'badges.roblox.com',
  'games.roblox.com',
  'users.roblox.com',
  'apis.roblox.com',
  'thumbnails.roblox.com',
]);

export function isAllowedUrl(value) {
  if (typeof value !== 'string' || value.length > 2000) return false;
  let parsed;
  try {
    parsed = new URL(value);
  } catch (error) {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  if (parsed.username || parsed.password) return false;
  return ALLOWED_HOSTS.has(parsed.hostname);
}
