import { useMemo, useState } from 'react';

// Filtro Planta/Área/Tipo compartido entre la tabla de equipos, el histórico de
// diagnósticos y el dashboard, para que cambiar de vista no pierda el contexto.
export function useFiltroEquipos(data) {
  const [plantaId, setPlantaId] = useState('todas');
  const [areaId, setAreaId] = useState('todas');
  const [tipo, setTipo] = useState('todos');

  const areasDisponibles = plantaId === 'todas' ? data.areas : data.areas.filter((a) => a.plantaId === plantaId);
  const tiposDisponibles = useMemo(() => Array.from(new Set(data.equipos.map((eq) => eq.tipo))).sort(), [data.equipos]);

  const equiposFiltrados = useMemo(() => {
    return data.equipos.filter((eq) => {
      const area = data.areas.find((a) => a.id === eq.areaId);
      if (plantaId !== 'todas' && area?.plantaId !== plantaId) return false;
      if (areaId !== 'todas' && eq.areaId !== areaId) return false;
      if (tipo !== 'todos' && eq.tipo !== tipo) return false;
      return true;
    });
  }, [data.equipos, data.areas, plantaId, areaId, tipo]);

  const setPlanta = (id) => {
    setPlantaId(id);
    setAreaId('todas');
  };

  const etiqueta = () => {
    const partes = [];
    if (plantaId !== 'todas') partes.push(data.plantas.find((p) => p.id === plantaId)?.nombre);
    if (areaId !== 'todas') partes.push(data.areas.find((a) => a.id === areaId)?.nombre);
    if (tipo !== 'todos') partes.push(tipo);
    return partes.length ? partes.join(' · ') : 'Todos los equipos';
  };

  return {
    plantaId,
    areaId,
    tipo,
    setPlantaId: setPlanta,
    setAreaId,
    setTipo,
    areasDisponibles,
    tiposDisponibles,
    equiposFiltrados,
    etiquetaFiltro: etiqueta(),
  };
}
