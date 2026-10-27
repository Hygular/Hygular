import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright';

const engines = { chromium, firefox, webkit };
const engine = process.env.HYGULAR_BROWSER || 'chromium';
assert.ok(engines[engine], `Unknown browser: ${engine}`);
const cssPath = process.env.HYGULAR_CSS || resolve('dist/css/hygular.min.css');
const css = await readFile(cssPath, 'utf8');
const browser = await engines[engine].launch({ timeout: 20000 });
const results = [];
const failures = [];
const palettes = [
  { name: 'default' },
  { name: 'violet', hue: 285, chroma: 0.12 },
  { name: 'green', hue: 145, chroma: 0.10 },
  { name: 'red', hue: 25, chroma: 0.12 },
  { name: 'gold', hue: 85, chroma: 0.08 },
  { name: 'neutral', hue: 0, chroma: 0 },
];
const semantic = ['primary', 'success', 'danger', 'warning', 'info'];
let serial = 0;
const checks = [];
function item(markup, name, states = ['normal'], kind = 'text') {
  const id = `case-${serial++}`;
  checks.push({ id, name, states, kind });
  return markup.replace('$', `id="${id}"`);
}
let content = '';
for (const name of [...semantic, 'light', 'dark']) {
  for (const variant of ['', '-outline', ...(semantic.includes(name) ? ['-ghost'] : [])]) {
    content += item(`<button $ class="button is-${name}${variant}">${name}${variant}</button>`, `button ${name}${variant}`, ['normal', 'hover', 'focus']);
  }
}
for (const name of ['primary', 'success', 'danger', 'warning']) {
  content += item(`<span $ class="badge is-${name}">Badge ${name}</span>`, `badge ${name}`);
  content += item(`<span $ class="badge is-outline is-${name}-outline">Outline ${name}</span>`, `badge outline ${name}`);
}
for (const name of semantic.filter(n => n !== 'primary')) {
  content += item(`<div $ class="alert is-${name}">Alert ${name}</div>`, `alert ${name}`);
}
for (const name of ['primary', ...semantic.filter(n => n !== 'primary')]) {
  content += `<div class="progress is-large ${name === 'primary' ? '' : `is-${name}`}">` + item('<div $ class="progress-bar" style="width:75%">75%</div>', `progress ${name}`) + '</div>';
}
content += '<div class="listview is-hoverable">' + item('<div $ class="list-item is-active">Selected item</div>', 'active list', ['normal', 'hover']) + '</div>';
content += '<div class="listview"><div class="list-item is-active">' + item('<span $ class="list-subtitle">Subtitle</span>', 'active list subtitle') + '</div></div>';
content += item('<button $ class="dropdown-item is-active">Selected dropdown</button>', 'dropdown', ['normal', 'hover']);
content += '<div class="custom-select">' + item('<div $ class="select-option is-active">Selected option</div>', 'select option', ['normal', 'hover']) + item('<span $ class="select-tag">Selected tag</span>', 'select tag') + '</div>';
content += '<div class="pagination"><div class="page-item is-active">' + item('<a $ class="page-link" href="#">1</a>', 'pagination', ['normal', 'focus']) + '</div></div>';
content += '<div class="group-file">' + item('<label $ tabindex="0" class="form-label">Upload</label>', 'file label', ['normal', 'hover', 'focus']) + '</div>';
content += item('<a $ href="#" class="link">Example link</a>', 'link', ['normal', 'hover', 'focus']);
content += item('<span $ style="color:var(--muted)">Secondary text</span>', 'muted');
content += '<blockquote class="blockquote">Quote' + item('<footer $ class="blockquote-footer">Source</footer>', 'blockquote footer') + '</blockquote>';
for (const name of semantic) {
  content += `<div class="tableview is-${name} is-hoverable"><table><thead><tr>` + item('<th $>Header</th>', `table ${name} header`) + '</tr></thead><tbody><tr>' + item('<td $>Cell</td>', `table ${name} cell`, ['normal', 'hover']) + '</tr></tbody></table></div>';
}
content += item('<input $ class="form-input" value="Input text">', 'input', ['normal', 'focus'], 'input');
content += item('<select $ class="form-select"><option>Select text</option></select>', 'native select', ['normal', 'focus'], 'input');
content += item('<input $ type="checkbox" class="form-checkbox" checked>', 'checkbox', ['normal', 'focus'], 'check');
for (const name of ['primary', 'danger', 'warning', 'success', 'info']) {
  content += item(`<button $ class="focus-ring${name === 'primary' ? '' : `-${name}`}">Focus ${name}</button>`, `focus utility ${name}`, ['focus'], 'focus');
}
for (const name of ['success','danger','warning','info']) {
  content += item(`<div $ class="toast has-icon is-active is-${name}">Toast ${name}</div>`, `toast ${name}`);
}
for (const [cls,name] of [['form-feedback is-invalid','invalid feedback'],['form-feedback is-valid','valid feedback'],['hygular-sk-retry','skeleton retry']]) {
 const tag = name === "skeleton retry" ? "button" : "p";
 content += item(`<${tag} $ class="${cls}" style="display:block">${name}</${tag}>`, name, ['normal','hover']);
}
content += '<div class="popover is-open" style="position:relative">'+item('<div $ class="popover-body">Popover content</div>','popover body')+'</div>';
content += item('<div $ class="tooltip is-open" style="position:relative">Tooltip content</div>','tooltip');
content += item('<input $ class="form-input" placeholder="Placeholder">','placeholder',['normal','focus'],'placeholder');
content += item('<input $ type="radio" class="form-radio" checked>','radio',['normal','focus'],'radio');
content += '<div class="group-switch">'+item('<input $ type="checkbox" class="form-checkbox" checked>','switch checked',['normal','focus'],'switch')+'</div>';
content += '<div class="group-switch">'+item('<input $ type="checkbox" class="form-checkbox">','switch unchecked',['normal','focus'],'switch')+'</div>';
content += '<div class="listview">'+item('<a $ href="#" class="list-item">List link</a>','list link',['normal','hover'])+'</div>';
content += item('<kbd $>Ctrl</kbd>','kbd');
content += item('<mark $>Highlight</mark>','mark');
for (const name of ['success','error','warning','info']) {
 content += item(`<span $ class="status-icon is-${name}">◆</span>`, `status icon ${name}`, ['normal'], 'graphic');
}
content += '<nav class="nav"><div class="nav-item">'+item('<a $ href="#" class="nav-link">Navigation link</a>','navigation link',['normal','hover','focus'])+'</div></nav>';
content += '<div class="modal-content">'+item('<div $ class="modal-body">Dialog content</div>','modal body')+'</div>';
const page = await Promise.race([browser.newPage({ viewport: { width: 1200, height: 900 } }),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('Browser page creation exceeded 20 seconds')),20000);timer.unref();})]).catch(async error => { await browser.close(); throw error; });
page.setDefaultTimeout(5000);
page.setDefaultNavigationTimeout(15000);
try {
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"></head><body><main class="stage">${content}</main></body></html>`);
  await page.addStyleTag({ content: css });
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}.stage{padding:24px;display:flex;flex-wrap:wrap;gap:20px;align-items:start}.stage>.tableview,.stage>.alert{max-width:340px}.stage>.progress{width:300px}.stage>.custom-select{width:300px}.stage>.form-input,.stage>.form-select{width:240px}' });
  await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    function pixel(colors) {
      ctx.clearRect(0, 0, 1, 1);
      for (const color of colors) {
        assertColor(color);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
      }
      return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
    }
    function assertColor(value) {
      if (!CSS.supports('color', value)) throw new Error(`Unsupported computed color: ${value}`);
    }
    function luminance(rgb) {
      return rgb.map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
        .reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
    }
    function contrast(a, b) {
      const x = luminance(a), y = luminance(b);
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    }
    window.measureColorCase = (id) => {
      const el = document.getElementById(id);
      const style = getComputedStyle(el);
      const parents = [];
      for (let node = el.parentElement; node; node = node.parentElement) parents.unshift(node);
      const outside = ['white', ...parents.map(node => getComputedStyle(node).backgroundColor)];
      for (const node of [...parents, el]) {
        const s = getComputedStyle(node);
        if ((node !== el && Number(s.opacity) !== 1) || s.filter !== 'none') throw new Error('Fixture measurement requires opaque, unfiltered elements');
        if (s.backgroundImage !== 'none' && node !== el && !node.matches('.custom-select')) throw new Error('Unsupported ancestor background image');
      }
      const background = [...outside, style.backgroundColor];
      const blend = (front, back, alpha) => front.map((v,i) => v * alpha + back[i] * (1-alpha));
      const backdrop = pixel(outside), opacity = Number(style.opacity);
      const bg = blend(pixel(background), backdrop, opacity), fg = blend(pixel([...background, style.color]), backdrop, opacity);
      const measurements = {
        text: contrast(fg, bg),
        border: contrast(pixel([...outside, style.borderTopColor]), pixel(outside)),
        borderInside: contrast(pixel([...background, style.borderTopColor]), bg),
        focus: contrast(pixel([...outside, style.outlineColor]), pixel(outside)),
        focused: el.matches(':focus-visible'),
        outlineWidth: parseFloat(style.outlineWidth),
        color: style.color, background: style.backgroundColor,
      };
      if (el.type === 'checkbox' && !el.closest('.group-switch')) {
        const match = style.getPropertyValue('--check-icon').match(/stroke='%23([0-9a-f]+)/i);
        if (!match) throw new Error('Checkbox checkmark color was not found');
        measurements.icon = contrast(pixel([`#${match[1]}`]), bg);
        measurements.control = contrast(bg, pixel(outside));
      }
      if (el.matches('.group-switch .form-checkbox')) {
        const match = style.backgroundImage.match(/fill=['"]%23([0-9a-f]+)/i);
        if (!match) throw new Error('Switch thumb color was not found');
        measurements.icon = contrast(pixel([`#${match[1]}`]), bg);
      }
      if (el.type === 'radio') {
        const probe = document.createElement('span'); el.parentElement.append(probe);
        probe.style.color = style.getPropertyValue('--accent');
        measurements.icon = contrast(pixel([getComputedStyle(probe).color]), bg); probe.remove();
      }
      if (el.hasAttribute('placeholder')) {
        const placeholder = getComputedStyle(el, '::placeholder');
        measurements.placeholder = contrast(blend(pixel([...background, placeholder.color]), bg, Number(placeholder.opacity)), bg);
      }
      if (el.matches('.toast.has-icon')) {
        const icon = getComputedStyle(el,'::before');
        if (icon.content === '""' && icon.maskImage !== 'none') {
          measurements.toastIcon = contrast(pixel([...background,icon.backgroundColor]), bg);
        } else {
          const colors = [...icon.content.matchAll(/fill=['"]%23([0-9a-f]+)/gi)].map(m=>m[1]);
          if (!colors.length) throw new Error('Toast icon color could not be measured');
          measurements.toastIcon = Math.min(...colors.map(c=>contrast(pixel([`#${c}`]),bg)));
        }
      }
      return measurements;
    };
  });
  for (const mode of ['light', 'dark']) {
    for (const palette of palettes) {
      for (const surface of (palette.name === 'default' ? ['body', 'surface', 'surface-raised'] : ['body'])) {
        await page.evaluate(({ mode, palette, surface }) => {
          const root = document.documentElement;
          root.setAttribute('data-hygular-theme', mode);
          root.style.removeProperty('--primary');
          if (palette.hue !== undefined) root.style.setProperty('--primary', `oklch(${mode === 'light' ? 0.53 : 0.66} ${palette.chroma} ${palette.hue})`);
          document.querySelector('.stage').style.backgroundColor = `var(--${surface})`;
        }, { mode, palette, surface });
        console.log(`${mode}/${palette.name}/${surface}`);
        for (const check of checks) {
          // Semantic status colors are unchanged by the custom primary samples.
          if (palette.name !== 'default' && !/primary|active list|dropdown|select option|select tag|pagination|link|checkbox/.test(check.name)) continue;
          const locator = page.locator(`#${check.id}`);
          for (const state of check.states) {
            await page.mouse.move(0, 0);
            await page.evaluate(() => document.activeElement?.blur());
            if (state === 'hover') await locator.hover({force:true});
            if (state === 'focus') { await page.keyboard.press('Tab'); await locator.focus(); }
            let measurement;
            try { measurement = await page.evaluate(id => window.measureColorCase(id), check.id); } catch (error) { failures.push({mode,palette:palette.name,surface,name:check.name,state,problem:error.message}); continue; }
            const requirements = [];
            if (check.name.startsWith('toast ')) requirements.push(['toastIcon',3]);
            if (!['check', 'focus', 'switch', 'radio', 'placeholder', 'graphic'].includes(check.kind)) requirements.push(['text', 4.5]);
            if (check.kind === 'graphic') requirements.push(['text',3]);
            if (check.kind === 'placeholder') requirements.push(['placeholder',4.5]);
            if (['switch','radio'].includes(check.kind)) requirements.push(['icon',3]);
            if (check.kind === 'input') requirements.push(['border', 3], ['borderInside', 3]);
            if (check.kind === 'check') requirements.push(['icon', 3], ['control', 3]);
            if (state === 'focus' && !['input','placeholder'].includes(check.kind)) {
              requirements.push(['focus', 3]);
              if (!measurement.focused || measurement.outlineWidth < 1) failures.push({ mode, palette: palette.name, surface, name: check.name, state, problem: 'No visible focus outline' });
            }
            for (const [metric, minimum] of requirements) {
              const record = { mode, palette: palette.name, surface, name: check.name, state, metric, minimum, ratio: measurement[metric] };
              results.push(record);
              if (!(measurement[metric] >= minimum)) failures.push({ ...record, color: measurement.color, background: measurement.background });
            }
          }
        }
      }
    }
  }
  // Verify that the brand changes propagate without changing semantic status colors.
  const dependencies = await page.evaluate(() => {
    const root = document.documentElement;
    root.setAttribute('data-hygular-theme', 'light');
    const probe = document.createElement('span');
    document.body.append(probe);
    const read = token => { probe.style.color = `var(${token})`; return getComputedStyle(probe).color; };
    root.style.setProperty('--primary', 'oklch(0.53 0.10 145)');
    const before = { accent: read('--accent'), danger: read('--danger'), link: read('--link') };
    root.style.setProperty('--primary', 'oklch(0.53 0.12 285)');
    const after = { accent: read('--accent'), danger: read('--danger'), link: read('--link') };
    root.style.setProperty('--accent', 'oklch(0.62 0.08 85)');
    const customAccent = read('--accent');
    root.style.setProperty('--primary', 'oklch(0.53 0.10 145)');
    const retainedAccent = read('--accent');
    root.style.removeProperty('--accent');probe.remove();
    return { before, after, customAccent, retainedAccent };
  });
  assert.notEqual(dependencies.before.accent, dependencies.after.accent);
  assert.notEqual(dependencies.before.link, dependencies.after.link);
  assert.equal(dependencies.before.danger, dependencies.after.danger);
  assert.equal(dependencies.customAccent, dependencies.retainedAccent);
  if (process.env.HYGULAR_SCREENSHOT) {
    await page.evaluate(() => { document.documentElement.style.removeProperty('--primary');document.documentElement.setAttribute('data-hygular-theme','light');document.querySelector('.stage').style.backgroundColor='var(--body)';document.activeElement?.blur(); });
    await page.mouse.move(0,0);
    await page.screenshot({ path: process.env.HYGULAR_SCREENSHOT, fullPage: true });
    await page.evaluate(() => document.documentElement.setAttribute('data-hygular-theme', 'dark'));
    await page.screenshot({ path: process.env.HYGULAR_SCREENSHOT.replace(/\.png$/, '-dark.png'), fullPage: true });
  }
  const report = { browser: engine, comparisons: results.length, failures, dependencies, results };
  if (process.env.HYGULAR_COLOR_REPORT) await writeFile(process.env.HYGULAR_COLOR_REPORT, JSON.stringify(report, null, 2));
  console.log(`${engine}: ${results.length} contrast comparisons; ${failures.length} failures; 4 token dependency assertions passed.`);
  for (const failure of failures.slice(0, 40)) console.error(JSON.stringify(failure));
  assert.equal(failures.length, 0, 'Color contrast regressions found; inspect the report.');
} finally {
  await browser.close();
}
