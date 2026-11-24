(function (root) {
  const CSS = [
    ':host { all: initial; }',
    '.card { width: min(292px, calc(100vw - 24px)); background: #0e0e10; color: #f4f4f5;',
    'border: 1px solid #2c2c30; border-radius: 16px; box-shadow: 0 16px 50px rgba(0,0,0,.45);',
    'font-family: "Builder Sans", Helvetica, Arial, sans-serif; overflow: hidden; }',
    '.top { display: flex; align-items: center; gap: 8px; padding: 10px 12px; cursor: grab; user-select: none; }',
    '.top:active { cursor: grabbing; }',
    '.mark { width: 22px; height: 22px; border-radius: 6px; display: block; background: #f4f4f5; }',
    '.word { font-weight: 700; letter-spacing: -0.03em; font-size: 14px; }',
    '.hide { margin-left: auto; border: 0; background: transparent; color: #9a9aa2; font: 600 12px/1 Helvetica, Arial, sans-serif; cursor: pointer; padding: 4px; }',
    '.hide:hover { color: #f4f4f5; }',
    '.body { padding: 0 12px 12px; max-height: min(70vh, 520px); overflow: auto; }',
    '.card.is-collapsed .body { display: none; }',
    '.kicker { margin: 0 0 4px; color: #9a9aa2; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; }',
    '.headline { margin: 0; font-size: 40px; line-height: .95; font-weight: 700; letter-spacing: -0.04em; font-variant-numeric: tabular-nums; }',
    '.good { color: #3ddc97; } .hot { color: #ffb020; } .bad { color: #ff6b6b; } .calm { color: #9ecbff; }',
    '.sub { margin: 6px 0 0; color: #b7b7be; font-size: 13px; line-height: 1.35; }',
    '.rows { margin-top: 12px; display: grid; gap: 6px; }',
    '.row { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; }',
    '.row span { color: #8d8d95; }',
    '.row strong { font-weight: 600; text-align: right; }',
    '.block { margin-top: 14px; }',
    '.block h3 { margin: 0 0 8px; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #9a9aa2; font-weight: 700; }',
    '.sig { display: flex; gap: 8px; }',
    '.col { flex: 1; min-width: 0; text-align: center; }',
    '.count { font-size: 11px; color: #d5d5da; font-variant-numeric: tabular-nums; }',
    '.track { height: 52px; display: flex; align-items: flex-end; border-bottom: 1px solid #2a2a2e; margin-top: 4px; }',
    '.bar { width: 100%; border-radius: 3px 3px 0 0; }',
    '.tier { display: block; margin-top: 4px; font-size: 10px; letter-spacing: .04em; color: #7d7d85; }',
    '.shelf { display: grid; gap: 8px; }',
    '.shelf-row { display: flex; gap: 8px; align-items: center; }',
    '.shelf-row img { width: 36px; height: 36px; border-radius: 8px; background: #1a1a1e; object-fit: cover; }',
    '.ph { width: 36px; height: 36px; border-radius: 8px; background: #1a1a1e; flex: 0 0 auto; }',
    '.name { font-size: 13px; font-weight: 600; line-height: 1.25; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }',
    '.meta { font-size: 11px; color: #8d8d95; margin-top: 2px; }',
    '.note { margin: 10px 0 0; font-size: 12px; color: #8d8d95; line-height: 1.4; }',
    '.retry { margin-top: 10px; border: 1px solid #2c2c30; background: #17171a; color: #f4f4f5; border-radius: 999px; padding: 6px 10px; font: 600 12px/1 Helvetica, Arial, sans-serif; cursor: pointer; }',
    'button:focus-visible { outline: 2px solid #3ddc97; outline-offset: 2px; }',
  ].join('');

  const BARS = [
    ['common', 'Com', '#9b9ba1'],
    ['uncommon', 'Unc', '#3ddc97'],
    ['rare', 'Rar', '#4c9aff'],
    ['epic', 'Epi', '#c77dff'],
    ['legendary', 'Leg', '#ffc14d'],
  ];

  let ui = null;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function place(host, settings) {
    host.style.position = 'fixed';
    host.style.zIndex = '9999';
    host.style.fontFamily = 'Helvetica, Arial, sans-serif';
    const anchor = settings && settings.anchor;
    if (anchor && Number.isFinite(anchor.left) && Number.isFinite(anchor.top)) {
      host.style.left = anchor.left + 'px';
      host.style.top = anchor.top + 'px';
      host.style.right = 'auto';
      host.style.bottom = 'auto';
      return;
    }
    host.style.left = 'auto';
    host.style.top = 'auto';
    host.style.right = '20px';
    host.style.bottom = '20px';
  }

  function mount(settings, handlers) {
    if (!ui) {
      const host = document.createElement('div');
      host.id = 'tironblox-host';
      const shadow = host.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = CSS;
      const card = el('article', 'card');
      card.setAttribute('role', 'complementary');
      card.setAttribute('aria-label', 'Tironblox');
      const top = el('div', 'top');
      top.title = 'Drag to move';
      const mark = document.createElement('img');
      mark.className = 'mark';
      mark.alt = '';
      mark.width = 22;
      mark.height = 22;
      mark.src = chrome.runtime.getURL('icons/icon48.png');
      const word = el('div', 'word', 'Tironblox');
      const hide = el('button', 'hide', 'Hide');
      hide.type = 'button';
      hide.setAttribute('aria-expanded', 'true');
      top.append(mark, word, hide);
      const body = el('div', 'body');
      card.append(top, body);
      shadow.append(style, card);
      document.documentElement.appendChild(host);
      ui = { host, shadow, card, body, hide, handlers: handlers || {} };

      hide.addEventListener('click', function () {
        const collapsed = !card.classList.contains('is-collapsed');
        card.classList.toggle('is-collapsed', collapsed);
        hide.textContent = collapsed ? 'Show' : 'Hide';
        hide.setAttribute('aria-expanded', String(!collapsed));
        if (ui.handlers.onCollapsed) ui.handlers.onCollapsed(collapsed);
      });

      top.addEventListener('pointerdown', function (event) {
        if (event.target.closest('button')) return;
        const rect = host.getBoundingClientRect();
        const dx = event.clientX - rect.left;
        const dy = event.clientY - rect.top;
        host.style.right = 'auto';
        host.style.bottom = 'auto';
        function move(moveEvent) {
          const left = Math.min(window.innerWidth - 80, Math.max(8, moveEvent.clientX - dx));
          const topEdge = Math.min(window.innerHeight - 40, Math.max(8, moveEvent.clientY - dy));
          host.style.left = left + 'px';
          host.style.top = topEdge + 'px';
        }
        function up() {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          if (ui.handlers.onDragEnd) {
            ui.handlers.onDragEnd({
              left: Number.parseFloat(host.style.left),
              top: Number.parseFloat(host.style.top),
            });
          }
        }
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      });
    }
    ui.handlers = handlers || {};
    const collapsed = Boolean(settings && settings.collapsed);
    ui.card.classList.toggle('is-collapsed', collapsed);
    ui.hide.textContent = collapsed ? 'Show' : 'Hide';
    ui.hide.setAttribute('aria-expanded', String(!collapsed));
    place(ui.host, settings);
    return ui;
  }

  function render(model) {
    if (!ui) return;
    const body = ui.body;
    body.replaceChildren();
    body.appendChild(el('p', 'kicker', model.kicker || 'Tironblox'));
    const headline = el('p', 'headline ' + (model.tone || 'good'), model.headline || '—');
    body.appendChild(headline);
    if (model.sub) body.appendChild(el('p', 'sub', model.sub));
    if (model.rows && model.rows.length) {
      const rows = el('div', 'rows');
      for (const row of model.rows) {
        const line = el('div', 'row');
        line.append(el('span', '', row.label), el('strong', '', row.value));
        rows.appendChild(line);
      }
      body.appendChild(rows);
    }
    if (model.signature) {
      const block = el('div', 'block');
      block.appendChild(el('h3', '', 'Signature'));
      const sig = el('div', 'sig');
      const max = Math.max.apply(null, BARS.map(function (bar) {
        return model.signature[bar[0]] || 0;
      }).concat([1]));
      for (const bar of BARS) {
        const count = model.signature[bar[0]] || 0;
        const col = el('div', 'col');
        col.title = bar[0] + ' ' + count;
        col.appendChild(el('div', 'count', String(count)));
        const track = el('div', 'track');
        const fill = el('div', 'bar');
        fill.style.height = Math.round((count / max) * 52) + 'px';
        fill.style.background = bar[2];
        track.appendChild(fill);
        col.append(track, el('span', 'tier', bar[1]));
        sig.appendChild(col);
      }
      block.appendChild(sig);
      body.appendChild(block);
    }
    if (model.shelf && model.shelf.length) {
      const block = el('div', 'block');
      block.appendChild(el('h3', '', 'Rarest'));
      const shelf = el('div', 'shelf');
      for (const item of model.shelf) {
        const row = el('div', 'shelf-row');
        if (item.iconUrl && root.TironScore.isRobloxCdn(item.iconUrl)) {
          const img = document.createElement('img');
          img.alt = '';
          img.src = item.iconUrl;
          row.appendChild(img);
        } else {
          row.appendChild(el('div', 'ph'));
        }
        const copy = el('div');
        copy.append(el('div', 'name', item.name), el('div', 'meta', item.meta));
        row.appendChild(copy);
        shelf.appendChild(row);
      }
      block.appendChild(shelf);
      body.appendChild(block);
    }
    if (model.note) body.appendChild(el('p', 'note', model.note));
    if (model.retry) {
      const button = el('button', 'retry', 'Try again');
      button.type = 'button';
      button.addEventListener('click', model.retry);
      body.appendChild(button);
    }
  }

  function remove() {
    if (!ui) return;
    ui.host.remove();
    ui = null;
  }

  function chip(scored) {
    const node = document.createElement('span');
    node.className = 'tironblox-chip';
    if (!scored) {
      node.dataset.tier = 'unknown';
      node.textContent = '…';
      node.title = 'Scoring this badge';
      return node;
    }
    node.dataset.tier = scored.tier;
    node.textContent = scored.points > 0 ? String(scored.points) : '–';
    node.title = scored.points > 0
      ? root.TironScore.tierLabel(scored.tier) + ' · ' + root.TironScore.percentLabel(scored.percent) + ' · ' + root.TironScore.rarityLine(scored)
      : root.TironScore.rarityLine(scored);
    return node;
  }

  root.TironUi = { mount: mount, render: render, remove: remove, chip: chip };
})(globalThis);
