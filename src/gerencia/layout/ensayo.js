import { MULTIPLICADORES_FINOS, buscarMejorAncho } from './grilla';
import { empaquetarSkyline } from './skyline';
import { celdaDeEquipo, ALTO_TAG } from './escalonado';
import { iconoBaseDe } from '../iconos';
import { cajaEquipo, rutaEntreEquipos, crucesEntreRutas, largoDeRutas, indiceDeObstaculos, puertoHacia } from '../puertos';

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

  // El índice se arma UNA vez para todas las conexiones del método: es lo
  // que evita comparar cada tramo contra las 500 cajas de la planta.
  const indice = indiceDeObstaculos(cajas);

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
    const r = rutaEntreEquipos(c, de.eq, a.eq, { x: de.x, y: de.y }, { x: a.x, y: a.y }, iconoDe(de), iconoDe(a), indice, limites);
    if (r) rutas.push({ ...r, conexion: c });
  });

  return { rutas, largo: Math.round(largoDeRutas(rutas)), cruces: crucesEntreRutas(rutas), fuera };
}

// --- Conectores de salida: la cañería que sigue en OTRA vista -----------
//
// Una conexión con un extremo en esta vista y el otro en otra desaparecería
// del lienzo sin dejar rastro. Se dibuja como conector de salida de P&ID: un
// cabo corto que apunta AFUERA del dibujo —no hacia donde está el otro
// equipo, que vive en otro lienzo y cuya posición en estas coordenadas no
// querría decir nada— con el TAG del otro extremo y a qué vista ir.
//
// Vive acá y no en la pantalla porque es geometría pura y la necesitan las
// DOS: el editor y la Vista de operación.
//
// Son pocas: medido, 3 de 470 conexiones en la planta demo a 28 px de
// mínimo, 6 a 48 px. El reparto nunca parte un área entre vistas y la demo
// conecta con colectores dentro de cada área, así que solo cruza lo que une
// áreas distintas.
const LARGO_SALIDA = 20;
const AIRE_VIEWBOX = 20; // el aire que agrega el encuadre por lado
const DIR_VECTOR_SALIDA = { N: { x: 0, y: -1 }, S: { x: 0, y: 1 }, E: { x: 1, y: 0 }, W: { x: -1, y: 0 } };

export function conectoresDeSalida({ piezas, conexiones, vistaDeEquipo, data, lienzo }) {
  const porId = new Map((piezas || []).map((p) => [p.eq.id, p]));
  if (porId.size === 0 || !lienzo) return [];

  const centro = { x: (lienzo.ancho || 0) / 2, y: (lienzo.alto || 0) / 2 };
  const izqVisible = -AIRE_VIEWBOX;
  const arribaVisible = -AIRE_VIEWBOX;
  const derVisible = (lienzo.ancho || 0) + AIRE_VIEWBOX;
  const abajoVisible = (lienzo.alto || 0) + AIRE_VIEWBOX;

  const salidas = [];
  (conexiones || []).forEach((c) => {
    const aca = porId.get(c.deId) || porId.get(c.aId);
    const otroId = porId.has(c.deId) ? c.aId : c.deId;
    if (!aca || porId.has(otroId)) return;
    const vistaOtro = vistaDeEquipo.get(otroId);
    if (vistaOtro === undefined) return; // el otro extremo no está en ninguna vista
    const base = iconoBaseDe(aca.eq.tipo, data);
    if (!base) return;
    const icono = { ...base, escala: aca.escala };

    // Un objetivo bien lejos en la dirección opuesta al centro: el puerto que
    // elige es el que mira hacia el borde más cercano.
    const afuera = { x: aca.x + (aca.x - centro.x) * 10, y: aca.y + (aca.y - centro.y) * 10 };
    const puerto = puertoHacia({ x: aca.x, y: aca.y }, icono, afuera);
    if (!puerto) return;
    const v = DIR_VECTOR_SALIDA[puerto.dir];
    const x2 = puerto.x + v.x * LARGO_SALIDA;
    const y2 = puerto.y + v.y * LARGO_SALIDA;
    const sale = porId.has(c.deId); // el equipo de acá es el origen
    const tagOtro = data.equipos.find((e) => e.id === otroId)?.tag || otroId;
    const texto = `${sale ? '▸ ' : '◂ '}${tagOtro} · vista ${vistaOtro + 1}`;

    // El cartel se acota al lienzo VISIBLE. Sin esto, un equipo pegado al
    // borde lo manda afuera del viewBox y no se dibuja: medido, 4 de 6
    // conectores de la demo quedaban invisibles —justo el mal que esto viene
    // a curar—. Si no entra del lado de afuera, el texto se pasa al otro lado
    // del cabo en vez de salirse.
    const ancho = texto.length * 5.6 + 8;
    let ancla = v.x < 0 ? 'end' : v.x > 0 ? 'start' : 'middle';
    let xTexto = x2 + (ancla === 'end' ? -6 : ancla === 'start' ? 6 : 0);
    if (ancla === 'start' && xTexto + ancho > derVisible) { ancla = 'end'; xTexto = x2 - 6; }
    else if (ancla === 'end' && xTexto - ancho < izqVisible) { ancla = 'start'; xTexto = x2 + 6; }
    if (ancla === 'middle') xTexto = Math.min(derVisible - ancho / 2, Math.max(izqVisible + ancho / 2, xTexto));
    else if (ancla === 'start') xTexto = Math.min(xTexto, derVisible - ancho);
    else xTexto = Math.max(xTexto, izqVisible + ancho);
    const yTexto = Math.min(abajoVisible - 2, Math.max(arribaVisible + 10, y2 - 6));

    salidas.push({ id: c.id, sale, tagOtro, vistaOtro, texto, x1: puerto.x, y1: puerto.y, x2, y2, ancla, xTexto, yTexto });
  });
  return salidas;
}
