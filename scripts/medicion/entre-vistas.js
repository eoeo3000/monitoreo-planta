const { abrirEditor, plantaDemo, encenderCanerias, esperar } = require('./comun');

// modo: 'semilla' | 'demo'. Recorre TODAS las vistas y mide dos cosas del
// lienzo que se rompen en silencio: los conectores de salida (la cañería que
// sigue en otra vista) y los títulos de área que se pisan entre sí.
const modo = process.argv[2] || 'demo';

(async () => {
  const { browser, page } = await abrirEditor();
  if (modo === 'demo') await plantaDemo(page);
  await encenderCanerias(page);
  await esperar(page, 500);

  const selectorVistas = () => page.evaluate(() => {
    const s = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => /^\d+\/\d+/.test(o.textContent)));
    return s ? s.options.length : 1;
  });
  const irAVista = (i) => page.evaluate((n) => {
    const s = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => /^\d+\/\d+/.test(o.textContent)));
    if (!s) return;
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(s, s.options[n].value);
    s.dispatchEvent(new Event('change', { bubbles: true }));
  }, i);

  const n = await selectorVistas();
  console.log(`\n=== entre vistas · ${modo} (${n} vista${n > 1 ? 's' : ''}) ===`);
  let totalConectores = 0;
  let totalPisados = 0;
  for (let v = 0; v < n; v++) {
    await irAVista(v);
    await esperar(page, 2500);
    const r = await page.evaluate(() => {
      const svg = document.querySelector('svg');
      const [vx, vy, vw, vh] = svg.getAttribute('viewBox').split(' ').map(Number);
      const sal = [...svg.querySelectorAll('[data-salida]')].map((g) => {
        const t = g.querySelector('text');
        const b = t.getBBox();
        const dentro = b.x >= vx && b.x + b.width <= vx + vw && b.y >= vy && b.y + b.height <= vy + vh;
        return { texto: t.textContent.trim(), dentro };
      });
      // Por el marcador y no por el estilo: los TAG de equipo tienen el
      // mismo font-size y font-weight, y filtrando por eso el script decía
      // "17 títulos" en una planta de 4 áreas y contaba miles de pares
      // pisados que eran TAGs.
      const tit = [...svg.querySelectorAll('[data-titulo-area]')]
        .map((t) => { const b = t.getBBox(); return { t: t.textContent, x: b.x, y: b.y, w: b.width, h: b.height }; });
      let pisados = 0;
      for (let i = 0; i < tit.length; i++)
        for (let j = i + 1; j < tit.length; j++)
          if (tit[i].x < tit[j].x + tit[j].w && tit[j].x < tit[i].x + tit[i].w && tit[i].y < tit[j].y + tit[j].h && tit[j].y < tit[i].y + tit[i].h) pisados += 1;
      return { sal, titulos: tit.length, pisados };
    });
    totalConectores += r.sal.length;
    totalPisados += r.pisados;
    const fuera = r.sal.filter((s) => !s.dentro).length;
    console.log(`  vista ${v + 1}: ${r.sal.length} conector(es)${fuera ? ` — ¡${fuera} FUERA DEL LIENZO!` : ''} · ${r.titulos} títulos de área, ${r.pisados} pares pisados`);
    r.sal.forEach((s) => console.log(`      ${s.texto}`));
  }
  console.log(`\n  total: ${totalConectores} conectores de salida · ${totalPisados} pares de títulos pisados (deben ser 0)`);
  await browser.close();
})();
