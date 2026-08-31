import { useCallback, useEffect, useState } from 'react';
import { SEED_PLANTAS, SEED_AREAS, SEED_EQUIPOS, SEED_DIAGNOSTICOS, SEED_AVISOS, SEED_CONEXIONES } from './mockData';
import { SCADA_ICONOS } from '../gerencia/scadaIconos';
import { iconoConEscala } from '../gerencia/iconos';

const STORAGE_KEY = 'condicion-activos-analista-v6';
const USUARIO_ACTUAL = 'analista.demo'; // sin autenticación real todavía
const POSICION_DEFAULT = { x: 80, y: 80 };

// Date.now() puede repetirse dentro del mismo milisegundo cuando se crean muchos
// registros seguidos en un bucle (p. ej. importando un CSV) — un contador propio
// evita que dos ids terminen siendo iguales en ese caso.
let contadorId = 0;
function nuevoId(prefijo) {
  contadorId += 1;
  return `${prefijo}_${Date.now()}_${contadorId}`;
}

function datosSemilla() {
  return {
    plantas: SEED_PLANTAS,
    areas: SEED_AREAS,
    equipos: SEED_EQUIPOS,
    diagnosticos: SEED_DIAGNOSTICOS,
    avisos: SEED_AVISOS,
    evidencias: [],
    conexiones: SEED_CONEXIONES,
    // Sobrescribe, por tipo, el multiplicador de escala por defecto de
    // scadaIconos.js — vacío significa "tamaño de fábrica (x1)". Se edita
    // desde el panel "Tamaños de equipo" del Portal SCADA, sin tocar código.
    escalasPorTipo: {},
    // Tipos de equipo creados desde Administración > Equipos (formas simples
    // + puertos), para equipos que no están en el catálogo fijo de
    // mockData.js. Solo visuales por ahora: no tienen modoFalla propio.
    tiposPersonalizados: [],
    // Agrupación de áreas por encima de "planta" — para plantas con muchas
    // ubicaciones (ver generarPlantaDePrueba), el Portal SCADA muestra
    // primero los sectores (vista macro) y recién al elegir uno entra al
    // lienzo con sus áreas. Una planta sin sectores (como la semilla) se
    // sigue viendo tal como siempre, sin este paso intermedio.
    sectores: [],
  };
}

function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    // localStorage no disponible o datos corruptos: usamos el set de prueba
  }
  return datosSemilla();
}

export function condicionActual(equipoId, diagnosticos) {
  const historial = diagnosticos
    .filter((d) => d.equipoId === equipoId)
    .sort((a, b) => new Date(b.fechaHora) - new Date(a.fechaHora));
  return historial[0] || null;
}

// PAD_ZONA_COMPACTAR (40) y ALTO_TITULO_COMPACTAR (18) espejan PAD_ZONA y
// el alto reservado al título en PortalSCADA.js — si esos cambian ahí, hay
// que actualizarlos acá para que el cuadro que resulta después de compactar
// siga siendo el mínimo posible (ni más chico, que recortaría el título, ni
// más grande, que dejaría aire de más).
const PAD_ZONA_COMPACTAR = 40;
const ALTO_TITULO_COMPACTAR = 18;
// Tope de escala por área al agrandar equipos — mismo tope que ya usa el
// panel "Tamaños de equipo" para el multiplicador por tipo.
const ESCALA_MAX_COMPACTAR = 4;
const PASO_CRECIMIENTO_AREA = 1.1;

// Arma la grilla de equipos de UN área a un factor de escala y una
// cantidad de columnas dados — separado en su propia función porque se
// llama muchas veces por área: una vez por cada forma candidata al
// ubicarla (ver calcularLayoutCompacto) y una por cada intento de
// agrandarla después, en agrandarAreaSinSolape.
function calcularGrillaArea(eqs, d, factor, cols) {
  const dimensiones = eqs.map((eq) => {
    const icono = iconoConEscala(eq, d);
    // Si ESTE equipo puntual ya viene con una escala guardada por encima
    // del tope (datos de antes del arreglo del crecimiento compuesto: un
    // solo equipo con escalaPropia de 20x, 50x…), se lo trata como si ya
    // estuviera en el tope antes de aplicar el factor de esta pasada — así
    // se autocorrige sin arrastrar hacia abajo a sus vecinos del área que
    // sí tenían un tamaño normal (aplicar un factor único para toda el
    // área, calculado a partir del peor equipo, los encogía a todos).
    const escalaBase = Math.min(icono ? icono.escala : 1, ESCALA_MAX_COMPACTAR);
    const escalaFinal = escalaBase * factor;
    return { eq, escalaFinal, ancho: icono ? icono.anchoBase * escalaFinal : 0, alto: icono ? icono.altoBase * escalaFinal : 0 };
  });
  const anchoMax = Math.max(...dimensiones.map((x) => x.ancho), 1);
  const altoMax = Math.max(...dimensiones.map((x) => x.alto), 1);
  const pasoH = Math.round(anchoMax * 2); // separación centro-a-centro entre equipos de una fila
  const pasoV = Math.round(altoMax + 30); // + lugar para el TAG debajo del ícono
  const filas = Math.ceil(eqs.length / cols);
  const yBase = PAD_ZONA_COMPACTAR + ALTO_TITULO_COMPACTAR + altoMax;

  const posiciones = dimensiones.map(({ eq, escalaFinal }, i) => {
    const col = i % cols;
    const fila = Math.floor(i / cols);
    // Todos los equipos del área se centran en una celda del mismo ancho
    // (anchoMax), no en su propio ancho — así quedan alineados en columnas
    // parejas aunque el área mezcle tipos de tamaños distintos, en vez de
    // un borde izquierdo dentado.
    return { eq, escalaFinal, x: PAD_ZONA_COMPACTAR + anchoMax / 2 + col * pasoH, y: yBase + fila * pasoV };
  });

  return {
    posiciones,
    ancho: PAD_ZONA_COMPACTAR * 2 + anchoMax + (cols - 1) * pasoH,
    alto: PAD_ZONA_COMPACTAR * 2 + ALTO_TITULO_COMPACTAR + altoMax + (filas - 1) * pasoV,
  };
}

