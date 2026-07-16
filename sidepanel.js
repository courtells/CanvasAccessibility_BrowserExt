// ---------- Functions injected into the page (must be fully self-contained) ----------

function pageScanFunction() {
  function parseColor(str) {
    const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (!m) return null;
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] !== undefined ? +m[4] : 1 };
  }
  function luminance(r, g, b) {
    const a = [r, g, b].map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }
  function contrastRatio(c1, c2) {
    const l1 = luminance(c1.r, c1.g, c1.b) + 0.05;
    const l2 = luminance(c2.r, c2.g, c2.b) + 0.05;
    return l1 > l2 ? l1 / l2 : l2 / l1;
  }
  function getBgColor(el) {
    let node = el;
    while (node && node !== document.documentElement) {
      const cs = getComputedStyle(node);
      const bg = parseColor(cs.backgroundColor);
      if (bg && bg.a > 0) return bg;
      node = node.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  }

  let uid = 0;
  function tag(el) {
    const id = 'a11y-' + uid++;
    el.setAttribute('data-a11y-flag', id);
    return id;
  }

  const container =
    document.querySelector('.user_content, #content, [role="main"], main') || document.body;

  const pageTitle = document.title.trim();
  const titleOk = !!pageTitle && pageTitle.toLowerCase() !== 'untitled';

  // Headings
  const headings = Array.from(container.querySelectorAll('h1,h2,h3,h4,h5,h6'));
  const headingIssues = [];
  if (headings.length === 0 && container.textContent.trim().length > 200) {
    headingIssues.push({
      id: null,
      title: 'This page has substantial content but no heading structure',
      fix: 'Break the content into sections using real HTML headings (Format > Heading in the Canvas editor), not bold text.'
    });
  }
  let prevLevel = 0;
  headings.forEach(h => {
    const level = parseInt(h.tagName[1]);
    if (level > prevLevel + 1 && prevLevel > 0) {
      const id = tag(h);
      headingIssues.push({
        id,
        title: `Heading level skipped: H${prevLevel} → H${level} ("${h.textContent.trim().slice(0, 50)}")`,
        fix: `Change this heading to H${prevLevel + 1}, or add the missing level before it. Don't skip levels for visual styling alone.`
      });
    }
    prevLevel = level;
  });

  // Links
  const links = Array.from(container.querySelectorAll('a'));
  const linkIssues = [];
  links.forEach(a => {
    const txt = a.textContent.trim();
    const aria = (a.getAttribute('aria-label') || '').trim();
    const labelledby = a.getAttribute('aria-labelledby');
    const title = (a.getAttribute('title') || '').trim();
    const imgAlt = Array.from(a.querySelectorAll('img'))
      .map(img => (img.getAttribute('alt') || '').trim())
      .filter(Boolean)
      .join(' ');

    // The accessible name a screen reader would announce, in priority order.
    // Empty visible text is fine on its own as long as one of these is present.
    const accessibleName = aria || (labelledby ? 'has-labelledby' : '') || imgAlt || title || txt;

    if (!accessibleName) {
      const id = tag(a);
      linkIssues.push({
        id,
        title: 'Link has no accessible name (no text, alt text on an inner image, aria-label, or title)',
        fix: 'Add visible link text, an aria-label, or alt text on an image inside the link so screen reader users know where it goes.'
      });
    } else if (/^(click here|here|link|read more|more|this|download)$/i.test(accessibleName)) {
      const id = tag(a);
      linkIssues.push({
        id,
        title: `Non-descriptive link text: "${accessibleName}"`,
        fix: 'Use meaningful link text that describes the destination (e.g., "Download the course syllabus PDF").'
      });
    }
  });

  // Images
  const imgs = Array.from(container.querySelectorAll('img'));
  const altIssues = [];
  const complexImgFlags = [];
  imgs.forEach(img => {
    const alt = img.getAttribute('alt');
    const src = img.getAttribute('src') || '';
    if (alt === null) {
      const id = tag(img);
      altIssues.push({
        id,
        title: `Image is missing an alt attribute (${src.split('/').pop() || 'unknown file'})`,
        fix: 'Add an alt attribute describing what the image shows, or alt="" if it is purely decorative.'
      });
    } else if (alt.length > 0 && /\.(png|jpe?g|gif|svg|webp)/i.test(alt)) {
      const id = tag(img);
      altIssues.push({
        id,
        title: `Alt text looks like a filename: "${alt.slice(0, 40)}"`,
        fix: 'Replace the filename with a real, meaningful description of what the image shows.'
      });
    }
    if (/chart|graph|diagram|infographic/i.test(src) || /chart|graph|diagram|infographic/i.test(alt || '')) {
      const id = tag(img);
      complexImgFlags.push({
        id,
        title: `Possible complex image detected (${src.split('/').pop() || 'image'})`,
        fix: 'If this is a chart, graph, or diagram, add a long description nearby (or a linked page) that conveys the same data in text.'
      });
    }
  });

  // Tables
  const tables = Array.from(container.querySelectorAll('table'));
  const tableIssues = [];
  tables.forEach(tbl => {
    const headers = tbl.querySelectorAll('th');
    const scoped = Array.from(headers).some(h => h.getAttribute('scope'));
    if (!headers.length) {
      const id = tag(tbl);
      tableIssues.push({ id, title: 'Table has no header cells (<th>)', fix: 'In the Canvas rich text editor, mark the header row/column cells as table headers.' });
    } else if (!scoped) {
      const id = tag(tbl);
      tableIssues.push({ id, title: 'Table headers are missing a scope attribute', fix: 'Add scope="col" or scope="row" to each header cell so screen readers announce them correctly.' });
    }
  });

  // Contrast (computed on real rendered styles)
  const contrastIssues = [];
  const seen = new Set();
  const textEls = Array.from(container.querySelectorAll('p,span,li,a,h1,h2,h3,h4,h5,h6,td,th,div,label,button'));
  textEls.forEach(el => {
    if (el.children.length > 0) return; // leaf nodes only, avoid double-counting containers
    const text = el.textContent.trim();
    if (!text) return;
    const cs = getComputedStyle(el);
    const fg = parseColor(cs.color);
    if (!fg) return;
    const bg = getBgColor(el);
    const ratio = contrastRatio(fg, bg);
    const fontSize = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight, 10) >= 700;
    const isLarge = fontSize >= 24 || (fontSize >= 18.66 && bold);
    const minRatio = isLarge ? 3 : 4.5;
    if (ratio < minRatio && !seen.has(el)) {
      seen.add(el);
      const id = tag(el);
      contrastIssues.push({
        id,
        title: `Low contrast (${ratio.toFixed(2)}:1, needs ${minRatio}:1) on "${text.slice(0, 40)}"`,
        fix: `Darken the text color or lighten the background so contrast reaches at least ${minRatio}:1. Test exact colors with WebAIM's Contrast Checker.`
      });
    }
  });

  // Media presence (captions/transcripts/audio-desc need human judgment either way)
  const videos = container.querySelectorAll('video');
  const iframeMedia = Array.from(container.querySelectorAll('iframe')).filter(f =>
    /youtube|vimeo|kaltura|panopto|studio/i.test(f.src || '')
  );
  const audios = container.querySelectorAll('audio');

  return {
    url: location.href,
    pageTitle,
    titleOk,
    headingIssues,
    linkIssues,
    altIssues,
    complexImgFlags,
    tableIssues,
    contrastIssues,
    mediaCount: videos.length + iframeMedia.length,
    audioCount: audios.length,
    totalImages: imgs.length,
    totalLinks: links.length
  };
}

