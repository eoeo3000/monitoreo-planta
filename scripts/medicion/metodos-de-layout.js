const { chromium } = require('playwright-core');

// modo: 'semilla' | 'grande' | 'demo'
const modo = process.argv[2] || 'semilla';

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1560, height: 900 } });
  page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
  page.on('dialog', async (d) => { await d.accept(); });

  await page.goto('http://localhost:3000');
  await page.waitForTimeout(600);
  await page.getByText('Portal SCADA', { exact: true }).click();
  await page.waitForTimeout(500);

  let planta = null;
  if (modo === 'demo') {
    await page.getByText('Demo escala', { exact: true }).click();
    await page.waitForTimeout(3500);
    planta = await page.evaluate(() => {
      const d = JSON.parse(localStorage.getItem('condicion-activos-analista-v6'));
      return d.plantas[d.plantas.length - 1].nombre;
    });
  } else if (modo === 'grande') {
    await page.locator('label:has-text("Modo edición") input[type=checkbox]').check();
    await page.waitForTimeout(300);
    const eqs = await page.evaluate(() => Array.from(document.querySelectorAll('svg text'))
      .filter((t) => /^[A-Z]+-\d+$/.test(t.textContent))
      .map((t) => { const r = t.parentElement.getBoundingClientRect(); return { tag: t.textContent, x: r.x + r.width / 2, y: r.y + r.height / 2 }; }));
    const b = eqs.find((e) => e.tag === 'B-101');
    for (let i = 0; i < 30; i++) {
      await page.mouse.click(b.x, b.y);
      await page.waitForTimeout(60);
      await page.getByText('Duplicar equipo', { exact: true }).click();
      await page.waitForTimeout(80);
    }
  }

  await page.getByText('Ensayo de layout', { exact: true }).click();
  await page.waitForTimeout(800);
  if (planta) {
    await page.selectOption('select', { label: planta });
    await page.waitForTimeout(6000);
  }
  await page.waitForTimeout(1500);

  const tabla = await page.evaluate(() =>
    Array.from(document.querySelectorAll('table tbody tr')).map((tr) =>
      Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim()).join(' | ')));
  console.log(`\n=== ${modo} (vacío | desvío | solape) ===`);
  tabla.forEach((f) => console.log('  ' + f));

  await page.getByText('Escalonado', { exact: true }).click();
  await page.waitForTimeout(modo === 'demo' ? 4000 : 1200);
  await page.screenshot({ path: `${__dirname}/salida/esc-${modo}.png` });

  await browser.close();
})();
