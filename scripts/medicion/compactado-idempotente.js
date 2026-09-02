const { chromium } = require('playwright-core');

const leer = (page) =>
  page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('condicion-activos-analista-v6'));
    return d.equipos.map((eq) => ({
      tag: eq.tag,
      escala: eq.escalaPropia,
      x: eq.posicion?.x,
      y: eq.posicion?.y,
    }));
  });

const iguales = (a, b) =>
  a.length === b.length &&
  a.every((eq, i) => eq.escala === b[i].escala && eq.x === b[i].x && eq.y === b[i].y);

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

  const estados = [];
  for (let i = 0; i < 4; i++) {
    await page.getByText('Compactar planta', { exact: true }).click();
    await page.waitForTimeout(600);
    estados.push(await leer(page));
  }

  console.log('Escalas tras cada compactada:');
  estados.forEach((e, i) => console.log(`  #${i + 1}: [${[...new Set(e.map((x) => x.escala))].join(', ')}]`));

  console.log('\nIdempotencia (cada compactada vs la anterior):');
  for (let i = 1; i < estados.length; i++) {
    console.log(`  #${i} -> #${i + 1}: ${iguales(estados[i - 1], estados[i]) ? 'IDÉNTICO' : 'CAMBIÓ'}`);
  }

  // Un tamaño puesto a mano DESPUÉS de compactar tiene que sobrevivir.
  await page.evaluate(() => {
    const clave = 'condicion-activos-analista-v6';
    const d = JSON.parse(localStorage.getItem(clave));
    d.equipos = d.equipos.map((eq, i) => (i === 0 ? { ...eq, escalaPropia: 2.5 } : eq));
    localStorage.setItem(clave, JSON.stringify(d));
  });
  await page.reload();
  await page.waitForTimeout(600);
  await page.getByText('Portal SCADA', { exact: true }).click();
  await page.waitForTimeout(500);
  await page.locator('label:has-text("Modo edición") input[type=checkbox]').check();
  await page.waitForTimeout(300);
  await page.getByText('Compactar planta', { exact: true }).click();
  await page.waitForTimeout(600);

  const tras = await leer(page);
  console.log('\nTamaño puesto a mano (2.5x en el primer equipo), tras compactar:');
  console.log(`  ${tras[0].tag}: ${tras[0].escala}x   (el resto: ${[...new Set(tras.slice(1).map((x) => x.escala))].join(', ')})`);

  await browser.close();
})();