function highlightFunction(targetId) {
  document.querySelectorAll('[data-a11y-flag]').forEach(el => {
    el.style.removeProperty('outline');
    el.style.removeProperty('outline-offset');
    el.style.removeProperty('background-color');
    el.style.removeProperty('box-shadow');
  });
  if (!targetId) return { found: true };
  const el = document.querySelector(`[data-a11y-flag="${targetId}"]`);
  if (!el) return { found: false };

  // If the element is inside a native <details> accordion, open it so the
  // highlight is actually visible instead of silently applying to a hidden node.
  let node = el.closest('details');
  while (node) {
    if (!node.open) node.open = true;
    node = node.parentElement ? node.parentElement.closest('details') : null;
  }

  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  // !important + box-shadow so it can't get silently overridden by the page's
  // own CSS (many sites, including Canvas, set outline: none broadly).
  el.style.setProperty('outline', '3px solid #e11d48', 'important');
  el.style.setProperty('outline-offset', '2px', 'important');
  el.style.setProperty('box-shadow', '0 0 0 4px rgba(225,29,72,0.35)', 'important');

  const stillHidden = el.offsetParent === null && getComputedStyle(el).position !== 'fixed';
  return { found: true, hidden: stillHidden };
}

// ---------- Popup logic ----------

let tabId = null;
let auditData = null;
let flatIssues = [];
let wtIndex = 0;

