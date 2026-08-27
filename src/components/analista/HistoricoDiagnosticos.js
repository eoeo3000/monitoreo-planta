import React, { useMemo } from 'react';
import { SEVERIDAD } from '../../analista/severidad';
import { descargarCsv } from '../../analista/exportarCsv';

const kicker = { fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-neutral-600)' };

function fmt(iso) {
  try {
    return new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return iso;
  }
}

// Listado plano de TODOS los diagnósticos (no solo el último por equipo) de los
// equipos que pasan el filtro compartido — a diferencia de la tabla de equipos,
// acá un mismo TAG puede aparecer varias veces (una fila por diagnóstico).
export default function HistoricoDiagnosticos({ data, filtro, color, onAbrirDetalle }) {
  const { equiposFiltrados, etiquetaFiltro } = filtro;

  const filas = useMemo(() => {
    const idsFiltrados = new Set(equiposFiltrados.map((eq) => eq.id));
    return data.diagnosticos
      .filter((d) => idsFiltrados.has(d.equipoId))
      .map((d) => {
        const equipo = data.equipos.find((eq) => eq.id === d.equipoId);
        const area = data.areas.find((a) => a.id === equipo?.areaId);
        const aviso = data.avisos.find((a) => a.diagnosticoOrigenId === d.id);
        return { diagnostico: d, equipo, area, aviso };
      })
      .sort((a, b) => new Date(b.diagnostico.fechaHora) - new Date(a.diagnostico.fechaHora));
  }, [data.diagnosticos, data.equipos, data.areas, data.avisos, equiposFiltrados]);

  const exportar = () => {
    descargarCsv(
      `historico-diagnosticos-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { titulo: 'Fecha', valor: (f) => fmt(f.diagnostico.fechaHora) },
        { titulo: 'TAG', valor: (f) => f.equipo?.tag },
        { titulo: 'Área', valor: (f) => f.area?.nombre },
        { titulo: 'Severidad', valor: (f) => SEVERIDAD[f.diagnostico.severidad].label },
        { titulo: 'Modo de falla', valor: (f) => f.diagnostico.modoFalla || '' },
        { titulo: 'Diagnóstico', valor: (f) => f.diagnostico.diagnosticoTexto },
        { titulo: 'Recomendación', valor: (f) => f.diagnostico.recomendacionTexto || '' },
        { titulo: 'Usuario', valor: (f) => f.diagnostico.usuario },
        { titulo: 'Aviso', valor: (f) => (f.aviso ? `${f.aviso.numeroSap || 'Solicitud'} (${f.aviso.estado})` : '') },
      ],
      filas
    );
  };

  return (
    <div style={{ padding: 'var(--space-6) var(--space-8)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
        <div>
          <div style={kicker}>Filtro activo</div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 16 }}>{etiquetaFiltro}</div>
        </div>
        <span style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>
          {filas.length} registro{filas.length === 1 ? '' : 's'}
        </span>
        <button className="btn btn-primary" onClick={exportar} disabled={filas.length === 0} style={{ marginLeft: 'auto' }}>
          Descargar CSV
        </button>
      </div>

      {filas.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-neutral-600)' }}>Sin diagnósticos para el filtro actual.</p>
      ) : (
        <table className="table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: 170 }}>Fecha</th>
              <th style={{ width: 100 }}>TAG</th>
              <th style={{ width: 160 }}>Área</th>
              <th style={{ width: 130 }}>Severidad</th>
              <th style={{ width: 190 }}>Modo de falla</th>
              <th>Diagnóstico</th>
              <th style={{ width: 120 }}>Usuario</th>
              <th style={{ width: 150 }}>Aviso</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.diagnostico.id} className="sev-row" onClick={() => onAbrirDetalle(f.diagnostico)} style={{ cursor: 'pointer' }}>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(f.diagnostico.fechaHora)}</td>
                <td style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.04em' }}>{f.equipo?.tag}</td>
                <td>{f.area?.nombre}</td>
                <td>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-heading)', letterSpacing: '0.03em', color: color(f.diagnostico.severidad) }}>
                    <span style={{ width: 7, height: 7, background: color(f.diagnostico.severidad) }} />
                    {SEVERIDAD[f.diagnostico.severidad].label}
                  </span>
                </td>
                <td>{f.diagnostico.modoFalla || '—'}</td>
                <td style={{ color: 'var(--color-neutral-700)' }}>
                  {f.diagnostico.diagnosticoTexto.length > 90 ? f.diagnostico.diagnosticoTexto.slice(0, 90) + '…' : f.diagnostico.diagnosticoTexto}
                </td>
                <td>{f.diagnostico.usuario}</td>
                <td>{f.aviso ? `${f.aviso.numeroSap || 'Solicitud'} · ${f.aviso.estado}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
