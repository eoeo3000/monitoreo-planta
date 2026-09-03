import { iconoBaseDe, escalaVisible } from '../iconos';

// Primitivas de geometría compartidas por todo lo que acomoda equipos: el
// compactado de producción (compactado.js) y los métodos que se prueban en
// la pantalla de ensayo (ensayo.js). Nada de acá sabe de React ni toca el
// estado — se puede llamar y medir en aislamiento.

// PAD_ZONA (40) y ALTO_TITULO (18) espejan los de PortalSCADA.js — si esos
// cambian ahí, hay que actualizarlos acá para que el cuadro que resulta
// después de compactar siga siendo el mínimo posible (ni más chico, que
// recortaría el título, ni más grande, que dejaría aire de más).
export const PAD_ZONA = 40;
export const ALTO_TITULO = 18;
// Tope de escala al agrandar equipos — mismo tope que ya usa el panel
// "Tamaños de equipo" para el multiplicador por tipo.
export const ESCALA_MAX = 4;
export const PASO_CRECIMIENTO = 1.1;
// Aire entre dos áreas vecinas — cada caja ya trae su propio PAD_ZONA de
// margen, esto es solo para que dos cuadros punteados no se toquen.
export const GAP_ENTRE_AREAS = 30;

// La escala de la que PARTE el compactado: la que eligió quien mira —la del
// tipo (panel "Tamaños de equipo"), o la que se le puso a mano a ESE equipo
// con doble clic—. Deliberadamente NO incluye eq.factorAuto, que es lo que
// escribió la compactada anterior: si lo incluyera, cada compactada se
// apilaría sobre el resultado de la anterior (de ahí salieron los bugs de
// escala compuesta) y bastaría UN equipo cerca del tope de 4 para que
// ninguna área pudiera volver a crecer nunca. Ignorarlo hace que compactar
// dos veces seguidas dé exactamente el mismo resultado.
//
// La otra mitad del par está en iconos.js: escalaVisible SÍ multiplica por
// factorAuto, porque es lo que se dibuja.
export function escalaDeCatalogo(eq, d) {
  return eq.escalaPropia ?? d.escalasPorTipo?.[eq.tipo] ?? 1;
}

// Re-exportada acá porque vive del lado del dibujo (iconos.js) pero la usan
// también los métodos de layout — así ninguno de los dos lados tiene que
// saber en qué archivo quedó.
export { escalaVisible };

// Arma la grilla de equipos de UN área a un factor de escala y una
// cantidad de columnas dados — separado en su propia función porque se
// llama muchas veces por área: una vez por cada forma candidata al
// ubicarla y una por cada intento de agrandarla después.
export function calcularGrillaArea(eqs, d, factor, cols) {
  const dimensiones = eqs.map((eq) => {
    const icono = iconoBaseDe(eq.tipo, d);
    // Si ESTE equipo puntual viene con una escala a mano por encima del
    // tope, se lo trata como si ya estuviera en el tope antes de aplicar el
    // factor — así se autocorrige sin arrastrar hacia abajo a sus vecinos
    // del área que sí tenían un tamaño normal.
    const escalaBase = Math.min(escalaDeCatalogo(eq, d), ESCALA_MAX);
    const escalaFinal = escalaBase * factor;
    return { eq, escalaFinal, ancho: icono ? icono.anchoBase * escalaFinal : 0, alto: icono ? icono.altoBase * escalaFinal : 0 };
  });
  const anchoMax = Math.max(...dimensiones.map((x) => x.ancho), 1);
  const altoMax = Math.max(...dimensiones.map((x) => x.alto), 1);
  const pasoH = Math.round(anchoMax * 2); // separación centro-a-centro entre equipos de una fila
  const pasoV = Math.round(altoMax + 30); // + lugar para el TAG debajo del ícono
  const filas = Math.ceil(eqs.length / cols);
  const yBase = PAD_ZONA + ALTO_TITULO + altoMax;

  const posiciones = dimensiones.map(({ eq, escalaFinal }, i) => {
    const col = i % cols;
    const fila = Math.floor(i / cols);
    // Todos los equipos del área se centran en una celda del mismo ancho
    // (anchoMax), no en su propio ancho — así quedan alineados en columnas
    // parejas aunque el área mezcle tipos de tamaños distintos, en vez de
    // un borde izquierdo dentado.
    return { eq, escalaFinal, x: PAD_ZONA + anchoMax / 2 + col * pasoH, y: yBase + fila * pasoV };
  });

  return {
    posiciones,
    ancho: PAD_ZONA * 2 + anchoMax + (cols - 1) * pasoH,
    alto: PAD_ZONA * 2 + ALTO_TITULO + altoMax + (filas - 1) * pasoV,
  };
}

// Ancho base más grande entre los equipos dados (a la escala YA acotada por
// ESCALA_MAX) — determina cuántos entran por fila a un ancho objetivo dado.
// Separado de calcularGrillaArea porque hace falta ANTES de saber "cols"
// (para poder calcular cols a partir de él).
export function anchoMaxDeEquipos(eqs, d) {
  const anchos = eqs.map((eq) => {
    const icono = iconoBaseDe(eq.tipo, d);
    if (!icono) return 0;
    return icono.anchoBase * Math.min(escalaDeCatalogo(eq, d), ESCALA_MAX);
  });
  return Math.max(...anchos, 1);
}

// Ancho que va a ocupar el cuadro punteado de un área SOLO por su título:
// PortalSCADA.js agranda la caja dibujada para que el título entre entero
// (cajaVisibleDeArea), así que un área de pocos equipos termina dibujada
// más ancha que su grilla. Si el empaquetado no reserva ese ancho, dos
// áreas angostas puestas una al lado de la otra se pisan los títulos.
// Estimación del ancho del texto: 13px, negrita, mayúsculas, con
// letter-spacing — alcanza con un promedio por carácter, más el margen
// izquierdo (8) con el que se ancla el título y el aire de la derecha.
const ANCHO_POR_CARACTER_TITULO = 8.4;
export function anchoDeTitulo(nombre) {
  return 8 + (nombre || '').length * ANCHO_POR_CARACTER_TITULO + 10;
}

export const cajasSolapan = (a, b) =>
  a.x < b.x + b.ancho && a.x + a.ancho > b.x && a.y < b.y + b.alto && a.y + a.alto > b.y;

// Busca el ancho de lienzo que deja el resultado más parecido a la
// proporción del panel. El ancho estimado por área total supone un
// aprovechamiento perfecto que en la práctica nunca se da, así que se
// resuelve con varios anchos alrededor y gana el de menor desvío.
//
// Se compara en escala logarítmica para que quedarse corto y pasarse pesen
// igual (1.5x más ancho es tan malo como 1.5x más angosto).
//
// Muestrear más fino que estos multiplicadores no sirve: la cantidad de
// columnas es un entero, así que los layouts alcanzables son un conjunto
// discreto y saltan de a escalones grandes (medido en la planta de prueba:
// se salta de una proporción de 1.46 a una de 2.03, sin nada en el medio).
export const MULTIPLICADORES = [0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.5, 1.75, 2];

export function buscarMejorAncho(anchoBase, arObjetivo, resolver, multiplicadores = MULTIPLICADORES) {
  let mejor = null;
  multiplicadores.forEach((mult) => {
    const r = resolver(anchoBase * mult);
    if (!r) return;
    const desvio = Math.abs(Math.log(r.ancho / r.alto / arObjetivo));
    if (!mejor || desvio < mejor.desvio) mejor = { ...r, desvio, mult };
  });
  return mejor;
}
