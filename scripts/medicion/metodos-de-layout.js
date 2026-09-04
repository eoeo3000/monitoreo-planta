const { abrirEditor, plantaGrande, plantaDemo, esperar } = require('./comun');

// modo: 'semilla' | 'grande' | 'demo'
const modo = process.argv[2] || 'semilla';

(async () => {
  const { browser, page } = await abrirEditor();
  if (modo === 'demo') await plantaDemo(page);
  if (modo === 'grande') await plantaGrande(page);
  await esperar(page, modo === 'demo' ? 4000 : 1500);

  const tabla = await page.evaluate(() =>
    Array.from(document.querySelectorAll('table tbody tr')).map((tr) =>
      Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim()).join(' | ')));
  console.log(`\n=== ${modo} (vacío | desvío | solape) ===`);
  tabla.forEach((f) => console.log('  ' + f));

  await page.getByText('Escalonado', { exact: true }).click();
  await esperar(page, modo === 'demo' ? 4000 : 1200);
  await page.screenshot({ path: `${__dirname}/salida/esc-${modo}.png` });
  await browser.close();
})();
