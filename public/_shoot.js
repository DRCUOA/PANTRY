// Dev-only screenshot helper. Loaded via /_shoot.js. Defines window.__shoot.
(() => {
  if (window.__shoot) return;

  // Mobile-frame styling
  let s = document.getElementById('pantry-screenshot-style');
  if (!s) {
    s = document.createElement('style');
    s.id = 'pantry-screenshot-style';
    document.head.appendChild(s);
  }
  s.textContent = `
    html, body { background: #f1f1f1 !important; }
    body { max-width: 430px !important; margin: 0 auto !important; box-shadow: 0 0 0 1px rgba(0,0,0,0.08) !important; background: var(--background, #f8f5f1) !important; min-height: 100vh !important; }
    body > div > nav.fixed { left: auto !important; right: auto !important; width: 430px !important; max-width: 430px !important; margin: 0 auto !important; }
    nextjs-portal { display: none !important; }
    /* Constrain portaled bottom sheets to the mobile body width */
    .ui-sheet { left: calc((100vw - 430px) / 2) !important; right: calc((100vw - 430px) / 2) !important; width: 430px !important; max-width: 430px !important; transform: none !important; }
    .ui-sheet-backdrop { left: calc((100vw - 430px) / 2) !important; right: calc((100vw - 430px) / 2) !important; width: 430px !important; max-width: 430px !important; transform: none !important; }
  `;

  // Inline computed oklab/oklch colours back to plain rgb so html2canvas can parse them
  const inlineColors = () => {
    const c = document.createElement('canvas'); c.width = 1; c.height = 1;
    const ctx = c.getContext('2d');
    const toRgb = (val) => {
      try {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = '#000';
        ctx.fillStyle = val;
        ctx.fillRect(0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        const a = d[3] / 255;
        return a < 1 ? `rgba(${d[0]},${d[1]},${d[2]},${a.toFixed(3)})` : `rgb(${d[0]},${d[1]},${d[2]})`;
      } catch { return val; }
    };
    const props = ['color', 'background-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'outline-color', 'caret-color', 'fill', 'stroke', 'text-decoration-color', 'column-rule-color', 'accent-color'];
    document.querySelectorAll('*').forEach((el) => {
      const cs = getComputedStyle(el);
      for (const p of props) {
        const v = cs.getPropertyValue(p);
        if (v && (v.includes('oklab') || v.includes('oklch') || v.includes('color('))) {
          el.style.setProperty(p, toRgb(v), 'important');
        }
      }
      const bg = cs.getPropertyValue('background-image');
      if (bg && (bg.includes('oklab') || bg.includes('oklch'))) {
        el.style.setProperty('background-image', 'none', 'important');
      }
      const sh = cs.getPropertyValue('box-shadow');
      if (sh && (sh.includes('oklab') || sh.includes('oklch'))) {
        el.style.setProperty('box-shadow', sh.replace(/oklab\([^)]+\)|oklch\([^)]+\)/g, m => toRgb(m)), 'important');
      }
    });
  };

  const ensureH2c = async () => {
    if (window.html2canvas) return;
    await new Promise((res, rej) => {
      const sc = document.createElement('script');
      sc.src = '/html2canvas.min.js';
      sc.onload = res;
      sc.onerror = () => rej(new Error('html2canvas load failed'));
      document.head.appendChild(sc);
    });
  };

  window.__shoot = async (name) => {
    await ensureH2c();
    inlineColors();
    const target = document.body;
    const canvas = await window.html2canvas(target, {
      backgroundColor: '#f1f1f1',
      scale: 2,
      useCORS: true,
      allowTaint: false,
      logging: false,
      width: target.offsetWidth,
      height: target.scrollHeight,
      windowWidth: target.offsetWidth,
      windowHeight: target.scrollHeight,
    });
    const dataUrl = canvas.toDataURL('image/png');
    const r = await fetch('/api/devshot', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, dataUrl }) });
    return r.json();
  };
})();
