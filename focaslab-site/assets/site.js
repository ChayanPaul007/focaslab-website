const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const get = f => fetch(`data/${f}.json`, { cache: 'no-cache' }).then(r => r.json());
const PAGE = document.body.dataset.page;

/* ---------- theme ---------- */
const saved = (() => { try { return localStorage.getItem('theme'); } catch { return null; } })();
if (saved) document.documentElement.dataset.theme = saved;
function toggleTheme() {
  const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  const next = dark ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch { }
}

/* ---------- shell ---------- */
const LOGO = `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M2 5 C12 5 16 13 30 14.5" stroke="var(--accent)" stroke-width="2"/><path d="M2 27 C12 27 16 19 30 17.5" stroke="var(--accent)" stroke-width="2"/><path d="M3 20 C9 9 15 21 29 16" stroke="var(--ink)" stroke-width="1.6"/><circle cx="29" cy="16" r="2.2" fill="var(--ink)"/></svg>`;
const NAV = [['index.html', 'Home', 'home'], ['research.html', 'Research', 'research'], ['people.html', 'People', 'people'], ['publications.html', 'Publications', 'publications'], ['facilities.html', 'Facilities', 'facilities'], ['join.html', 'Join', 'join']];

function shell(site) {
  document.body.insertAdjacentHTML('afterbegin', `
  <header class="nav"><div class="wrap">
    <a class="brand" href="index.html">${LOGO}<span>FOCAS<br><small>IISc · CPS</small></span></a>
    <nav class="links" id="links">${NAV.map(([h, l, k]) => `<a href="${h}" class="${k === PAGE ? 'active' : ''}">${l}</a>`).join('')}</nav>
    <div style="display:flex;gap:8px">
      <button class="icon-btn" id="theme" aria-label="Toggle theme"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg></button>
      <button class="icon-btn burger" id="burger" aria-label="Menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8h16M4 16h16"/></svg></button>
    </div>
  </div></header>`);
  document.body.insertAdjacentHTML('beforeend', `
  <footer><div class="wrap">
    <div><div class="big">FOCAS <em class="accent">Lab</em></div><p>${esc(site.full_name)}<br>${esc(site.department)}<br>${esc(site.institute)}</p></div>
    <div><h5>Visit</h5><p>${site.address.map(esc).join('<br>')}</p><a href="${site.map}" target="_blank" rel="noopener">Open in Maps ↗</a></div>
    <div><h5>Elsewhere</h5><a href="mailto:${site.email}">${site.email}</a><a href="${site.links.scholar}" target="_blank" rel="noopener">Google Scholar ↗</a><a href="${site.links.github}" target="_blank" rel="noopener">GitHub ↗</a><a href="${site.links.youtube}" target="_blank" rel="noopener">YouTube ↗</a></div>
    <div class="base mono"><span>© ${new Date().getFullYear()} FOCAS Lab, IISc Bengaluru</span><span>Publications sync weekly from Google Scholar</span></div>
  </div></footer>`);
  $('#theme').onclick = toggleTheme;
  $('#burger').onclick = () => $('#links').classList.toggle('open');
  const nav = $('.nav'); addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 8), { passive: true });
}

function reveal() {
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.rv').forEach(el => io.observe(el));
}

