// Empaquetado por "skyline" — el mismo tipo de algoritmo que se usa para
// acomodar sprites en una textura de videojuego. El skyline es el perfil de
// altura ya ocupada en cada tramo de X: arranca como un único tramo de
// altura 0 y se va levantando a medida que se ubican piezas.
//
// Una sola implementación para los dos usos que tiene la app: ubicar
// BLOQUES de área (compactado.js) y ubicar EQUIPOS sueltos (ensayo.js).
// Antes había una copia en cada lado y ya habían divergido.
//
// Cada pieza declara dos tamaños:
//   ancho / alto              lo que ocupa de verdad, y lo que se usa para
//                             decidir si entra en un hueco
//   anchoOcupado / altoOcupado  lo que se reserva en el skyline, que puede
//                             ser mayor si hace falta dejar aire alrededor
//                             (el compactado reserva el margen entre áreas)
// Si no se declaran los "ocupado", se usan ancho y alto.

export function empaquetarSkyline(piezas, anchoObjetivo) {
  let skyline = [{ x: 0, ancho: anchoObjetivo, y: 0 }];

  const alturaEnTramo = (xIni, ancho) => {
    let alturaMax = 0;
    const xFin = xIni + ancho;
    skyline.forEach((seg) => {
      if (seg.x + seg.ancho <= xIni || seg.x >= xFin) return;
      alturaMax = Math.max(alturaMax, seg.y);
    });
    return alturaMax;
  };

  // Lo más arriba posible y, a igual altura, lo más a la izquierda. El
  // borde izquierdo de cada tramo es el único punto donde tiene sentido
  // empezar una pieza nueva. Si no entra en ninguno (una pieza más ancha
  // que el lienzo), va abajo de todo contra el margen izquierdo.
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

  piezas.forEach((pieza) => {
    const anchoOcupado = pieza.anchoOcupado ?? pieza.ancho;
    const altoOcupado = pieza.altoOcupado ?? pieza.alto;
    const pos = mejorPosicion(pieza.ancho);

    colocadas.push({ ...pieza, x: pos.x, y: pos.y });
    ancho = Math.max(ancho, pos.x + pieza.ancho);
    alto = Math.max(alto, pos.y + pieza.alto);

    // Los tramos que esta pieza cubre pasan a su nueva altura; lo que quede
    // de esos tramos a los costados se conserva a su altura de antes, que es
    // lo que después deja lugar para una pieza chica al lado.
    const xFin = pos.x + anchoOcupado;
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
        nuevo.push({ x: pos.x, ancho: anchoOcupado, y: pos.y + altoOcupado });
        agregado = true;
      }
      if (segFin > xFin) nuevo.push({ x: xFin, ancho: segFin - xFin, y: seg.y });
    });
    skyline = nuevo.sort((a, b) => a.x - b.x);
  });

  return { colocadas, ancho: ancho || 1, alto: alto || 1 };
}
