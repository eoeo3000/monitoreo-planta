import {
  ESCALA_MAX,
  PASO_CRECIMIENTO,
  GAP_ENTRE_AREAS,
  escalaDeCatalogo,
  calcularGrillaArea,
  anchoMaxDeEquipos,
  anchoDeTitulo,
  cajasSolapan,
  buscarMejorAncho,
} from './grilla';
import { empaquetarSkyline } from './skyline';

const POSICION_DEFAULT = { x: 80, y: 80 };

// Cuánto PODRÍA crecer un área por su cuenta: se prueba de a 10% por vez
// mientras el resultado no invada el bloque BASE (el tamaño con el que se
// empaquetó, antes de que nadie creciera) de ninguna otra. Comparar siempre
// contra el bloque base ajeno —nunca contra cuánto creció ya esa vecina— es
// lo que hace que el resultado no dependa del orden en que se procesan.
//
// Solo MIDE: no arma la grilla definitiva. Quien la arma es resolverLayout,
// con el mínimo de estos factores aplicado a toda la planta (ver allá el
// porqué).
//
// El tope es la escala ABSOLUTA final de cada equipo (escalaBaseMax, la más
// grande entre los del área, por el factor de esta pasada) — nunca pasa
// ESCALA_MAX.
function factorMaximoDeArea(eqs, d, origen, otrasCajasBase, cols, anchoMinimo) {
  const escalaBaseMax = Math.min(Math.max(...eqs.map((eq) => escalaDeCatalogo(eq, d))), ESCALA_MAX);
  let factor = 1;
  while (escalaBaseMax * (factor * PASO_CRECIMIENTO) <= ESCALA_MAX) {
    const siguienteFactor = factor * PASO_CRECIMIENTO;
    const candidato = calcularGrillaArea(eqs, d, siguienteFactor, cols);
    const caja = { x: origen.x, y: origen.y, ancho: Math.max(candidato.ancho, anchoMinimo || 0), alto: candidato.alto };
    if (otrasCajasBase.some((otra) => cajasSolapan(caja, otra))) break;
    factor = siguienteFactor;
  }
  return factor;
}

// Ubica todas las áreas dentro de un ancho de lienzo dado, sin agrandar
// todavía a nadie.
function empaquetarAreas(equiposPorArea, d, anchoObjetivo) {
  // Forma de cada área: tantas columnas como entren en el ancho compartido
  // (nunca más — ese es el tope que evita que un área acapare todo el
  // lienzo), y nunca más que su propia cantidad de equipos. El ancho que se
  // RESERVA es el mayor entre el de la grilla y el que necesita el título:
  // PortalSCADA.js agranda la caja dibujada para que el título entre
  // entero, así que sin esto dos áreas angostas vecinas se pisan.
  const colsDeArea = {};
  const bloqueDeArea = {};
  const anchoReservadoDeArea = {};
  equiposPorArea.forEach(({ area, eqs }) => {
    const pasoH = Math.round(anchoMaxDeEquipos(eqs, d) * 2);
    const cols = Math.max(1, Math.min(eqs.length, Math.floor(anchoObjetivo / pasoH) || 1));
    const bloque = calcularGrillaArea(eqs, d, 1, cols);
    colsDeArea[area.id] = cols;
    bloqueDeArea[area.id] = bloque;
    anchoReservadoDeArea[area.id] = Math.max(bloque.ancho, anchoDeTitulo(area.nombre));
  });

  // De más alta a más baja: las altas definen la forma general primero y
  // las bajas van rellenando los huecos que quedan. Lo que se RESERVA en el
  // skyline incluye el margen entre áreas en los dos sentidos —hacia abajo
  // para la que se apile debajo, hacia la derecha para que dos cuadros
  // punteados vecinos no se toquen— pero lo que se usa para decidir si
  // entra en un hueco es el ancho pelado.
  const piezas = [...equiposPorArea]
    .sort((a, b) => bloqueDeArea[b.area.id].alto - bloqueDeArea[a.area.id].alto)
    .map(({ area }) => ({
      areaId: area.id,
      ancho: anchoReservadoDeArea[area.id],
      alto: bloqueDeArea[area.id].alto,
      anchoOcupado: anchoReservadoDeArea[area.id] + GAP_ENTRE_AREAS,
      altoOcupado: bloqueDeArea[area.id].alto + GAP_ENTRE_AREAS,
    }));

  const { colocadas, ancho, alto } = empaquetarSkyline(piezas, anchoObjetivo);
  const origenDeArea = {};
  colocadas.forEach((c) => {
    origenDeArea[c.areaId] = { x: c.x, y: c.y };
  });

  return { colsDeArea, bloqueDeArea, anchoReservadoDeArea, origenDeArea, ancho, alto };
}