const el = sel => document.querySelector(sel);

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function getActiveTabId() {
  const tab = await getActiveTab();
  return tab.id;
}

function buildSections(raw) {
  const sections = [];
  sections.push({
    id: 'titles', label: 'Page title (2.4.2)',
    checks: raw.titleOk
      ? [{ status: 'pass', title: 'Page has a descriptive title', issues: [] }]
      : [{ status: 'fail', title: 'Page title is missing or generic ("Untitled")', issues: [{ title: `Current title: "${raw.pageTitle || '(none)'}"`, fix: 'Set a unique, descriptive page title in Canvas page settings.', id: null }] }]
  });
  sections.push({
    id: 'headings', label: 'Headings & structure (1.3.1 / 2.4.6)',
    checks: raw.headingIssues.length === 0
      ? [{ status: 'pass', title: 'Heading structure looks correct', issues: [] }]
      : [{ status: 'fail', title: `${raw.headingIssues.length} heading issue(s) found`, issues: raw.headingIssues }]
  });
  sections.push({
    id: 'reading-order', label: 'Logical reading order (1.3.2 / 2.4.3)',
    checks: [{ status: 'warn', title: 'Verify with a screen reader that reading order matches visual layout', issues: [] }]
  });
  sections.push({
    id: 'links', label: 'Descriptive links (2.4.4)',
    checks: raw.linkIssues.length === 0
      ? [{ status: raw.totalLinks > 0 ? 'pass' : 'warn', title: raw.totalLinks > 0 ? `All ${raw.totalLinks} link(s) look descriptive` : 'No links found on this page', issues: [] }]
      : [{ status: 'fail', title: `${raw.linkIssues.length} non-descriptive link(s) found`, issues: raw.linkIssues }]
  });
  sections.push({
    id: 'contrast', label: 'Color contrast (1.4.3)',
    checks: raw.contrastIssues.length === 0
      ? [{ status: 'pass', title: 'No low-contrast text detected', issues: [] }]
      : [{ status: 'fail', title: `${raw.contrastIssues.length} low-contrast element(s) found`, issues: raw.contrastIssues }]
  });
  sections.push({
    id: 'alt', label: 'Image alt text (1.1.1 / 1.4.5)',
    checks: raw.totalImages === 0
      ? [{ status: 'warn', title: 'No <img> elements found — check embedded content separately', issues: [] }]
      : raw.altIssues.length === 0
        ? [{ status: 'pass', title: `All ${raw.totalImages} image(s) have alt attributes`, issues: [] }]
        : [{ status: 'fail', title: `${raw.altIssues.length} alt text issue(s) found`, issues: raw.altIssues }]
  });
  sections.push({
    id: 'long-desc', label: 'Long descriptions for complex images (1.1.1)',
    checks: raw.complexImgFlags.length === 0
      ? [{ status: 'warn', title: 'No obviously complex images detected — spot-check charts/diagrams manually', issues: [] }]
      : [{ status: 'warn', title: `${raw.complexImgFlags.length} possible complex image(s) — verify a long description exists`, issues: raw.complexImgFlags }]
  });
  sections.push({
    id: 'tables', label: 'Accessible tables (1.3.1)',
    checks: raw.tableIssues.length === 0
      ? [{ status: 'pass', title: 'No table issues detected', issues: [] }]
      : [{ status: 'fail', title: `${raw.tableIssues.length} table issue(s) found`, issues: raw.tableIssues }]
  });
  sections.push({
    id: 'media', label: 'Captions, transcripts & audio description (1.2.1–1.2.5)',
    checks: (raw.mediaCount + raw.audioCount) > 0
      ? [{ status: 'warn', title: `${raw.mediaCount + raw.audioCount} media item(s) found — verify captions, a transcript, and audio description`, issues: [] }]
      : [{ status: 'pass', title: 'No embedded audio/video detected on this page', issues: [] }]
  });
  sections.push({
    id: 'flashing', label: 'Flashing content & auto-motion (2.3.1 / 2.2.2)',
    checks: [{ status: 'warn', title: 'Manually confirm nothing flashes >3x/sec and any auto-moving content can be paused', issues: [] }]
  });
  return { sections };
}

