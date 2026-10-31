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
const logo = (name, alt) => `<img class="logo-light" src="assets/img/${name}.png" alt="${alt}"><img class="logo-dark" src="assets/img/${name}-dark.png" alt="" aria-hidden="true">`;
const NAV = [['index.html', 'Home', 'home'], ['research.html', 'Research', 'research'], ['people.html', 'People', 'people'], ['publications.html', 'Publications', 'publications'], ['facilities.html', 'Facilities', 'facilities'], ['teaching.html', 'Teaching', 'teaching'], ['join.html', 'Join', 'join']];

function shell(site) {
  document.body.insertAdjacentHTML('afterbegin', `
  <header class="nav"><div class="wrap">
    <a class="brand" href="index.html" aria-label="FOCAS Lab home">${logo('focas-mark', 'FOCAS')}<small>IISc<br>CPS</small></a>
    <nav class="links" id="links">${NAV.map(([h, l, k]) => `<a href="${h}" class="${k === PAGE ? 'active' : ''}">${l}</a>`).join('')}</nav>
    <div style="display:flex;gap:8px">
      <button class="icon-btn" id="theme" aria-label="Toggle theme"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg></button>
      <button class="icon-btn burger" id="burger" aria-label="Menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8h16M4 16h16"/></svg></button>
    </div>
  </div></header>`);
  document.body.insertAdjacentHTML('beforeend', `
  <footer><div class="wrap">
    <div><div class="big">${logo('focas-logo', 'FOCAS: Formal Control &amp; Autonomous Systems Lab')}</div><p>${esc(site.full_name)}<br>${esc(site.department)}<br>${esc(site.institute)}</p></div>
    <div><h5>Visit</h5><p>${site.address.map(esc).join('<br>')}</p><a href="${site.map}" target="_blank" rel="noopener">Open in Maps ↗</a></div>
    <div><h5>Elsewhere</h5><a href="mailto:${site.email}">${site.email}</a><a href="${site.links.scholar}" target="_blank" rel="noopener">Google Scholar ↗</a><a href="${site.links.github}" target="_blank" rel="noopener">GitHub ↗</a><a href="${site.links.youtube}" target="_blank" rel="noopener">YouTube ↗</a>${site.links.linkedin ? `<a href="${site.links.linkedin}" target="_blank" rel="noopener">LinkedIn ↗</a>` : ''}</div>
    <div class="base mono"><span>© ${new Date().getFullYear()} FOCAS Lab, IISc Bengaluru</span><span>${esc(site.department)} · IISc</span></div>
  </div></footer>`);
  $('#theme').onclick = toggleTheme;
  $('#burger').onclick = () => $('#links').classList.toggle('open');
  const nav = $('.nav'); addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 8), { passive: true });
}