const cajasSolapanArea = (a, b) => a.x < b.x + b.ancho && a.x + a.ancho > b.x && a.y < b.y + b.alto && a.y + a.alto > b.y;

// Agranda el bloque de un área, paso a paso (10% por vez), mientras el
// resultado no invada el bloque BASE (el tamaño con el que se empaquetó,
// antes de que nadie creciera) de ninguna otra área. Comparar siempre
// contra el bloque base ajeno —nunca contra cuánto creció ya esa vecina—
// es lo que hace que el resultado no dependa del orden en que se procesan
// las áreas: cada una compite solo por el espacio que quedó libre desde el
// principio.
//
// El tope es la escala ABSOLUTA final de cada equipo (escalaBaseMax, la más
// grande entre los del área, multiplicada por el factor de esta pasada) —
// nunca pasa ESCALA_MAX_COMPACTAR. No alcanza con topar el FACTOR de esta
// pasada sola: si un equipo ya venía con escalaPropia de una compactada
// anterior (ej. 3.5, cerca del tope), "factor hasta 4" lo multiplicaría de
// nuevo por 4 y lo mandaría a 14 — el tope se corre de una compactada a la
// siguiente en vez de frenar en 4 de verdad.
//
function agrandarAreaSinSolape(eqs, d, origen, otrasCajasBase, cols) {
  // escalaBaseMax ya viene acotada a ESCALA_MAX_COMPACTAR: calcularGrillaArea
  // corrige cada equipo corrupto individualmente antes de este cálculo (ver
  // más arriba), así que esta cuenta nunca parte por encima del tope.
  const escalaBaseMax = Math.min(Math.max(...eqs.map((eq) => iconoConEscala(eq, d)?.escala || 1)), ESCALA_MAX_COMPACTAR);
  let mejor = calcularGrillaArea(eqs, d, 1, cols);
  let factor = 1;
  while (escalaBaseMax * (factor * PASO_CRECIMIENTO_AREA) <= ESCALA_MAX_COMPACTAR) {
    const siguienteFactor = factor * PASO_CRECIMIENTO_AREA;
    const candidato = calcularGrillaArea(eqs, d, siguienteFactor, cols);
    const caja = { x: origen.x, y: origen.y, ancho: candidato.ancho, alto: candidato.alto };
    if (otrasCajasBase.some((otra) => cajasSolapanArea(caja, otra))) break;
    mejor = candidato;
    factor = siguienteFactor;
  }
  return mejor;
}

