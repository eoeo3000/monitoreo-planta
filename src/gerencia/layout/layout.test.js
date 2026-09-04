import { escalaDeCatalogo, escalaVisible, calcularGrillaArea, anchoDeTitulo, PAD_ZONA, ALTO_TITULO } from './grilla';
import { migrarEscalas } from '../../analista/store';
import { empaquetarSkyline } from './skyline';
import { solapamientoDeCajas } from './ensayo';
import { contornosDeArea, repartirEnVistas, encuadrar } from './escalonado';
import { rutaPuertos, indiceDeObstaculos, crucesEntreRutas } from '../puertos';

// Geometría pura: se puede probar sin navegador y sin React, que es
// justamente lo que motivó separarla del store.

const datos = { escalasPorTipo: {}, tiposPersonalizados: [] };
const bomba = (id) => ({ id, tag: id, tipo: 'bomba', areaId: 'a1' });

describe('escalaDeCatalogo — de dónde PARTE el compactado', () => {
  test('sin escala propia usa la del tipo', () => {
    expect(escalaDeCatalogo(bomba('b1'), datos)).toBe(1);
    expect(escalaDeCatalogo(bomba('b1'), { ...datos, escalasPorTipo: { bomba: 2 } })).toBe(2);
  });

  test('la escala puesta a mano gana sobre la del tipo', () => {
    const eq = { ...bomba('b1'), escalaPropia: 2.5 };
    expect(escalaDeCatalogo(eq, { ...datos, escalasPorTipo: { bomba: 2 } })).toBe(2.5);
  });

  test('ignora el factor de la compactada anterior', () => {
    // Si lo mirara, cada compactada se apilaría sobre su propio resultado.
    const eq = { ...bomba('b1'), factorAuto: 3.8 };
    expect(escalaDeCatalogo(eq, datos)).toBe(1);
  });
});

describe('escalaVisible — lo que se DIBUJA', () => {
  test('multiplica el tamaño elegido por el factor de la app', () => {
    const eq = { ...bomba('b1'), factorAuto: 2 };
    expect(escalaVisible(eq, { ...datos, escalasPorTipo: { bomba: 1.5 } })).toBe(3);
  });

  test('el panel por tipo sigue mandando sobre una planta compactada', () => {
    // El defecto que motivó separar las dos capas: antes el compactado
    // escribía su resultado en escalaPropia y bloqueaba el panel.
    const eq = { ...bomba('b1'), factorAuto: 2 };
    expect(escalaVisible(eq, { ...datos, escalasPorTipo: { bomba: 1 } })).toBe(2);
    expect(escalaVisible(eq, { ...datos, escalasPorTipo: { bomba: 0.5 } })).toBe(1);
  });

  test('sin factor es solo el tamaño elegido', () => {
    expect(escalaVisible(bomba('b1'), datos)).toBe(1);
    expect(escalaVisible({ ...bomba('b1'), escalaPropia: 2.5 }, datos)).toBe(2.5);
  });
});

describe('migrarEscalas — datos guardados por la versión anterior', () => {
  const conEquipos = (equipos, escalasPorTipo = {}) => ({ equipos, escalasPorTipo });

  test('lo que escribió el compactado pasa a factorAuto y se ve igual', () => {
    const d = conEquipos([{ ...bomba('b1'), escalaPropia: 2, escalaAuto: 2 }]);
    const eq = migrarEscalas(d).equipos[0];
    expect(eq.escalaPropia).toBeUndefined();
    expect(eq.escalaAuto).toBeUndefined();
    expect(eq.factorAuto).toBe(2);
    expect(escalaVisible(eq, { ...datos, ...d })).toBe(2);
  });

  test('descuenta el multiplicador por tipo al pasar el factor', () => {
    // El compactado guardaba escalaBase × factor; acá escalaBase era el 2
    // del tipo, así que el factor de la compactada fue 1.5.
    const d = conEquipos([{ ...bomba('b1'), escalaPropia: 3, escalaAuto: 3 }], { bomba: 2 });
    expect(migrarEscalas(d).equipos[0].factorAuto).toBe(1.5);
  });

  test('un tamaño cambiado a mano después de compactar se respeta', () => {
    const d = conEquipos([{ ...bomba('b1'), escalaPropia: 2.5, escalaAuto: 3.8 }]);
    const eq = migrarEscalas(d).equipos[0];
    expect(eq.escalaPropia).toBe(2.5);
    expect(eq.factorAuto).toBeUndefined();
    expect(eq.escalaAuto).toBeUndefined();
  });

  test('no toca un equipo sin tamaño guardado, ni uno ya migrado', () => {
    const d = conEquipos([bomba('b1'), { ...bomba('b2'), factorAuto: 1.3 }]);
    expect(migrarEscalas(d).equipos).toEqual(d.equipos);
  });

  test('es idempotente: migrar dos veces da lo mismo', () => {
    const d = conEquipos([{ ...bomba('b1'), escalaPropia: 2, escalaAuto: 2 }, { ...bomba('b2'), escalaPropia: 1.3 }]);
    expect(migrarEscalas(migrarEscalas(d))).toEqual(migrarEscalas(d));
  });
});

