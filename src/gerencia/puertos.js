// Modelo de puertos declarados (handoff §9): convierte los puertos de un
// ícono — expresados en coordenadas de su propio viewBox — a coordenadas
// absolutas del lienzo, y rutea las conexiones entre ellos sin holgura, con
// tramos ortogonales y un mínimo de 8px perpendicular al glifo antes del
// primer giro. Usado por PortalSCADA.js con los glifos de scadaIconos.js.

import { puntoPerimetroDeFormas } from './formas';

// Tamaño base y anclaje (borde inferior fijo) por defecto. Un ícono puede
// pisar estos valores con sus propios `anchoBase`/`altoBase`/`bordeInferior`
// cuando su gramática visual usa otra proporción.
const ANCHO_BASE = 52;
const ALTO_BASE = 35;
const BORDE_INFERIOR = 5;
const TRAMO_MINIMO = 8;

const DIR_VECTOR = { N: { x: 0, y: -1 }, S: { x: 0, y: 1 }, E: { x: 1, y: 0 }, W: { x: -1, y: 0 } };
const esHorizontal = (dir) => dir === 'E' || dir === 'W';
const redondear = (p) => ({ x: Math.round(p.x), y: Math.round(p.y) });

// Proyecta un puerto (coordenadas del viewBox) a coordenadas absolutas del
// lienzo, dada la posición del equipo y su ícono (con su propia `escala`).
export function puntoAbsoluto(posicion, icono, nombrePuerto) {
  const puerto = icono?.puertos?.[nombrePuerto];
  if (!puerto) return null;
  const escala = icono.escala || 1;
  const anchoIcono = (icono.anchoBase || ANCHO_BASE) * escala;
  const altoIcono = (icono.altoBase || ALTO_BASE) * escala;
  const bordeInferior = icono.bordeInferior ?? BORDE_INFERIOR;
  const [, , vbAncho, vbAlto] = icono.viewBox.split(' ').map(Number);
  const x = posicion.x + (-anchoIcono / 2 + (puerto.x / vbAncho) * anchoIcono);
  const y = posicion.y + (bordeInferior - altoIcono) + (puerto.y / vbAlto) * altoIcono;
  return { x, y, dir: puerto.dir, nombre: nombrePuerto };
}

// Entre los puertos declarados de un ícono, elige el que queda más orientado
// hacia `posicionOtro` — así "Conectar equipos" no necesita pedir qué puerto
// usar: el más cercano en dirección al otro equipo es, en la práctica, el
// correcto (succión hacia la bomba, descarga hacia el hidrociclón, etc.).
export function elegirPuerto(icono, posicion, posicionOtro) {
  const nombres = Object.keys(icono?.puertos || {});
  if (nombres.length === 0) return null;
  const vx = posicionOtro.x - posicion.x;
  const vy = posicionOtro.y - posicion.y;
  const largo = Math.hypot(vx, vy) || 1;
  const dir = { x: vx / largo, y: vy / largo };
  let mejor = nombres[0];
  let mejorPuntaje = -Infinity;
  for (const nombre of nombres) {
    const dv = DIR_VECTOR[icono.puertos[nombre].dir];
    const puntaje = dv.x * dir.x + dv.y * dir.y;
    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejor = nombre;
    }
  }
  return mejor;
}

// Punto absoluto del puerto de un equipo mejor orientado hacia otra posición.
export function puertoHacia(posicion, icono, posicionOtro) {
  if (!icono) return null;
  const nombre = elegirPuerto(icono, posicion, posicionOtro);
  return nombre ? puntoAbsoluto(posicion, icono, nombre) : null;
}

function dimensionesIcono(icono) {
  const escala = icono.escala || 1;
  const anchoIcono = (icono.anchoBase || ANCHO_BASE) * escala;
  const altoIcono = (icono.altoBase || ALTO_BASE) * escala;
  return { anchoIcono, altoIcono, escala };
}

// Un punto absoluto del lienzo, a las mismas coordenadas "crudas" en las que
// están definidas `formas`/`puertos` de un ícono (antes de escala y
// posición) — y de vuelta. Guardar el punto libre en estas coordenadas
// (no en píxeles absolutos) es lo que hace que siga al equipo solo si se
// mueve o se le cambia el tamaño.
function aLocal(posicion, icono, absoluto) {
  const { anchoIcono, altoIcono, escala } = dimensionesIcono(icono);
  const origenX = posicion.x - anchoIcono / 2;
  const origenY = posicion.y - altoIcono;
  return { x: (absoluto.x - origenX) / escala, y: (absoluto.y - origenY) / escala };
}
function aAbsoluto(posicion, icono, local) {
  const { anchoIcono, altoIcono, escala } = dimensionesIcono(icono);
  const origenX = posicion.x - anchoIcono / 2;
  const origenY = posicion.y - altoIcono;
  return { x: origenX + local.x * escala, y: origenY + local.y * escala };
}