// Resuelve la planta entera a un ancho de lienzo dado: ubica las áreas y
// después agranda. Devuelve las posiciones finales de cada equipo y el
// tamaño que ocupa el resultado YA agrandado — que es el que hay que
// comparar contra la proporción del panel, no el de antes de agrandar: el
// crecimiento se come el espacio libre de los costados y cambia bastante la
// forma final del conjunto.
function resolverLayout(equiposPorArea, d, anchoObjetivo) {
  const { colsDeArea, bloqueDeArea, anchoReservadoDeArea, origenDeArea } = empaquetarAreas(equiposPorArea, d, anchoObjetivo);

  // Cajas BASE (sin agrandar) de cada área, para que el crecimiento compare
  // siempre contra el tamaño con el que se empaquetó originalmente — nunca
  // contra cuánto ya creció una vecina, que haría depender el resultado del
  // orden en que se procesan.
  const cajasBase = equiposPorArea.map(({ area }) => ({
    areaId: area.id,
    x: origenDeArea[area.id].x,
    y: origenDeArea[area.id].y,
    ancho: anchoReservadoDeArea[area.id],
    alto: bloqueDeArea[area.id].alto,
  }));

  // Crecimiento en dos fases. Primero se MIDE cuánto podría crecer cada
  // área por su cuenta; después manda el MÍNIMO, aplicado a todas por
  // igual. Un factor por área —lo que se hacía antes— hacía que la escala
  // final dijera cuánto lugar libre le tocó al área, no qué equipo es: en
  // la planta de prueba Bombeo terminaba en 3.8x contra 1.33x de
  // Agitación, y una bomba (el ícono más chico del catálogo) quedaba más
  // alta que el clarificador y que el secador. Con un factor único, las
  // proporciones del catálogo quedan intactas.
  //
  // No puede aparecer un solapamiento nuevo: el factor global es menor o
  // igual que el que cada área ya podía permitirse, y una caja más chica no
  // choca donde la más grande no chocaba.
  const factorGlobal = Math.min(
    ...equiposPorArea.map(({ area, eqs }) =>
      factorMaximoDeArea(
        eqs,
        d,
        origenDeArea[area.id],
        cajasBase.filter((c) => c.areaId !== area.id),
        colsDeArea[area.id],
        anchoDeTitulo(area.nombre)
      )
    )
  );

  const posicionRelativa = {}; // equipoId -> {x, y} relativo al origen de SU área
  const areaIdDeEquipo = {};
  let ancho = 0;
  let alto = 0;
  equiposPorArea.forEach(({ area, eqs }) => {
    const anchoTitulo = anchoDeTitulo(area.nombre);
    const grillaFinal = calcularGrillaArea(eqs, d, factorGlobal, colsDeArea[area.id]);
    const origen = origenDeArea[area.id];
    ancho = Math.max(ancho, origen.x + Math.max(grillaFinal.ancho, anchoTitulo));
    alto = Math.max(alto, origen.y + grillaFinal.alto);
    grillaFinal.posiciones.forEach(({ eq, x, y }) => {
      areaIdDeEquipo[eq.id] = area.id;
      posicionRelativa[eq.id] = { x, y };
    });
  });

  return { posicionRelativa, areaIdDeEquipo, origenDeArea, factorGlobal, ancho: ancho || 1, alto: alto || 1 };
}

// Agrupa los equipos de una planta por área, ordenados por la posición que
// tienen en ese momento — así el orden de lectura del resultado se parece
// al que ya había en pantalla en vez de salir arbitrario.
export function equiposPorAreaDePlanta(d, plantaId) {
  return d.areas
    .filter((a) => a.plantaId === plantaId)
    .map((area) => ({
      area,
      eqs: d.equipos
        .filter((eq) => eq.areaId === area.id)
        .slice()
        .sort((a, b) => {
          const pa = a.posicion || POSICION_DEFAULT;
          const pb = b.posicion || POSICION_DEFAULT;
          return pa.y - pb.y || pa.x - pb.x;
        }),
    }))
    .filter((x) => x.eqs.length > 0);
}

