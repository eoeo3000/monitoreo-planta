import { useCallback, useEffect, useState } from 'react';
import { SEED_PLANTAS, SEED_AREAS, SEED_EQUIPOS, SEED_DIAGNOSTICOS, SEED_AVISOS, SEED_CONEXIONES } from './mockData';
import { SCADA_ICONOS } from '../gerencia/scadaIconos';

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
    // Multiplicador de escala por tipo, POR PLANTA: { plantaId: { tipo: n } }.
    // Vacío significa "tamaño de fábrica (x1)". Se edita desde el panel
    // "Tamaños de equipo" del Editor de planta.
    //
    // Era una tabla global a toda la app, y eso confundía de una forma
    // concreta: se subía "tanque" mirando una planta y todas las demás
    // cambiaban de tamaño sin avisar. Al volver a mirar la otra, el doble
    // clic informaba el mismo número —porque era el mismo— y parecía que
    // dos plantas con parámetros idénticos se veían distinto.
    escalasPorPlanta: {},
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

// Migración de una sola pasada al leer: hasta ahora el compactado escribía
// su resultado DENTRO de eq.escalaPropia y lo marcaba con eq.escalaAuto.
// Eso dejaba a toda planta compactada sorda al panel "Tamaños de equipo",
// porque un valor propio en cada equipo le gana al del tipo. Ahora el factor
// que pone la app vive aparte, en eq.factorAuto, y escalaPropia queda solo
// para lo que eligió el usuario (ver escalaVisible en iconos.js).
//
// Se exporta para poder probarla: es la parte con más riesgo de este cambio
// —toca datos ya guardados de los que no hay copia— y conviene tenerla
// cubierta y no solo leída.
// Los tamaños por tipo eran una tabla global; ahora son de cada planta. Lo
// guardado se copia TAL CUAL a todas las plantas existentes, así ninguna
// cambia de aspecto al actualizar; después la tabla global se borra para que
// no queden dos fuentes de verdad.
// Los tamaños por tipo son de cada planta, pero todo el layout los lee de
// `data.escalasPorTipo` (escalaVisible, escalaDeCatalogo, buscarMejorAncho…).
// En vez de pasarle el plantaId a media docena de funciones de geometría,
// cada pantalla resuelve la tabla UNA vez y trabaja con estos datos: los
// mismos de siempre, con la tabla de SU planta puesta donde el layout la
// busca. Hay que memoizarlo, porque devuelve un objeto nuevo.
export function datosDePlanta(data, plantaId) {
  return { ...data, escalasPorTipo: data?.escalasPorPlanta?.[plantaId] || {} };
}

export function migrarEscalasPorPlanta(d) {
  if (!d || !Array.isArray(d.plantas)) return d;
  if (d.escalasPorPlanta) return d; // ya migrado
  const global = d.escalasPorTipo || {};
  const porPlanta = {};
  d.plantas.forEach((p) => { porPlanta[p.id] = { ...global }; });
  const { escalasPorTipo, ...resto } = d;
  return { ...resto, escalasPorPlanta: porPlanta };
}

export function migrarEscalas(d) {
  if (!d || !Array.isArray(d.equipos)) return d;
  const equipos = d.equipos.map((eq) => {
    if (eq.factorAuto !== undefined) return eq; // ya migrado
    if (eq.escalaPropia === undefined || eq.escalaPropia === null) return eq;
    const { escalaAuto, ...resto } = eq;
    // Con marca y un valor que ya no coincide, el usuario lo cambió a mano
    // después de compactar: su tamaño se respeta tal cual.
    if (escalaAuto != null && Math.abs(eq.escalaPropia - escalaAuto) > 0.005) return resto;
    // Lo demás lo escribió la app: la compactada anterior, o el generador de
    // la planta demo (que fijaba un tamaño propio en cada equipo por el
    // mismo motivo). Sin marca también cuenta como suyo — es el criterio que
    // ya usaba escalaDeCatalogo con los datos viejos. Se pasa a factorAuto
    // el factor respecto del tamaño del tipo, así lo que se ve no cambia.
    const delTipo = d.escalasPorTipo?.[eq.tipo] ?? 1;
    const { escalaPropia, ...sinPropia } = resto;
    return { ...sinPropia, factorAuto: escalaPropia / (delTipo || 1) };
  });
  return { ...d, equipos };
}

