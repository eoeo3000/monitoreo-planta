// Modelo de puertos declarados (handoff §9): convierte los puertos de un
// ícono — expresados en coordenadas de su propio viewBox — a coordenadas
// absolutas del lienzo, y rutea las conexiones entre ellos sin holgura, con
// tramos ortogonales y un mínimo de 8px perpendicular al glifo antes del
// primer giro. Usado por PortalSCADA.js con los glifos de scadaIconos.js.

import { puntoPerimetroDeFormas } from './formas';

// Tamaño base por defecto, para un ícono que no declare el suyo. El ANCLAJE
// no es configurable y no debe serlo: `posicion` es siempre el centro
// horizontal y el borde INFERIOR del ícono, que es lo que hace el dibujo
// (translate(pos.x - anchoIcono/2, pos.y - altoIcono)). Existía un campo
// `bordeInferior` por ícono que sugería lo contrario; todos lo declaraban
// igual a `altoBase` y la única cuenta que lo leía estaba mal por eso.
const ANCHO_BASE = 52;
const ALTO_BASE = 35;
const TRAMO_MINIMO = 8;

const DIR_VECTOR = { N: { x: 0, y: -1 }, S: { x: 0, y: 1 }, E: { x: 1, y: 0 }, W: { x: -1, y: 0 } };
const esHorizontal = (dir) => dir === 'E' || dir === 'W';
const redondear = (p) => ({ x: Math.round(p.x), y: Math.round(p.y) });

// Proyecta un puerto (coordenadas del viewBox) a coordenadas absolutas del
// lienzo, dada la posición del equipo y su ícono (con su propia `escala`).
//
// Delega en aAbsoluto (más abajo) a propósito: un puerto declarado y un
// extremo arrastrado a mano son el MISMO tipo de punto —coordenadas crudas
// del ícono— y tienen que proyectarse igual. Antes había dos conversiones
// distintas en este archivo y no coincidían: esta sumaba `bordeInferior` sin
// escalar, así que cada cañería nacía ese tanto por debajo de su equipo. En
// la planta semilla solo 2 de 6 extremos tocaban su ícono; la de B-101
// arrancaba 16 px por debajo de la bomba, a la altura del TAG.
export function puntoAbsoluto(posicion, icono, nombrePuerto) {
  const puerto = icono?.puertos?.[nombrePuerto];
  if (!puerto) return null;
  const { x, y } = aAbsoluto(posicion, icono, puerto);
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
  if (nombre) return puntoAbsoluto(posicion, icono, nombre);
  // Sin puertos declarados (p. ej. un tipo personalizado creado sin agregar
  // ninguno): en vez de no conectar nada, se usa el mismo mecanismo que ya
  // existe para arrastrar un extremo a mano — el punto real del contorno
  // más cercano a la posición del otro equipo.
  const perimetral = puntoPerimetroCercano(posicion, icono, posicionOtro);
  return perimetral ? puntoDeManual(posicion, icono, perimetral) : null;
}

function dimensionesIcono(icono) {
  const escala = icono.escala || 1;
  const anchoIcono = (icono.anchoBase || ANCHO_BASE) * escala;
  const altoIcono = (icono.altoBase || ALTO_BASE) * escala;
  return { anchoIcono, altoIcono, escala };
}