/* stat tiles: [value, label, suffix?]; numbers count up when they scroll into view */
const statsHTML = list => list.map(([v, l, suf]) => `<div class="stat rv"><b data-n="${v}">${Number(v).toLocaleString()}${suf ? `<sup>${suf}</sup>` : ''}</b><span class="mono">${l}</span></div>`).join('');
function countUp() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return; io.unobserve(e.target);
    const b = e.target, n = +b.dataset.n, sup = b.querySelector('sup')?.outerHTML || '', t0 = performance.now();
    const step = t => { const k = Math.min(1, (t - t0) / 1400), v = Math.round(n * (1 - Math.pow(1 - k, 3))); b.innerHTML = v.toLocaleString() + sup; if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }), { threshold: .4 });
  document.querySelectorAll('[data-n]').forEach(b => io.observe(b));
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
    $('#stats').innerHTML = statsHTML([[items.length, 'Publications'], [pub.profile.citations, 'Citations', '+'], [pub.profile.h_index, 'h-index'], [members, 'Members'], [robots, 'Robots']]);
    $('#themes').innerHTML = site.research.map((r, i) => `
      <a class="theme rv" href="research.html#${r.id}">
        <span class="num">0${i + 1}</span>
        <div><h3>${esc(r.title)}</h3><span class="k mono">${esc(r.kicker)}</span></div>
        <p>${esc(r.text)}</p><span class="arrow">→</span>
      </a>`).join('');
    // only news from the last 6 months; a bare year counts as December of that year
    const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 6);
    const when = d => { const m = String(d).match(/^(?:([A-Za-z]{3})\w*\s+)?(\d{4})$/); return m ? new Date(`${m[1] || 'Dec'} 1, ${m[2]}`) : new Date(0); };
    const recentNews = site.news.filter(n => when(n.date) >= cutoff);
    $('#news').innerHTML = (recentNews.length ? recentNews : site.news.slice(0, 3)).map(n => `<li><span class="d">${esc(n.date)}</span><span>${esc(n.text)}${n.url ? ` <a class="more" href="${esc(n.url)}" target="_blank" rel="noopener">Post →</a>` : ''}</span></li>`).join('');
    const recent = items.filter(p => p.kind === 'journal' || p.kind === 'conference').sort((a, b) => (b.year || 0) - (a.year || 0)).slice(0, 5);
    $('#recent').innerHTML = recent.map(p => pubHTML(p, true)).join('');
    const figs = fac.flatMap(g => g.items).map(f => `<figure><img loading="lazy" src="${f.image}" alt="${esc(f.name)}"><figcaption>${esc(f.name)}</figcaption></figure>`).join('');
    $('#strip').innerHTML = `<div class="track">${figs}${figs}</div>`;
  },

  async research(site) {
    const pubs = prepPubs(await get('publications')).filter(p => !p.dup)
      .sort((a, b) => (a.kind === 'preprint') - (b.kind === 'preprint') || (b.year || 0) - (a.year || 0) || b.citations - a.citations);
    const used = new Set();
    $('#rlist').innerHTML = site.research.map((r, i) => {
      const re = new RegExp(r.match, 'i');
      const sel = pubs.filter(p => !used.has(p.key) && re.test(p.title)).slice(0, 3);
      sel.forEach(p => used.add(p.key));
      return `<article class="rcard rv" id="${r.id}">
        <div>
          <span class="mono">0${i + 1} · ${esc(r.kicker)}</span><h2>${esc(r.title)}</h2><p>${esc(r.text)}</p>
          <ul class="points">${r.points.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
          <div class="tags">${r.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
          ${sel.length ? `<div class="selected"><span class="mono">Selected papers</span>${sel.map(p => `<a href="${p.url}" target="_blank" rel="noopener">${esc(p.title)}<small>${esc(p.kind === 'preprint' ? 'Preprint' : (p.venue || '').replace(/[,\s\d…-]*$/, '') || LABEL[p.kind])}${p.year ? ' · ' + p.year : ''}</small></a>`).join('')}</div>` : ''}
          <div class="code">${(r.repos || []).map(([l, h]) => `<a href="${h}" target="_blank" rel="noopener">⌥ ${esc(l)}</a>`).join('')}${r.video ? `<a href="https://www.youtube.com/watch?v=${r.video}" target="_blank" rel="noopener">▶ Watch a demo</a>` : ''}</div>
        </div>
        <div class="media viz"><canvas data-viz="${r.viz}" role="img" aria-label="${esc(r.title)} animation"></canvas><span class="cap mono" data-cap></span></div></article>`;
    }).join('');
    window.FOCAS_VIZ?.();
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
    $('#metrics').innerHTML = statsHTML([[all.filter(p => !p.dup).length, 'Papers'], [data.profile.citations, 'Citations', '+'], [data.profile.h_index, 'h-index'], [data.profile.i10_index, 'i10-index']]) +
      `<a class="stat link" href="https://scholar.google.com/citations?user=${data.scholar_id}&hl=en" target="_blank" rel="noopener"><b>→</b><span class="mono">Google Scholar profile</span></a>`;
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
  },

  async teaching() {
    const [t, fac] = await Promise.all([get('teaching'), get('facilities')]);
    const robots = fac.filter(g => g.group !== 'Infrastructure').reduce((n, g) => n + g.items.length, 0);
    $('#tstats').innerHTML = statsHTML([[t.courses.length, 'Graduate courses'], [t.code.reduce((n, g) => n + g.items.length, 0), 'Open-source repositories'], [robots, 'Robot platforms']]);
    $('#courses').innerHTML = t.courses.map(c => `<div class="course rv"><div><div class="ccode">${esc(c.code)}</div><span class="mono">${esc(c.note)}</span></div>
      <div><h3>${esc(c.title)}</h3><p>${esc(c.text)}</p>
      ${c.topics ? `<ul class="points">${c.topics.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <div class="code"><a href="${c.link}" target="_blank" rel="noopener">⌥ ${esc(c.link_label || 'Course materials on GitHub')} ↗</a></div></div></div>`).join('');
    $('#code').innerHTML = t.code.map(g => `<div class="group"><h3>${esc(g.group)} <span class="mono">${esc(g.note)}</span></h3><div class="plain repos">
      ${g.items.map(([n, m, h]) => `<a href="${h}" target="_blank" rel="noopener"><span>${esc(n)}</span><span class="mono">${esc(m)} ↗</span></a>`).join('')}</div></div>`).join('');
    $('#highlights').innerHTML = t.highlights.map((h, i) => `<div class="rv"><span class="mono">0${i + 1}</span><h3>${esc(h.title)}</h3><p>${esc(h.text)}</p>
      ${h.link ? `<a href="${h.link}" target="_blank" rel="noopener">${esc(h.link_label)}</a>` : ''}</div>`).join('');
  }
};

(async () => {
  const site = await get('site');
  shell(site);
  try { await pages[PAGE]?.(site); } catch (e) { console.error(e); }
  reveal();
  countUp();
})();
