import { iconoBaseDe } from '../iconos';
import { escalaVisible, buscarMejorAncho } from './grilla';
import { empaquetarSkyline } from './skyline';

// Empaquetado LIBRE: acomoda equipos sueltos, sin el rectángulo de área como
// unidad. El compactado de producción (store.js) arma primero un bloque
// rectangular por área y después empaqueta esos bloques entre sí; ese
// rectángulo es lo que fija el piso de espacio desperdiciado, porque el
// hueco que queda dentro de un bloque no lo puede usar ninguna otra área.
// Acá la unidad que se ubica es el equipo, así que un equipo chico puede
// meterse en un hueco que un bloque entero nunca habría aprovechado.
//
// Solo REUBICA: no cambia el tamaño de ningún equipo. Así la comparación
// contra el método actual mide una sola cosa —cuánto aprovecha el
// empaquetado— sin mezclarla con el crecimiento de escala.

const SEPARACION = 14; // aire entre equipos vecinos
export const ALTO_TAG = 18; // alto reservado al TAG debajo del ícono
// El TAG puede ser MÁS ANCHO que su ícono (una bomba mide 26 y "PMP-100"
// unos 53): si la celda no lo contempla, las etiquetas se pisan entre sí
// justo cuando el empaquetado se pone denso, que es de lo que se trata esto.
const ANCHO_CARACTER_TAG = 7.6;

export function celdaDeEquipo(eq, data) {
  const icono = iconoBaseDe(eq.tipo, data);
  if (!icono) return null;
  const escala = escalaVisible(eq, data);
  const anchoIcono = icono.anchoBase * escala;
  const altoIcono = icono.altoBase * escala;
  const anchoTag = (eq.tag || '').length * ANCHO_CARACTER_TAG;
  return {
    eq,
    escala,
    anchoIcono,
    altoIcono,
    ancho: Math.max(anchoIcono, anchoTag) + SEPARACION,
    alto: altoIcono + ALTO_TAG + SEPARACION,
  };
}

// Los métodos de ensayo arrancan de un ancho más chico que el compactado de
// producción: al ubicar equipos sueltos, y no bloques, las formas
// alcanzables son mucho más finas y conviene mirar un poco más abajo.
const MULTIPLICADORES_ENSAYO = [0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.5, 1.75, 2];

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
    MULTIPLICADORES_ENSAYO
  );
}

// ---------------------------------------------------------------------
// Empaquetado ESCALONADO: los equipos fluyen como un texto —de izquierda a
// derecha, saltando de fila al llegar al ancho— y las áreas se suceden en
// ese flujo sin reservar cada una un rectángulo propio. La ganancia está
// justo ahí: la última fila de un área casi siempre queda a medio llenar, y
// acá ese sobrante lo usa la siguiente área en vez de perderse dentro de un
// bloque.
//
// A diferencia del empaquetado libre, respeta el agrupamiento por
// construcción: los equipos de un área son contiguos en el flujo, no
// "ordenados juntos" y después dispersados por el packer. El precio es que
// el límite del área deja de ser un rectángulo — es una figura escalonada,
// que es lo que dibuja contornoDeSpans.

