import React, { useState } from 'react';
import { STATUS, worstStatus } from '../statusConfig';

export default function PlantView({ levels, equipment, onEnterLevel, onAddLevel, role }) {
  const [newLevelName, setNewLevelName] = useState('');

  return (
    <div style={{ padding: '32px', flexGrow: 1, overflowY: 'auto' }}>
      <h1 style={{ marginBottom: '8px' }}>Mapa de calor de planta</h1>
      <p style={{ color: '#666', marginBottom: '24px' }}>
        Selecciona un nivel para ver el detalle de sus equipos.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        {levels.map((level) => {
          const eqs = equipment.filter((e) => e.levelId === level.id);
          const worst = worstStatus(eqs.map((e) => e.status));
          const color = worst ? STATUS[worst].color : '#ccc';
          const counts = eqs.reduce((acc, e) => {
            acc[e.status] = (acc[e.status] || 0) + 1;
            return acc;
          }, {});

          return (
            <button
              key={level.id}
              onClick={() => onEnterLevel(level.id)}
              style={{
                textAlign: 'left',
                border: 'none',
                borderRadius: '10px',
                padding: '20px',
                cursor: 'pointer',
                background: '#fff',
                borderLeft: `8px solid ${color}`,
                boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
              }}
            >
              <h3 style={{ margin: 0 }}>{level.name}</h3>
              <p style={{ margin: '8px 0', fontSize: '0.85rem', color: '#666' }}>
                {eqs.length} equipo{eqs.length === 1 ? '' : 's'}
              </p>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {Object.entries(STATUS).map(([key, cfg]) =>
                  counts[key] ? (
                    <span
                      key={key}
                      style={{
                        fontSize: '0.75rem',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: cfg.color,
                        color: '#fff',
                      }}
                    >
                      {counts[key]} {cfg.label}
                    </span>
                  ) : null
                )}
              </div>
            </button>
          );
        })}
      </div>

      {role === 'tecnico' && (
        <div style={{ marginTop: '32px', display: 'flex', gap: '8px' }}>
          <input
            value={newLevelName}
            onChange={(e) => setNewLevelName(e.target.value)}
            placeholder="Nombre del nuevo nivel"
            style={{ padding: '8px', flexGrow: 1, maxWidth: '280px' }}
          />
          <button
            onClick={() => {
              if (newLevelName.trim()) {
                onAddLevel(newLevelName.trim());
                setNewLevelName('');
              }
            }}
          >
            + Agregar nivel
          </button>
        </div>
      )}
    </div>
  );
}
