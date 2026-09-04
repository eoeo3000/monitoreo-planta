import { MULTIPLICADORES_FINOS, buscarMejorAncho } from './grilla';
import { empaquetarSkyline } from './skyline';
import { celdaDeEquipo, ALTO_TAG } from './escalonado';
import { iconoBaseDe } from '../iconos';
import { cajaEquipo, rutaEntreEquipos, crucesEntreRutas, largoDeRutas } from '../puertos';

// Métodos de layout que solo existen para COMPARARSE contra el de
// producción en la pantalla de ensayo, más las métricas con las que se los
// compara. El escalonado, que ganó esa comparación, vive en escalonado.js.

// Orden de colocación. Por altura descendente empaqueta mejor (las altas
// definen el perfil y las bajas rellenan). Agrupando por área se pierde algo
// de densidad pero los equipos de un mismo sistema quedan juntos, que es lo
// que hace que el diagrama siga siendo legible como planta.
function ordenar(celdas, agruparPorArea) {
  if (!agruparPorArea) return [...celdas].sort((a, b) => b.alto - a.alto);
  const grupos = new Map();
  celdas.forEach((c) => {
    if (!grupos.has(c.eq.areaId)) grupos.set(c.eq.areaId, []);
    grupos.get(c.eq.areaId).push(c);
  });
  return [...grupos.values()].flatMap((g) => g.sort((a, b) => b.alto - a.alto));
}

export function empaquetarLibre(equipos, data, { arObjetivo = 16 / 9, agruparPorArea = true } = {}) {
  const celdas = equipos.map((eq) => celdaDeEquipo(eq, data)).filter(Boolean);
  if (celdas.length === 0) return null;

  const ordenadas = ordenar(celdas, agruparPorArea);
  const areaCeldas = celdas.reduce((acc, c) => acc + c.ancho * c.alto, 0);
  const anchoBase = Math.max(Math.sqrt(areaCeldas * arObjetivo), 200);

  // Mismo criterio que el compactado de producción: se prueban varios anchos
  // y gana el que deja la forma del resultado más parecida a la del panel.
  return buscarMejorAncho(
    anchoBase,
    arObjetivo,
    (ancho) => empaquetarSkyline(ordenadas, ancho),
    MULTIPLICADORES_FINOS
  );
}

const PAD_CAJA = 10;

// Caja que encierra a los equipos de cada área, calculada DESPUÉS de
// ubicarlos — igual que hace PortalSCADA.js con el cuadro punteado. Sirve
// para responder la pregunta que decide si este método es usable: al no
// reservar un rectángulo por área, ¿los equipos de un mismo sistema igual
// quedan juntos, o se dispersan y el diagrama deja de leerse como planta?
export function cajasPorArea(piezas) {
  const porArea = new Map();
  piezas.forEach((p) => {
    const izq = p.x - p.anchoIcono / 2;
    const der = p.x + p.anchoIcono / 2;
    const arriba = p.y - p.altoIcono;
    const abajo = p.y + ALTO_TAG;
    const c = porArea.get(p.eq.areaId);
    if (!c) {
      porArea.set(p.eq.areaId, { areaId: p.eq.areaId, x0: izq, x1: der, y0: arriba, y1: abajo });
      return;
    }
    c.x0 = Math.min(c.x0, izq);
    c.x1 = Math.max(c.x1, der);
    c.y0 = Math.min(c.y0, arriba);
    c.y1 = Math.max(c.y1, abajo);
  });
  return [...porArea.values()].map((c) => ({
    areaId: c.areaId,
    x: c.x0 - PAD_CAJA,
    y: c.y0 - PAD_CAJA,
    ancho: c.x1 - c.x0 + PAD_CAJA * 2,
    alto: c.y1 - c.y0 + PAD_CAJA * 2,
  }));
}

// Superficie cubierta por DOS O MÁS cajas de área. Si da cero, cada área
// quedó en una zona propia y se le puede dibujar su límite sin que choque
// con el de otra: densidad Y legibilidad, no una u otra.
//
// Se mide la UNIÓN de las zonas pisadas, no la suma de los pares: con
// muchas áreas, sumar pares cuenta la misma superficie una vez por cada par
// que la comparte y da cifras sin sentido (en la planta demo, 2315% de un
// lienzo). Para eso se comprimen las coordenadas y se cuenta por celda con
// un arreglo de diferencias.
export function solapamientoDeCajas(cajas) {
  if (cajas.length < 2) return 0;
  const xs = [...new Set(cajas.flatMap((c) => [c.x, c.x + c.ancho]))].sort((a, b) => a - b);
  const ys = [...new Set(cajas.flatMap((c) => [c.y, c.y + c.alto]))].sort((a, b) => a - b);
  const ix = new Map(xs.map((v, i) => [v, i]));
  const iy = new Map(ys.map((v, i) => [v, i]));

  const ancho = xs.length;
  const diff = new Int32Array(ys.length * ancho);
  cajas.forEach((c) => {
    const j0 = ix.get(c.x);
    const j1 = ix.get(c.x + c.ancho);
    const i0 = iy.get(c.y);
    const i1 = iy.get(c.y + c.alto);
    diff[i0 * ancho + j0] += 1;
    diff[i0 * ancho + j1] -= 1;
    diff[i1 * ancho + j0] -= 1;
    diff[i1 * ancho + j1] += 1;
  });

  let total = 0;
  const acum = new Int32Array(ys.length * ancho);
  for (let i = 0; i < ys.length - 1; i += 1) {
    for (let j = 0; j < ancho - 1; j += 1) {
      const k = i * ancho + j;
      acum[k] = diff[k] + (i > 0 ? acum[k - ancho] : 0) + (j > 0 ? acum[k - 1] : 0) - (i > 0 && j > 0 ? acum[k - ancho - 1] : 0);
      if (acum[k] >= 2) total += (xs[j + 1] - xs[j]) * (ys[i + 1] - ys[i]);
    }
  }
  return total;
}