// Reparte los equipos en filas de ancho máximo W. Tres pasadas porque el
// alto de una fila no se conoce hasta terminarla.
function fluirEnAncho(grupos, W) {
  const items = [];
  let fila = 0;
  let x = 0;
  grupos.forEach((g) => {
    g.celdas.forEach((c) => {
      if (x > 0 && x + c.ancho > W) {
        fila += 1;
        x = 0;
      }
      items.push({ celda: c, areaId: g.areaId, fila, x });
      x += c.ancho;
    });
  });

  const altoDeFila = [];
  items.forEach((it) => {
    altoDeFila[it.fila] = Math.max(altoDeFila[it.fila] || 0, it.celda.alto);
  });
  const yDeFila = [];
  altoDeFila.reduce((acc, alto, i) => {
    yDeFila[i] = acc;
    return acc + alto;
  }, 0);

  const colocadas = items.map((it) => ({ ...it.celda, areaId: it.areaId, fila: it.fila, x: it.x, y: yDeFila[it.fila] }));

  // Tramo que ocupa cada área en cada fila — la base del contorno.
  const spansPorArea = new Map();
  items.forEach((it) => {
    if (!spansPorArea.has(it.areaId)) spansPorArea.set(it.areaId, new Map());
    const porFila = spansPorArea.get(it.areaId);
    const s = porFila.get(it.fila);
    const x1 = it.x + it.celda.ancho;
    if (!s) porFila.set(it.fila, { fila: it.fila, x0: it.x, x1 });
    else {
      s.x0 = Math.min(s.x0, it.x);
      s.x1 = Math.max(s.x1, x1);
    }
  });

  const spans = [...spansPorArea.entries()].map(([areaId, porFila]) => ({
    areaId,
    spans: [...porFila.values()]
      .sort((a, b) => a.fila - b.fila)
      .map((s) => ({ ...s, y0: yDeFila[s.fila], y1: yDeFila[s.fila] + altoDeFila[s.fila] })),
  }));

  const ancho = Math.max(...colocadas.map((c) => c.x + c.ancho), 1);
  const alto = (yDeFila[altoDeFila.length - 1] || 0) + (altoDeFila[altoDeFila.length - 1] || 0);
  return { colocadas, spans, ancho, alto: alto || 1 };
}

export function empaquetarEscalonado(equipos, data, { arObjetivo = 16 / 9 } = {}) {
  const celdas = equipos.map((eq) => celdaDeEquipo(eq, data)).filter(Boolean);
  if (celdas.length === 0) return null;

  // Los equipos de un área van juntos y en orden; las áreas, en el orden en
  // que aparecen. Nada de reordenar por altura: acá manda la pertenencia.
  const porArea = new Map();
  celdas.forEach((c) => {
    if (!porArea.has(c.eq.areaId)) porArea.set(c.eq.areaId, []);
    porArea.get(c.eq.areaId).push(c);
  });
  const grupos = [...porArea.entries()].map(([areaId, cs]) => ({ areaId, celdas: cs }));

  const areaCeldas = celdas.reduce((acc, c) => acc + c.ancho * c.alto, 0);
  const anchoBase = Math.max(Math.sqrt(areaCeldas * arObjetivo), 200);

  return buscarMejorAncho(anchoBase, arObjetivo, (ancho) => fluirEnAncho(grupos, ancho), MULTIPLICADORES_ENSAYO);
}

// Contorno rectilíneo de un área: baja por los bordes derechos de sus
// tramos y vuelve por los izquierdos. Los tramos que no se tocan en X (un
// área chica justo en el salto de fila) salen como contornos separados —
// que es la verdad: ahí el área quedó partida.
const INSET_CONTORNO = 4;

export function contornosDeArea(spans) {
  if (!spans || spans.length === 0) return [];
  const runs = [];
  let actual = [spans[0]];
  for (let i = 1; i < spans.length; i += 1) {
    const prev = spans[i - 1];
    const s = spans[i];
    const seTocan = s.x0 < prev.x1 && s.x1 > prev.x0;
    if (seTocan) actual.push(s);
    else {
      runs.push(actual);
      actual = [s];
    }
  }
  runs.push(actual);

  return runs.map((run) => {
    const r = run.map((s) => ({
      x0: s.x0 + INSET_CONTORNO,
      x1: s.x1 - INSET_CONTORNO,
      y0: s.y0 + INSET_CONTORNO,
      y1: s.y1 - INSET_CONTORNO,
    }));
    const derecha = r.flatMap((s) => [[s.x1, s.y0], [s.x1, s.y1]]);
    const izquierda = [...r].reverse().flatMap((s) => [[s.x0, s.y1], [s.x0, s.y0]]);
    const puntos = [...derecha, ...izquierda];
    return {
      d: `M ${puntos.map((p) => `${Math.round(p[0])} ${Math.round(p[1])}`).join(' L ')} Z`,
      x: r[0].x0,
      y: r[0].y0,
    };
  });
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