// Calcula (sin escribir nada todavía) cómo quedaría una planta si se
// compacta. Tres pasadas:
// 1. FORMA: todas las áreas comparten un mismo ancho de lienzo
//    (`anchoObjetivo`, estimado del área total de bloques de la planta y la
//    proporción real del panel) y cada una envuelve sus equipos en filas
//    hasta ESE ancho — nunca más. Ese tope es lo que le faltaba a la
//    primera versión con skyline: sin él, la primera área ubicada elegía su
//    forma minimizando SU propio borde inferior, y como achatarse (más
//    columnas, menos filas) siempre baja ese número sin nada que lo
//    compense, terminaba tomando para sí todo el ancho del lienzo.
// 2. UBICACIÓN: las áreas se empaquetan por skyline, cada una lo más arriba
//    y a la izquierda posible dentro del ancho compartido — así un área
//    chica se ubica AL LADO de otra en vez de gastar una franja entera de
//    alto para sí sola. Apilarlas siempre una debajo de la otra (lo que se
//    probó antes) desperdicia mucho alto cuando la planta tiene varias
//    áreas de pocos equipos.
// 3. CRECIMIENTO: se mide cuánto podría crecer cada área hasta la vecina
//    más cercana y se aplica el MÍNIMO a toda la planta — un factor por
//    área hacía que la escala terminara diciendo cuánto lugar libre tenía
//    el área en vez de qué equipo es (ver resolverLayout).
//
// La caja punteada de cada área no se reserva de antemano en ningún
// momento: la calcula sola PortalSCADA.js a partir de dónde terminaron sus
// equipos, así que un área de pocos equipos queda angosta en vez de
// estirada.
export function calcularLayoutCompacto(d, plantaId, arObjetivo) {
  const equiposPorArea = equiposPorAreaDePlanta(d, plantaId);
  if (equiposPorArea.length === 0) return { equipos: d.equipos };

  // Ancho de lienzo compartido, estimado del área de cada bloque de
  // referencia (la forma CUADRADA de cada área) y la proporción real del
  // panel. Se usa el bloque de referencia — no el área "cruda" de los
  // íconos — porque la grilla real deja el doble de espacio entre equipos
  // por separación (pasoH = anchoMax×2) más el margen y el título de cada
  // área: el área cruda no ve nada de eso y sale muy por debajo del ancho
  // que realmente hace falta.
  const areaTotalBloques = equiposPorArea.reduce((acc, { eqs }) => {
    const colsCuadrado = Math.max(1, Math.ceil(Math.sqrt(eqs.length)));
    const bloqueRef = calcularGrillaArea(eqs, d, 1, colsCuadrado);
    return acc + bloqueRef.ancho * bloqueRef.alto;
  }, 0);
  const anchoBase = Math.max(Math.sqrt((areaTotalBloques || 1) * (arObjetivo || 1)), 200);

  // El ancho estimado es solo un PUNTO DE PARTIDA: da por sentado un
  // aprovechamiento del 100% que en la práctica nunca se da. Se resuelve la
  // planta entera con varios anchos y gana el que deja el resultado REAL
  // —ya con las áreas agrandadas, que es lo que se dibuja— más parecido a
  // la proporción del panel.
  const mejor = buscarMejorAncho(anchoBase, arObjetivo || 1, (ancho) => resolverLayout(equiposPorArea, d, ancho));

  // Lo único que escribe el compactado sobre el tamaño es factorAuto: el
  // factor con el que agrandó la planta entera. NO toca escalaPropia, que
  // es del usuario. Así el panel "Tamaños de equipo" sigue mandando sobre
  // una planta ya compactada (escalaVisible multiplica las dos capas) en
  // vez de quedar bloqueado por un valor propio en cada equipo.
  const factorAuto = Math.round(mejor.factorGlobal * 100) / 100;
  const equipos = d.equipos.map((eq) => {
    const rel = mejor.posicionRelativa[eq.id];
    if (!rel) return eq;
    const origen = mejor.origenDeArea[mejor.areaIdDeEquipo[eq.id]];
    // escalaAuto es el campo que usaba la versión anterior para marcar su
    // propio resultado dentro de escalaPropia; ya no se escribe, y se saca
    // acá para no dejar restos que confundan al leer los datos.
    const { escalaAuto, ...resto } = eq;
    const equipo = {
      ...resto,
      posicion: { x: Math.round(origen.x + rel.x), y: Math.round(origen.y + rel.y) },
      factorAuto,
    };
    // El layout acotó a ESCALA_MAX la escala a mano de este equipo (ver
    // calcularGrillaArea), así que si no se acota también el dato, el
    // dibujo saldría más grande que la celda que se le reservó. Es la única
    // circunstancia en la que el compactado pisa un tamaño puesto a mano, y
    // es para corregir uno que ya estaba fuera de rango.
    if (equipo.escalaPropia != null && equipo.escalaPropia > ESCALA_MAX) equipo.escalaPropia = ESCALA_MAX;
    return equipo;
  });

  return { equipos };
}
