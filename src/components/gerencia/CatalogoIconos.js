import React from 'react';
import { EQUIPO_ICONOS } from '../../gerencia/equipoIcons';
import { CATALOGO_MODO_FALLA } from '../../analista/mockData';

export default function CatalogoIconos() {
  const tipos = Object.keys(EQUIPO_ICONOS);

  return (
    <div style={{ padding: 24, overflow: 'auto', height: '100%' }}>
      <h2 style={{ marginTop: 0 }}>Catálogo de íconos de equipo</h2>
      <p style={{ color: '#666', fontSize: '0.85rem' }}>
        Formas simplificadas placeholder para el diagrama HMI — no son símbolos P&ID reales.
        Un equipo con un <code>tipo</code> que no esté aquí no se dibuja en el HMI.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
        {tipos.map((tipo) => (
          <div
            key={tipo}
            style={{
              background: '#fff',
              borderRadius: 8,
              padding: 16,
              textAlign: 'center',
              border: '1px solid #eee',
            }}
          >
            {EQUIPO_ICONOS[tipo]('#333')}
            <div style={{ fontWeight: 'bold', marginTop: 8, textTransform: 'capitalize' }}>{tipo}</div>
            <div style={{ fontSize: '0.7rem', color: '#999', marginTop: 4 }}>
              {(CATALOGO_MODO_FALLA[tipo] || []).length} modos de falla
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