// Caja del equipo en coordenadas absolutas del lienzo — mismo criterio que
// usa el dibujo (transform="translate(pos.x - anchoIcono/2, pos.y - altoIcono)"):
// `posicion` es el centro horizontal y el borde INFERIOR del ícono, no su
// centro geométrico. La usan tanto el cuadro punteado de zona (PortalSCADA)
// como la detección de solapamiento entre equipos y el ruteo que esquiva
// obstáculos, más abajo.
export function cajaEquipo(posicion, icono) {
  if (!icono) return null;
  const { anchoIcono, altoIcono } = dimensionesIcono(icono);
  return { izq: posicion.x - anchoIcono / 2, der: posicion.x + anchoIcono / 2, arriba: posicion.y - altoIcono, abajo: posicion.y };
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
// extremo de la conexión. Si lo guardado no tiene esa forma exacta (p. ej.
// quedó de una versión anterior del formato, como {lado, t}), se ignora y se
// vuelve al puerto automático — un dato viejo/corrupto no debe romper el
// lienzo entero.
export function puertoElegido(posicion, icono, posicionOtro, manual) {
  if (!icono) return null;
  if (manual && typeof manual === 'object' && typeof manual.x === 'number' && typeof manual.y === 'number' && DIR_VECTOR[manual.dir]) {
    return puntoDeManual(posicion, icono, manual);
  }
  if (typeof manual === 'string' && icono.puertos?.[manual]) return puntoAbsoluto(posicion, icono, manual);
  return puertoHacia(posicion, icono, posicionOtro);
}

// Separación mínima entre una tubería re-ruteada y el borde de un equipo que
// esquiva — no queda rozando el contorno.
const MARGEN_OBSTACULO = 10;
// Grilla y radio de búsqueda al buscar un quiebre libre: mismo tamaño de paso
// que el snap de arrastre de equipos (20px), hasta 400px del punto de
// quiebre por defecto. Es una búsqueda en espiral, no un laberinto: resuelve
// el caso común (un equipo de por medio en línea recta), no garantiza
// esquivar un corredor tapado por varios equipos seguidos — en ese caso se
// resigna y deja el trazo por defecto.
const PASO_RUTEO = 20;
const RADIO_RUTEO_MAX = 400;

// ¿El segmento ortogonal p1->p2 (horizontal o vertical — nunca diagonal, el
// ruteo no usa otra cosa) invade la caja de un equipo, con margen?
function segmentoInvadeCaja(p1, p2, caja, margen) {
  const izq = caja.izq - margen;
  const der = caja.der + margen;
  const arriba = caja.arriba - margen;
  const abajo = caja.abajo + margen;
  if (p1.y === p2.y) {
    if (p1.y < arriba || p1.y > abajo) return false;
    return Math.max(p1.x, p2.x) >= izq && Math.min(p1.x, p2.x) <= der;
  }
  if (p1.x === p2.x) {
    if (p1.x < izq || p1.x > der) return false;
    return Math.max(p1.y, p2.y) >= arriba && Math.min(p1.y, p2.y) <= abajo;
  }
  return false;
}

function rutaChocaConObstaculos(puntos, obstaculos) {
  for (let i = 0; i < puntos.length - 1; i++) {
    for (const caja of obstaculos) {
      if (segmentoInvadeCaja(puntos[i], puntos[i + 1], caja, MARGEN_OBSTACULO)) return true;
    }
  }
  return false;
}

// Busca en espiral cuadrada, alrededor de `base`, el punto más cercano que
// cumple `esLibre`.
//
// Dos detalles que no son adorno:
//
// - `limites` ({izq, der, arriba, abajo}) descarta los candidatos fuera del
//   lienzo. Sin eso la espiral se iba afuera: en la planta semilla la
//   conexión con1 esquivaba por un quiebre 108 unidades ARRIBA del borde,
//   así que la cañería salía de la pantalla y volvía, y su tirador de
//   quiebre quedaba donde nadie lo podía agarrar. Es preferible un trazo que
//   roza un ícono adentro del lienzo a uno impecable que se va afuera.
//
// - Los candidatos de cada anillo se prueban ordenados por distancia real a
//   `base`, no en el orden del barrido. Recorrer dx y luego dy devolvía
//   siempre la esquina superior izquierda del anillo, que es la más lejana
//   (√2 veces el radio) y además sesgaba todos los desvíos hacia arriba y a
//   la izquierda.
function buscarQuiebreLibre(base, esLibre, limites) {
  const dentro = (c) =>
    !limites || (c.x >= limites.izq && c.x <= limites.der && c.y >= limites.arriba && c.y <= limites.abajo);

  for (let radio = PASO_RUTEO; radio <= RADIO_RUTEO_MAX; radio += PASO_RUTEO) {
    const anillo = [];
    for (let dx = -radio; dx <= radio; dx += PASO_RUTEO) {
      for (let dy = -radio; dy <= radio; dy += PASO_RUTEO) {
        if (Math.abs(dx) !== radio && Math.abs(dy) !== radio) continue;
        anillo.push({ x: base.x + dx, y: base.y + dy, d2: dx * dx + dy * dy });
      }
    }
    anillo.sort((a, b) => a.d2 - b.d2);
    for (const c of anillo) {
      const candidato = { x: c.x, y: c.y };
      if (dentro(candidato) && esLibre(candidato)) return candidato;
    }
  }
  return null;
}

// Ruta ortogonal entre dos puertos {x,y,dir}: sale perpendicular al glifo con
// un tramo mínimo de TRAMO_MINIMO antes de girar, sin diagonales ni curvas, y
// con coordenadas enteras (shape-rendering="crispEdges" en el trazo).
//
// `quiebreManual` ({x,y}), si viene, reemplaza el punto medio automático —
// en cualquier dirección, no solo en el eje que quedaba libre según la
// orientación de los puertos: el primer y último tramo siguen saliendo
// perpendiculares al glifo (esa parte no se toca, es la regla dura del
// modelo de puertos); lo que se mueve es por dónde pasa la ruta en el medio.
//
// `limites` ({izq, der, arriba, abajo}) acota dónde puede caer el quiebre al
// esquivar: sin eso el desvío se va del lienzo.
//
// `obstaculos` (cajas de otros equipos, de cajaEquipo) solo se usa cuando NO
// hay quiebreManual: si el trazo por defecto atraviesa alguna, se busca un
// quiebre cercano que lo esquive — el usuario que ya movió el quiebre a mano
// resolvió el cruce por su cuenta, y esa elección no se pisa.
export function rutaPuertos(puertoA, puertoB, quiebreManual, obstaculos, limites) {
  const p1 = { x: puertoA.x + DIR_VECTOR[puertoA.dir].x * TRAMO_MINIMO, y: puertoA.y + DIR_VECTOR[puertoA.dir].y * TRAMO_MINIMO };
  const p2 = { x: puertoB.x + DIR_VECTOR[puertoB.dir].x * TRAMO_MINIMO, y: puertoB.y + DIR_VECTOR[puertoB.dir].y * TRAMO_MINIMO };
  const horizA = esHorizontal(puertoA.dir);
  const horizB = esHorizontal(puertoB.dir);

  const puntosPara = (quiebre) => {
    const medioA = horizA ? { x: quiebre.x, y: p1.y } : { x: p1.x, y: quiebre.y };
    const medioB = horizB ? { x: quiebre.x, y: p2.y } : { x: p2.x, y: quiebre.y };
    return [puertoA, p1, medioA, quiebre, medioB, p2, puertoB];
  };

  let quiebre = quiebreManual || (horizA === horizB ? { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 } : { x: p2.x, y: p1.y });

  if (!quiebreManual && obstaculos && obstaculos.length > 0 && rutaChocaConObstaculos(puntosPara(quiebre), obstaculos)) {
    quiebre = buscarQuiebreLibre(quiebre, (candidato) => !rutaChocaConObstaculos(puntosPara(candidato), obstaculos), limites) || quiebre;
  }

  const puntos = puntosPara(quiebre).map(redondear);
  const filtrados = puntos.filter((p, i) => i === 0 || p.x !== puntos[i - 1].x || p.y !== puntos[i - 1].y);
  const d = filtrados.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  return { d, puntos: filtrados, inicio: filtrados[0], fin: filtrados[filtrados.length - 1], medio: redondear(quiebre) };
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

// Ruta entre DOS EQUIPOS: resuelve sus íconos, elige el puerto de cada uno
// mejor orientado hacia el otro (o respeta el que se fijó a mano) y rutea
// esquivando las cajas de los demás.
//
// Vive acá y no en PortalSCADA.js porque es geometría pura —no sabe de
// React— y la necesitan dos pantallas: el Portal para dibujar el proceso, y
// el ensayo para MEDIR cuánta cañería y cuántos cruces deja cada método de
// acomodado. Con la copia dentro del componente, esa comparación no se podía
// hacer sin duplicar el ruteo.
export function rutaEntreEquipos(conexion, deEq, aEq, posDe, posA, iconoDe, iconoA, cajasEquipos, limites) {
  if (!iconoDe || !iconoA) return null;
  const puertoDe = puertoElegido(posDe, iconoDe, posA, conexion.puertoDe);
  const puertoA = puertoElegido(posA, iconoA, posDe, conexion.puertoA);
  if (!puertoDe || !puertoA) return null;
  const obstaculos = cajasEquipos ? cajasEquipos.filter((c) => c.id !== deEq.id && c.id !== aEq.id).map((c) => c.caja) : undefined;
  return rutaPuertos(puertoDe, puertoA, conexion.quiebreManual, obstaculos, limites);
}

// Cuántas veces se cruzan entre sí los trazos de un conjunto de rutas —
// tramos de la MISMA ruta no cuentan. Es la métrica que dice si un método de
// acomodado deja el proceso legible o hecho un ovillo.
export function crucesEntreRutas(rutas) {
  const segmentos = [];
  rutas.forEach((r, iRuta) => {
    const pts = r.puntos || [];
    for (let i = 0; i < pts.length - 1; i++) segmentos.push({ iRuta, a: pts[i], b: pts[i + 1] });
  });
  const orient = (p, q, r) => Math.sign((q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y));
  let cruces = 0;
  for (let i = 0; i < segmentos.length; i++) {
    for (let j = i + 1; j < segmentos.length; j++) {
      const s = segmentos[i];
      const t = segmentos[j];
      if (s.iRuta === t.iRuta) continue;
      const d1 = orient(s.a, s.b, t.a);
      const d2 = orient(s.a, s.b, t.b);
      const d3 = orient(t.a, t.b, s.a);
      const d4 = orient(t.a, t.b, s.b);
      if (d1 !== d2 && d3 !== d4) cruces += 1;
    }
  }
  return cruces;
}

// Largo total de cañería, en unidades del lienzo. Como los tramos son
// ortogonales, alcanza con sumar |dx| + |dy|.
export function largoDeRutas(rutas) {
  return rutas.reduce((total, r) => {
    const pts = r.puntos || [];
    let l = 0;
    for (let i = 0; i < pts.length - 1; i++) l += Math.abs(pts[i + 1].x - pts[i].x) + Math.abs(pts[i + 1].y - pts[i].y);
    return total + l;
  }, 0);
}
