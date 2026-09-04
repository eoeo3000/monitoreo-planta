const { abrirEditor, plantaDemo, encenderCanerias, esperar } = require('./comun');

// modo: 'semilla' | 'demo'
const modo = process.argv[2] || 'semilla';

(async () => {
  const { browser, page } = await abrirEditor();
  if (modo === 'demo') await plantaDemo(page);

  const ms = await encenderCanerias(page);
  await esperar(page, 500);

  const r = await page.evaluate(() => {
    const filas = [...document.querySelectorAll('table tr')].map((t) => [...t.children].map((c) => c.textContent.trim()));
    const svg = document.querySelector('svg');
    const [vx, vy, vw, vh] = svg.getAttribute('viewBox').split(' ').map(Number);
    const dentro = (x, y) => x >= vx && x <= vx + vw && y >= vy && y <= vy + vh;
    const tiradores = [...svg.querySelectorAll('[data-quiebre]')];
    const trazos = [...svg.querySelectorAll('path')].filter((p) => p.getAttribute('stroke-width') === '2' || p.getAttribute('stroke-width') === '3');
    let fueraTrazo = 0;
    trazos.forEach((p) => { const b = p.getBBox(); if (b.x < vx || b.y < vy || b.x + b.width > vx + vw || b.y + b.height > vy + vh) fueraTrazo += 1; });
    const nota = [...document.querySelectorAll('p')].map((x) => x.textContent.trim()).find((t) => /cañerías dibujadas/.test(t));
    return {
      filas,
      nota,
      tiradores: tiradores.length,
      fueraTirador: tiradores.filter((h) => !dentro(+h.getAttribute('cx'), +h.getAttribute('cy'))).length,
      trazos: trazos.length,
      fueraTrazo,
    };
  });

  console.log(`\n=== cañerías · ${modo} ===`);
  console.log(`  de clic en "Cañerías" a tabla completa: ${(ms / 1000).toFixed(1)} s`);
  r.filas.forEach((f) => console.log('  ' + f.join('  |  ')));
  console.log(`\n  ${r.nota || 'sin nota'}`);
  console.log(`  tiradores de quiebre: ${r.tiradores} (fuera del lienzo: ${r.fueraTirador})`);
  console.log(`  trazos dibujados: ${r.trazos} (que se salen del lienzo: ${r.fueraTrazo})`);
  await page.screenshot({ path: `${__dirname}/salida/canerias-${modo}.png` });
  await browser.close();
})();
