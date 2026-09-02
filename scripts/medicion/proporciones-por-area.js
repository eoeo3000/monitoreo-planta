const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1560, height: 900 } });
  page.on('dialog', async (d) => { await d.accept(); });

  await page.goto('http://localhost:3000');
  await page.waitForTimeout(500);
  await page.getByText('Portal SCADA', { exact: true }).click();
  await page.waitForTimeout(500);
  await page.locator('label:has-text("Modo edición") input[type=checkbox]').check();
  await page.waitForTimeout(300);

  const antes = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('condicion-activos-analista-v6'));
    const areas = Object.fromEntries(data.areas.map((a) => [a.id, a.nombre]));
    return data.equipos.map((eq) => ({ tag: eq.tag, tipo: eq.tipo, area: areas[eq.areaId], escala: eq.escalaPropia || 1 }));
  });

  await page.getByText('Compactar planta', { exact: true }).click();
  await page.waitForTimeout(800);

  const despues = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('condicion-activos-analista-v6'));
    const areas = Object.fromEntries(data.areas.map((a) => [a.id, a.nombre]));
    return data.equipos.map((eq) => ({ tag: eq.tag, tipo: eq.tipo, area: areas[eq.areaId], escala: eq.escalaPropia || 1 }));
  });

  console.log('TAG      TIPO            AREA                    ANTES -> DESPUES');
  despues.forEach((eq, i) => {
    console.log(
      `${eq.tag.padEnd(8)} ${String(eq.tipo).padEnd(15)} ${String(eq.area).padEnd(22)} ${antes[i].escala}x -> ${eq.escala}x`
    );
  });

  // Tamaño renderizado real de cada ícono, para ver la relación visual.
  const tamanios = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('svg text').forEach((t) => {
      if (!/^[A-Z]+-\d+$/.test(t.textContent)) return;
      const r = t.parentElement.getBoundingClientRect();
      out.push({ tag: t.textContent, ancho: Math.round(r.width), alto: Math.round(r.height) });
    });
    return out;
  });
  console.log('\nTamaño en pantalla (px):');
  tamanios.forEach((t) => console.log(`  ${t.tag.padEnd(8)} ${t.ancho} x ${t.alto}`));

  await browser.close();
})();
