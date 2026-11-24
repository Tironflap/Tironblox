# Tironblox

A Chrome and Edge extension for Roblox profiles, badge pages, inventories, and game pages.

## What it adds

- **Badge gamerscore.** Each badge is scored from Roblox's win-rate fraction on a log curve. A profile shows the total. A zero win rate stays unscored, so missing data does not look legendary.
- **Rarity signature.** Five bars show how the collection splits across common, uncommon, rare, epic, and legendary.
- **Rarest shelf.** The three hardest earned badges, with their official icons.
- **Badge dossier.** A badge page shows the point value, tier, win rate, 1-in-N odds, and how many people earned it in the last day.
- **Inventory chips.** Badge tiles in an inventory get a score chip. The list can rerender; the chips come back without a timer.
- **Lobby weather.** A game page gets one word for the room: Packed, Fresh, Quiet, Laggy, Stormy, or Breezy, plus likes, server fill, ping, frame rate, and update age.
- **Visit ledger.** Game pages you open are counted in this browser only. A repeat inside 30 minutes does not add another visit.

The toolbar popup turns each of these off and can clear the ledger or the score cache. Drag the card if it covers something. Hide collapses it.

## Privacy

Requests go to Roblox from the extension. The service worker refuses any other host. The visit ledger and score cache stay in `chrome.storage.local`. Profile totals need a signed-in Roblox session, because the badge list endpoint requires it. Signed-out, the card scores badges the profile is already showing.

## Install

1. Open `chrome://extensions` or `edge://extensions`.
2. Turn on Developer mode.
3. Choose Load unpacked and select this folder.
4. Reload any Roblox tab that was already open.
5. Open a profile, badge, inventory, or game.

## Tests

```
node --test test/score.test.js test/net.test.mjs
```