describe('calcularGrillaArea', () => {
  test('un solo equipo: margen a los dos lados más lugar para el título', () => {
    const g = calcularGrillaArea([bomba('b1')], datos, 1, 1);
    expect(g.ancho).toBe(PAD_ZONA * 2 + 26); // anchoBase de la bomba
    expect(g.alto).toBe(PAD_ZONA * 2 + ALTO_TITULO + 29); // altoBase
    expect(g.posiciones).toHaveLength(1);
  });

  test('dos equipos en una fila suman un paso horizontal', () => {
    const g = calcularGrillaArea([bomba('b1'), bomba('b2')], datos, 1, 2);
    expect(g.ancho).toBe(PAD_ZONA * 2 + 26 + 52); // pasoH = anchoMax * 2
    expect(g.alto).toBe(PAD_ZONA * 2 + ALTO_TITULO + 29); // sigue siendo una fila
  });

  test('el factor escala las posiciones y las dimensiones', () => {
    const g1 = calcularGrillaArea([bomba('b1')], datos, 1, 1);
    const g2 = calcularGrillaArea([bomba('b1')], datos, 2, 1);
    expect(g2.posiciones[0].escalaFinal).toBe(2);
    expect(g2.ancho).toBeGreaterThan(g1.ancho);
  });
});

describe('anchoDeTitulo', () => {
  test('crece con la cantidad de caracteres', () => {
    expect(anchoDeTitulo('AB')).toBeLessThan(anchoDeTitulo('ÁREA DE BOMBEO'));
  });

  test('tolera un nombre vacío', () => {
    expect(anchoDeTitulo(undefined)).toBeGreaterThan(0);
  });
});

describe('empaquetarSkyline', () => {
  const pieza = (id, ancho, alto) => ({ id, ancho, alto });

  test('dos piezas que entran quedan lado a lado arriba de todo', () => {
    const r = empaquetarSkyline([pieza('a', 50, 20), pieza('b', 50, 20)], 100);
    expect(r.colocadas.map((c) => [c.x, c.y])).toEqual([[0, 0], [50, 0]]);
    expect(r.ancho).toBe(100);
    expect(r.alto).toBe(20);
  });

  test('la tercera pieza baja a la fila siguiente', () => {
    const r = empaquetarSkyline([pieza('a', 50, 20), pieza('b', 50, 20), pieza('c', 50, 20)], 100);
    expect(r.colocadas[2]).toMatchObject({ x: 0, y: 20 });
    expect(r.alto).toBe(40);
  });

  test('ninguna pieza se superpone con otra', () => {
    const piezas = [pieza('a', 60, 30), pieza('b', 50, 10), pieza('c', 40, 25), pieza('d', 30, 40)];
    const { colocadas } = empaquetarSkyline(piezas, 100);
    colocadas.forEach((a, i) => {
      colocadas.slice(i + 1).forEach((b) => {
        const seCruzan = a.x < b.x + b.ancho && a.x + a.ancho > b.x && a.y < b.y + b.alto && a.y + a.alto > b.y;
        expect(seCruzan).toBe(false);
      });
    });
  });

  test('lo reservado puede ser mayor que lo que ocupa (margen entre áreas)', () => {
    // La pieza mide 50 pero reserva 60: la siguiente no puede arrancar en 50.
    const r = empaquetarSkyline(
      [{ id: 'a', ancho: 50, alto: 20, anchoOcupado: 60, altoOcupado: 30 }, pieza('b', 40, 20)],
      100
    );
    expect(r.colocadas[1].x).toBe(60);
  });
});