/* ---------- publications helpers ---------- */
const kind = v => {
  if (!v) return 'other';
  if (/arxiv|preprint|e-prints/i.test(v)) return 'preprint';
  if (/universit|institute of technology|technische/i.test(v)) return 'thesis';
  if (/conference|proceedings|symposium|workshop|papersonline|allerton|congress/i.test(v)) return 'conference';
  return 'journal';
};
const LABEL = { journal: 'Journal', conference: 'Conference', preprint: 'Preprint', thesis: 'Thesis', other: 'Other' };
const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function prepPubs(data) {
  const sid = data.scholar_id;
  const items = data.items.filter(p => p.title).map(p => {
    const ax = (p.venue || '').match(/arxiv[:\s]*(?:arxiv:)?\s*([0-9]{4}\.[0-9]{4,5})/i);
    const id = (p.id || '').includes(':') ? p.id : `${sid}:${p.id}`;
    return { ...p, kind: kind(p.venue), arxiv: ax ? ax[1] : null, key: norm(p.title), url: `https://scholar.google.com/citations?view_op=view_citation&hl=en&user=${sid}&citation_for_view=${id}` };
  });
  const best = {};
  const rank = p => (p.kind === 'preprint' ? 0 : 10) + (p.citations || 0) / 1e4;
  items.forEach(p => { if (!best[p.key] || rank(p) > rank(best[p.key])) best[p.key] = p; });
  items.forEach(p => { p.dup = best[p.key] !== p; const alt = items.find(q => q.key === p.key && q !== p && q.arxiv); if (!p.arxiv && alt) p.arxiv = alt.arxiv; });
  return items;
}
const authors = a => esc(a).replace(/\bP(?:ushpak)? Jagtap\b/g, m => `<b>${m}</b>`).replace(/J Pushpak/g, '<b>J Pushpak</b>');
const pubHTML = (p, short) => `
  <article class="pub">
    <div>
      <div class="t"><a href="${p.url}" target="_blank" rel="noopener">${esc(p.title)}</a></div>
      <div class="a">${authors(p.authors)}</div>
      ${p.venue ? `<div class="v">${esc(p.venue.replace(/,\s*\d{4}$/, ''))}</div>` : ''}
    </div>
    <div class="side">
      <span class="tag ${p.kind}">${LABEL[p.kind]}</span>
      ${short ? `<span class="cites">${p.year || ''}</span>` : `
      ${p.citations ? `<span class="cites">${p.citations} cit.</span>` : ''}
      <span class="lk">${p.arxiv ? `<a href="https://arxiv.org/abs/${p.arxiv}" target="_blank" rel="noopener">arXiv</a>` : ''}<a href="${p.url}" target="_blank" rel="noopener">Scholar</a></span>`}
    </div>
  </article>`;

