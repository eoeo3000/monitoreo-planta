import { iconoBaseDe, escalaVisible } from '../iconos';
import { MULTIPLICADORES_FINOS, buscarMejorAncho } from './grilla';

// Layout ESCALONADO y su reparto en vistas — el método de la Vista de
// operación. Vino de la pantalla de ensayo, donde ganó contra el compactado
// de bloques y contra el empaquetado libre en las tres plantas de prueba
// (menos lienzo vacío, mejor calce con el panel, cero solape entre áreas).
// Al pasar a producción se mudó acá; en ensayo.js quedó solo lo que sigue
// siendo comparación.
//
// Nada de este archivo sabe de React ni toca el estado.

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

  return buscarMejorAncho(anchoBase, arObjetivo, (ancho) => fluirEnAncho(grupos, ancho), MULTIPLICADORES_FINOS);
}

// ---------------------------------------------------------------------
// Reparto en VISTAS.
//
// El encuadre escala el contenido para llenar el panel, así que la escala
// interna no cambia nada de lo que se ve: si todo crece, la cámara se aleja
// y el producto queda igual. Lo único que mueve el tamaño en pantalla es
// CUÁNTOS equipos hay. De ahí que un tamaño mínimo legible no sea un
// parámetro más, sino lo que DEFINE la capacidad de una pantalla: si no
// entran, la única salida es mostrar menos y mandar el resto a otra vista.
//
// Se reparte por área completa, nunca partiendo un área: una mitad de
// sistema en cada pantalla no se lee como planta.
//
// El MÁXIMO no participa de esta decisión — solo el mínimo. Ver encuadrar:
// el tope de acercamiento es una regla de dibujo y decide cómo se ve una
// vista, no cuántas vistas hay.

// Alto del ícono más chico y del más grande, en coordenadas del lienzo —
// el chico decide cuándo hace falta paginar, el grande cuánto se puede
// acercar la cámara sin que quede ridículo.
function altosDeIcono(colocadas) {
  const altos = colocadas.map((c) => c.altoIcono).filter((a) => a > 0);
  if (altos.length === 0) return { min: 1, max: 1 };
  return { min: Math.min(...altos), max: Math.max(...altos) };
}

// Cuánto agranda o achica el encuadre a este lienzo para meterlo en el
// panel, y qué tamaño en pantalla le queda al ícono más chico.
// `altoIconoMinRef` es el ícono más chico de TODA la planta, no el de esta
// vista. Importa porque todas las vistas terminan dibujándose a la misma
// escala (ver repartirEnVistas): si cada una se midiera contra su propio
// ícono más chico, una vista de puros tanques daría por buena una escala
// con la que los motores de otra vista quedarían ilegibles.
export function encuadrar(layout, panel, tamMaxPx, altoIconoMinRef) {
  const { min, max } = altosDeIcono(layout.colocadas);
  const minRef = altoIconoMinRef || min;
  const zoomEntra = Math.min(panel.ancho / layout.ancho, panel.alto / layout.alto);
  // Tope de acercamiento: con muy pocos equipos la cámara se acerca tanto
  // que un solo tanque ocupa la pantalla entera.
  const zoomTope = tamMaxPx ? tamMaxPx / max : Infinity;
  const zoom = Math.min(zoomEntra, zoomTope);
  return {
    zoom,
    minPx: minRef * zoom,
    maxPx: max * zoom,
    // Lo que mediría el ícono más chico SIN el tope. Es el número que decide
    // la paginación, y tiene que ser este y no minPx: el tope es una regla
    // de DIBUJO, y si entrara en la decisión un parámetro de dibujo
    // terminaría diciendo cuántas vistas hay. Medido en la planta demo con
    // el tipo tanque en 3x y un mínimo de 35 px: mirando minPx salían 54
    // vistas, mirando este 19.
    minPxParaCaber: minRef * zoomEntra,
    topado: zoomEntra > zoomTope,
  };
}

