(function (root) {
  function assertId(id) {
    if (!/^\d+$/.test(String(id))) throw new Error('Bad id');
  }

  function request(url) {
    return new Promise(function (resolve, reject) {
      chrome.runtime.sendMessage({ type: 'TIRON_FETCH', url }, function (res) {
        const last = chrome.runtime.lastError;
        if (last) {
          reject(new Error(last.message));
          return;
        }
        if (!res || !res.ok) {
          const error = new Error((res && res.error) || 'Request failed');
          error.status = res && res.status ? res.status : 0;
          reject(error);
          return;
        }
        resolve(res.body);
      });
    });
  }

  async function userBadges(userId, onPage) {
    assertId(userId);
    const badges = [];
    let cursor = '';
    let limit = 100;
    let pages = 0;
    while (pages < (limit === 100 ? 8 : 20)) {
      const cursorQuery = cursor ? '&cursor=' + encodeURIComponent(cursor) : '';
      let body;
      try {
        body = await request(
          'https://badges.roblox.com/v1/users/' + userId +
          '/badges?limit=' + limit + '&sortOrder=Desc' + cursorQuery
        );
      } catch (error) {
        if (pages === 0 && error.status === 400 && limit > 10) {
          limit = 10;
          continue;
        }
        if (pages === 0) throw error;
        return { badges: badges, partial: true };
      }
      pages += 1;
      const data = body && Array.isArray(body.data) ? body.data : [];
      for (const badge of data) badges.push(badge);
      if (onPage) onPage(badges.length);
      if (!body || !body.nextPageCursor) return { badges: badges, partial: false };
      cursor = body.nextPageCursor;
    }
    return { badges: badges, partial: true };
  }

  root.TironApi = {
    user: function (id) {
      assertId(id);
      return request('https://users.roblox.com/v1/users/' + id);
    },
    badge: function (id) {
      assertId(id);
      return request('https://badges.roblox.com/v1/badges/' + id);
    },
    badgeIcons: function (ids) {
      const clean = ids.filter(function (id) { return /^\d+$/.test(String(id)); }).slice(0, 3);
      return request(
        'https://thumbnails.roblox.com/v1/badges/icons?badgeIds=' +
        clean.join(',') + '&size=150x150&format=Png&isCircular=false'
      );
    },
    universeForPlace: function (placeId) {
      assertId(placeId);
      return request('https://apis.roblox.com/universes/v1/places/' + placeId + '/universe');
    },
    game: function (universeId) {
      assertId(universeId);
      return request('https://games.roblox.com/v1/games?universeIds=' + universeId);
    },
    votes: function (universeId) {
      assertId(universeId);
      return request('https://games.roblox.com/v1/games/votes?universeIds=' + universeId);
    },
    servers: function (placeId) {
      assertId(placeId);
      return request('https://games.roblox.com/v1/games/' + placeId + '/servers/Public?sortOrder=Desc&limit=100');
    },
    userBadges: userBadges,
  };
})(globalThis);
