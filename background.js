import { isAllowedUrl } from './lib/net.mjs';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== 'TIRON_FETCH') return undefined;
  fetchAllowed(message.url).then(sendResponse);
  return true;
});

async function fetchAllowed(url) {
  if (!isAllowedUrl(url)) return { ok: false, status: 0, error: 'Blocked host' };
  try {
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      return { ok: false, status: response.status, error: 'Roblox returned ' + response.status };
    }
    return { ok: true, status: response.status, body: await response.json() };
  } catch (error) {
    return { ok: false, status: 0, error: 'Could not reach Roblox' };
  }
}
