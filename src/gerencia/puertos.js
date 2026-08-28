// Modelo de puertos declarados (handoff §9): convierte los puertos de un
// ícono — expresados en coordenadas de su propio viewBox — a coordenadas
// absolutas del lienzo, y rutea las conexiones entre ellos sin holgura, con
// tramos ortogonales y un mínimo de 8px perpendicular al glifo antes del
// primer giro. Usado por PortalSCADA.js con los glifos de scadaIconos.js.

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
  return { anchoIcono, altoIcono };
}

// Punto exacto sobre un lado (N/S/E/W) del rectángulo que envuelve al glifo,
// a una fracción `t` (0..1) de una esquina a la otra. A diferencia de un
// puerto declarado (semántico, fijo en la geometría exacta del dibujo), esto
// es "cualquier parte del perímetro" — el rectángulo envolvente, no la
// silueta exacta, para no necesitar geometría distinta por cada forma o tipo
// creado por el usuario.
export function puntoDeLado(posicion, icono, lado, t) {
  const { anchoIcono, altoIcono } = dimensionesIcono(icono);
  const origenX = posicion.x - anchoIcono / 2;
  const origenY = posicion.y - altoIcono;
  const tc = Math.max(0, Math.min(1, t));
  if (lado === 'N') return { x: origenX + tc * anchoIcono, y: origenY, dir: 'N' };
  if (lado === 'S') return { x: origenX + tc * anchoIcono, y: origenY + altoIcono, dir: 'S' };
  if (lado === 'W') return { x: origenX, y: origenY + tc * altoIcono, dir: 'W' };
  return { x: origenX + anchoIcono, y: origenY + tc * altoIcono, dir: 'E' };
}

// El punto del perímetro (rectángulo envolvente) más cercano a un punto
// cualquiera del lienzo — usado al soltar el extremo de una conexión
// arrastrado a mano: nunca queda un punto suelto en el aire, pero ya no está
// limitado a los puertos declarados, cualquier lugar del contorno vale.
export function puntoPerimetroCercano(posicion, icono, punto) {
  const { anchoIcono, altoIcono } = dimensionesIcono(icono);
  const origenX = posicion.x - anchoIcono / 2;
  const origenY = posicion.y - altoIcono;
  let lx = punto.x - origenX;
  let ly = punto.y - origenY;

  const dentro = lx >= 0 && lx <= anchoIcono && ly >= 0 && ly <= altoIcono;
  if (dentro) {
    // Ya está sobre el equipo: el lado libre más cercano de los cuatro.
    const distIzq = lx, distDer = anchoIcono - lx, distArriba = ly, distAbajo = altoIcono - ly;
    const minDist = Math.min(distIzq, distDer, distArriba, distAbajo);
    if (minDist === distIzq) lx = 0;
    else if (minDist === distDer) lx = anchoIcono;
    else if (minDist === distArriba) ly = 0;
    else ly = altoIcono;
  } else {
    // Afuera: recortar (clamp) a la caja ya deja el punto exactamente sobre
    // el borde que quedó del lado de afuera.
    lx = Math.max(0, Math.min(anchoIcono, lx));
    ly = Math.max(0, Math.min(altoIcono, ly));
  }

  if (lx <= 0) return { lado: 'W', t: altoIcono ? ly / altoIcono : 0 };
  if (lx >= anchoIcono) return { lado: 'E', t: altoIcono ? ly / altoIcono : 0 };
  if (ly <= 0) return { lado: 'N', t: anchoIcono ? lx / anchoIcono : 0 };
  return { lado: 'S', t: anchoIcono ? lx / anchoIcono : 0 };
}

// Igual que puertoHacia, pero respeta un extremo fijado a mano cuando existe:
// un nombre de puerto declarado (string) o un punto libre del perímetro
// ({lado, t}) — el que se guarda al arrastrar un extremo de la conexión.
export function puertoElegido(posicion, icono, posicionOtro, manual) {
  if (!icono) return null;
  if (manual && typeof manual === 'object') return puntoDeLado(posicion, icono, manual.lado, manual.t);
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