function countByStatus(data) {
  let pass = 0, fail = 0, warn = 0;
  data.sections.forEach(sec => sec.checks.forEach(c => {
    if (c.status === 'pass') pass++;
    else if (c.status === 'fail') fail++;
    else warn++;
  }));
  return { pass, fail, warn };
}

function buildFlatIssueList(data) {
  const flat = [];
  data.sections.forEach(sec => {
    sec.checks.forEach(c => {
      if (c.status !== 'fail') return;
      if (c.issues.length === 0) {
        flat.push({ category: sec.label, title: c.title, detail: '', fix: '', id: null });
      } else {
        c.issues.forEach(issue => {
          flat.push({ category: sec.label, title: issue.title, detail: '', fix: issue.fix || '', id: issue.id || null });
        });
      }
    });
  });
  return flat;
}

function renderResults() {
  const { pass, fail, warn } = countByStatus(auditData);
  el('#pass-count').textContent = pass;
  el('#fail-count').textContent = fail;
  el('#manual-count').textContent = warn;

  const body = el('#results-body');
  body.innerHTML = '';

  // Sections made up entirely of manual-check items get grouped together at
  // the end, separate from sections with an actual pass/fail result.
  const automatedSections = [];
  const manualOnlySections = [];
  auditData.sections.forEach(sec => {
    const isManualOnly = sec.checks.every(c => c.status === 'warn');
    (isManualOnly ? manualOnlySections : automatedSections).push(sec);
  });

  automatedSections.forEach(sec => body.appendChild(renderSection(sec)));

  if (manualOnlySections.length > 0) {
    const divider = document.createElement('div');
    divider.className = 'group-divider';
    divider.textContent = 'Manual checks — needs a human review';
    body.appendChild(divider);
    manualOnlySections.forEach(sec => body.appendChild(renderSection(sec)));
  }

  body.querySelectorAll('[data-show]').forEach(btn => {
    btn.addEventListener('click', () => {
      console.log('Show me clicked, target id:', btn.getAttribute('data-show'));
      highlightOnPage(btn.getAttribute('data-show'));
    });
  });
}

function renderSection(sec) {
  const failCt = sec.checks.filter(c => c.status === 'fail').length;
  const warnCt = sec.checks.filter(c => c.status === 'warn').length;
  const passCt = sec.checks.filter(c => c.status === 'pass').length;
  const div = document.createElement('div');
  div.className = 'section';
  const badgeHtml =
    (passCt ? `<span class="badge badge-pass">pass</span>` : '') +
    (failCt ? `<span class="badge badge-fail">${failCt} issue${failCt > 1 ? 's' : ''}</span>` : '') +
    (warnCt ? `<span class="badge badge-warn">manual</span>` : '');
  const issueRows = sec.checks.flatMap(c =>
    (c.issues.length ? c.issues : [{ title: c.title, fix: '', id: null }]).map(iss => `
      <div class="issue-row">
        <div class="it">${escapeHtml(iss.title)}</div>
        ${iss.fix ? `<div class="fx">${escapeHtml(iss.fix)}</div>` : ''}
        ${iss.id ? `<button class="btn small" data-show="${iss.id}">Show me</button>` : ''}
      </div>`)
  ).join('');
  div.innerHTML = `
    <div class="section-hdr"><h3>${escapeHtml(sec.label)}</h3><div>${badgeHtml}</div></div>
    <div class="section-body">${issueRows}</div>`;
  return div;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function highlightOnPage(targetId) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: highlightFunction,
      args: [targetId]
    });
    if (targetId && result && result.found === false) {
      showStatus('Could not find that element on the page — it may have changed since your last scan. Try rescanning.');
    } else if (targetId && result && result.hidden) {
      showStatus('This issue is inside a collapsed or hidden section of the page. Open that section manually, then click "Show me" again to see the highlight.');
    }
  } catch (e) {
    console.error('Canvas Accessibility Checker highlight failed:', e);
    showStatus('Could not highlight that element: ' + (e && e.message ? e.message : String(e)));
  }
}

let statusTimer = null;
function showStatus(msg) {
  const box = el('#status-msg');
  if (!box) return;
  box.textContent = msg;
  box.classList.remove('hidden');
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => box.classList.add('hidden'), 5000);
}

