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
// que el snap de arrastre de equipos (20px). Es una búsqueda en espiral, no
// un laberinto: resuelve el caso común (un equipo de por medio en línea
// recta), no garantiza
// esquivar un corredor tapado por varios equipos seguidos — en ese caso se
// resigna y deja el trazo por defecto.
const PASO_RUTEO = 20;
// Hasta 200 del quiebre por defecto, y el tope importa: la espiral casi
// nunca encuentra salida en una planta densa —medido en la demo de 500,
// esquivan 7 de 169 conexiones que chocan por el compactado, 0 de 60 por el
// escalonado y 3 de 420 por el libre— y cada fracaso paga la búsqueda
// entera antes de rendirse. Los desvíos que SÍ salen están todos dentro de
// 160, así que los anillos de 200 a 400 no encontraron nunca nada: eran
// 1.240 candidatos por conexión gastados en confirmar un fracaso. Un tope
// más chico también es mejor dibujo: un quiebre a 400 del trazo directo
// manda la cañería a pasear lejos del proceso que representa.
const RADIO_RUTEO_MAX = 200;

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

// Índice espacial de las cajas de equipo, para preguntar rápido si un trazo
// choca con alguna.
//
// El ruteo se pasaba el 86% de su tiempo en esta pregunta, y no por rutear:
// cada prueba comparaba los 6 tramos de una ruta contra las 500 cajas de la
// planta, y la espiral de `buscarQuiebreLibre` prueba cientos de candidatos
// para UNA conexión (440 con el radio actual; eran 1.680). Daba millones de
// comparaciones de caja por conexión difícil.
//
// La grilla no cambia ningún resultado: divide el lienzo en celdas del
// tamaño típico de un equipo y guarda cada caja en las celdas que ocupa (ya
// ensanchada por el margen, así la consulta no lo tiene que sumar). Como los
// tramos son ortogonales, las celdas que cruza un tramo son un rectángulo de
// la grilla, y solo se comparan las cajas que viven ahí: dos o tres en vez
// de quinientas.
//
// Acepta las dos formas en que el resto del código tiene las cajas: la lista
// `{ id, caja }` de `metricasDeCanerias` —el `id` es lo que permite excluir
// los equipos de los extremos sin copiar el array— y cajas sueltas.
const TAM_CELDA_MIN = 40;
const MAX_CELDAS = 200000;

