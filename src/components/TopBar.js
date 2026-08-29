import React from 'react';

const VISTAS = [
  { id: 'analista', label: 'Analista' },
  { id: 'administracion', label: 'Administración' },
  { id: 'portalScada', label: 'Portal SCADA' },
];

export default function TopBar({ vista, setVista, onResetear }) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 'var(--space-4)',
        padding: 'var(--space-3) var(--space-4)',
        borderBottom: '1px solid var(--color-divider)',
        background: 'var(--color-bg)',
        color: 'var(--color-text)',
        fontFamily: 'var(--font-body)',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-heading)',
          fontWeight: 600,
          fontSize: 16,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          marginRight: 'var(--space-4)',
        }}
      >
        Condición de Activos
      </span>
      {VISTAS.map((v) => {
        const on = vista === v.id;
        return (
          <span
            key={v.id}
            onClick={() => setVista(v.id)}
            style={{
              cursor: 'pointer',
              fontFamily: 'var(--font-heading)',
              fontSize: 14,
              letterSpacing: '0.02em',
              color: on ? 'var(--color-text)' : 'var(--color-neutral-600)',
              paddingBottom: 4,
              borderBottom: on ? '2px solid var(--color-accent)' : '2px solid transparent',
            }}
          >
            {v.label}
          </span>
        );
      })}

      <button
        className="btn btn-ghost"
        onClick={() => {
          if (window.confirm('Esto borra los datos de prueba guardados en este navegador y los reemplaza por el set inicial. ¿Continuar?')) {
            onResetear();
          }
        }}
        style={{ marginLeft: 'auto', fontSize: 12 }}
        title="Solo para pruebas: borra los datos guardados en este navegador y los reemplaza por el set inicial"
      >
        Restablecer datos de prueba
      </button>
    </div>
  );
}