// Métricas comparables entre métodos. "Lienzo vacío" es lo que de verdad se
// ve: incluye tanto el hueco que deja el empaquetado como el que agrega el
// encuadre al estirar el lienzo para no deformar los íconos.
export function metricas({ ancho, alto, areaIconos, arObjetivo }) {
  const ar = ancho / alto;
  const desvio = Math.abs(Math.log(ar / arObjetivo));
  // El encuadre estira el lado que haga falta hasta igualar la proporción
  // del panel; nunca encoge, porque recortaría contenido.
  const lienzoAncho = ar < arObjetivo ? alto * arObjetivo : ancho;
  const lienzoAlto = ar < arObjetivo ? alto : ancho / arObjetivo;
  return {
    ancho: Math.round(ancho),
    alto: Math.round(alto),
    ar,
    desvio,
    lienzoAncho: Math.round(lienzoAncho),
    lienzoAlto: Math.round(lienzoAlto),
    vacio: 1 - areaIconos / (lienzoAncho * lienzoAlto),
  };
}

// Qué le hace un método de acomodado a las CAÑERÍAS. Los métodos que
// reacomodan ignorando el proceso (escalonado, libre) ganan en densidad,
// pero la pregunta que faltaba responder con números es cuánto le cuesta
// eso al diagrama: si las conexiones quedan cortas y locales o hechas un
// ovillo.
//
// `piezas` son las de un método ya resuelto (eq + posición + escala), y
// solo se rutean las conexiones cuyos DOS extremos están entre ellas: una
// conexión que sale de la vista no se puede dibujar, y se cuenta aparte.
//
// Cuesta caro (el ruteo esquiva las cajas de todos los demás equipos), así
// que la pantalla lo calcula solo cuando se piden las cañerías.
// Cuánto puede desviarse una cañería más allá del borde de lo dibujado.
const MARGEN_LIENZO = 20;

export function metricasDeCanerias(piezas, conexiones, data) {
  const porId = new Map(piezas.map((p) => [p.eq.id, p]));
  const iconoDe = (p) => {
    const base = iconoBaseDe(p.eq.tipo, data);
    return base ? { ...base, escala: p.escala } : null;
  };
  const cajas = piezas
    .map((p) => ({ id: p.eq.id, caja: cajaEquipo({ x: p.x, y: p.y }, iconoDe(p)) }))
    .filter((c) => c.caja);

  // Los desvíos para esquivar equipos se acotan al lienzo: el lienzo es el
  // bounding box de lo dibujado, así que sale de las mismas cajas. Sin este
  // límite la espiral de buscarQuiebreLibre se iba afuera de la pantalla.
  const limites = cajas.length
    ? {
        izq: Math.min(...cajas.map((c) => c.caja.izq)) - MARGEN_LIENZO,
        der: Math.max(...cajas.map((c) => c.caja.der)) + MARGEN_LIENZO,
        arriba: Math.min(...cajas.map((c) => c.caja.arriba)) - MARGEN_LIENZO,
        abajo: Math.max(...cajas.map((c) => c.caja.abajo)) + MARGEN_LIENZO,
      }
    : null;

  const rutas = [];
  let fuera = 0;
  conexiones.forEach((c) => {
    const de = porId.get(c.deId);
    const a = porId.get(c.aId);
    if (!de || !a) {
      // Al menos un extremo cayó en otra vista (o en otra planta).
      if (porId.has(c.deId) || porId.has(c.aId)) fuera += 1;
      return;
    }
    const r = rutaEntreEquipos(c, de.eq, a.eq, { x: de.x, y: de.y }, { x: a.x, y: a.y }, iconoDe(de), iconoDe(a), cajas, limites);
    if (r) rutas.push({ ...r, conexion: c });
  });

  return { rutas, largo: Math.round(largoDeRutas(rutas)), cruces: crucesEntreRutas(rutas), fuera };
}