/* ---------- pages ---------- */
const pages = {
  async home(site) {
    const [pub, ppl, fac] = await Promise.all([get('publications'), get('people'), get('facilities')]);
    const items = prepPubs(pub).filter(p => !p.dup);
    const members = 1 + ppl.groups.reduce((n, g) => n + g.members.length, 0) + ppl.lists.reduce((n, g) => n + g.members.length, 0);
    const robots = fac.filter(g => g.group !== 'Infrastructure').reduce((n, g) => n + g.items.length, 0);
    $('#stats').innerHTML = [[items.length, 'Publications'], [pub.profile.citations.toLocaleString(), 'Citations'], [members, 'Members'], [robots, 'Robots']]
      .map(([v, l]) => `<div class="stat"><b>${v}</b><span class="mono">${l}</span></div>`).join('');
    $('#themes').innerHTML = site.research.map((r, i) => `
      <a class="theme rv" href="research.html#${r.id}">
        <span class="num">0${i + 1}</span>
        <div><h3>${esc(r.title)}</h3><span class="k mono">${esc(r.kicker)}</span></div>
        <p>${esc(r.text)}</p><span class="arrow">→</span>
      </a>`).join('');
    $('#news').innerHTML = site.news.slice(0, 7).map(n => `<li><span class="d">${esc(n.date)}</span><span>${esc(n.text)}</span></li>`).join('');
    const recent = items.filter(p => p.kind === 'journal' || p.kind === 'conference').sort((a, b) => (b.year || 0) - (a.year || 0)).slice(0, 5);
    $('#recent').innerHTML = recent.map(p => pubHTML(p, true)).join('');
    const figs = fac.flatMap(g => g.items).map(f => `<figure><img loading="lazy" src="${f.image}" alt="${esc(f.name)}"><figcaption>${esc(f.name)}</figcaption></figure>`).join('');
    $('#strip').innerHTML = `<div class="track">${figs}${figs}</div>`;
  },

  async research(site) {
    $('#rlist').innerHTML = site.research.map((r, i) => {
      const media = r.video ? `<iframe src="https://www.youtube-nocookie.com/embed/${r.video}" title="${esc(r.title)}" loading="lazy" allowfullscreen></iframe>`
        : r.image ? `<img loading="lazy" src="${r.image}" alt="${esc(r.title)}">`
          : `<canvas data-glyph="${i}"></canvas>`;
      return `<article class="rcard rv" id="${r.id}">
        <div><span class="mono">0${i + 1} · ${esc(r.kicker)}</span><h2>${esc(r.title)}</h2><p>${esc(r.text)}</p>
        ${r.more ? `<a class="more" href="${r.more}" target="_blank" rel="noopener">Read more on the archive site ↗</a>` : ''}</div>
        <div class="media">${media}</div></article>`;
    }).join('');
    document.querySelectorAll('canvas[data-glyph]').forEach(glyph);
  },

  async people() {
    const d = await get('people');
    const links = l => Object.entries(l || {}).map(([k, v]) => `<a href="${k === 'email' ? 'mailto:' + v : v}" target="_blank" rel="noopener">${{ web: 'Web', scholar: 'Scholar', linkedin: 'LinkedIn', researchgate: 'RG', x: 'X', email: 'Email' }[k] || k}</a>`).join('');
    const ph = (src, name) => `<div class="ph">${src ? `<img loading="lazy" src="${src}" alt="${esc(name)}" onerror="this.remove()">` : ''}<span class="init" style="z-index:-1">${esc(name.replace(/^Dr\.\s*/, '')[0])}</span></div>`;
    const pi = d.pi;
    $('#pi').innerHTML = `<div class="ph"><img src="${pi.photo}" alt="${esc(pi.name)}"></div>
      <div><span class="mono">Principal Investigator</span><h2>${esc(pi.name)}</h2><p><b>${esc(pi.role)}</b><br>${esc(pi.bio)}</p><div class="socials">${links(pi.links)}</div></div>`;
    $('#groups').innerHTML = d.groups.map(g => `
      <div class="group"><h3>${esc(g.title)} <span class="mono">${g.members.length}</span></h3><div class="grid">
      ${g.members.map(m => `<div class="person rv">${ph(m.photo, m.name)}<h4>${esc(m.name)}</h4>
        <div class="meta">Since ${esc(m.since)}${m.note ? ' · ' + esc(m.note) : ''}</div>
        ${m.topics ? `<div class="tp">${esc(m.topics)}</div>` : ''}<div class="socials">${links(m.links)}</div></div>`).join('')}
      </div></div>`).join('') +
      d.lists.map(g => `<div class="group"><h3>${esc(g.title)} <span class="mono">${g.members.length}</span></h3><div class="plain">
        ${g.members.map(m => `<a href="${m.link}" target="_blank" rel="noopener"><span>${esc(m.name)}</span><span class="mono">${esc(m.note || '↗')}</span></a>`).join('')}</div></div>`).join('');
    $('#alumni').innerHTML = d.alumni.map((g, i) => `<details class="al" ${i < 2 ? 'open' : ''}><summary>${esc(g.group)} <span class="mono">${g.members ? g.members.length : g.names.split(',').length}</span></summary>
      ${g.members ? `<table class="alumni">${g.members.map(m => `<tr><td>${esc(m[0])}</td><td>${esc(m[1])}</td><td>${esc(m[2])}</td></tr>`).join('')}</table>`
        : `<p style="color:var(--ink-2);font-size:14.5px;line-height:1.9">${esc(g.names)}</p>`}</details>`).join('');
  },

  async publications() {
    const data = await get('publications');
    const all = prepPubs(data);
    const st = { q: '', kind: 'all', year: 'all', dedupe: true };
    const years = [...new Set(all.map(p => p.year).filter(Boolean))].sort((a, b) => b - a);
    const upd = new Date(data.updated);
    $('#sync').innerHTML = `
      <span class="mono"><span class="dot"></span>Synced from Google Scholar · ${upd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
      <span class="mono">${data.profile.citations.toLocaleString()} citations</span>
      <span class="mono">h-index ${data.profile.h_index}</span>
      <span class="mono">i10 ${data.profile.i10_index}</span>
      <a class="mono" style="border-bottom:1px solid var(--accent)" href="https://scholar.google.com/citations?user=${data.scholar_id}&hl=en" target="_blank" rel="noopener">Profile ↗</a>`;
    const kinds = ['all', 'journal', 'conference', 'preprint'];
    $('#tools').innerHTML = `<input type="search" id="q" placeholder="Search titles, authors, venues…" aria-label="Search publications">
      ${kinds.map(k => `<button class="chip" data-k="${k}">${k === 'all' ? 'All' : LABEL[k]}<small></small></button>`).join('')}
      <select class="chip" id="yr" aria-label="Year"><option value="all">All years</option>${years.map(y => `<option>${y}</option>`).join('')}</select>
      <label class="toggle"><input type="checkbox" id="dd" checked> Merge versions</label>`;
    const render = () => {
      const q = st.q.toLowerCase();
      const base = all.filter(p => (!st.dedupe || !p.dup) && (st.year === 'all' || String(p.year) === st.year) && (!q || `${p.title} ${p.authors} ${p.venue}`.toLowerCase().includes(q)));
      document.querySelectorAll('[data-k]').forEach(b => { b.classList.toggle('on', b.dataset.k === st.kind); b.querySelector('small').textContent = b.dataset.k === 'all' ? base.length : base.filter(p => p.kind === b.dataset.k).length; });
      const list = base.filter(p => st.kind === 'all' || p.kind === st.kind);
      const by = {}; list.forEach(p => (by[p.year || 'Other'] ??= []).push(p));
      const ks = Object.keys(by).sort((a, b) => (b === 'Other' ? -1 : a === 'Other' ? 1 : b - a));
      $('#plist').innerHTML = ks.length ? ks.map(y => `<div class="year-block"><h3>${y}<small>${by[y].length} paper${by[y].length > 1 ? 's' : ''}</small></h3><div>${by[y].map(p => pubHTML(p)).join('')}</div></div>`).join('')
        : `<p class="empty">No publications match “${esc(st.q)}”.</p>`;
    };
    $('#q').oninput = e => { st.q = e.target.value; render(); };
    $('#yr').onchange = e => { st.year = e.target.value; render(); };
    $('#dd').onchange = e => { st.dedupe = e.target.checked; render(); };
    document.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { st.kind = b.dataset.k; render(); });
    render();
  },

  async facilities() {
    const fac = await get('facilities');
    $('#fac').innerHTML = fac.map(g => `<div class="group"><h3>${esc(g.group)} <span class="mono">${g.items.length}</span></h3><div class="fac">
      ${g.items.map(f => `<figure class="rv"><div class="im"><img loading="lazy" src="${f.image}" alt="${esc(f.name)}"></div><figcaption>${esc(f.name)}</figcaption></figure>`).join('')}</div></div>`).join('');
  },

  async join(site) {
    $('#open').innerHTML = site.openings.map(o => `<div class="rv"><h3>${esc(o.title)}</h3><p>${esc(o.text)}</p><a href="${o.href}" target="_blank" rel="noopener">${esc(o.action)} →</a></div>`).join('');
    $('#courses').innerHTML = site.courses.map(c => `<div class="course rv"><div><div class="code">${esc(c.code)}</div><span class="mono">${esc(c.note)}</span></div>
      <div><h3 class="serif" style="font-size:30px;line-height:1.1">${esc(c.title)}</h3><p style="color:var(--ink-2);margin:10px 0 14px">${esc(c.text)}</p>
      <a class="mono" style="border-bottom:1px solid var(--accent)" href="${c.link}" target="_blank" rel="noopener">Course materials on GitHub ↗</a></div></div>`).join('');
  }
};

