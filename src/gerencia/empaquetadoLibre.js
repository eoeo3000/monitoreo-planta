import { iconoBaseDe } from './iconos';

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
  const escala = eq.escalaPropia ?? data.escalasPorTipo?.[eq.tipo] ?? 1;
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

// Skyline: el perfil de altura ya ocupada en cada tramo de X. Misma familia
// de algoritmo que usa el compactado de producción, pero a nivel de equipo.
function empaquetarEnAncho(celdas, anchoObjetivo) {
  let skyline = [{ x: 0, ancho: anchoObjetivo, y: 0 }];

  const alturaEnTramo = (xIni, ancho) => {
    let maxY = 0;
    const xFin = xIni + ancho;
    skyline.forEach((seg) => {
      if (seg.x + seg.ancho <= xIni || seg.x >= xFin) return;
      maxY = Math.max(maxY, seg.y);
    });
    return maxY;
  };

  // Lo más arriba posible y, a igual altura, lo más a la izquierda.
  const mejorPosicion = (ancho) => {
    let mejor = null;
    skyline.forEach((seg) => {
      if (seg.x + ancho > anchoObjetivo + 0.5) return;
      const y = alturaEnTramo(seg.x, ancho);
      if (!mejor || y < mejor.y || (y === mejor.y && seg.x < mejor.x)) mejor = { x: seg.x, y };
    });
    return mejor || { x: 0, y: alturaEnTramo(0, ancho) };
  };

  const colocadas = [];
  let ancho = 0;
  let alto = 0;

  celdas.forEach((celda) => {
    const pos = mejorPosicion(celda.ancho);
    colocadas.push({ ...celda, x: pos.x, y: pos.y });
    ancho = Math.max(ancho, pos.x + celda.ancho);
    alto = Math.max(alto, pos.y + celda.alto);

    const xFin = pos.x + celda.ancho;
    const nuevo = [];
    let agregado = false;
    skyline.forEach((seg) => {
      const segFin = seg.x + seg.ancho;
      if (segFin <= pos.x || seg.x >= xFin) {
        nuevo.push(seg);
        return;
      }
      if (seg.x < pos.x) nuevo.push({ x: seg.x, ancho: pos.x - seg.x, y: seg.y });
      if (!agregado) {
        nuevo.push({ x: pos.x, ancho: celda.ancho, y: pos.y + celda.alto });
        agregado = true;
      }
      if (segFin > xFin) nuevo.push({ x: xFin, ancho: segFin - xFin, y: seg.y });
    });
    skyline = nuevo.sort((a, b) => a.x - b.x);
  });

  return { colocadas, ancho: ancho || 1, alto: alto || 1 };
}

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
  // Se compara en escala logarítmica para que quedarse corto y pasarse pesen
  // igual.
  let mejor = null;
  [0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.5, 1.75, 2].forEach((mult) => {
    const r = empaquetarEnAncho(ordenadas, anchoBase * mult);
    const desvio = Math.abs(Math.log(r.ancho / r.alto / arObjetivo));
    if (!mejor || desvio < mejor.desvio) mejor = { ...r, desvio, mult };
  });

  return mejor;
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

// Cuánto se pisan entre sí esas cajas. Si da cero, cada área quedó en una
// zona propia y se le puede volver a dibujar el cuadro punteado sin que
// choque con el de otra: densidad Y legibilidad, no una u otra.
export function solapamientoDeCajas(cajas) {
  let total = 0;
  for (let i = 0; i < cajas.length; i += 1) {
    for (let j = i + 1; j < cajas.length; j += 1) {
      const a = cajas[i];
      const b = cajas[j];
      const w = Math.min(a.x + a.ancho, b.x + b.ancho) - Math.max(a.x, b.x);
      const h = Math.min(a.y + a.alto, b.y + b.alto) - Math.max(a.y, b.y);
      if (w > 0 && h > 0) total += w * h;
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
