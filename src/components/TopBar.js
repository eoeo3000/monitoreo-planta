import React from 'react';

export default function TopBar({ role, setRole, levelName, onBack }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 24px',
        borderBottom: '1px solid #e0e0e0',
        background: '#fff',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {levelName ? (
          <>
            <button onClick={onBack}>← Planta</button>
            <strong>{levelName}</strong>
          </>
        ) : (
          <strong>Planta</strong>
        )}
      </div>
      <div>
        <label style={{ fontSize: '0.85rem', marginRight: 8 }}>Rol:</label>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="tecnico">Técnico de terreno</option>
          <option value="jefe">Jefe / Gerente</option>
        </select>
      </div>
    </div>
  );
}
