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
    crearEquipo,
    moverEquipo,
    renombrarEquipo,
    duplicarEquipo,
    cambiarEscalaTipo,
    cambiarEscalaEquipo,
    moverTituloArea,
    crearTipoPersonalizado,
    actualizarTipoPersonalizado,
    crearConexion,
    eliminarConexion,
    actualizarConexion,
  };
}