describe('solapamientoDeCajas', () => {
  const caja = (x, y) => ({ x, y, ancho: 100, alto: 100 });

  test('cajas separadas no se pisan', () => {
    expect(solapamientoDeCajas([caja(0, 0), caja(200, 0)])).toBe(0);
  });

  test('mide la superficie pisada', () => {
    expect(solapamientoDeCajas([caja(0, 0), caja(50, 0)])).toBe(50 * 100);
  });

  test('cuenta la UNIÓN, no la suma de los pares', () => {
    // Tres cajas idénticas comparten una sola superficie de 100x100. Sumar
    // los pares daría 30000; la respuesta correcta es 10000.
    expect(solapamientoDeCajas([caja(0, 0), caja(0, 0), caja(0, 0)])).toBe(100 * 100);
  });

  test('una sola caja no se pisa consigo misma', () => {
    expect(solapamientoDeCajas([caja(0, 0)])).toBe(0);
  });
});

describe('encuadrar', () => {
  const layout = (anchoIcono, altoIcono, ancho, alto) => ({
    colocadas: [{ anchoIcono, altoIcono }],
    ancho,
    alto,
  });

  test('el zoom mete el lienzo en el panel', () => {
    // Lienzo de 640x360 en un panel de 1280x720: entra justo al doble.
    const e = encuadrar(layout(20, 40, 640, 360), { ancho: 1280, alto: 720 });
    expect(e.zoom).toBe(2);
    expect(e.minPx).toBe(80);
  });

  test('el máximo frena el acercamiento', () => {
    // Sin tope el zoom sería 2 y el ícono quedaría en 80px.
    const e = encuadrar(layout(20, 40, 640, 360), { ancho: 1280, alto: 720 }, 60);
    expect(e.maxPx).toBeCloseTo(60);
    expect(e.topado).toBe(true);
  });

  test('sin necesidad de topar, no topa', () => {
    const e = encuadrar(layout(20, 40, 640, 360), { ancho: 1280, alto: 720 }, 200);
    expect(e.topado).toBe(false);
    expect(e.zoom).toBe(2);
  });

  test('minPxParaCaber ignora el tope — es el que decide la paginación', () => {
    const e = encuadrar(layout(20, 40, 640, 360), { ancho: 1280, alto: 720 }, 60);
    expect(e.topado).toBe(true);
    expect(e.minPx).toBeCloseTo(60); // lo que se DIBUJA, ya topado
    expect(e.minPxParaCaber).toBe(80); // lo que DECIDE, sin topar
  });
});