export function indiceDeObstaculos(cajas) {
  const items = (cajas || [])
    .map((c) => ({ id: c && c.caja ? c.id : undefined, caja: c && c.caja ? c.caja : c }))
    .filter((c) => c.caja);

  if (items.length === 0) return { vacio: true, choca: () => false };

  let izq = Infinity, der = -Infinity, arriba = Infinity, abajo = -Infinity;
  let sumaLado = 0;
  items.forEach(({ caja }) => {
    izq = Math.min(izq, caja.izq - MARGEN_OBSTACULO);
    der = Math.max(der, caja.der + MARGEN_OBSTACULO);
    arriba = Math.min(arriba, caja.arriba - MARGEN_OBSTACULO);
    abajo = Math.max(abajo, caja.abajo + MARGEN_OBSTACULO);
    sumaLado += (caja.der - caja.izq) + (caja.abajo - caja.arriba);
  });

  // Celda del tamaño típico de un equipo: más chica multiplica celdas vacías,
  // más grande devuelve candidatos de más.
  let celda = Math.max(TAM_CELDA_MIN, sumaLado / (2 * items.length));
  let cols = Math.max(1, Math.ceil((der - izq) / celda));
  let filas = Math.max(1, Math.ceil((abajo - arriba) / celda));
  // Un lienzo enorme con pocos equipos podría pedir millones de celdas: se
  // agranda la celda hasta que la grilla entre en un tamaño razonable.
  while (cols * filas > MAX_CELDAS) {
    celda *= 2;
    cols = Math.max(1, Math.ceil((der - izq) / celda));
    filas = Math.max(1, Math.ceil((abajo - arriba) / celda));
  }

  const col = (x) => Math.min(cols - 1, Math.max(0, Math.floor((x - izq) / celda)));
  const fila = (y) => Math.min(filas - 1, Math.max(0, Math.floor((y - arriba) / celda)));

  const cubos = new Array(cols * filas);
  items.forEach((it, i) => {
    const c1 = col(it.caja.izq - MARGEN_OBSTACULO);
    const c2 = col(it.caja.der + MARGEN_OBSTACULO);
    const f1 = fila(it.caja.arriba - MARGEN_OBSTACULO);
    const f2 = fila(it.caja.abajo + MARGEN_OBSTACULO);
    for (let f = f1; f <= f2; f++) {
      for (let c = c1; c <= c2; c++) {
        const k = f * cols + c;
        if (!cubos[k]) cubos[k] = [];
        cubos[k].push(i);
      }
    }
  });

  // Una caja vive en varias celdas: el sello evita compararla dos veces
  // contra el mismo tramo. Sube POR TRAMO y no por ruta — una caja que no
  // choca con el primer tramo puede chocar con el segundo.
  const visto = new Int32Array(items.length);
  let sello = 0;

  return {
    vacio: false,
    choca(puntos, excluirA, excluirB) {
      for (let i = 0; i < puntos.length - 1; i++) {
        const p1 = puntos[i];
        const p2 = puntos[i + 1];
        sello += 1;
        const c1 = col(Math.min(p1.x, p2.x));
        const c2 = col(Math.max(p1.x, p2.x));
        const f1 = fila(Math.min(p1.y, p2.y));
        const f2 = fila(Math.max(p1.y, p2.y));
        for (let f = f1; f <= f2; f++) {
          for (let c = c1; c <= c2; c++) {
            const cubo = cubos[f * cols + c];
            if (!cubo) continue;
            for (let n = 0; n < cubo.length; n++) {
              const idx = cubo[n];
              if (visto[idx] === sello) continue;
              visto[idx] = sello;
              const it = items[idx];
              if (it.id !== undefined && (it.id === excluirA || it.id === excluirB)) continue;
              if (segmentoInvadeCaja(p1, p2, it.caja, MARGEN_OBSTACULO)) return true;
            }
          }
        }
      }
      return false;
    },
  };
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
// `opciones` lleva lo que hace falta para esquivar: `obstaculos` (un índice
// de indiceDeObstaculos, o una lista suelta de cajas), `limites` y `excluir`
// (los ids de los dos equipos de la conexión, que no son obstáculo de su
// propia cañería).
//
// `limites` ({izq, der, arriba, abajo}) acota dónde puede caer el quiebre al
// esquivar: sin eso el desvío se va del lienzo.
//
// `obstaculos` solo se usa cuando NO hay quiebreManual: si el trazo por defecto atraviesa alguna, se busca un
// quiebre cercano que lo esquive — el usuario que ya movió el quiebre a mano
// resolvió el cruce por su cuenta, y esa elección no se pisa.
export function rutaPuertos(puertoA, puertoB, quiebreManual, opciones = {}) {
  const { obstaculos, limites, excluir } = opciones;
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

  // El índice se arma UNA vez por método y se reusa en todas las conexiones
  // (lo hace metricasDeCanerias). Armarlo acá con una lista suelta de cajas
  // es la comodidad para quien tiene dos o tres, no el camino caliente.
  const indice = !obstaculos ? null : typeof obstaculos.choca === 'function' ? obstaculos : indiceDeObstaculos(obstaculos);
  const excluirA = excluir ? excluir[0] : undefined;
  const excluirB = excluir ? excluir[1] : undefined;
  const choca = (puntos) => indice.choca(puntos, excluirA, excluirB);

  if (!quiebreManual && indice && !indice.vacio && choca(puntosPara(quiebre))) {
    quiebre = buscarQuiebreLibre(quiebre, (candidato) => !choca(puntosPara(candidato)), limites) || quiebre;
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
export function rutaEntreEquipos(conexion, deEq, aEq, posDe, posA, iconoDe, iconoA, obstaculos, limites) {
  if (!iconoDe || !iconoA) return null;
  const puertoDe = puertoElegido(posDe, iconoDe, posA, conexion.puertoDe);
  const puertoA = puertoElegido(posA, iconoA, posDe, conexion.puertoA);
  if (!puertoDe || !puertoA) return null;
  // Los dos equipos de la conexión no son obstáculo de su propia cañería. Se
  // saltean POR ID en la consulta al índice; antes se armaba un array filtrado
  // por conexión, o sea 470 copias de 500 cajas por método.
  return rutaPuertos(puertoDe, puertoA, conexion.quiebreManual, {
    obstaculos,
    limites,
    excluir: [deEq.id, aEq.id],
  });
}

// Cuántas veces se cruzan entre sí los trazos de un conjunto de rutas —
// tramos de la MISMA ruta no cuentan. Es la métrica que dice si un método de
// acomodado deja el proceso legible o hecho un ovillo.
// Antes comparaba TODOS los pares de tramos con el test de orientación
// clásico: con 2.537 tramos son 3,2 millones de pares y 1,5 s por método.
// Dos observaciones lo vuelven casi lineal, sin cambiar un solo resultado:
//
// - Todos los tramos son ortogonales por construcción, y con aquel test dos
//   tramos PARALELOS nunca cuentan como cruce (los dos extremos del otro
//   caen del mismo lado, así que los signos empatan; colineales dan 0 y 0).
//   Solo hace falta mirar los pares horizontal × vertical.
// - Para ese par, el test se reduce a que se toquen los rangos: la vertical
//   en x=X cruza la horizontal en y=Y si X está en el ancho de la horizontal
//   e Y en el alto de la vertical. Los bordes cuentan, igual que antes (un
//   extremo justo sobre la otra recta daba 0 contra ±1, o sea distinto).
//
// Con las verticales ordenadas por x, cada horizontal solo mira la franja de
// verticales que caen en su ancho, con dos búsquedas binarias.
export function crucesEntreRutas(rutas) {
  const horizontales = [];
  const verticales = [];
  rutas.forEach((r, iRuta) => {
    const pts = r.puntos || [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      if (a.y === b.y && a.x !== b.x) horizontales.push({ iRuta, y: a.y, min: Math.min(a.x, b.x), max: Math.max(a.x, b.x) });
      else if (a.x === b.x && a.y !== b.y) verticales.push({ iRuta, x: a.x, min: Math.min(a.y, b.y), max: Math.max(a.y, b.y) });
      // Un tramo de largo cero no cruza nada: con el test viejo daba 0 en
      // las cuatro orientaciones y tampoco contaba.
    }
  });

  verticales.sort((p, q) => p.x - q.x);
  const xs = verticales.map((v) => v.x);
  // Primer índice con xs[i] >= valor.
  const desde = (valor) => {
    let lo = 0;
    let hi = xs.length;
    while (lo < hi) {
      const medio = (lo + hi) >> 1;
      if (xs[medio] < valor) lo = medio + 1;
      else hi = medio;
    }
    return lo;
  };

  let cruces = 0;
  for (const h of horizontales) {
    for (let i = desde(h.min); i < verticales.length && xs[i] <= h.max; i++) {
      const v = verticales[i];
      if (v.iRuta === h.iRuta) continue;
      if (h.y >= v.min && h.y <= v.max) cruces += 1;
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
