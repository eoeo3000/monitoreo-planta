import React from 'react';

// Formas primitivas compartidas por los glifos de fábrica (scadaIconos.js) y
// los tipos de equipo creados por el usuario (tiposPersonalizados.js) — un
// solo lugar para dibujarlas Y para calcular el punto de su borde más
// cercano a un punto cualquiera, que es lo que permite conectar en
// "cualquier parte del perímetro" tocando la silueta real, no una caja
// invisible que la envuelve.

// `sinTrazo` en círculo/rectángulo/óvalo apaga el borde de ESA forma nomás
// (sigue rellena) — no es una fusión geométrica real de los dos contornos,
// pero si se apaga el borde de la forma que queda tapada por otra (p. ej. un
// círculo chico sobre un rectángulo más grande), ya no se ve la línea
// cruzada entre las dos siluetas.
export function formaAJsx(forma, key) {
  if (forma.tipo === 'circulo') return <circle key={key} cx={forma.cx} cy={forma.cy} r={forma.r} stroke={forma.sinTrazo ? 'none' : undefined} />;
  if (forma.tipo === 'rectangulo')
    return <rect key={key} x={forma.x} y={forma.y} width={forma.ancho} height={forma.alto} stroke={forma.sinTrazo ? 'none' : undefined} />;
  if (forma.tipo === 'elipse')
    return <ellipse key={key} cx={forma.cx} cy={forma.cy} rx={forma.rx} ry={forma.ry} stroke={forma.sinTrazo ? 'none' : undefined} />;
  if (forma.tipo === 'poligono') return <polygon key={key} points={forma.puntos.map((p) => `${p.x},${p.y}`).join(' ')} />;
  if (forma.tipo === 'linea') return <line key={key} x1={forma.x1} y1={forma.y1} x2={forma.x2} y2={forma.y2} />;
  if (forma.tipo === 'texto') {
    return (
      <text key={key} x={forma.x} y={forma.y} fontSize={forma.tamano || 10} textAnchor="middle" fill={forma.color || undefined} stroke="none">
        {forma.contenido}
      </text>
    );
  }
  return null;
}

// El ruteo de conexiones es ortogonal exclusivamente (nunca diagonal), así
// que cualquier normal continua se redondea al cardinal más parecido.
const cuadrante = (nx, ny) => (Math.abs(nx) >= Math.abs(ny) ? (nx >= 0 ? 'E' : 'W') : ny >= 0 ? 'S' : 'N');

function puntoEnSegmento(a, b, punto) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const largo2 = dx * dx + dy * dy || 1;
  let t = ((punto.x - a.x) * dx + (punto.y - a.y) * dy) / largo2;
  t = Math.max(0, Math.min(1, t));
  const x = a.x + t * dx;
  const y = a.y + t * dy;
  // Normal perpendicular al segmento — se elige el lado hacia donde cae
  // `punto` para que la dirección apunte hacia afuera, no hacia adentro.
  const nx = -dy;
  const ny = dx;
  const signo = (punto.x - a.x) * nx + (punto.y - a.y) * ny >= 0 ? 1 : -1;
  return { x, y, dist: Math.hypot(punto.x - x, punto.y - y), dir: cuadrante(nx * signo, ny * signo) };
}

// Punto más cercano a `punto` sobre el borde de UNA sola forma, con la
// distancia (para comparar entre varias formas) y una dirección cardinal.
function puntoEnForma(forma, punto) {
  if (forma.tipo === 'circulo') {
    const dx = punto.x - forma.cx;
    const dy = punto.y - forma.cy;
    const largo = Math.hypot(dx, dy) || 1;
    const nx = dx / largo;
    const ny = dy / largo;
    return { x: forma.cx + nx * forma.r, y: forma.cy + ny * forma.r, dist: Math.abs(largo - forma.r), dir: cuadrante(nx, ny) };
  }
  if (forma.tipo === 'elipse') {
    const dx = punto.x - forma.cx;
    const dy = punto.y - forma.cy;
    // Aproximación angular (no la proyección exacta, que es de grado 4):
    // se "redondea" el punto a un círculo unitario y se vuelve a estirar.
    // Indistinguible a simple vista en las proporciones de estos glifos.
    const ux = dx / (forma.rx || 1);
    const uy = dy / (forma.ry || 1);
    const largo = Math.hypot(ux, uy) || 1;
    const nx = ux / largo;
    const ny = uy / largo;
    const x = forma.cx + nx * forma.rx;
    const y = forma.cy + ny * forma.ry;
    return { x, y, dist: Math.hypot(punto.x - x, punto.y - y), dir: cuadrante(dx, dy) };
  }
  if (forma.tipo === 'rectangulo') {
    const { x: rx, y: ry, ancho, alto } = forma;
    const dentro = punto.x >= rx && punto.x <= rx + ancho && punto.y >= ry && punto.y <= ry + alto;
    let x = punto.x;
    let y = punto.y;
    let dir;
    if (dentro) {
      const distIzq = x - rx;
      const distDer = rx + ancho - x;
      const distArriba = y - ry;
      const distAbajo = ry + alto - y;
      const min = Math.min(distIzq, distDer, distArriba, distAbajo);
      if (min === distIzq) { x = rx; dir = 'W'; }
      else if (min === distDer) { x = rx + ancho; dir = 'E'; }
      else if (min === distArriba) { y = ry; dir = 'N'; }
      else { y = ry + alto; dir = 'S'; }
    } else {
      x = Math.max(rx, Math.min(rx + ancho, x));
      y = Math.max(ry, Math.min(ry + alto, y));
      if (x <= rx) dir = 'W';
      else if (x >= rx + ancho) dir = 'E';
      else if (y <= ry) dir = 'N';
      else dir = 'S';
    }
    return { x, y, dist: Math.hypot(punto.x - x, punto.y - y), dir };
  }
  if (forma.tipo === 'poligono') {
    let mejor = null;
    const pts = forma.puntos;
    for (let i = 0; i < pts.length; i++) {
      const cand = puntoEnSegmento(pts[i], pts[(i + 1) % pts.length], punto);
      if (!mejor || cand.dist < mejor.dist) mejor = cand;
    }
    return mejor;
  }
  // 'linea' y 'texto': no forman parte del contorno conectable (un trazo
  // abierto y una etiqueta no son un borde sobre el que aterrizar una tubería).
  return null;
}

// El punto más cercano a `punto` entre TODAS las formas de un ícono — la
// silueta real (círculos, óvalos, rectángulos, polígonos combinados), no la
// caja que los envuelve.
export function puntoPerimetroDeFormas(formas, punto) {
  let mejor = null;
  for (const forma of formas || []) {
    const cand = puntoEnForma(forma, punto);
    if (cand && (!mejor || cand.dist < mejor.dist)) mejor = cand;
  }
  return mejor;
}

// Al armar un tipo de equipo con varias formas (p. ej. un eje que debe tocar
// el cuerpo del agitador), esto encuentra el punto de OTRA forma más
// cercano a donde se soltó un extremo — si está a `umbral` unidades o menos,
// se puede ajustar (snap) ahí para que quede pegado sin dejar hueco.
// `indiceExcluir` es la forma que se está arrastrando (para no pegarla
// consigo misma).
export function puntoDeContactoCercano(formas, punto, indiceExcluir, umbral = 4) {
  let mejor = null;
  (formas || []).forEach((forma, i) => {
    if (i === indiceExcluir) return;
    const cand = puntoEnForma(forma, punto);
    if (cand && cand.dist <= umbral && (!mejor || cand.dist < mejor.dist)) mejor = cand;
  });
  return mejor;
}