// El punto de la silueta real (no una caja que la envuelve) más cercano a un
// punto cualquiera del lienzo — usado al soltar el extremo de una conexión
// arrastrado a mano: se puede conectar en cualquier parte del contorno
// dibujado, círculos y óvalos incluidos, no solo en los puertos declarados
// ni en las esquinas de un rectángulo invisible. Devuelve {x,y,dir} en
// coordenadas "crudas" del ícono — así es como se guarda en la conexión.
export function puntoPerimetroCercano(posicion, icono, punto) {
  const local = aLocal(posicion, icono, punto);
  return puntoPerimetroDeFormas(icono?.formas, local);
}

// Convierte un punto libre guardado (coordenadas crudas + dir, de
// puntoPerimetroCercano) a coordenadas absolutas del lienzo.
export function puntoDeManual(posicion, icono, manual) {
  const abs = aAbsoluto(posicion, icono, manual);
  return { x: abs.x, y: abs.y, dir: manual.dir };
}

// Igual que puertoHacia, pero respeta un extremo fijado a mano cuando existe:
// un nombre de puerto declarado (string) o un punto libre del perímetro real
// ({x, y, dir} en coordenadas crudas) — el que se guarda al arrastrar un
// extremo de la conexión.
export function puertoElegido(posicion, icono, posicionOtro, manual) {
  if (!icono) return null;
  if (manual && typeof manual === 'object') return puntoDeManual(posicion, icono, manual);
  if (typeof manual === 'string' && icono.puertos?.[manual]) return puntoAbsoluto(posicion, icono, manual);
  return puertoHacia(posicion, icono, posicionOtro);
}

// Ruta ortogonal entre dos puertos {x,y,dir}: sale perpendicular al glifo con
// un tramo mínimo de TRAMO_MINIMO antes de girar, sin diagonales ni curvas, y
// con coordenadas enteras (shape-rendering="crispEdges" en el trazo).
//
// `quiebreManual`, si viene, reemplaza la posición automática del tramo medio
// — solo tiene efecto cuando los dos puertos salen en la misma orientación
// (ambos horizontales o ambos verticales), que es el único caso con un tramo
// libre para mover; con orientaciones mixtas la ruta es un solo codo fijo por
// geometría y no hay nada que arrastrar. `esOrientacionLibre` avisa cuál es
// el caso, para que quien arrastra la manija sepa si mover X o Y.
export function rutaPuertos(puertoA, puertoB, quiebreManual) {
  const p1 = { x: puertoA.x + DIR_VECTOR[puertoA.dir].x * TRAMO_MINIMO, y: puertoA.y + DIR_VECTOR[puertoA.dir].y * TRAMO_MINIMO };
  const p2 = { x: puertoB.x + DIR_VECTOR[puertoB.dir].x * TRAMO_MINIMO, y: puertoB.y + DIR_VECTOR[puertoB.dir].y * TRAMO_MINIMO };
  const horizA = esHorizontal(puertoA.dir);
  const horizB = esHorizontal(puertoB.dir);
  const orientacionLibre = horizA === horizB ? (horizA ? 'x' : 'y') : null;

  let intermedios;
  if (horizA && horizB) {
    const midX = quiebreManual ?? (p1.x + p2.x) / 2;
    intermedios = [{ x: midX, y: p1.y }, { x: midX, y: p2.y }];
  } else if (!horizA && !horizB) {
    const midY = quiebreManual ?? (p1.y + p2.y) / 2;
    intermedios = [{ x: p1.x, y: midY }, { x: p2.x, y: midY }];
  } else if (horizA && !horizB) {
    intermedios = [{ x: p2.x, y: p1.y }];
  } else {
    intermedios = [{ x: p1.x, y: p2.y }];
  }

  const puntos = [puertoA, p1, ...intermedios, p2, puertoB].map(redondear);
  const filtrados = puntos.filter((p, i) => i === 0 || p.x !== puntos[i - 1].x || p.y !== puntos[i - 1].y);
  const d = filtrados.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  return {
    d,
    inicio: filtrados[0],
    fin: filtrados[filtrados.length - 1],
    medio: filtrados[Math.floor((filtrados.length - 1) / 2)],
    orientacionLibre,
  };
}

// Variante para la línea de previsualización mientras se conecta: el destino
// es el puntero del mouse, no un puerto real (no tiene `dir`).
export function rutaHaciaPunto(puertoA, destino) {
  const p1 = { x: puertoA.x + DIR_VECTOR[puertoA.dir].x * TRAMO_MINIMO, y: puertoA.y + DIR_VECTOR[puertoA.dir].y * TRAMO_MINIMO };
  const quiebre = esHorizontal(puertoA.dir) ? { x: destino.x, y: p1.y } : { x: p1.x, y: destino.y };
  const puntos = [puertoA, p1, quiebre, destino].map(redondear);
  const filtrados = puntos.filter((p, i) => i === 0 || p.x !== puntos[i - 1].x || p.y !== puntos[i - 1].y);
  const d = filtrados.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  return { d };
}
