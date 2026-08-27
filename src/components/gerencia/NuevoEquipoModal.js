import React, { useState } from 'react';
import { EQUIPO_ICONOS } from '../../gerencia/equipoIcons';

export default function NuevoEquipoModal({ areas, areaIdInicial, tagsExistentes, onCancel, onCrear }) {
  const tipos = Object.keys(EQUIPO_ICONOS);
  const [tag, setTag] = useState('');
  const [tipo, setTipo] = useState(tipos[0] || '');
  const [areaId, setAreaId] = useState(areaIdInicial || areas[0]?.id || '');
  const [descripcion, setDescripcion] = useState('');
  const [error, setError] = useState(null);

  const confirmar = () => {
    const tagLimpio = tag.trim();
    if (!tagLimpio) return setError('El TAG es obligatorio.');
    if (tagsExistentes.includes(tagLimpio)) return setError('Ya existe un equipo con ese TAG.');
    if (!areaId) return setError('Selecciona un área.');
    onCrear({ tag: tagLimpio, tipo, areaId, descripcion });
  };

  return (
    <div
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
      <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: 380 }}>
        <h3 style={{ marginTop: 0 }}>Nuevo equipo</h3>
        {error && <p style={{ color: '#c62828', fontSize: '0.85rem' }}>{error}</p>}

        <label style={{ fontSize: '0.75rem', display: 'block', marginTop: 8 }}>TAG *</label>
        <input value={tag} onChange={(e) => setTag(e.target.value)} style={{ width: '100%' }} placeholder="Ej: B-103" />

        <label style={{ fontSize: '0.75rem', display: 'block', marginTop: 8 }}>Tipo</label>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ width: '100%' }}>
          {tipos.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <label style={{ fontSize: '0.75rem', display: 'block', marginTop: 8 }}>Área</label>
        <select value={areaId} onChange={(e) => setAreaId(e.target.value)} style={{ width: '100%' }}>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>

        <label style={{ fontSize: '0.75rem', display: 'block', marginTop: 8 }}>Descripción</label>
        <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} style={{ width: '100%' }} />

        <p style={{ fontSize: '0.75rem', color: '#999', marginTop: 8 }}>
          Se ubicará al centro de la zona del área elegida; luego puedes arrastrarlo a su posición real.
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={onCancel}>Cancelar</button>
          <button
            onClick={confirmar}
            style={{ background: '#1565c0', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 4 }}
          >
            Crear
          </button>
        </div>
      </div>
    </div>
  );
}