function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    // Orden: primero la de factorAuto, que todavía lee la tabla GLOBAL, y
    // recién después la que la reparte por planta.
    if (raw) return migrarEscalasPorPlanta(migrarEscalas(JSON.parse(raw)));
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
      // Sin posicionPropia: la copia entra al layout calculado en vez de
      // nacer pegada encima del original con su mismo override.
      const { posicionPropia, ...sinOverride } = original;
      const copia = { ...sinOverride, id, posicion: { x: posBase.x + 40, y: posBase.y + 40 } };
      return { ...d, equipos: [...d.equipos, copia] };
    });
    return id;
  }, []);

  const cambiarEscalaTipo = useCallback((plantaId, tipo, escala) => {
    if (!plantaId) return;
    setData((d) => ({
      ...d,
      escalasPorPlanta: { ...d.escalasPorPlanta, [plantaId]: { ...(d.escalasPorPlanta?.[plantaId] || {}), [tipo]: escala } },
    }));
  }, []);

  // Sube o baja el multiplicador de un tipo. Va por DELTA y no por valor
  // final a propósito: los botones ± calculaban el nuevo valor a partir del
  // que tenían dibujado, así que dos clics seguidos antes de que React
  // re-renderizara partían los dos del mismo número y el segundo pisaba al
  // primero — medido, 5 clics movían de 1.00 a 1.10 en vez de a 1.50.
  // Leyendo el valor acá adentro, cada clic parte del anterior.
  const ajustarEscalaTipo = useCallback((plantaId, tipo, delta, { min = 0.3, max = 4 } = {}) => {
    if (!plantaId) return;
    setData((d) => {
      const dePlanta = d.escalasPorPlanta?.[plantaId] || {};
      const actual = dePlanta[tipo] ?? 1;
      const nueva = Math.min(max, Math.max(min, Math.round((actual + delta) * 100) / 100));
      return { ...d, escalasPorPlanta: { ...d.escalasPorPlanta, [plantaId]: { ...dePlanta, [tipo]: nueva } } };
    });
  }, []);

  // Posición puesta a mano en el Editor de planta, POR ENCIMA de la que
  // calcula el escalonado. Mismo idioma que las escalas: el layout propone y
  // el usuario puede pisar un caso puntual sin dejar de recalcular el resto.
  // Guardar la posición calculada de todos los equipos sería lo contrario —
  // congelaría el layout y volvería a atarnos a posiciones almacenadas.
  const moverEquipoPropio = useCallback((equipoId, posicion) => {
    setData((d) => ({
      ...d,
      equipos: d.equipos.map((eq) => {
        if (eq.id !== equipoId) return eq;
        if (posicion) return { ...eq, posicionPropia: posicion };
        const { posicionPropia, ...resto } = eq;
        return resto;
      }),
    }));
  }, []);

  // Devuelve la planta al layout calculado: borra las posiciones puestas a
  // mano y los desplazamientos de título y TAG, que son relativos a ellas.
  const restablecerPosiciones = useCallback((plantaId) => {
    setData((d) => {
      const areaIds = d.areas.filter((a) => a.plantaId === plantaId).map((a) => a.id);
      const equipos = d.equipos.map((eq) => {
        if (!areaIds.includes(eq.areaId)) return eq;
        const { posicionPropia, ...resto } = eq;
        return resto;
      });
      const areas = d.areas.map((a) => (areaIds.includes(a.id) ? { ...a, tituloOffset: undefined } : a));
      return { ...d, equipos, areas };
    });
  }, []);

  // Tamaño de UN equipo en particular (doble clic), por encima del tamaño
  // del tipo — null quita la sobrescritura y vuelve a usar el tamaño del tipo.
  const cambiarEscalaEquipo = useCallback((equipoId, escala) => {
    setData((d) => ({
      ...d,
      equipos: d.equipos.map((eq) => (eq.id === equipoId ? { ...eq, escalaPropia: escala } : eq)),
    }));
  }, []);

  // Borra los tamaños guardados equipo por equipo en una planta: tanto los
  // que puso el usuario a mano (escalaPropia) como el factor que dejó el
  // compactado (factorAuto). La planta vuelve a las proporciones del
  // catálogo, con el multiplicador por tipo como único ajuste.
  //
  // Es la salida masiva que faltaba: sin esto, deshacer un tamaño
  // equivocado era equipo por equipo, y en la planta demo son 500. NO toca
  // los multiplicadores por tipo de la planta: son otro ajuste, con su
  // propio botón, y borrar los dos de un saque sería más de lo que dice el
  // aviso.
  const restablecerTamanios = useCallback((plantaId) => {
    setData((d) => {
      const areaIds = d.areas.filter((a) => a.plantaId === plantaId).map((a) => a.id);
      const equipos = d.equipos.map((eq) => {
        if (!areaIds.includes(eq.areaId)) return eq;
        const { escalaPropia, escalaAuto, factorAuto, ...resto } = eq;
        return resto;
      });
      return { ...d, equipos };
    });
  }, []);

  // Posición del título de una zona (área) del Portal SCADA — desplazamiento
  // a mano sobre el punto por defecto, para cuando queda mal ubicado.
  const moverTituloArea = useCallback((areaId, tituloOffset) => {
    setData((d) => ({
      ...d,
      areas: d.areas.map((a) => (a.id === areaId ? { ...a, tituloOffset } : a)),
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

  // NOTA: acá vivían compactarPlanta y acomodarEnFlujo, que escribían
  // eq.posicion. Se fueron con el Portal: en el Editor de planta la posición
  // la CALCULA el escalonado en cada render, y lo único que se guarda es el
  // override de un equipo movido a mano (moverEquipoPropio). Un layout
  // guardado volvería a atarnos a posiciones viejas, que es de donde venían
  // casi todos los problemas de esta parte.

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
    // Factor de tamaño de la demo, en factorAuto y no en escalaPropia: es
    // una decisión del generador, no del usuario, así que se multiplica con
    // el multiplicador por tipo en vez de bloquearlo (ver escalaVisible en
    // iconos.js). Los equipos reales de otras plantas no se ven afectados.
    const ESCALA_EQUIPO_DEMO = 1.3;

    // "Ley" de espaciado: TODAS las distancias salen del tamaño REAL de los
    // íconos, no de números sueltos elegidos a ojo.
    const ESCALA = ESCALA_EQUIPO_DEMO;
    const altoDe = (tipo) => SCADA_ICONOS[tipo].altoBase * ESCALA;
    const anchoDe = (tipo) => SCADA_ICONOS[tipo].anchoBase * ESCALA;
    const GAP_TAG = 30; // lugar para el TAG debajo de cada ícono
    const PAD_ZONA_APROX = 40; // espeja PAD_ZONA de PortalSCADA.js
    const ALTO_TITULO_APROX = 18; // espeja el alto del título de la ubicación
    const GAP_ENTRE_UBICACIONES = Math.round(anchoDe('motor'));

    const sectores = [];
    const areas = [];
    for (let sec = 1; sec <= NUM_SECTORES; sec++) {
      const sectorId = `${plantaId}_sector${sec}`;
      sectores.push({ id: sectorId, plantaId, nombre: `Sector ${sec}` });
      for (let a = 1; a <= AREAS_POR_SECTOR; a++) {
        const nUbicacion = (sec - 1) * AREAS_POR_SECTOR + a;
        areas.push({ id: `${plantaId}_area${nUbicacion}`, plantaId, sectorId, nombre: `Ubicación ${nUbicacion}` });
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

    // Primero se decide QUÉ equipo va en cada ubicación y recién después
    // DÓNDE. La columna de una ubicación mezcla tipos de alturas muy
    // distintas (un tanque mide más del triple que un motor), así que el alto
    // de celda no se puede fijar antes de saber la mezcla sin reservar de más
    // o dejar que un tanque se salga de su cuadro.
    const asignados = [];
    let indiceArea = 0;
    composicion.forEach(({ tipo, cantidad, prefijo }) => {
      for (let i = 1; i <= cantidad; i++) {
        asignados.push({ area: areas[indiceArea % areas.length], tipo, tag: `${prefijo} ${i}` });
        indiceArea += 1;
      }
    });
    const columnaDeArea = new Map();
    asignados.forEach((x) => {
      if (!columnaDeArea.has(x.area.id)) columnaDeArea.set(x.area.id, []);
      columnaDeArea.get(x.area.id).push(x);
    });
    const altoDeColumna = (col) => col.reduce((h, x) => h + altoDe(x.tipo) + GAP_TAG, 0) - GAP_TAG;
    const ALTO_MAX_COLUMNA = Math.max(...[...columnaDeArea.values()].map(altoDeColumna));
    const ANCHO_MAX_ICONO = Math.max(...composicion.map((c) => anchoDe(c.tipo)));

    // 7 columnas por sector (3 filas: 7 + 7 + 6). Al apilar los equipos en
    // columna la celda pasó a ser angosta y alta, así que la cantidad de
    // columnas decide la forma del sector: con 4 sale mucho más alto que
    // ancho y el encuadre deja dos tercios del panel vacíos; con 10, muy
    // apaisado. Medido contra un panel de proporción ~1.5, el desvío
    // |ln(proporción / panel)| da 0.54 con 5 columnas, 0.84 con 10 y 0.08
    // con 7. La última fila queda con una ubicación menos, que es más
    // parecido a una planta real que una grilla perfecta.
    const AREA_COLS = 7;
    const AREA_CELL_ANCHO = Math.round(ANCHO_MAX_ICONO + PAD_ZONA_APROX * 2 + GAP_ENTRE_UBICACIONES);
    const AREA_CELL_ALTO = Math.round(ALTO_MAX_COLUMNA + PAD_ZONA_APROX * 2 + ALTO_TITULO_APROX + GAP_ENTRE_UBICACIONES);

    const baseDeArea = {}; // areaId -> {x, y}, esquina de su celda dentro del sector
    areas.forEach((area, i) => {
      const posEnSector = i % AREAS_POR_SECTOR;
      baseDeArea[area.id] = {
        x: (posEnSector % AREA_COLS) * AREA_CELL_ANCHO,
        y: Math.floor(posEnSector / AREA_COLS) * AREA_CELL_ALTO,
      };
    });

    // Cada ubicación es una COLUMNA vertical, y el enlace entre ubicaciones
    // vecinas de una misma fila corre por arriba, a la altura del primer
    // equipo de cada una: eso dibuja un colector horizontal del que cuelgan
    // los tramos verticales de cada ubicación. Antes los equipos iban en
    // fila y todas las cañerías salían horizontales a la misma altura — el
    // conjunto se leía como una escalera, no como un proceso.
    //
    // posicion.y es el BORDE INFERIOR del ícono, así que la columna se
    // acumula sumando el alto de cada equipo antes de fijarlo, no después.
    const equipos = [];
    areas.forEach((area) => {
      const base = baseDeArea[area.id];
      let cursor = base.y + PAD_ZONA_APROX + ALTO_TITULO_APROX;
      (columnaDeArea.get(area.id) || []).forEach((x) => {
        const alto = altoDe(x.tipo);
        equipos.push({
          id: nuevoId('eq'),
          areaId: area.id,
          tag: x.tag,
          tipo: x.tipo,
          descripcion: '',
          posicion: { x: Math.round(base.x + PAD_ZONA_APROX + ANCHO_MAX_ICONO / 2), y: Math.round(cursor + alto) },
          factorAuto: ESCALA,
        });
        cursor += alto + GAP_TAG;
      });
    });

    const equiposPorArea = new Map();
    equipos.forEach((eq) => {
      if (!equiposPorArea.has(eq.areaId)) equiposPorArea.set(eq.areaId, []);
      equiposPorArea.get(eq.areaId).push(eq);
    });
    const conexiones = [];
    const conectar = (de, a) => {
      if (de && a) conexiones.push({ id: nuevoId('cx'), plantaId, deId: de.id, aId: a.id });
    };
    areas.forEach((area, i) => {
      const eqs = equiposPorArea.get(area.id) || [];
      // Tramo vertical: la columna encadenada de arriba hacia abajo.
      for (let k = 0; k < eqs.length - 1; k++) conectar(eqs[k], eqs[k + 1]);
      // Colector: el primer equipo de esta ubicación con el primero de la
      // siguiente, solo si comparten sector Y fila de la grilla. Sin la
      // condición de fila el colector saltaría de la última columna de una
      // fila a la primera de la siguiente y cruzaría todo el sector.
      const siguiente = areas[i + 1];
      const mismaFila = Math.floor((i % AREAS_POR_SECTOR) / AREA_COLS) === Math.floor((((i + 1) % AREAS_POR_SECTOR)) / AREA_COLS);
      if (siguiente && siguiente.sectorId === area.sectorId && mismaFila) {
        conectar(eqs[0], (equiposPorArea.get(siguiente.id) || [])[0]);
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
      conexiones: [...d.conexiones, ...conexiones],
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
    moverEquipoPropio,
    restablecerPosiciones,
    renombrarEquipo,
    duplicarEquipo,
    cambiarEscalaTipo,
    ajustarEscalaTipo,
    cambiarEscalaEquipo,
    restablecerTamanios,
    moverTituloArea,
    reunirEquiposDispersos,
    crearTipoPersonalizado,
    actualizarTipoPersonalizado,
    crearConexion,
    eliminarConexion,
    actualizarConexion,
  };
}
