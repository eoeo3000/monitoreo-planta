import { useCallback, useEffect, useState } from 'react';
import { SEED_PLANTAS, SEED_AREAS, SEED_EQUIPOS, SEED_DIAGNOSTICOS, SEED_AVISOS, SEED_CONEXIONES } from './mockData';

const STORAGE_KEY = 'condicion-activos-analista-v6';
const USUARIO_ACTUAL = 'analista.demo'; // sin autenticación real todavía
const POSICION_DEFAULT = { x: 80, y: 80 };

function datosSemilla() {
  return {
    plantas: SEED_PLANTAS,
    areas: SEED_AREAS,
    equipos: SEED_EQUIPOS,
    diagnosticos: SEED_DIAGNOSTICOS,
    avisos: SEED_AVISOS,
    evidencias: [],
    conexiones: SEED_CONEXIONES,
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
    const id = `diag_${Date.now()}`;
    const nuevo = {
      id,
      equipoId,
      fechaHora: new Date().toISOString(),
      usuario: USUARIO_ACTUAL,
      ...diagnosticoData,
    };
    const evidencias = evidenciasPendientes.map((ev, i) => ({
      id: `ev_${Date.now()}_${i}`,
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
      const diagnosticoId = `diag_${Date.now()}`;
      const diagnostico = {
        id: diagnosticoId,
        equipoId,
        fechaHora: new Date().toISOString(),
        usuario: USUARIO_ACTUAL,
        ...diagnosticoData,
      };
      const aviso = {
        id: `aviso_${Date.now()}`,
        equipoId,
        diagnosticoOrigenId: diagnosticoId,
        numeroSap: null,
        estado: 'solicitud',
        ...avisoData,
      };
      const evidencias = evidenciasPendientes.map((ev, i) => ({
        id: `ev_${Date.now()}_${i}`,
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
    const id = `planta_${Date.now()}`;
    setData((d) => ({ ...d, plantas: [...d.plantas, { id, nombre }] }));
    return id;
  }, []);

  const crearArea = useCallback((plantaId, nombre) => {
    const id = `area_${Date.now()}`;
    setData((d) => ({ ...d, areas: [...d.areas, { id, plantaId, nombre }] }));
    return id;
  }, []);

  const crearEquipo = useCallback((areaId, { tag, tipo, descripcion }) => {
    const id = `eq_${Date.now()}`;
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

  // Conexiones = flechas de flujo entre equipos en el editor de Planta. Puramente
  // visuales/informativas por ahora (no representan un dato de proceso consultable
  // en otras pantallas), tal como se acordó al construirlas.
  const crearConexion = useCallback((plantaId, deId, aId) => {
    if (deId === aId) return;
    const id = `conexion_${Date.now()}`;
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
    crearConexion,
    eliminarConexion,
  };
}
