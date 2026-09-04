// Lo que comparten los scripts de medición: abrir el Editor de planta y
// dejar lista la planta que se quiere medir.
const { chromium } = require('playwright-core');

// Si no hay un Chromium acá, ajustá esta ruta.
const CHROMIUM = process.env.CHROMIUM || '/opt/pw-browsers/chromium';
const CLAVE = 'condicion-activos-analista-v6';

const esperar = (page, ms) => page.waitForTimeout(ms);

// Arranca SIEMPRE de datos limpios: una medición que depende de lo que quedó
// de la corrida anterior no es reproducible.
async function abrirEditor({ limpiar = true } = {}) {
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const page = await browser.newPage({ viewport: { width: 1560, height: 900 } });
  page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
  page.on('dialog', async (d) => { await d.accept(); });
  await page.goto('http://localhost:3000');
  if (limpiar) {
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  }
  await esperar(page, 1500);
  await page.getByText('Editor de planta', { exact: true }).click();
  await page.waitForSelector('select', { timeout: 30000 });
  await esperar(page, 2500);
  return { browser, page };
}

// 500 equipos en 200 ubicaciones, con conexiones. El botón está en el panel
// del editor; genera la planta y la deja elegida.
async function plantaDemo(page) {
  await page.getByText(/Generar planta de prueba/).click();
  await page.waitForFunction(() => {
    const s = document.querySelectorAll('select')[0];
    return s && /Demo/.test(s.options[s.selectedIndex].textContent);
  }, null, { timeout: 180000, polling: 300 });
  await esperar(page, 4000);
}

// La "planta grande" (43 equipos) no es un dato del repo: se arma duplicando
// una bomba de la semilla 30 veces. Se rehace en cada corrida a propósito.
async function plantaGrande(page) {
  const b = await page.evaluate(() => {
    const t = [...document.querySelectorAll('svg text')].find((x) => x.textContent === 'B-101');
    const r = t.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y - 22 };
  });
  await page.mouse.click(b.x, b.y);
  await esperar(page, 400);
  for (let i = 0; i < 30; i++) {
    await page.getByText('Duplicar equipo', { exact: true }).click();
    await esperar(page, 120);
  }
  await esperar(page, 1500);
}

// Métricas de cañería: hay que encender "Cañerías" y esperar el cálculo.
async function encenderCanerias(page) {
  const t0 = Date.now();
  await page.getByText('Cañerías', { exact: false }).first().click();
  await page.waitForFunction(() => {
    const filas = [...document.querySelectorAll('table tr')];
    return filas.length > 3 && filas.slice(1).every((f) => f.children.length >= 6 && !/^[—\s]*$/.test(f.children[4].textContent));
  }, null, { timeout: 300000, polling: 200 });
  return Date.now() - t0;
}

const leerDatos = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), CLAVE);

module.exports = { abrirEditor, plantaDemo, plantaGrande, encenderCanerias, leerDatos, esperar, CLAVE };
