import React from 'react';
import { SEVERIDAD } from '../../analista/severidad';

export default function EquipoDetalleModal({ equipo, historial, avisosAbiertos, evidencias, onClose }) {
  const condicion = historial[0] || null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 8, padding: 24, width: 520, maxHeight: '80vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: 0 }}>{equipo.tag}</h2>
            <p style={{ margin: '4px 0', color: '#666', fontSize: '0.85rem' }}>{equipo.descripcion}</p>
          </div>
          <button onClick={onClose}>✕</button>
        </div>

        <h4 style={{ marginBottom: 4 }}>Condición actual</h4>
        {condicion ? (
          <>
            <span
              style={{
                display: 'inline-block',
                padding: '2px 10px',
                borderRadius: 12,
                background: SEVERIDAD[condicion.severidad].color,
                color: '#fff',
                fontSize: '0.85rem',
              }}
            >
              {SEVERIDAD[condicion.severidad].label}
            </span>
            <p style={{ fontSize: '0.8rem', color: '#666' }}>
              Último diagnóstico: {new Date(condicion.fechaHora).toLocaleString()} — {condicion.usuario}
            </p>
          </>
        ) : (
          <p style={{ color: '#888' }}>Sin diagnóstico registrado.</p>
        )}

        <h4 style={{ marginBottom: 4 }}>Avisos abiertos</h4>
        {avisosAbiertos.length === 0 ? (
          <p style={{ color: '#888', margin: 0 }}>No existen avisos abiertos asociados a este equipo.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {avisosAbiertos.map((a) => (
              <li key={a.id} style={{ padding: '4px 0', borderBottom: '1px solid #eee', fontSize: '0.85rem' }}>
                <strong>{a.numeroSap || 'Solicitud (sin número SAP)'}</strong> — {a.textoBreve} — {a.estado}
              </li>
            ))}
          </ul>
        )}

        <h4 style={{ marginBottom: 4 }}>Historial</h4>
        {historial.length === 0 ? (
          <p style={{ color: '#888', margin: 0 }}>Sin registros históricos.</p>
        ) : (
          <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                <th>Fecha</th>
                <th>Severidad</th>
                <th>Modo de falla</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((d) => (
                <tr key={d.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td>{new Date(d.fechaHora).toLocaleDateString()}</td>
                  <td style={{ color: SEVERIDAD[d.severidad].color, fontWeight: 'bold' }}>
                    {SEVERIDAD[d.severidad].label}
                  </td>
                  <td>{d.modoFalla || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h4 style={{ marginBottom: 4 }}>Evidencias</h4>
        {evidencias.length === 0 ? (
          <p style={{ color: '#888', margin: 0 }}>Sin evidencias adjuntas.</p>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {evidencias.map((ev) => (
              <img
                key={ev.id}
                src={ev.dataUrl}
                alt="evidencia"
                style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4, border: '1px solid #ddd' }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
