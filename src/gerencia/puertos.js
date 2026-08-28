// Modelo de puertos declarados (handoff §9): convierte los puertos de
// equipoIcons.js — expresados en coordenadas del viewBox del glifo — a
// coordenadas absolutas del lienzo, y rutea las conexiones entre ellos sin
// holgura, con tramos ortogonales y un mínimo de 8px perpendicular al glifo
// antes del primer giro.

// Debe coincidir con el tamaño base y el anclaje (borde inferior fijo) que usa
// el renderizado del glifo en PlantaConcentradora.js.
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
  const anchoIcono = ANCHO_BASE * escala;
  const altoIcono = ALTO_BASE * escala;
  const [, , vbAncho, vbAlto] = icono.viewBox.split(' ').map(Number);
  const x = posicion.x + (-anchoIcono / 2 + (puerto.x / vbAncho) * anchoIcono);
  const y = posicion.y + (BORDE_INFERIOR - altoIcono) + (puerto.y / vbAlto) * altoIcono;
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

// Ruta ortogonal entre dos puertos {x,y,dir}: sale perpendicular al glifo con
// un tramo mínimo de TRAMO_MINIMO antes de girar, sin diagonales ni curvas, y
// con coordenadas enteras (shape-rendering="crispEdges" en el trazo).
export function rutaPuertos(puertoA, puertoB) {
  const p1 = { x: puertoA.x + DIR_VECTOR[puertoA.dir].x * TRAMO_MINIMO, y: puertoA.y + DIR_VECTOR[puertoA.dir].y * TRAMO_MINIMO };
  const p2 = { x: puertoB.x + DIR_VECTOR[puertoB.dir].x * TRAMO_MINIMO, y: puertoB.y + DIR_VECTOR[puertoB.dir].y * TRAMO_MINIMO };
  const horizA = esHorizontal(puertoA.dir);
  const horizB = esHorizontal(puertoB.dir);

  let intermedios;
  if (horizA && horizB) {
    const midX = (p1.x + p2.x) / 2;
    intermedios = [{ x: midX, y: p1.y }, { x: midX, y: p2.y }];
  } else if (!horizA && !horizB) {
    const midY = (p1.y + p2.y) / 2;
    intermedios = [{ x: p1.x, y: midY }, { x: p2.x, y: midY }];
  } else if (horizA && !horizB) {
    intermedios = [{ x: p2.x, y: p1.y }];
  } else {
    intermedios = [{ x: p1.x, y: p2.y }];
  }

  const puntos = [puertoA, p1, ...intermedios, p2, puertoB].map(redondear);
  const filtrados = puntos.filter((p, i) => i === 0 || p.x !== puntos[i - 1].x || p.y !== puntos[i - 1].y);
  const d = filtrados.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  return { d, inicio: filtrados[0], fin: filtrados[filtrados.length - 1], medio: filtrados[Math.floor((filtrados.length - 1) / 2)] };
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
