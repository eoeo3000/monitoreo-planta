import React, { useMemo } from 'react';
import { condicionActual } from '../../analista/store';
import { SEVERIDAD, SEVERIDAD_ORDEN } from '../../analista/severidad';
import Blueprint from '../../theme/Blueprint';

const kicker = { fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-neutral-600)' };
const kickerAccent = { ...kicker, letterSpacing: '0.16em', color: 'var(--color-accent-700)' };

function KpiTile({ titulo, valor, colorValor }) {
  return (
    <Blueprint as="section" style={{ padding: 'var(--space-4)', flex: 1, minWidth: 160 }}>
      <div style={kicker}>{titulo}</div>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 24, lineHeight: 1.1, color: colorValor || 'var(--color-text)' }}>{valor}</div>
    </Blueprint>
  );
}

// Barras horizontales por severidad. Los colores son el "status palette" fijo del
// sistema (SEVERIDAD, sección 3 del documento fuente) — no una paleta categórica
// nueva, así que no aplica el validador de paleta de la skill de dataviz; el ancho
// de cada barra es magnitud (conteo), el color identifica el estado, y el conteo
// va siempre como etiqueta directa (nunca solo color). Sin bordes redondeados,
// consistente con el resto del sistema visual (handoff §1: "esquinas rectas").
function BarraSeveridad({ conteos, maxConteo }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {SEVERIDAD_ORDEN.map((key) => {
        const cfg = SEVERIDAD[key];
        const cantidad = conteos[key] || 0;
        const ancho = maxConteo > 0 ? Math.max(2, (cantidad / maxConteo) * 100) : 0;
        return (
          <div key={key} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 32px', alignItems: 'center', gap: 'var(--space-3)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <span style={{ width: 8, height: 8, background: cfg.color, flexShrink: 0 }} />
              {cfg.label}
            </span>
            <div style={{ background: 'var(--color-neutral-200)', height: 14 }}>
              <div style={{ width: `${ancho}%`, height: '100%', background: cfg.color }} title={`${cfg.label}: ${cantidad}`} />
            </div>
            <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, textAlign: 'right' }}>{cantidad}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard({ data, filtro }) {
  const { equiposFiltrados, etiquetaFiltro } = filtro;

  const { conteos, sinDiagnostico, avisosAbiertos } = useMemo(() => {
    const conteos = { normal: 0, observacion: 0, alerta: 0, alarma: 0 };
    let sinDiagnostico = 0;
    equiposFiltrados.forEach((eq) => {
      const cond = condicionActual(eq.id, data.diagnosticos);
      if (cond) conteos[cond.severidad] = (conteos[cond.severidad] || 0) + 1;
      else sinDiagnostico += 1;
    });
    const idsFiltrados = new Set(equiposFiltrados.map((eq) => eq.id));
    const avisosAbiertos = data.avisos.filter((a) => idsFiltrados.has(a.equipoId) && a.estado !== 'cerrado').length;
    return { conteos, sinDiagnostico, avisosAbiertos };
  }, [equiposFiltrados, data.diagnosticos, data.avisos]);

  const maxConteo = Math.max(...SEVERIDAD_ORDEN.map((k) => conteos[k] || 0), 1);

  return (
    <div style={{ padding: 'var(--space-4) var(--space-6)' }}>
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <div style={kicker}>Filtro activo</div>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 16 }}>{etiquetaFiltro}</div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
        <KpiTile titulo="Total equipos" valor={equiposFiltrados.length} />
        <KpiTile titulo="Sin diagnóstico" valor={sinDiagnostico} colorValor={sinDiagnostico > 0 ? 'var(--color-neutral-600)' : undefined} />
        <KpiTile titulo="Avisos abiertos" valor={avisosAbiertos} colorValor={avisosAbiertos > 0 ? SEVERIDAD.alerta.color : undefined} />
      </div>

      <Blueprint as="section" style={{ padding: 'var(--space-4)', maxWidth: 560 }}>
        <div style={kickerAccent}>Condición actual</div>
        <h3 style={{ fontSize: 20, margin: '0 0 var(--space-4)' }}>Distribución por severidad</h3>
        <BarraSeveridad conteos={conteos} maxConteo={maxConteo} />
      </Blueprint>
    </div>
  );
}
