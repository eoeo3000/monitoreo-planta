import React from 'react';
import { SEVERIDAD, colorDeSeveridad } from '../../analista/severidad';
import Blueprint from '../../theme/Blueprint';

function fmt(iso) {
  try {
    return new Date(iso).toLocaleString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    return iso;
  }
}

const kicker = { fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-neutral-600)' };

export default function HistorialDetalleModal({ diagnostico, aviso, onClose }) {
  const color = colorDeSeveridad(diagnostico.severidad);

  return (
    <div className="dialog-backdrop" onClick={onClose} style={{ zIndex: 100 }}>
      <Blueprint
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(560px, 100%)',
          background: 'var(--color-bg)',
          padding: 'var(--space-6)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
          maxHeight: '88vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)' }}>
          <div>
            <div style={{ ...kicker, letterSpacing: '0.16em', color: 'var(--color-accent-700)' }}>{fmt(diagnostico.fechaHora)}</div>
            <h3 style={{ fontSize: 26, margin: 0 }}>Detalle de diagnóstico</h3>
          </div>
          <button className="btn btn-icon btn-secondary" onClick={onClose} style={{ marginLeft: 'auto' }}>✕</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', border: `1px solid ${color}`, padding: 'var(--space-2) var(--space-3)' }}>
          <span style={{ width: 10, height: 10, background: color }} />
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: 18, letterSpacing: '0.04em', textTransform: 'uppercase', color }}>
            {SEVERIDAD[diagnostico.severidad].label}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-neutral-600)' }}>{diagnostico.usuario}</span>
        </div>

        <div style={{ display: 'grid', gap: 'var(--space-4)', fontSize: 14 }}>
          <div>
            <div style={{ ...kicker, marginBottom: 2 }}>Modo de falla</div>
            <div>{diagnostico.modoFalla || '—'}</div>
          </div>
          <div>
            <div style={{ ...kicker, marginBottom: 2 }}>Diagnóstico</div>
            <div style={{ textWrap: 'pretty' }}>{diagnostico.diagnosticoTexto}</div>
          </div>
          <div>
            <div style={{ ...kicker, marginBottom: 2 }}>Recomendación</div>
            <div style={{ textWrap: 'pretty' }}>{diagnostico.recomendacionTexto || '—'}</div>
          </div>
          <div>
            <div style={{ ...kicker, marginBottom: 2 }}>Aviso asociado</div>
            <div>{aviso ? `${aviso.numeroSap || 'Solicitud sin número SAP'} (${aviso.estado})` : 'Sin aviso asociado'}</div>
          </div>
        </div>
      </Blueprint>
    </div>
  );
}