function showView(name) {
  ['start-view', 'scanning-view', 'results-view', 'walkthrough-view'].forEach(v => {
    el('#' + v).classList.toggle('hidden', v !== name);
  });
}

async function runScan() {
  showView('scanning-view');
  tabId = await getActiveTabId();
  const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, func: pageScanFunction });
  auditData = buildSections(result);
  flatIssues = buildFlatIssueList(auditData);
  await chrome.storage.session.set({
    ['scan_' + tabId]: { url: result.url, auditData, flatIssues, ts: Date.now() }
  });
  renderResults();
  showView('results-view');
}

function renderWalkthroughStep() {
  if (flatIssues.length === 0) return;
  const issue = flatIssues[wtIndex];
  el('#wt-position').textContent = `Issue ${wtIndex + 1} of ${flatIssues.length}`;
  el('#wt-category').textContent = issue.category;
  el('#wt-title').textContent = issue.title;
  el('#wt-detail').textContent = issue.detail || '';
  el('#wt-fix-text').textContent = issue.fix || 'Review this manually — automated detection can\'t fully verify it.';
  el('#wt-prev').disabled = wtIndex === 0;
  el('#wt-next').textContent = wtIndex === flatIssues.length - 1 ? 'Done' : 'Next →';
  el('#wt-show').classList.toggle('hidden', !issue.id);
  if (issue.id) highlightOnPage(issue.id);
}

function startWalkthrough() {
  if (flatIssues.length === 0) {
    alert('No fixable issues found — nice work! Remaining items need a manual check (see the list above).');
    return;
  }
  wtIndex = 0;
  showView('walkthrough-view');
  renderWalkthroughStep();
}

async function restoreSession() {
  const tab = await getActiveTab();
  tabId = tab.id;

  // If activeTab hasn't been (re)granted for this tab yet, tab.url comes back
  // empty. Don't guess — just show the start screen rather than risk a failed
  // scripting call.
  if (!tab.url) {
    showView('start-view');
    return;
  }

  const stored = await chrome.storage.session.get('scan_' + tabId);
  const cached = stored['scan_' + tabId];

  if (cached && cached.url === tab.url) {
    // Same page as last time — reuse the cached scan.
    auditData = cached.auditData;
    flatIssues = cached.flatIssues;
    renderResults();
    showView('results-view');
    return;
  }

  if (cached) {
    // URL changed since the last scan (user navigated to a different page, or
    // switched tabs) — the old results no longer apply, so drop them and scan
    // the new page automatically.
    await chrome.storage.session.remove('scan_' + tabId);
  }

  try {
    await safeRunScan();
  } catch (e) {
    // ignore — safeRunScan already handles its own fallback UI
  }
}

// The side panel stays open across tab switches and page navigations, unlike a
// popup — so it needs to actively refresh itself instead of only checking once
// at load time.
chrome.tabs.onActivated.addListener(() => { restoreSession(); });
chrome.tabs.onUpdated.addListener((updatedTabId, changeInfo) => {
  if (updatedTabId === tabId && changeInfo.status === 'loading') {
    // The tracked tab is navigating to a new page — its old scan is now stale.
    chrome.storage.session.remove('scan_' + tabId);
    showView('start-view');
  }
});

async function safeRunScan() {
  try {
    await runScan();
  } catch (e) {
    console.error('Canvas Accessibility Checker scan failed:', e);
    showView('start-view');
    el('#start-view .hint').textContent =
      'Scan failed: ' + (e && e.message ? e.message : String(e)) +
      ' — try clicking the extension icon once, then Scan again.';
  }
}

el('#scan-btn').addEventListener('click', safeRunScan);
el('#rescan-btn').addEventListener('click', safeRunScan);
el('#walkthrough-btn').addEventListener('click', startWalkthrough);
el('#wt-exit').addEventListener('click', () => { highlightOnPage(null); showView('results-view'); });
el('#wt-show').addEventListener('click', () => highlightOnPage(flatIssues[wtIndex].id));
el('#wt-prev').addEventListener('click', () => { if (wtIndex > 0) { wtIndex--; renderWalkthroughStep(); } });
el('#wt-next').addEventListener('click', () => {
  if (wtIndex < flatIssues.length - 1) { wtIndex++; renderWalkthroughStep(); }
  else { highlightOnPage(null); showView('results-view'); }
});

restoreSession();