describe('repartirEnVistas', () => {
  const panel = { ancho: 1280, alto: 720 };
  const equiposDeArea = (areaId, n, tipo = 'bomba') =>
    Array.from({ length: n }, (_, i) => ({ id: `${areaId}-${i}`, tag: `${areaId}-${i}`, tipo, areaId }));

  test('sin mínimo entra todo en una sola vista', () => {
    const eqs = [...equiposDeArea('a1', 30), ...equiposDeArea('a2', 30)];
    const vistas = repartirEnVistas(eqs, datos, { panel, tamMinPx: 0 });
    expect(vistas).toHaveLength(1);
    expect(vistas[0].areas).toHaveLength(2);
  });

  test('un mínimo exigente obliga a repartir', () => {
    const eqs = Array.from({ length: 12 }, (_, i) => equiposDeArea(`a${i}`, 20)).flat();
    const holgado = repartirEnVistas(eqs, datos, { panel, tamMinPx: 10 });
    const exigente = repartirEnVistas(eqs, datos, { panel, tamMinPx: 60 });
    expect(exigente.length).toBeGreaterThan(holgado.length);
  });

  test('ninguna área se parte entre vistas y no se pierde ninguna', () => {
    const eqs = Array.from({ length: 10 }, (_, i) => equiposDeArea(`a${i}`, 15)).flat();
    const vistas = repartirEnVistas(eqs, datos, { panel, tamMinPx: 50 });
    const ids = vistas.flatMap((v) => v.areas.map((a) => a.areaId));
    expect(new Set(ids).size).toBe(ids.length); // sin repetidas
    expect(ids.sort()).toEqual(Array.from({ length: 10 }, (_, i) => `a${i}`).sort());
  });

  test('un mínimo inalcanzable deja de fragmentar y lo marca', () => {
    // Si una área sola ya no llega, ninguna cantidad va a llegar: partir no
    // gana nada. Antes esto daba una vista por área.
    const eqs = [...equiposDeArea('a1', 40), ...equiposDeArea('a2', 40)];
    const vistas = repartirEnVistas(eqs, datos, { panel, tamMinPx: 5000 });
    expect(vistas).toHaveLength(1);
    expect(vistas[0].areas).toHaveLength(2);
    expect(vistas[0].minimoInalcanzable).toBe(true);
  });

  test('el máximo no cambia el reparto: es regla de dibujo, no de paginación', () => {
    const eqs = Array.from({ length: 12 }, (_, i) => equiposDeArea(`a${i}`, 8, i % 3 === 0 ? 'tanque' : 'bomba')).flat();
    const sinTope = repartirEnVistas(eqs, datos, { panel, tamMinPx: 60, tamMaxPx: 4000 });
    const conTope = repartirEnVistas(eqs, datos, { panel, tamMinPx: 60, tamMaxPx: 50 });
    expect(conTope.map((v) => v.areas.length)).toEqual(sinTope.map((v) => v.areas.length));
    // …pero al dibujar el tope sí actúa.
    expect(conTope.some((v) => v.encuadre.topado)).toBe(true);
    expect(sinTope.some((v) => v.encuadre.topado)).toBe(false);
  });
});

describe('contornosDeArea', () => {
  const span = (fila, x0, x1) => ({ fila, x0, x1, y0: fila * 50, y1: fila * 50 + 50 });

  test('tramos que se tocan dan un solo contorno', () => {
    const c = contornosDeArea([span(0, 0, 200), span(1, 0, 120)]);
    expect(c).toHaveLength(1);
    expect(c[0].d).toMatch(/^M .* Z$/);
  });

  test('tramos separados en X dan contornos separados', () => {
    // Un área chica justo en el salto de fila: termina a la derecha y sigue
    // a la izquierda, sin tocarse. Son dos figuras, y eso es la verdad.
    const c = contornosDeArea([span(0, 700, 900), span(1, 0, 200)]);
    expect(c).toHaveLength(2);
  });

  test('sin tramos no hay contorno', () => {
    expect(contornosDeArea([])).toEqual([]);
    expect(contornosDeArea(undefined)).toEqual([]);
  });
});

