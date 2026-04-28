/* SportsPayCoin: interactive bits
   - Countdown to June 10, 2026 17:00 UK time (BST = UTC+1)
   - SOL/USD area chart (static demo data)
   - Token distribution donut animation
   - Reveal-on-scroll
*/

(function () {
  'use strict';

  // ============================================================
  // Countdown: June 10, 2026 17:00 UK (BST = UTC+1)
  // ============================================================
  const TARGET = Date.UTC(2026, 5, 10, 16, 0, 0); // 16:00 UTC = 17:00 BST

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function tickCountdown() {
    const els = {
      d: document.querySelector('[data-cd="d"]'),
      h: document.querySelector('[data-cd="h"]'),
      m: document.querySelector('[data-cd="m"]'),
      s: document.querySelector('[data-cd="s"]')
    };
    if (!els.d) return;

    const diff = Math.max(0, TARGET - Date.now());
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diff / (1000 * 60)) % 60);
    const secs = Math.floor((diff / 1000) % 60);

    els.d.textContent = pad(days);
    els.h.textContent = pad(hours);
    els.m.textContent = pad(mins);
    els.s.textContent = pad(secs);
  }

  // ============================================================
  // SOL/USD chart: live data from Zerion via /api/sol-chart
  // Falls back to a static curve if the API is unreachable.
  // ============================================================
  const STATIC_CHART_FALLBACK = [83.4, 82.1, 84.6, 86.8, 89.2, 88.0, 85.9, 87.4, 88.7, 87.1, 85.4, 86.0, 87.6, 89.9, 91.2, 90.0, 88.3, 86.9, 87.5, 86.49];

  // Fetches 24h SOL/USD price series from CoinGecko (free, CORS-enabled, no key needed).
  // Returns [{ ts, price }, ...] decimated to ~80 points.
  async function fetchChartPoints() {
    try {
      const url = 'https://api.coingecko.com/api/v3/coins/solana/market_chart?vs_currency=usd&days=1';
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const d = await res.json();
      const raw = (d && Array.isArray(d.prices)) ? d.prices : [];
      if (!raw.length) throw new Error('no points');
      // CoinGecko returns [[ts_ms, price], ...]
      const src = raw.map(([ts, price]) => ({ ts: ts / 1000, price }));
      const step = Math.max(1, Math.floor(src.length / 80));
      const out = [];
      for (let i = 0; i < src.length; i += step) out.push(src[i]);
      if (out[out.length - 1] !== src[src.length - 1]) out.push(src[src.length - 1]);
      return out;
    } catch (e) {
      return STATIC_CHART_FALLBACK.map((p, i) => ({ ts: Date.now() / 1000 - (STATIC_CHART_FALLBACK.length - 1 - i) * 4320, price: p }));
    }
  }

  function renderSolChart(points) {
    const svg = document.getElementById('sol-chart');
    if (!svg) return;

    const W = 1000, H = 360;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio', 'none');

    const prices = points.map((p) => p.price);
    const data = prices;
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const span = Math.max(0.5, maxP - minP);
    const yPad = span * 0.15; // 15% breathing room top/bottom
    const yMin = minP - yPad;
    const yMax = maxP + yPad;
    const padX = 40, padY = 20;
    const innerW = W - padX * 2;
    const innerH = H - padY * 2;

    function px(i) { return padX + (i / (data.length - 1)) * innerW; }
    function py(v) { return padY + innerH - ((v - yMin) / (yMax - yMin)) * innerH; }

    // Smooth path via simple cubic curves
    let d = `M ${px(0)} ${py(data[0])}`;
    for (let i = 1; i < data.length; i++) {
      const x0 = px(i - 1), y0 = py(data[i - 1]);
      const x1 = px(i),     y1 = py(data[i]);
      const cx = (x0 + x1) / 2;
      d += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
    }

    const areaD = d + ` L ${px(data.length - 1)} ${H - padY} L ${px(0)} ${H - padY} Z`;

    // Build SVG content
    const NS = 'http://www.w3.org/2000/svg';

    // Gridlines: derive 4 round-ish ticks from the live range
    const grid = document.createElementNS(NS, 'g');
    grid.setAttribute('stroke', 'rgba(255,255,255,0.06)');
    grid.setAttribute('stroke-dasharray', '3 5');
    const tickStep = span / 3;
    const tickRound = tickStep > 5 ? 1 : tickStep > 1 ? 0.5 : 0.25;
    const ticks = [];
    for (let i = 0; i < 4; i++) {
      const v = minP + tickStep * i;
      ticks.push(Math.round(v / tickRound) * tickRound);
    }
    ticks.forEach((v) => {
      const y = py(v);
      const line = document.createElementNS(NS, 'line');
      line.setAttribute('x1', padX); line.setAttribute('x2', W - padX);
      line.setAttribute('y1', y);    line.setAttribute('y2', y);
      grid.appendChild(line);

      const lbl = document.createElementNS(NS, 'text');
      lbl.setAttribute('x', 8); lbl.setAttribute('y', y + 4);
      lbl.setAttribute('fill', 'rgba(255,255,255,0.45)');
      lbl.setAttribute('font-family', 'JetBrains Mono, monospace');
      lbl.setAttribute('font-size', '10');
      lbl.textContent = '$' + v.toFixed(tickRound < 1 ? 2 : 0);
      grid.appendChild(lbl);
    });

    // Defs: gradients
    const defs = document.createElementNS(NS, 'defs');
    defs.innerHTML = `
      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.35"/>
        <stop offset="50%" stop-color="#8b5cf6" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="#0099ff" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#22d3ee"/>
        <stop offset="50%" stop-color="#8b5cf6"/>
        <stop offset="100%" stop-color="#f472b6"/>
      </linearGradient>
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>`;

    const area = document.createElementNS(NS, 'path');
    area.setAttribute('d', areaD);
    area.setAttribute('fill', 'url(#areaGrad)');

    const line = document.createElementNS(NS, 'path');
    line.setAttribute('d', d);
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', 'url(#lineGrad)');
    line.setAttribute('stroke-width', '2.5');
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('filter', 'url(#glow)');

    // End dot
    const lastX = px(data.length - 1);
    const lastY = py(data[data.length - 1]);
    const dotOuter = document.createElementNS(NS, 'circle');
    dotOuter.setAttribute('cx', lastX); dotOuter.setAttribute('cy', lastY);
    dotOuter.setAttribute('r', '8');
    dotOuter.setAttribute('fill', '#22d3ee');
    dotOuter.setAttribute('opacity', '0.25');
    const dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('cx', lastX); dot.setAttribute('cy', lastY);
    dot.setAttribute('r', '4');
    dot.setAttribute('fill', '#fff');

    svg.innerHTML = '';
    svg.appendChild(defs);
    svg.appendChild(grid);
    svg.appendChild(area);
    svg.appendChild(line);
    svg.appendChild(dotOuter);
    svg.appendChild(dot);

    // Animate line drawing
    const length = line.getTotalLength();
    line.style.strokeDasharray = length;
    line.style.strokeDashoffset = length;
    requestAnimationFrame(() => {
      line.style.transition = 'stroke-dashoffset 1.6s cubic-bezier(.2,.7,.2,1)';
      line.style.strokeDashoffset = 0;
    });
    area.style.opacity = 0;
    requestAnimationFrame(() => {
      area.style.transition = 'opacity 1.6s ease 0.4s';
      area.style.opacity = 1;
    });

    // Update axis labels with live timestamps
    const axis = document.querySelector('.chart-axis');
    if (axis && points.length) {
      const tsStart = points[0].ts * 1000;
      const tsEnd = points[points.length - 1].ts * 1000;
      const labels = axis.querySelectorAll('span');
      const fmt = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      labels.forEach((el, i) => {
        const f = i / (labels.length - 1);
        el.textContent = fmt(new Date(tsStart + (tsEnd - tsStart) * f));
      });
    }

    // Update foot label with source attribution
    const foot = document.querySelector('.chart-foot');
    if (foot) {
      const left = foot.querySelector('span:first-child');
      if (left) left.textContent = 'Powered by CoinGecko';
    }
  }

  async function drawSolChart() {
    const svg = document.getElementById('sol-chart');
    if (!svg) return;
    const points = await fetchChartPoints();
    renderSolChart(points);
  }

  // ============================================================
  // Donut chart: token distribution (4 segments)
  // ============================================================
  function drawDonut() {
    const svg = document.getElementById('donut');
    if (!svg) return;

    const segments = [
      { value: 80, color: 'url(#dgrad1)', name: 'Public Sale & Liquidity', short: 'Public', desc: 'Total SPC' },
      { value: 10, color: 'url(#dgrad2)', name: 'Core Team',              short: 'Team',   desc: 'Vested over time' },
      { value: 5,  color: 'url(#dgrad3)', name: 'Community Rewards',      short: 'Comm.',  desc: 'Airdrops & incentives' },
      { value: 5,  color: 'url(#dgrad4)', name: 'Athletes Reserve',       short: 'Athl.',  desc: 'Partnerships & integrations' }
    ];
    const total = segments.reduce((s, x) => s + x.value, 0);
    const cx = 200, cy = 200;
    const r = 145, stroke = 36;
    const C = 2 * Math.PI * r;

    svg.setAttribute('viewBox', '0 0 400 400');

    let html = `
      <defs>
        <linearGradient id="dgrad1" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#22d3ee"/><stop offset="100%" stop-color="#0099ff"/>
        </linearGradient>
        <linearGradient id="dgrad2" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#8b5cf6"/><stop offset="100%" stop-color="#6d28d9"/>
        </linearGradient>
        <linearGradient id="dgrad3" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#f472b6"/><stop offset="100%" stop-color="#ec4899"/>
        </linearGradient>
        <linearGradient id="dgrad4" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#fbbf24"/><stop offset="100%" stop-color="#f97316"/>
        </linearGradient>
        <filter id="dglow"><feGaussianBlur stdDeviation="6"/></filter>
      </defs>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="${stroke}"/>
    `;

    let offset = 0;
    segments.forEach((seg, idx) => {
      const len = (seg.value / total) * C;
      const dash = `${len} ${C - len}`;
      const startDelay = idx * 180;
      html += `
        <circle
          class="seg" data-idx="${idx}"
          cx="${cx}" cy="${cy}" r="${r}"
          fill="none"
          stroke="${seg.color}"
          stroke-width="${stroke}"
          stroke-dasharray="${dash}"
          stroke-dashoffset="${-offset}"
          stroke-linecap="butt"
          style="opacity:0; animation: donutIn 1.2s cubic-bezier(.2,.7,.2,1) ${startDelay}ms forwards;"
        />`;
      offset += len + 1.5;
    });

    svg.innerHTML = html;

    if (!document.getElementById('donut-kf')) {
      const style = document.createElement('style');
      style.id = 'donut-kf';
      style.textContent = `@keyframes donutIn { from { opacity: 0; stroke-dashoffset: var(--from); } to { opacity: 1; } }`;
      document.head.appendChild(style);
    }

    // Hover interactivity: update the center text on hover
    const center = document.querySelector('.donut-center');
    if (!center) return;
    const numEl = center.querySelector('.num');
    const lblEl = center.querySelector('.lbl');
    const defaults = { num: numEl.textContent, lbl: lblEl.textContent };

    svg.querySelectorAll('circle.seg').forEach((c) => {
      c.addEventListener('mouseenter', () => {
        const seg = segments[+c.getAttribute('data-idx')];
        numEl.textContent = seg.value + '%';
        lblEl.textContent = seg.name;
        center.classList.add('hot');
      });
      c.addEventListener('mouseleave', () => {
        numEl.textContent = defaults.num;
        lblEl.textContent = defaults.lbl;
        center.classList.remove('hot');
      });
    });
  }

  // ============================================================
  // Count-up animation for elements with [data-count]
  // ============================================================
  function animateCount(el) {
    const target = parseFloat(el.getAttribute('data-count'));
    const prefix = el.getAttribute('data-prefix') || '';
    const suffix = el.getAttribute('data-suffix') || '';
    const isFloat = !Number.isInteger(target);
    const duration = 1400;
    const start = performance.now();
    function frame(t) {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = target * eased;
      el.textContent = prefix + (isFloat ? v.toFixed(1) : Math.round(v)) + suffix;
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = prefix + (isFloat ? target.toFixed(1) : target) + suffix;
    }
    requestAnimationFrame(frame);
  }
  function setupCountUp() {
    const els = document.querySelectorAll('[data-count]');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) {
      els.forEach(animateCount);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          animateCount(e.target);
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.4 });
    els.forEach((el) => io.observe(el));
  }

  // ============================================================
  // Reveal on scroll
  // ============================================================
  function setupReveal() {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window) || !els.length) {
      els.forEach((el) => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    els.forEach((el) => io.observe(el));
  }

  // ============================================================
  // Live SOL/USD price: polls /api/sol-price every 30s
  // Updates #sol-price and #sol-change. Falls back silently on error.
  // ============================================================
  function formatPrice(p) {
    return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function formatChange(c) {
    if (c == null || isNaN(c)) return '';
    const sign = c >= 0 ? '+' : '';
    return sign + c.toFixed(2) + '%';
  }
  async function fetchSolPrice() {
    const priceEl = document.getElementById('sol-price');
    const changeEl = document.getElementById('sol-change');
    if (!priceEl) return;
    try {
      const url = 'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true';
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const d = await res.json();
      const price = d && d.solana && d.solana.usd;
      const change = d && d.solana && d.solana.usd_24h_change;
      if (typeof price === 'number') {
        priceEl.textContent = formatPrice(price);
        priceEl.classList.add('live');
      }
      if (changeEl && change != null) {
        changeEl.textContent = formatChange(change);
        changeEl.classList.toggle('chart-change-up', change >= 0);
        changeEl.classList.toggle('chart-change-down', change < 0);
      }
    } catch (e) {
      // keep static fallback values
    }
  }
  function setupSolPrice() {
    fetchSolPrice();
    setInterval(fetchSolPrice, 30 * 1000);
  }

  // ============================================================
  // Cursor-follow background glow: eased trail
  // ============================================================
  function setupCursorGlow() {
    const glow = document.querySelector('.cursor-glow');
    if (!glow) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (matchMedia('(hover: none)').matches) {
      glow.style.display = 'none';
      return;
    }

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;

    window.addEventListener('mousemove', (e) => {
      targetX = e.clientX;
      targetY = e.clientY;
    }, { passive: true });

    window.addEventListener('mouseleave', () => {
      glow.style.opacity = '0';
    });
    window.addEventListener('mouseenter', () => {
      glow.style.opacity = '1';
    });

    function frame() {
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;
      glow.style.transform =
        'translate3d(' + (currentX - 350) + 'px, ' + (currentY - 350) + 'px, 0)';
      requestAnimationFrame(frame);
    }
    glow.style.left = '0';
    glow.style.top = '0';
    requestAnimationFrame(frame);
  }

  // ============================================================
  // News: latest sports + crypto headlines
  // Pulls Cointelegraph (and Decrypt as fallback) via rss2json — both free,
  // no API key, CORS-enabled. Filter prefers sports-tagged stories; if too
  // few match, falls back to top general crypto news so the grid is never
  // empty.
  // ============================================================
  const NEWS_KEYWORDS = [
    'sport', 'sports', 'athlete', 'athletes', 'nba', 'nfl', 'fifa',
    'soccer', 'football', 'tennis', 'baseball', 'basketball', 'olympic',
    'olympics', 'fan token', 'fan tokens', 'club', 'league', 'team',
    'nhl', 'mlb', 'mls', 'esports', 'fitness', 'la liga', 'premier league',
    'chiliz', 'socios', 'racing', 'f1', 'formula 1', 'world cup', 'cricket'
  ];
  const NEWS_FEEDS = [
    { url: 'https://cointelegraph.com/rss', source: 'Cointelegraph' },
    { url: 'https://decrypt.co/feed',       source: 'Decrypt' }
  ];

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  // Defence in depth: only allow http(s) URLs from feeds, and reject any
  // string containing characters that could break out of an HTML attribute
  // or a CSS url() declaration. Blocks `javascript:` href XSS and
  // background-image CSS injection from a compromised feed source.
  function safeHttpUrl(s) {
    if (!s) return '';
    const u = String(s).trim();
    if (!/^https?:\/\//i.test(u)) return '';
    if (/['"<>\\\s;()]/.test(u)) return '';
    return u;
  }
  function stripTags(html) {
    return String(html || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function firstImage(item) {
    if (item.thumbnail) return item.thumbnail;
    if (item.enclosure && item.enclosure.link) return item.enclosure.link;
    const m = String(item.content || item.description || '').match(/<img[^>]+src="([^"]+)"/i);
    return m ? m[1] : '';
  }
  function parsePubDate(s) {
    if (!s) return 0;
    // rss2json returns "YYYY-MM-DD HH:MM:SS" in UTC
    const safe = s.includes('T') ? s : s.replace(' ', 'T') + 'Z';
    const t = Date.parse(safe);
    return isNaN(t) ? 0 : Math.floor(t / 1000);
  }
  function timeAgo(unixSec) {
    if (!unixSec) return '';
    const diff = (Date.now() / 1000) - unixSec;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return new Date(unixSec * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  function buildNewsCard(item) {
    const safeLink = safeHttpUrl(item.link);
    const safeImg  = safeHttpUrl(item._img);
    // Drop the card entirely if the link isn't a normal http(s) URL —
    // a card you can't safely click adds no value.
    if (!safeLink) return '';
    const title = escapeHtml(item.title || '');
    const url = escapeHtml(safeLink);
    const source = escapeHtml(item._source || 'News');
    const img = escapeHtml(safeImg);
    const snippet = escapeHtml(((item._text || '').slice(0, 180)).trim() + (item._text && item._text.length > 180 ? '...' : ''));
    const when = timeAgo(item._ts);
    return (
      '<a class="news-card" href="' + url + '" target="_blank" rel="noopener noreferrer">' +
        '<div class="news-thumb"' + (img ? ' style="background-image:url(\'' + img + '\')"' : '') + '></div>' +
        '<div class="news-body">' +
          '<span class="news-source">' + source + '</span>' +
          '<h3 class="news-title">' + title + '</h3>' +
          '<p class="news-snippet">' + snippet + '</p>' +
          '<div class="news-meta"><span>' + when + '</span><span class="news-arrow">Read &rsaquo;</span></div>' +
        '</div>' +
      '</a>'
    );
  }
  async function fetchFeed(feed) {
    const proxy = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(feed.url);
    const res = await fetch(proxy, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data || data.status !== 'ok' || !Array.isArray(data.items)) throw new Error('bad feed');
    return data.items.map(it => ({
      ...it,
      _source: feed.source,
      _img: firstImage(it),
      _text: stripTags(it.description || it.content || ''),
      _ts: parsePubDate(it.pubDate)
    }));
  }
  async function loadNews() {
    const grid = document.getElementById('news-grid');
    if (!grid) return;
    // Try each feed, keep going on failure so a single bad source doesn't kill the section
    let allItems = [];
    for (const feed of NEWS_FEEDS) {
      try {
        const items = await fetchFeed(feed);
        allItems = allItems.concat(items);
      } catch (e) {
        // ignore, try next
      }
    }
    if (!allItems.length) {
      grid.innerHTML = '<div class="news-empty">Couldn\'t load latest news right now. Try again later.</div>';
      return;
    }
    // Sort newest first
    allItems.sort((a, b) => (b._ts || 0) - (a._ts || 0));
    // Prefer sports-tagged stories
    const matches = allItems.filter(it => {
      const text = ((it.title || '') + ' ' + (it._text || '') + ' ' + (it.categories || []).join(' ')).toLowerCase();
      return NEWS_KEYWORDS.some(k => text.includes(k));
    });
    const chosen = (matches.length >= 3 ? matches : allItems).slice(0, 6);
    grid.innerHTML = chosen.map(buildNewsCard).join('');
  }

  // ============================================================
  // Hero presale video: muted autoplay + click-to-unmute toggle.
  // Browsers only allow autoplay when the video is muted, so we start
  // muted and let the user opt in to sound via the corner button.
  // ============================================================
  function setupPresaleVideo() {
    const video = document.getElementById('presale-video');
    const btn   = document.getElementById('presale-mute');
    if (!video || !btn) return;

    const ico = btn.querySelector('.presale-mute-ico');
    const ICON_MUTED =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>' +
      '<line x1="22" y1="9" x2="16" y2="15"/>' +
      '<line x1="16" y1="9" x2="22" y2="15"/>' +
      '</svg>';
    const ICON_SOUND =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>' +
      '<path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>' +
      '<path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>' +
      '</svg>';

    function refresh() {
      if (ico) ico.innerHTML = video.muted ? ICON_MUTED : ICON_SOUND;
      btn.setAttribute('aria-label', video.muted ? 'Unmute video' : 'Mute video');
      btn.setAttribute('aria-pressed', String(!video.muted));
    }
    refresh();

    btn.addEventListener('click', () => {
      video.muted = !video.muted;
      // Some browsers pause when toggling mute mid-stream, so re-kick play
      if (!video.muted) video.play().catch(() => {});
      refresh();
    });

    // If autoplay is blocked, still keep things tidy
    video.addEventListener('volumechange', refresh);
  }

  // ============================================================
  // Boot
  // ============================================================
  document.addEventListener('DOMContentLoaded', () => {
    tickCountdown();
    setInterval(tickCountdown, 1000);
    drawSolChart();
    drawDonut();
    setupReveal();
    setupCursorGlow();
    setupSolPrice();
    setupCountUp();
    setupPresaleVideo();
    loadNews();
  });
})();