// Reparte las áreas en vistas sucesivas. Dentro de cada vista se empaqueta
// con el método escalonado; se agregan áreas mientras el ícono más chico
// siga por encima del mínimo.
//
// Agregar áreas suma superficie y por lo tanto aleja la cámara, así que la
// condición se toma como monótona y el corte se busca por bisección: con
// 200 áreas son ~8 empaquetados en vez de 200. (La forma del empaquetado
// salta en escalones, así que en teoría un K puntual podría encuadrarse
// mejor que K+1; probado con una extensión hacia adelante en la planta
// demo, no cambió ni un corte, así que no se paga ese costo.)
//
// Las vistas salen DESPAREJAS en cantidad de equipos, y está bien: se
// equilibran por superficie, no por cuenta. En la planta demo el reparto da
// 183 / 84 / 191 / 42, y la vista corta es la que concentra los tanques —
// un tanque (44×90) ocupa unas seis veces lo de un motor (26×26).
export function repartirEnVistas(equipos, data, { arObjetivo = 16 / 9, panel, tamMinPx = 0, tamMaxPx } = {}) {
  const porArea = new Map();
  equipos.forEach((eq) => {
    if (!porArea.has(eq.areaId)) porArea.set(eq.areaId, []);
    porArea.get(eq.areaId).push(eq);
  });
  const areas = [...porArea.entries()].map(([areaId, eqs]) => ({ areaId, eqs }));
  if (areas.length === 0) return [];

  // El ícono más chico de la planta entera. Todas las vistas se miden
  // contra este y no contra el suyo propio, porque todas se van a dibujar a
  // la misma escala.
  const altosPlanta = equipos.map((eq) => celdaDeEquipo(eq, data)).filter(Boolean).map((c) => c.altoIcono);
  const altoIconoMinPlanta = altosPlanta.length ? Math.min(...altosPlanta) : 1;

  const armar = (subset) => {
    const layout = empaquetarEscalonado(subset.flatMap((a) => a.eqs), data, { arObjetivo });
    if (!layout) return null;
    return { layout, encuadre: encuadrar(layout, panel, tamMaxPx, altoIconoMinPlanta), areas: subset };
  };

  // Sin mínimo no hay nada que repartir: entra todo en una vista.
  if (!tamMinPx || !panel) {
    const unica = armar(areas);
    return unica ? [unica] : [];
  }

  const entra = (n) => {
    const candidato = armar(pendientesActuales.slice(0, n));
    return candidato && candidato.encuadre.minPxParaCaber >= tamMinPx ? candidato : null;
  };

  const vistas = [];
  let pendientesActuales = areas;
  while (pendientesActuales.length > 0) {
    const total = pendientesActuales.length;
    const conUna = entra(1);

    // Si UNA área sola ya no llega al mínimo, ninguna cantidad va a llegar:
    // agregar áreas solo aleja la cámara. Partir no gana nada, y antes esto
    // caía en el peor resultado posible —la bisección devolvía 1 y salían
    // decenas de vistas de tres equipos—. Se deja todo lo que queda en una
    // sola vista y se marca que ese mínimo no es alcanzable en esta
    // pantalla, que es la verdad y hay que poder decirla.
    if (!conUna) {
      const resto = armar(pendientesActuales);
      if (resto) vistas.push({ ...resto, minimoInalcanzable: true });
      break;
    }

    let corte = 1;
    let mejor = conUna;

    // Bisección para acercarse rápido: con 200 áreas son ~8 empaquetados en
    // vez de 200.
    let bajo = 1;
    let alto = total;
    while (bajo < alto) {
      const medio = Math.ceil((bajo + alto) / 2);
      const candidato = entra(medio);
      if (candidato) {
        bajo = medio;
        corte = medio;
        mejor = candidato;
      } else {
        alto = medio - 1;
      }
    }

    vistas.push(mejor);
    pendientesActuales = pendientesActuales.slice(corte);
  }
  return vistas;
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