describe('rutaPuertos — el desvío para esquivar un equipo', () => {
  // Dos puertos enfrentados a distinta altura: el quiebre por defecto queda
  // en el medio (150, 150) y el tramo vertical atraviesa la caja.
  const puertoA = { x: 0, y: 100, dir: 'E' };
  const puertoB = { x: 300, y: 200, dir: 'W' };
  const estorbo = [{ izq: 140, der: 160, arriba: 140, abajo: 160 }];

  test('sin estorbos el quiebre es el punto medio', () => {
    expect(rutaPuertos(puertoA, puertoB, null, { obstaculos: [] }).medio).toEqual({ x: 150, y: 150 });
  });

  test('el desvío es el punto libre MÁS CERCANO, no la esquina del anillo', () => {
    // Barrer dx y después dy devolvía la esquina superior izquierda del
    // anillo —la más lejana— y sesgaba todos los desvíos hacia arriba y a
    // la izquierda. Ordenado por distancia real, sale un desplazamiento
    // sobre un solo eje.
    const r = rutaPuertos(puertoA, puertoB, null, { obstaculos: estorbo });
    expect(r.medio).toEqual({ x: 110, y: 150 });
  });

  test('los límites del lienzo acotan el desvío', () => {
    // Sin acotar, la espiral se iba de la pantalla: la cañería salía del
    // lienzo y volvía, y su tirador de quiebre quedaba inalcanzable.
    const limites = { izq: 120, der: 400, arriba: 0, abajo: 400 };
    const r = rutaPuertos(puertoA, puertoB, null, { obstaculos: estorbo, limites });
    expect(r.medio.x).toBeGreaterThanOrEqual(limites.izq);
    expect(r.medio.x).toBeLessThanOrEqual(limites.der);
    expect(r.medio.y).toBeGreaterThanOrEqual(limites.arriba);
    expect(r.medio.y).toBeLessThanOrEqual(limites.abajo);
  });

  // El conteo de cruces se apoya en que NINGÚN tramo sea diagonal: clasifica
  // en horizontales y verticales y un diagonal se le escaparía sin ruido.
  test('todos los tramos son ortogonales, con y sin quiebre a mano', () => {
    const casos = [
      rutaPuertos({ x: 0, y: 100, dir: 'E' }, { x: 300, y: 200, dir: 'W' }, null, { obstaculos: estorbo }),
      rutaPuertos({ x: 0, y: 100, dir: 'N' }, { x: 300, y: 200, dir: 'S' }, null, {}),
      rutaPuertos({ x: 0, y: 100, dir: 'E' }, { x: 300, y: 200, dir: 'S' }, null, {}),
      rutaPuertos({ x: 0, y: 100, dir: 'E' }, { x: 300, y: 200, dir: 'W' }, { x: 77, y: 33 }, {}),
    ];
    casos.forEach((r) => {
      for (let i = 0; i < r.puntos.length - 1; i++) {
        const a = r.puntos[i];
        const b = r.puntos[i + 1];
        expect(a.x === b.x || a.y === b.y).toBe(true);
      }
    });
  });

  test('un quiebre puesto a mano no se toca, aunque haya estorbos', () => {
    const r = rutaPuertos(puertoA, puertoB, { x: 150, y: 150 }, { obstaculos: estorbo });
    expect(r.medio).toEqual({ x: 150, y: 150 });
  });
});

// Las dos optimizaciones del ruteo son EXACTAS: no aproximan, solo dejan de
// mirar lo que no puede dar distinto. Estos dos tests las atan a su versión
// ingenua, que es la definición de lo que tienen que devolver.

