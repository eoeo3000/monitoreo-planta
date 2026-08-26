import { useCallback, useEffect, useState } from 'react';
import { SEED_LEVELS, SEED_EQUIPMENT } from './data';

const STORAGE_KEY = 'monitoreo-planta-data-v1';

function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    // localStorage no disponible o datos corruptos: usamos el set inicial
  }
  return { levels: SEED_LEVELS, equipment: SEED_EQUIPMENT };
}

export function usePlantData() {
  const [data, setData] = useState(loadInitial);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      // almacenamiento lleno o no disponible: se pierde persistencia mas no la sesión actual
    }
  }, [data]);

  const addLevel = useCallback((name) => {
    const id = `level_${Date.now()}`;
    setData((d) => ({ ...d, levels: [...d.levels, { id, name }] }));
    return id;
  }, []);

  const addEquipment = useCallback((levelId, tipo, position, label) => {
    const id = `eq_${Date.now()}`;
    setData((d) => ({
      ...d,
      equipment: [
        ...d.equipment,
        {
          id,
          tipo,
          levelId,
          position,
          label: label || tipo,
          status: 'operativo',
          fichaTecnica: {
            marca: '',
            modelo: '',
            numeroSerie: '',
            fechaInstalacion: '',
            ubicacion: '',
          },
          historial: [],
        },
      ],
    }));
    return id;
  }, []);

  const updateEquipmentPosition = useCallback((id, position) => {
    setData((d) => ({
      ...d,
      equipment: d.equipment.map((eq) =>
        eq.id === id ? { ...eq, position } : eq
      ),
    }));
  }, []);

  const updateFichaTecnica = useCallback((id, fichaTecnica) => {
    setData((d) => ({
      ...d,
      equipment: d.equipment.map((eq) =>
        eq.id === id
          ? { ...eq, fichaTecnica: { ...eq.fichaTecnica, ...fichaTecnica } }
          : eq
      ),
    }));
  }, []);

  const addInforme = useCallback((equipmentId, informe) => {
    setData((d) => ({
      ...d,
      equipment: d.equipment.map((eq) => {
        if (eq.id !== equipmentId) return eq;
        const entry = {
          id: `inf_${Date.now()}`,
          fecha: new Date().toISOString(),
          ...informe,
        };
        return { ...eq, status: informe.estado, historial: [entry, ...eq.historial] };
      }),
    }));
  }, []);

  const deleteEquipment = useCallback((id) => {
    setData((d) => ({
      ...d,
      equipment: d.equipment.filter((eq) => eq.id !== id),
    }));
  }, []);

  const renameEquipment = useCallback((id, label) => {
    setData((d) => ({
      ...d,
      equipment: d.equipment.map((eq) => (eq.id === id ? { ...eq, label } : eq)),
    }));
  }, []);

  return {
    data,
    addLevel,
    addEquipment,
    updateEquipmentPosition,
    updateFichaTecnica,
    addInforme,
    deleteEquipment,
    renameEquipment,
  };
}