// Calcula (sin escribir nada todavía) cómo quedaría una planta si se
// compacta. Dos pasadas:
// 1. Ubica las áreas por "skyline", eligiendo para cada una, en el momento
//    de ubicarla, la FORMA de grilla (cuántas columnas) que deja el borde
//    inferior más bajo — no siempre la más cuadrada. Esto fija dónde va
//    cada área y con qué forma.
// 2. Con las áreas ya ubicadas y su forma fija, intenta agrandar cada una
//    por separado hasta el borde de la vecina más cercana
//    (agrandarAreaSinSolape) — así un área con lugar de sobra alrededor
//    puede crecer aunque el resto de la planta ya esté apretado al límite,
//    en vez de depender de una sola escala global para toda la planta (que
//    un área enorme como "Bombeo" podía dejar sin margen de mejora real,
//    aunque hubiera espacio suelto en otra parte).
function calcularLayoutCompacto(d, plantaId, arObjetivo) {
  const areasDePlanta = d.areas.filter((a) => a.plantaId === plantaId);
  const equiposPorArea = areasDePlanta
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

  if (equiposPorArea.length === 0) return { equipos: d.equipos };

  // Referencia única de espaciado ENTRE áreas — un ancho de ícono típico de
  // esta planta al tamaño base (el más grande, para no dejar dos equipos de
  // áreas vecinas casi tocándose si una de las dos usa íconos chicos).
  const anchosPlanta = equiposPorArea
    .flatMap(({ eqs }) => eqs)
    .map((eq) => {
      const icono = iconoConEscala(eq, d);
      return icono ? icono.anchoBase * icono.escala : 0;
    })
    .filter((n) => n > 0);
  const gapEntreAreas = Math.round(Math.max(...anchosPlanta, 60));

  // Bloque de referencia (forma cuadrada) de cada área — solo para decidir
  // el ORDEN en que se procesan (de más alta a más baja) y una primera
  // estimación de anchoObjetivo. La forma FINAL de cada área se decide más
  // abajo, al ubicarla — no tiene por qué ser la cuadrada.
  const referencia = equiposPorArea.map(({ area, eqs }) => {
    const colsCuadrado = Math.max(1, Math.ceil(Math.sqrt(eqs.length)));
    return { area, eqs, colsCuadrado, bloqueRef: calcularGrillaArea(eqs, d, 1, colsCuadrado) };
  });

  // Empaqueta las áreas por "skyline" (el mismo tipo de algoritmo que se
  // usa para acomodar sprites en una textura de videojuego): cada área se
  // ubica donde quede MÁS ARRIBA posible dentro de un ancho objetivo fijo
  // (`anchoObjetivo`, estimado del área total de referencia y la
  // proporción real del panel). El "skyline" es el perfil de altura ya
  // ocupada en cada tramo de X — arranca como un único tramo de altura 0.
  // Se procesan las áreas de más alta a más baja (empaqueta mejor: las
  // altas definen la forma general primero, y las bajas van rellenando los
  // huecos que van quedando).
  let anchoObjetivo = Math.sqrt(referencia.reduce((acc, r) => acc + r.bloqueRef.ancho * r.bloqueRef.alto, 0) * arObjetivo) || 1;
  let skyline = [{ x: 0, ancho: anchoObjetivo, y: 0 }];
  const origenDeArea = {};
  const bloques = []; // { areaId, ancho, alto, cols } — la forma FINAL elegida, para el crecimiento posterior

  const alturaEnTramo = (xIni, ancho) => {
    let y = 0;
    const xFin = xIni + ancho;
    skyline.forEach((seg) => {
      if (seg.x + seg.ancho <= xIni || seg.x >= xFin) return;
      y = Math.max(y, seg.y);
    });
    return y;
  };

  // Dónde ubicaría el skyline un bloque de este ancho, ahora mismo — el
  // borde izquierdo de cada tramo es el único punto donde tiene sentido
  // empezar un rectángulo nuevo.
  const mejorPosicionPara = (ancho) => {
    let mejorX = 0;
    let mejorY = Infinity;
    skyline.forEach((seg) => {
      const y = alturaEnTramo(seg.x, ancho);
      if (y < mejorY) {
        mejorY = y;
        mejorX = seg.x;
      }
    });
    return { x: mejorX, y: mejorY };
  };

  [...referencia]
    .sort((a, b) => b.bloqueRef.alto - a.bloqueRef.alto)
    .forEach(({ area, eqs, colsCuadrado }) => {
      // No se usa solo la forma cuadrada: se prueban varias cantidades de
      // columnas (mitad a doble de la cuadrada — evita formas degeneradas,
      // una sola columna altísima o una sola fila kilométrica) y, para cada
      // una, se calcula dónde la ubicaría el skyline — quedándose con la
      // que deja el BORDE INFERIOR más bajo (dónde ubicaría el skyline +
      // su propio alto). Una vecina más alta define una altura a igualar:
      // la forma que más se acerca a esa altura dejando el bloque más bajo
      // posible es la que menos hueco deja debajo suyo — a diferencia de
      // "maximizar la escala del equipo" (lo que se probó antes), este
      // criterio no premia formas angostas degeneradas: una columna de una
      // sola celda tiene MENOS ancho pero MÁS alto, así que su borde
      // inferior empeora en vez de mejorar.
      const colsMin = Math.max(1, Math.floor(colsCuadrado / 2));
      const colsMax = Math.min(eqs.length, colsCuadrado * 2);

      let mejor = null;
      for (let cols = colsMin; cols <= colsMax; cols++) {
        const bloque = calcularGrillaArea(eqs, d, 1, cols);
        const pos = mejorPosicionPara(bloque.ancho);
        const bordeInferior = pos.y + bloque.alto;
        if (!mejor || bordeInferior < mejor.bordeInferior) {
          mejor = { cols, bloque, pos, bordeInferior };
        }
      }

      const { cols, bloque, pos } = mejor;
      // Si ni la mejor forma entra en el ancho objetivo (un área más ancha
      // que todo el resto junto), se agranda lo justo y necesario — no
      // debería angostar el resto del empaquetado.
      if (pos.x + bloque.ancho > anchoObjetivo) anchoObjetivo = pos.x + bloque.ancho;

      origenDeArea[area.id] = pos;
      bloques.push({ areaId: area.id, ancho: bloque.ancho, alto: bloque.alto, cols });

      // Actualiza el skyline: los tramos que este bloque cubre pasan a su
      // nueva altura (con el margen entre áreas ya sumado); lo que quede
      // de esos tramos a los costados se conserva a su altura de antes.
      const xFin = pos.x + bloque.ancho;
      const nuevoSkyline = [];
      let agregado = false;
      skyline.forEach((seg) => {
        const segFin = seg.x + seg.ancho;
        if (segFin <= pos.x || seg.x >= xFin) {
          nuevoSkyline.push(seg);
          return;
        }
        if (seg.x < pos.x) nuevoSkyline.push({ x: seg.x, ancho: pos.x - seg.x, y: seg.y });
        if (!agregado) {
          nuevoSkyline.push({ x: pos.x, ancho: bloque.ancho, y: pos.y + bloque.alto + gapEntreAreas });
          agregado = true;
        }
        if (segFin > xFin) nuevoSkyline.push({ x: xFin, ancho: segFin - xFin, y: seg.y });
      });
      skyline = nuevoSkyline.sort((s1, s2) => s1.x - s2.x);
    });

  // Con cada área ya ubicada y con su forma final fijada (bloques), se
  // intenta agrandar una por una — siempre comparando contra el bloque BASE
  // de las demás, nunca contra cuánto creció ya alguna vecina, y sin
  // recalcular la forma (cols) — esa ya quedó fijada arriba.
  const cajasBase = bloques.map((b) => ({ areaId: b.areaId, x: origenDeArea[b.areaId].x, y: origenDeArea[b.areaId].y, ancho: b.ancho, alto: b.alto }));

  const posicionRelativa = {}; // equipoId -> {x, y, escalaFinal} relativo al origen de SU área
  const areaIdDeEquipo = {};
  equiposPorArea.forEach(({ area, eqs }) => {
    const { cols } = bloques.find((b) => b.areaId === area.id);
    const otrasCajasBase = cajasBase.filter((c) => c.areaId !== area.id);
    const grillaFinal = agrandarAreaSinSolape(eqs, d, origenDeArea[area.id], otrasCajasBase, cols);
    grillaFinal.posiciones.forEach(({ eq, escalaFinal, x, y }) => {
      areaIdDeEquipo[eq.id] = area.id;
      posicionRelativa[eq.id] = { x, y, escalaFinal };
    });
  });

  const equipos = d.equipos.map((eq) => {
    const rel = posicionRelativa[eq.id];
    if (!rel) return eq;
    const origen = origenDeArea[areaIdDeEquipo[eq.id]];
    return {
      ...eq,
      posicion: { x: Math.round(origen.x + rel.x), y: Math.round(origen.y + rel.y) },
      escalaPropia: Math.round(rel.escalaFinal * 100) / 100,
    };
  });

  return { equipos };
}