describe('indiceDeObstaculos — la grilla da lo mismo que mirar todas las cajas', () => {
  const MARGEN = 10;
  // Referencia: la comparación una-por-una que hacía el ruteo antes.
  const invade = (p1, p2, caja) => {
    const izq = caja.izq - MARGEN;
    const der = caja.der + MARGEN;
    const arriba = caja.arriba - MARGEN;
    const abajo = caja.abajo + MARGEN;
    if (p1.y === p2.y) {
      if (p1.y < arriba || p1.y > abajo) return false;
      return Math.max(p1.x, p2.x) >= izq && Math.min(p1.x, p2.x) <= der;
    }
    if (p1.x === p2.x) {
      if (p1.x < izq || p1.x > der) return false;
      return Math.max(p1.y, p2.y) >= arriba && Math.min(p1.y, p2.y) <= abajo;
    }
    return false;
  };
  const chocaIngenuo = (puntos, cajas, exA, exB) => {
    for (let i = 0; i < puntos.length - 1; i++) {
      for (const c of cajas) {
        if (c.id === exA || c.id === exB) continue;
        if (invade(puntos[i], puntos[i + 1], c.caja)) return true;
      }
    }
    return false;
  };

  // Generador determinista: el test tiene que fallar siempre igual.
  let semilla = 12345;
  const azar = () => { semilla = (semilla * 1103515245 + 12345) % 2147483648; return semilla / 2147483648; };
  const entre = (a, b) => Math.round(a + azar() * (b - a));

  test('mismo veredicto que la comparación una-por-una, en 400 tramos al azar', () => {
    const cajas = [];
    for (let i = 0; i < 120; i++) {
      const x = entre(0, 1800);
      const y = entre(0, 1200);
      const w = entre(20, 90);
      const h = entre(20, 110);
      cajas.push({ id: `e${i}`, caja: { izq: x, der: x + w, arriba: y, abajo: y + h } });
    }
    const indice = indiceDeObstaculos(cajas);

    let iguales = 0;
    let choques = 0;
    for (let n = 0; n < 400; n++) {
      const x1 = entre(-100, 1900);
      const y1 = entre(-100, 1300);
      // Tramo ortogonal, horizontal o vertical, más un segundo tramo pegado.
      const horiz = azar() < 0.5;
      const p1 = { x: x1, y: y1 };
      const p2 = horiz ? { x: x1 + entre(-600, 600), y: y1 } : { x: x1, y: y1 + entre(-600, 600) };
      const p3 = horiz ? { x: p2.x, y: p2.y + entre(-400, 400) } : { x: p2.x + entre(-400, 400), y: p2.y };
      const puntos = [p1, p2, p3];
      const exA = `e${entre(0, 119)}`;
      const exB = `e${entre(0, 119)}`;
      const esperado = chocaIngenuo(puntos, cajas, exA, exB);
      if (esperado) choques += 1;
      if (indice.choca(puntos, exA, exB) === esperado) iguales += 1;
    }
    expect(iguales).toBe(400);
    // Si no chocara casi nunca, el test no probaría nada.
    expect(choques).toBeGreaterThan(100);
  });

  test('sin cajas no choca nunca', () => {
    expect(indiceDeObstaculos([]).choca([{ x: 0, y: 0 }, { x: 100, y: 0 }])).toBe(false);
  });

  test('los equipos de los extremos no son obstáculo de su propia cañería', () => {
    const cajas = [{ id: 'a', caja: { izq: 40, der: 60, arriba: 40, abajo: 60 } }];
    const tramo = [{ x: 0, y: 50 }, { x: 100, y: 50 }];
    expect(indiceDeObstaculos(cajas).choca(tramo)).toBe(true);
    expect(indiceDeObstaculos(cajas).choca(tramo, 'a')).toBe(false);
    expect(indiceDeObstaculos(cajas).choca(tramo, 'otro', 'a')).toBe(false);
  });
});

describe('crucesEntreRutas — el índice cuenta lo mismo que comparar todos los pares', () => {
  // Referencia: el test de orientación sobre TODOS los pares de tramos.
  const ingenuo = (rutas) => {
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
        if (orient(s.a, s.b, t.a) !== orient(s.a, s.b, t.b) && orient(t.a, t.b, s.a) !== orient(t.a, t.b, s.b)) cruces += 1;
      }
    }
    return cruces;
  };

  let semilla = 999;
  const azar = () => { semilla = (semilla * 1103515245 + 12345) % 2147483648; return semilla / 2147483648; };
  const entre = (a, b) => Math.round(a + azar() * (b - a));

  test('mismo conteo en 60 rutas ortogonales al azar', () => {
    const rutas = [];
    for (let i = 0; i < 60; i++) {
      let x = entre(0, 400);
      let y = entre(0, 400);
      const pts = [{ x, y }];
      for (let k = 0; k < 5; k++) {
        if (k % 2 === 0) x += entre(-150, 150); else y += entre(-150, 150);
        pts.push({ x, y });
      }
      rutas.push({ puntos: pts.filter((p, k) => k === 0 || p.x !== pts[k - 1].x || p.y !== pts[k - 1].y) });
    }
    const esperado = ingenuo(rutas);
    expect(esperado).toBeGreaterThan(50);
    expect(crucesEntreRutas(rutas)).toBe(esperado);
  });

  test('dos tramos paralelos no cuentan, ni encimados', () => {
    const a = { puntos: [{ x: 0, y: 0 }, { x: 100, y: 0 }] };
    const b = { puntos: [{ x: 20, y: 0 }, { x: 80, y: 0 }] };
    expect(crucesEntreRutas([a, b])).toBe(0);
  });

  test('una T cuenta como cruce, igual que antes', () => {
    const h = { puntos: [{ x: 0, y: 50 }, { x: 100, y: 50 }] };
    const v = { puntos: [{ x: 50, y: 50 }, { x: 50, y: 150 }] };
    expect(crucesEntreRutas([h, v])).toBe(ingenuo([h, v]));
    expect(crucesEntreRutas([h, v])).toBe(1);
  });
});
