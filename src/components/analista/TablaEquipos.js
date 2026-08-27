import React, { useMemo, useState } from 'react';
import { condicionActual } from '../../analista/store';
import { SEVERIDAD } from '../../analista/severidad';

const kicker = { fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-neutral-600)' };

function fmt(iso) {
  try {
    return new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return iso;
  }
}

// Vista de triage: busca/filtra equipos y permite cargar diagnósticos sin perder el
// listado (doble clic abre el mismo formulario que la vista de Árbol, en un modal).
export default function TablaEquipos({ data, onAbrirEquipo, color }) {
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

  return (
    <div style={{ padding: 'var(--space-6) var(--space-8)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', marginBottom: 'var(--space-4)', alignItems: 'flex-end' }}>
        <label className="field" style={{ minWidth: 180 }}>
          <span style={kicker}>Planta</span>
          <select
            className="input"
            value={plantaId}
            onChange={(e) => {
              setPlantaId(e.target.value);
              setAreaId('todas');
            }}
          >
            <option value="todas">Todas</option>
            {data.plantas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="field" style={{ minWidth: 180 }}>
          <span style={kicker}>Área</span>
          <select className="input" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
            <option value="todas">Todas</option>
            {areasDisponibles.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="field" style={{ minWidth: 180 }}>
          <span style={kicker}>Tipo de equipo</span>
          <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="todos">Todos</option>
            {tiposDisponibles.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <span style={{ fontSize: 12, color: 'var(--color-neutral-600)', marginLeft: 'auto' }}>
          {equiposFiltrados.length} equipo{equiposFiltrados.length === 1 ? '' : 's'} · doble clic en una fila para cargar datos
        </span>
      </div>

      <table className="table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th style={{ width: 120 }}>TAG</th>
            <th style={{ width: 180 }}>Área</th>
            <th style={{ width: 140 }}>Tipo</th>
            <th style={{ width: 150 }}>Condición</th>
            <th style={{ width: 220 }}>Modo de falla</th>
            <th style={{ width: 170 }}>Última actualización</th>
            <th>Avisos abiertos</th>
          </tr>
        </thead>
        <tbody>
          {equiposFiltrados.map((eq) => {
            const cond = condicionActual(eq.id, data.diagnosticos);
            const area = data.areas.find((a) => a.id === eq.areaId);
            const avisosAbiertos = data.avisos.filter((a) => a.equipoId === eq.id && a.estado !== 'cerrado').length;
            return (
              <tr key={eq.id} className="sev-row" onDoubleClick={() => onAbrirEquipo(eq.id)} style={{ cursor: 'pointer' }}>
                <td style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.04em' }}>{eq.tag}</td>
                <td>{area?.nombre}</td>
                <td style={{ textTransform: 'uppercase', fontSize: 12, color: 'var(--color-neutral-600)' }}>{eq.tipo}</td>
                <td>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-heading)', letterSpacing: '0.03em', color: cond ? color(cond.severidad) : 'var(--color-neutral-400)' }}>
                    <span style={{ width: 7, height: 7, background: cond ? color(cond.severidad) : 'var(--color-neutral-300)' }} />
                    {cond ? SEVERIDAD[cond.severidad].label : 'Sin diagnóstico'}
                  </span>
                </td>
                <td>{cond?.modoFalla || '—'}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{cond ? fmt(cond.fechaHora) : '—'}</td>
                <td>{avisosAbiertos}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
