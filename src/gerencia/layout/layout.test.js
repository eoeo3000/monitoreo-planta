import { escalaDeCatalogo, escalaVisible, calcularGrillaArea, anchoDeTitulo, PAD_ZONA, ALTO_TITULO } from './grilla';
import { migrarEscalas } from '../../analista/store';
import { empaquetarSkyline } from './skyline';
import { contornosDeArea, solapamientoDeCajas, repartirEnVistas, encuadrar } from './ensayo';

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

  test('un mínimo imposible no cuelga: cada vista se lleva al menos un área', () => {
    const eqs = [...equiposDeArea('a1', 40), ...equiposDeArea('a2', 40)];
    const vistas = repartirEnVistas(eqs, datos, { panel, tamMinPx: 5000 });
    expect(vistas).toHaveLength(2);
    expect(vistas.every((v) => v.areas.length >= 1)).toBe(true);
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