export function useAnalistaData() {
  const [data, setData] = useState(loadInitial);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      // almacenamiento lleno o no disponible: se pierde persistencia mas no la sesión actual
    }
  }, [data]);

  // Regla anti-duplicado (provisional, pendiente de confirmar): bloquea un insert
  // idéntico (mismo equipo + severidad + modoFalla + texto) del mismo usuario dentro
  // de los últimos 5 minutos, para evitar dobles clics accidentales.
  const esDuplicadoReciente = useCallback(
    (equipoId, diagnosticoData) => {
      const ultimo = condicionActual(equipoId, data.diagnosticos);
      if (!ultimo) return false;
      const mismosDatos =
        ultimo.usuario === USUARIO_ACTUAL &&
        ultimo.severidad === diagnosticoData.severidad &&
        (ultimo.modoFalla || '') === (diagnosticoData.modoFalla || '') &&
        ultimo.diagnosticoTexto === diagnosticoData.diagnosticoTexto;
      const minutosDesdeUltimo = (Date.now() - new Date(ultimo.fechaHora)) / 60000;
      return mismosDatos && minutosDesdeUltimo < 5;
    },
    [data.diagnosticos]
  );

  const crearDiagnostico = useCallback((equipoId, diagnosticoData, evidenciasPendientes = []) => {
    const id = nuevoId('diag');
    const nuevo = {
      id,
      equipoId,
      fechaHora: new Date().toISOString(),
      usuario: USUARIO_ACTUAL,
      ...diagnosticoData,
    };
    const evidencias = evidenciasPendientes.map((ev) => ({
      id: nuevoId('ev'),
      diagnosticoId: id,
      dataUrl: ev.dataUrl,
    }));
    setData((d) => ({
      ...d,
      diagnosticos: [...d.diagnosticos, nuevo],
      evidencias: [...d.evidencias, ...evidencias],
    }));
    return nuevo;
  }, []);

  const solicitarAviso = useCallback(
    (equipoId, diagnosticoData, avisoData, evidenciasPendientes = []) => {
      const diagnosticoId = nuevoId('diag');
      const diagnostico = {
        id: diagnosticoId,
        equipoId,
        fechaHora: new Date().toISOString(),
        usuario: USUARIO_ACTUAL,
        ...diagnosticoData,
      };
      const aviso = {
        id: nuevoId('aviso'),
        equipoId,
        diagnosticoOrigenId: diagnosticoId,
        numeroSap: null,
        estado: 'solicitud',
        ...avisoData,
      };
      const evidencias = evidenciasPendientes.map((ev) => ({
        id: nuevoId('ev'),
        diagnosticoId,
        dataUrl: ev.dataUrl,
      }));
      setData((d) => ({
        ...d,
        diagnosticos: [...d.diagnosticos, diagnostico],
        avisos: [...d.avisos, aviso],
        evidencias: [...d.evidencias, ...evidencias],
      }));
      return { diagnostico, aviso };
    },
    []
  );

  const resetearDatos = useCallback(() => {
    setData(datosSemilla());
  }, []);

  const crearPlanta = useCallback((nombre) => {
    const id = nuevoId('planta');
    setData((d) => ({ ...d, plantas: [...d.plantas, { id, nombre }] }));
    return id;
  }, []);

  const crearArea = useCallback((plantaId, nombre) => {
    const id = nuevoId('area');
    setData((d) => ({ ...d, areas: [...d.areas, { id, plantaId, nombre }] }));
    return id;
  }, []);

  // Cada equipo nuevo se ubica en una celda de grilla propia dentro de su
  // área (según cuántos equipos ya tiene esa área) en vez de apilarse sobre
  // los que ya existen — si no, dos equipos creados a mano en la misma área
  // quedan exactamente superpuestos: al hacer clic siempre se selecciona el
  // mismo (el que quedó arriba en el dibujo), y nunca se puede elegir el
  // otro como destino de una conexión.
  //
  // El ORIGEN de esa grilla ya no es un punto fijo (80,80): si el área ya
  // tiene equipos, se ancla al primero de ellos (esté donde esté — el
  // usuario pudo haberlo movido); si el área es nueva pero la planta ya
  // tiene equipos en OTRAS áreas, se ancla pegado al borde derecho de ese
  // grupo. Solo si la planta entera está vacía se usa POSICION_DEFAULT.
  // Así un equipo (o un área) nuevo siempre aparece junto al resto de la
  // planta, sin importar a qué parte del lienzo se haya movido el conjunto.
  const crearEquipo = useCallback((areaId, { tag, tipo, descripcion }) => {
    const id = nuevoId('eq');
    setData((d) => {
      const equiposDelArea = d.equipos.filter((eq) => eq.areaId === areaId);
      const n = equiposDelArea.length;
      let origen;
      if (n > 0) {
        origen = equiposDelArea[0].posicion || POSICION_DEFAULT;
      } else {
        const area = d.areas.find((a) => a.id === areaId);
        const equiposDeOtrasAreas = area
          ? d.equipos.filter((eq) => eq.areaId !== areaId && d.areas.find((a) => a.id === eq.areaId)?.plantaId === area.plantaId)
          : [];
        if (equiposDeOtrasAreas.length) {
          const maxX = Math.max(...equiposDeOtrasAreas.map((eq) => (eq.posicion || POSICION_DEFAULT).x));
          const minY = Math.min(...equiposDeOtrasAreas.map((eq) => (eq.posicion || POSICION_DEFAULT).y));
          origen = { x: maxX + 160, y: minY };
        } else {
          origen = POSICION_DEFAULT;
        }
      }
      const posicion = { x: origen.x + (n % 5) * 140, y: origen.y + Math.floor(n / 5) * 120 };
      return { ...d, equipos: [...d.equipos, { id, areaId, tag, tipo, descripcion: descripcion || '', posicion }] };
    });
    return id;
  }, []);

  const moverEquipo = useCallback((equipoId, posicion) => {
    setData((d) => ({
      ...d,
      equipos: d.equipos.map((eq) => (eq.id === equipoId ? { ...eq, posicion } : eq)),
    }));
  }, []);

  const renombrarEquipo = useCallback((equipoId, tag) => {
    setData((d) => ({
      ...d,
      equipos: d.equipos.map((eq) => (eq.id === equipoId ? { ...eq, tag } : eq)),
    }));
  }, []);

  // Copia un equipo tal cual (tipo, área, descripción) desplazada dos celdas de
  // cuadrícula (40px) para que no quede exactamente encima del original — el
  // flujo pensado es: duplicar y de inmediato escribir el TAG nuevo encima.
  const duplicarEquipo = useCallback((equipoId) => {
    const id = nuevoId('eq');
    setData((d) => {
      const original = d.equipos.find((eq) => eq.id === equipoId);
      if (!original) return d;
      const posBase = original.posicion || POSICION_DEFAULT;
      const copia = { ...original, id, posicion: { x: posBase.x + 40, y: posBase.y + 40 } };
      return { ...d, equipos: [...d.equipos, copia] };
    });
    return id;
  }, []);

  const cambiarEscalaTipo = useCallback((tipo, escala) => {
    setData((d) => ({ ...d, escalasPorTipo: { ...d.escalasPorTipo, [tipo]: escala } }));
  }, []);

  // Tamaño de UN equipo en particular (doble clic), por encima del tamaño
  // del tipo — null quita la sobrescritura y vuelve a usar el tamaño del tipo.
  const cambiarEscalaEquipo = useCallback((equipoId, escala) => {
    setData((d) => ({
      ...d,
      equipos: d.equipos.map((eq) => (eq.id === equipoId ? { ...eq, escalaPropia: escala } : eq)),
    }));
  }, []);

  // Posición del título de una zona (área) del Portal SCADA — desplazamiento
  // a mano sobre el punto por defecto, para cuando queda mal ubicado.
  const moverTituloArea = useCallback((areaId, tituloOffset) => {
    setData((d) => ({
      ...d,
      areas: d.areas.map((a) => (a.id === areaId ? { ...a, tituloOffset } : a)),
    }));
  }, []);

  const moverEtiquetaEquipo = useCallback((equipoId, etiquetaOffset) => {
    setData((d) => ({
      ...d,
      equipos: d.equipos.map((eq) => (eq.id === equipoId ? { ...eq, etiquetaOffset } : eq)),
    }));
  }, []);

  // Detecta equipos "sueltos" (lejos de la mediana del resto de la planta —
  // mismo criterio que ya usa el Portal SCADA para no dejar que un equipo
  // aislado estire el zoom) y los reubica pegados al borde de ese grupo
  // principal, en una grilla propia para no superponerlos entre sí. Corrige
  // de una sola vez plantas que ya quedaron con equipos perdidos, en vez de
  // tener que arrastrarlos uno por uno a mano.
  const reunirEquiposDispersos = useCallback((plantaId) => {
    setData((d) => {
      const areaIdsDePlanta = d.areas.filter((a) => a.plantaId === plantaId).map((a) => a.id);
      const equiposDePlanta = d.equipos.filter((eq) => areaIdsDePlanta.includes(eq.areaId));
      if (equiposDePlanta.length < 2) return d;
      const mediana = (valores) => {
        const s = [...valores].sort((a, b) => a - b);
        const mitad = Math.floor(s.length / 2);
        return s.length % 2 ? s[mitad] : (s[mitad - 1] + s[mitad]) / 2;
      };
      const medX = mediana(equiposDePlanta.map((eq) => (eq.posicion || POSICION_DEFAULT).x));
      const medY = mediana(equiposDePlanta.map((eq) => (eq.posicion || POSICION_DEFAULT).y));
      const UMBRAL_DISPERSO = 1200;
      let siguienteHueco = 0;
      const equipos = d.equipos.map((eq) => {
        if (!areaIdsDePlanta.includes(eq.areaId)) return eq;
        const pos = eq.posicion || POSICION_DEFAULT;
        if (Math.hypot(pos.x - medX, pos.y - medY) <= UMBRAL_DISPERSO) return eq;
        const col = siguienteHueco % 5;
        const fila = Math.floor(siguienteHueco / 5);
        siguienteHueco += 1;
        return { ...eq, posicion: { x: medX + 200 + col * 140, y: medY + fila * 120 } };
      });
      return { ...d, equipos };
    });
  }, []);

  // Reacomoda TODOS los equipos de una planta en una grilla apretada, área
  // por área, y además reubica las áreas mismas (los cuadros punteados) una
  // al lado de la otra sin huecos entre sí — a diferencia de
  // reunirEquiposDispersos (que solo corrige equipos perdidos), esto
  // reorganiza toda la planta de una para minimizar el espacio vacío.
  //
  // Misma "ley de espaciado" que usa generarPlantaDePrueba más abajo
  // (distancias derivadas del tamaño REAL del ícono, no números sueltos),
  // pero calculada por área a partir de sus propios equipos — una planta
  // real mezcla tipos de tamaños distintos dentro de una misma área, así que
  // no hay un "ícono típico" único como en la demo.
  //
  // Además de acomodar, agranda los equipos de cada área por separado,
  // hasta el borde de la vecina más cercana (ver agrandarAreaSinSolape) —
  // así un área con lugar de sobra puede crecer aunque el resto de la
  // planta ya esté apretado al límite: agrandar TODA la planta con una sola
  // escala global (como se hacía antes) casi no mejoraba nada cuando un
  // área enorme dominaba el cálculo, aunque hubiera espacio suelto en otra
  // parte. `arObjetivo` (ancho/alto real del panel donde se dibuja) decide
  // cómo se reparten las áreas — si no se pasa, se asume panel ancho (16:9).
  const compactarPlanta = useCallback((plantaId, arObjetivo) => {
    const ar = arObjetivo && arObjetivo > 0 ? arObjetivo : 16 / 9;

    setData((d) => {
      const resultado = calcularLayoutCompacto(d, plantaId, ar);

      // El compactado reubica equipos a gran escala: un quiebre o puerto
      // fijado a mano en una conexión de esta planta quedaría apuntando a
      // coordenadas del layout viejo, ya sin relación con el nuevo — se
      // resetean para que esas conexiones vuelvan al ruteo automático (que
      // ya esquiva equipos por su cuenta).
      const conexiones = d.conexiones.map((c) => {
        if (c.plantaId !== plantaId) return c;
        const { quiebreManual, puertoDe, puertoA, ...resto } = c;
        return resto;
      });

      // Mismo motivo: un título de área o un TAG de equipo arrastrados a
      // mano ANTES de compactar quedan con un desplazamiento fijo en
      // píxeles (tituloOffset/etiquetaOffset) — relativo a dónde estaba el
      // área o el equipo en el layout viejo. Con el bloque ya reubicado en
      // otra parte del lienzo, ese desplazamiento puede dejar el título
      // lejos de sus equipos: PortalSCADA.js agranda el cuadro punteado
      // para seguir encerrándolo, y aparece como un hueco enorme entre el
      // título y los equipos reales (el bug que reportó el usuario). Se
      // resetean para que título y TAG vuelvan a su posición por defecto,
      // pegada al bloque recién compactado.
      const areasDePlantaIds = d.areas.filter((a) => a.plantaId === plantaId).map((a) => a.id);
      const areas = d.areas.map((a) => (areasDePlantaIds.includes(a.id) ? { ...a, tituloOffset: undefined } : a));
      const equipos = resultado.equipos.map((eq) => (areasDePlantaIds.includes(eq.areaId) ? { ...eq, etiquetaOffset: undefined } : eq));

      return { ...d, equipos, areas, conexiones };
    });
  }, []);

  // Genera una planta nueva (no toca las existentes) con muchos sectores,
  // ubicaciones y equipos de nombres genéricos — para probar cómo se
  // comporta la app (Vista de Sectores + Portal SCADA) con una cantidad de
  // datos parecida a la de un Excel real grande. Diagnósticos y severidades
  // son aleatorios, solo para que las tarjetas de sector muestren colores
  // variados al probar la vista — no representan condición real de ningún
  // equipo.
  const generarPlantaDePrueba = useCallback(() => {
    const plantaId = nuevoId('planta');
    const NUM_SECTORES = 10;
    const AREAS_POR_SECTOR = 20; // 10 x 20 = 200 ubicaciones
    // Tamaño propio de cada equipo de la demo (independiente de
    // escalasPorTipo, que es global a toda la app) — para que se vean bien
    // sin achicar a los equipos reales de otras plantas.
    const ESCALA_EQUIPO_DEMO = 1.3;

    // "Ley" de espaciado: TODAS las distancias (entre equipos, del equipo al
    // borde del cuadro de su ubicación, y entre ubicaciones vecinas) salen
    // del tamaño REAL del ícono dominante (motor/bomba son el 90% de esta
    // composición) multiplicado por un factor — así se usan los espacios de
    // forma consistente, en vez de mezclar números sueltos elegidos a ojo.
    const iconoTipico = SCADA_ICONOS.motor;
    const anchoTipico = iconoTipico.anchoBase * ESCALA_EQUIPO_DEMO;
    const altoTipico = iconoTipico.altoBase * ESCALA_EQUIPO_DEMO;
    const MAX_POR_FILA = 3;
    const PASO_H = Math.round(anchoTipico * 2); // separación centro-a-centro entre equipos de una fila
    const PASO_V = Math.round(altoTipico + 30); // + lugar para el TAG debajo del ícono, por si hace falta una 2ª fila
    const PAD_ZONA_APROX = 40; // espeja PAD_ZONA de PortalSCADA.js — margen del cuadro punteado de la ubicación
    const GAP_ENTRE_UBICACIONES = Math.round(anchoTipico); // separación entre los cuadros de dos ubicaciones vecinas: un ancho de ícono

    const AREA_COLS = 4;
    const AREA_CELL_ANCHO = PASO_H * (MAX_POR_FILA - 1) + PAD_ZONA_APROX * 2 + GAP_ENTRE_UBICACIONES;
    // Con 500 equipos sobre 200 ubicaciones ninguna pasa de MAX_POR_FILA (ver
    // el reparto más abajo), así que en la práctica siempre quedan en una
    // sola fila — se deja el término de PASO_V igual por si el día de mañana
    // cambia la mezcla y alguna ubicación necesita una 2ª fila.
    const AREA_CELL_ALTO = PAD_ZONA_APROX * 2 + 18 + GAP_ENTRE_UBICACIONES;
    const sectores = [];
    const areas = [];
    const baseDeArea = {}; // areaId -> {x, y}, esquina de su celda dentro del sector
    for (let s = 1; s <= NUM_SECTORES; s++) {
      const sectorId = `${plantaId}_sector${s}`;
      sectores.push({ id: sectorId, plantaId, nombre: `Sector ${s}` });
      for (let a = 1; a <= AREAS_POR_SECTOR; a++) {
        const nUbicacion = (s - 1) * AREAS_POR_SECTOR + a;
        const areaId = `${plantaId}_area${nUbicacion}`;
        areas.push({ id: areaId, plantaId, sectorId, nombre: `Ubicación ${nUbicacion}` });
        const posEnSector = a - 1;
        baseDeArea[areaId] = { x: (posEnSector % AREA_COLS) * AREA_CELL_ANCHO, y: Math.floor(posEnSector / AREA_COLS) * AREA_CELL_ALTO };
      }
    }

    // 500 equipos repartidos en las 200 ubicaciones. "Reductor" no es todavía
    // un tipo del catálogo (scadaIconos.js) — se usa "tanque" en su lugar
    // para no crear equipos con un tipo sin ícono.
    const composicion = [
      { tipo: 'motor', cantidad: 300, prefijo: 'Motor' },
      { tipo: 'bomba', cantidad: 150, prefijo: 'Bomba' },
      { tipo: 'tanque', cantidad: 50, prefijo: 'Tanque' },
    ];
    const equipos = [];
    const contadorPorArea = {};
    let indiceArea = 0;
    composicion.forEach(({ tipo, cantidad, prefijo }) => {
      for (let i = 1; i <= cantidad; i++) {
        const area = areas[indiceArea % areas.length];
        indiceArea += 1;
        const n = contadorPorArea[area.id] || 0;
        contadorPorArea[area.id] = n + 1;
        const col = n % MAX_POR_FILA;
        const fila = Math.floor(n / MAX_POR_FILA);
        const base = baseDeArea[area.id];
        equipos.push({
          id: nuevoId('eq'),
          areaId: area.id,
          tag: `${prefijo} ${i}`,
          tipo,
          descripcion: '',
          posicion: { x: base.x + 40 + col * PASO_H, y: base.y + 40 + fila * PASO_V },
          escalaPropia: ESCALA_EQUIPO_DEMO,
        });
      }
    });

    const severidadesPonderadas = ['normal', 'normal', 'normal', 'normal', 'observacion', 'observacion', 'alerta', 'alarma'];
    const diagnosticos = [];
    equipos.forEach((eq) => {
      if (Math.random() < 0.7) {
        diagnosticos.push({
          id: nuevoId('diag'),
          equipoId: eq.id,
          severidad: severidadesPonderadas[Math.floor(Math.random() * severidadesPonderadas.length)],
          modoFalla: null,
          diagnosticoTexto: 'Dato de demostración generado para probar la Vista de Sectores a gran escala.',
          recomendacionTexto: '',
          fechaHora: new Date().toISOString(),
          usuario: USUARIO_ACTUAL,
        });
      }
    });

    setData((d) => ({
      ...d,
      plantas: [...d.plantas, { id: plantaId, nombre: `Planta Demo (${equipos.length} equipos)` }],
      sectores: [...(d.sectores || []), ...sectores],
      areas: [...d.areas, ...areas],
      equipos: [...d.equipos, ...equipos],
      diagnosticos: [...d.diagnosticos, ...diagnosticos],
    }));
    return plantaId;
  }, []);

  // La validación de nombre/clave única vive en el formulario (Administración),
  // igual que crearEquipo: esta acción solo agrega el tipo tal como llega.
  const crearTipoPersonalizado = useCallback((tipoData) => {
    const id = nuevoId('tipo');
    setData((d) => ({ ...d, tiposPersonalizados: [...(d.tiposPersonalizados || []), { id, ...tipoData }] }));
    return id;
  }, []);

  // Edita un tipo personalizado ya creado (nombre/tamaño/formas/puertos) — la
  // `clave` NO se toca acá: ya la usan los equipos existentes de ese tipo
  // (eq.tipo) y cambiarla los dejaría apuntando a un tipo que ya no existe.
  const actualizarTipoPersonalizado = useCallback((id, cambios) => {
    setData((d) => ({
      ...d,
      tiposPersonalizados: (d.tiposPersonalizados || []).map((t) => (t.id === id ? { ...t, ...cambios, clave: t.clave } : t)),
    }));
  }, []);

  // Conexiones = flechas de flujo entre equipos, editadas desde el Portal SCADA.
  // Puramente visuales/informativas por ahora (no representan un dato de proceso
  // consultable en otras pantallas), tal como se acordó al construirlas.
  const crearConexion = useCallback((plantaId, deId, aId) => {
    if (deId === aId) return;
    const id = nuevoId('conexion');
    setData((d) => {
      const yaExiste = d.conexiones.some((c) => c.plantaId === plantaId && c.deId === deId && c.aId === aId);
      if (yaExiste) return d;
      return { ...d, conexiones: [...d.conexiones, { id, plantaId, deId, aId }] };
    });
    return id;
  }, []);

  const eliminarConexion = useCallback((id) => {
    setData((d) => ({ ...d, conexiones: d.conexiones.filter((c) => c.id !== id) }));
  }, []);

  // Ajustes manuales de una conexión: puertoDe/puertoA (fijan qué puerto usar
  // en cada extremo en vez de elegirlo automáticamente por dirección) y
  // quiebreManual (desplaza a mano el tramo medio del ruteo ortogonal). Se
  // editan arrastrando la conexión en el Portal SCADA.
  const actualizarConexion = useCallback((id, cambios) => {
    setData((d) => ({
      ...d,
      conexiones: d.conexiones.map((c) => (c.id === id ? { ...c, ...cambios } : c)),
    }));
  }, []);

  return {
    data,
    usuarioActual: USUARIO_ACTUAL,
    esDuplicadoReciente,
    crearDiagnostico,
    solicitarAviso,
    resetearDatos,
    crearPlanta,
    crearArea,
    generarPlantaDePrueba,
    crearEquipo,
    moverEquipo,
    renombrarEquipo,
    duplicarEquipo,
    cambiarEscalaTipo,
    cambiarEscalaEquipo,
    moverTituloArea,
    moverEtiquetaEquipo,
    reunirEquiposDispersos,
    compactarPlanta,
    crearTipoPersonalizado,
    actualizarTipoPersonalizado,
    crearConexion,
    eliminarConexion,
    actualizarConexion,
  };
}