/* small static tube glyph for research cards without media */
function glyph(cv) {
  const r = cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2), W = r.width, H = r.height, c = cv.getContext('2d');
  cv.width = W * d; cv.height = H * d; c.scale(d, d);
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const seed = +cv.dataset.glyph, rho = t => .1 + .5 * Math.exp(-3 * t);
  const mid = t => .25 * Math.sin(t * (4 + seed) + seed) * (1 - t);
  const X = t => 20 + t * (W - 40), Y = x => H / 2 - x * H * .42;
  c.fillStyle = css('--accent'); c.globalAlpha = .14; c.beginPath();
  for (let i = 0; i <= 100; i++) c.lineTo(X(i / 100), Y(mid(i / 100) + rho(i / 100)));
  for (let i = 100; i >= 0; i--) c.lineTo(X(i / 100), Y(mid(i / 100) - rho(i / 100)));
  c.fill(); c.globalAlpha = 1; c.strokeStyle = css('--accent'); c.lineWidth = 1.4;
  [1, -1].forEach(s => { c.beginPath(); for (let i = 0; i <= 100; i++) c.lineTo(X(i / 100), Y(mid(i / 100) + s * rho(i / 100))); c.stroke(); });
  c.strokeStyle = css('--ink'); c.lineWidth = 1.8; c.beginPath();
  for (let i = 0; i <= 100; i++) { const t = i / 100; c.lineTo(X(t), Y(mid(t) + rho(t) * .7 * Math.exp(-2 * t) * Math.cos(9 * t + seed))); } c.stroke();
}

(async () => {
  const site = await get('site');
  shell(site);
  try { await pages[PAGE]?.(site); } catch (e) { console.error(e); }
  reveal();
})();
