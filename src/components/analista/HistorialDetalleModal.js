import React from 'react';
import { SEVERIDAD } from '../../analista/severidad';

export default function HistorialDetalleModal({ diagnostico, aviso, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 8, padding: 24, width: 480, maxHeight: '80vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h3 style={{ marginTop: 0 }}>Detalle de diagnóstico</h3>
          <button onClick={onClose}>✕</button>
        </div>
        <span
          style={{
            display: 'inline-block',
            padding: '2px 10px',
            borderRadius: 12,
            background: SEVERIDAD[diagnostico.severidad].color,
            color: '#fff',
            fontSize: '0.8rem',
            marginBottom: 12,
          }}
        >
          {SEVERIDAD[diagnostico.severidad].label}
        </span>
        <p style={{ fontSize: '0.8rem', color: '#666' }}>
          {new Date(diagnostico.fechaHora).toLocaleString()} — {diagnostico.usuario}
        </p>
        <p>
          <strong>Modo de falla:</strong> {diagnostico.modoFalla || '-'}
        </p>
        <p>
          <strong>Diagnóstico:</strong> {diagnostico.diagnosticoTexto}
        </p>
        <p>
          <strong>Recomendación:</strong> {diagnostico.recomendacionTexto || '-'}
        </p>
        <p>
          <strong>Aviso:</strong>{' '}
          {aviso ? `${aviso.numeroSap || 'Solicitud sin número SAP'} (${aviso.estado})` : 'Sin aviso asociado'}
        </p>
      </div>
    </div>
  );
}
