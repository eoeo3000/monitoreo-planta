import { useCallback, useEffect, useState } from 'react';
import { SEED_PLANTAS, SEED_AREAS, SEED_EQUIPOS, SEED_DIAGNOSTICOS, SEED_AVISOS, SEED_CONEXIONES } from './mockData';

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

  const crearEquipo = useCallback((areaId, { tag, tipo, descripcion }) => {
    const id = nuevoId('eq');
    setData((d) => ({
      ...d,
      equipos: [
        ...d.equipos,
        { id, areaId, tag, tipo, descripcion: descripcion || '', posicion: { ...POSICION_DEFAULT } },
      ],
    }));
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
    // El Portal SCADA dibuja todos los equipos de un sector en un único
    // lienzo compartido, así que cada ubicación necesita su propia celda de
    // coordenadas — si no, los equipos de las 20 ubicaciones de un sector
    // terminan todos superpuestos en el mismo puñado de posiciones.
    // Una ubicación con 3 equipos en fila ocupa hasta ~420 unidades de ancho
    // (ver cajaEquiposDeArea en PortalSCADA.js: PAD_ZONA=70 de cada lado) —
    // la celda tiene que ser más ancha que eso para que los cuadros
    // punteados de ubicaciones vecinas no se toquen. Con 4 columnas, un
    // sector completo de 20 ubicaciones queda algo más ancho que el lienzo
    // fijo (1400): entra haciendo un zoom-out leve, a cambio de que los
    // equipos se vean a buen tamaño y bien separados.
    const AREA_COLS = 4;
    const AREA_CELL_ANCHO = 520;
    const AREA_CELL_ALTO = 200;
    // Tamaño propio de cada equipo de la demo (independiente de
    // escalasPorTipo, que es global a toda la app) — para que se vean bien
    // sin achicar a los equipos reales de otras plantas.
    const ESCALA_EQUIPO_DEMO = 1.3;
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
        const col = n % 3;
        const fila = Math.floor(n / 3);
        const base = baseDeArea[area.id];
        equipos.push({
          id: nuevoId('eq'),
          areaId: area.id,
          tag: `${prefijo} ${i}`,
          tipo,
          descripcion: '',
          posicion: { x: base.x + 40 + col * 160, y: base.y + 40 + fila * 140 },
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
    crearTipoPersonalizado,
    actualizarTipoPersonalizado,
    crearConexion,
    eliminarConexion,
    actualizarConexion,
  };
}
