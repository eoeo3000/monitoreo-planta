import React, { useState } from 'react';
import { STATUS } from '../statusConfig';

const FICHA_FIELDS = [
  { key: 'marca', label: 'Marca' },
  { key: 'modelo', label: 'Modelo' },
  { key: 'numeroSerie', label: 'N° de serie' },
  { key: 'fechaInstalacion', label: 'Fecha de instalación' },
  { key: 'ubicacion', label: 'Ubicación' },
];

export default function EquipmentPanel({
  equipment,
  role,
  onClose,
  onUpdateFicha,
  onAddInforme,
  onDelete,
}) {
  const [estado, setEstado] = useState(equipment.status);
  const [observaciones, setObservaciones] = useState('');
  const [autor, setAutor] = useState('');
  const [editingFicha, setEditingFicha] = useState(false);
  const [ficha, setFicha] = useState(equipment.fichaTecnica);

  const submitInforme = (e) => {
    e.preventDefault();
    if (!autor.trim()) return;
    onAddInforme(equipment.id, { estado, observaciones, autor: autor.trim() });
    setObservaciones('');
  };

  const saveFicha = () => {
    onUpdateFicha(equipment.id, ficha);
    setEditingFicha(false);
  };

  return (
    <aside
      style={{
        width: 320,
        borderLeft: '1px solid #e0e0e0',
        padding: 20,
        overflowY: 'auto',
        background: '#fafafa',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h2 style={{ marginTop: 0, marginBottom: 4 }}>{equipment.label}</h2>
        <button onClick={onClose}>✕</button>
      </div>
      <span
        style={{
          display: 'inline-block',
          padding: '2px 10px',
          borderRadius: 12,
          background: STATUS[equipment.status].color,
          color: '#fff',
          fontSize: '0.8rem',
        }}
      >
        {STATUS[equipment.status].label}
      </span>

      <h4>Ficha técnica</h4>
      {editingFicha ? (
        <div>
          {FICHA_FIELDS.map(({ key, label }) => (
            <div key={key} style={{ marginBottom: 6 }}>
              <label style={{ fontSize: '0.75rem', display: 'block' }}>{label}</label>
              <input
                value={ficha[key] || ''}
                onChange={(e) => setFicha({ ...ficha, [key]: e.target.value })}
                style={{ width: '100%' }}
              />
            </div>
          ))}
          <button onClick={saveFicha}>Guardar</button>
        </div>
      ) : (
        <div style={{ fontSize: '0.85rem' }}>
          {FICHA_FIELDS.map(({ key, label }) => (
            <p key={key} style={{ margin: '4px 0' }}>
              {label}: {equipment.fichaTecnica[key] || '-'}
            </p>
          ))}
          {role === 'tecnico' && <button onClick={() => setEditingFicha(true)}>Editar</button>}
        </div>
      )}

      {role === 'tecnico' && (
        <>
          <h4>Nuevo informe</h4>
          <form onSubmit={submitInforme}>
            <input
              placeholder="Tu nombre"
              value={autor}
              onChange={(e) => setAutor(e.target.value)}
              style={{ width: '100%', marginBottom: 6 }}
            />
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              style={{ width: '100%', marginBottom: 6 }}
            >
              {Object.entries(STATUS).map(([key, cfg]) => (
                <option key={key} value={key}>
                  {cfg.label}
                </option>
              ))}
            </select>
            <textarea
              placeholder="Observaciones"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              style={{ width: '100%', marginBottom: 6 }}
            />
            <button type="submit">Guardar informe</button>
          </form>
        </>
      )}

      <h4>Historial</h4>
      {equipment.historial.length === 0 && (
        <p style={{ fontSize: '0.8rem', color: '#888' }}>Sin informes registrados.</p>
      )}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {equipment.historial.map((h) => (
          <li
            key={h.id}
            style={{ borderLeft: `3px solid ${STATUS[h.estado].color}`, paddingLeft: 8, marginBottom: 10 }}
          >
            <div style={{ fontSize: '0.75rem', color: '#666' }}>
              {new Date(h.fecha).toLocaleString()} — {h.autor}
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{STATUS[h.estado].label}</div>
            {h.observaciones && <div style={{ fontSize: '0.8rem' }}>{h.observaciones}</div>}
          </li>
        ))}
      </ul>

      {role === 'tecnico' && (
        <button
          onClick={() => {
            if (window.confirm('¿Eliminar este equipo?')) {
              onDelete(equipment.id);
              onClose();
            }
          }}
          style={{
            marginTop: 16,
            color: '#c62828',
            border: '1px solid #c62828',
            background: 'transparent',
            padding: '6px 10px',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          Eliminar equipo
        </button>
      )}
    </aside>
  );
}
