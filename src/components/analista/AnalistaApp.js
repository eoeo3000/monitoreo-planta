import React, { useEffect, useMemo, useState } from 'react';
import { RECOMENDACION_DEFAULT, reglasPorSeveridad, colorDeSeveridad } from '../../analista/severidad';
import { useFiltroEquipos } from '../../analista/filtroEquipos';
import EquipoDiagnosticoPanel from './EquipoDiagnosticoPanel';
import TablaEquipos from './TablaEquipos';
import HistoricoDiagnosticos from './HistoricoDiagnosticos';
import Dashboard from './Dashboard';
import HistorialDetalleModal from './HistorialDetalleModal';
import NuevoAvisoModal from './NuevoAvisoModal';
import './analista.css';

const SEVERIDAD_EN_COLOR = true; // handoff §2 — flag para paleta mono en acero

const FORM_VACIO = { severidad: 'normal', modoFalla: '', diagnosticoTexto: '', recomendacionTexto: '' };

const VISTAS = [
  { id: 'equipos', label: 'Equipos' },
  { id: 'historico', label: 'Histórico' },
  { id: 'dashboard', label: 'Dashboard' },
];

export default function AnalistaApp({ data, esDuplicadoReciente, crearDiagnostico, solicitarAviso }) {
  const [vista, setVista] = useState('equipos');
  const filtro = useFiltroEquipos(data);
  const [equipoSeleccionadoId, setEquipoSeleccionadoId] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [evidenciasPendientes, setEvidenciasPendientes] = useState([]);
  const [detalleHistorial, setDetalleHistorial] = useState(null);
  const [mostrarModalAviso, setMostrarModalAviso] = useState(false);
  const [mostrarModalDiagnostico, setMostrarModalDiagnostico] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const equipo = data.equipos.find((e) => e.id === equipoSeleccionadoId);

  const historialEquipo = useMemo(() => {
    if (!equipo) return [];
    return data.diagnosticos
      .filter((d) => d.equipoId === equipo.id)
      .sort((a, b) => new Date(b.fechaHora) - new Date(a.fechaHora));
  }, [data.diagnosticos, equipo]);

  const condicion = equipo ? historialEquipo[0] || null : null;

  const avisosEquipo = useMemo(() => {
    if (!equipo) return [];
    return data.avisos.filter((a) => a.equipoId === equipo.id && a.estado !== 'cerrado');
  }, [data.avisos, equipo]);

  useEffect(() => {
    setForm(FORM_VACIO);
    setEvidenciasPendientes([]);
    setMensaje(null);
  }, [equipoSeleccionadoId]);

  const abrirDesdeTabla = (id) => {
    setEquipoSeleccionadoId(id);
    setMostrarModalDiagnostico(true);
  };

  const pickSeveridad = (sev) => {
    setForm((f) => {
      const next = { ...f, severidad: sev };
      if (!reglasPorSeveridad(sev).recomendacionRequerida && !next.recomendacionTexto) {
        next.recomendacionTexto = RECOMENDACION_DEFAULT;
      }
      if (sev === 'normal') next.modoFalla = '';
      return next;
    });
    setMensaje(null);
  };

  const handlePasteEvidencia = (e) => {
    const items = e.clipboardData?.items || [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        const reader = new FileReader();
        reader.onload = () => {
          setEvidenciasPendientes((ev) => [...ev, { dataUrl: reader.result }]);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const cargarUltimaCondicion = () => {
    if (!condicion) return;
    setForm({
      severidad: condicion.severidad,
      modoFalla: condicion.modoFalla || '',
      diagnosticoTexto: condicion.diagnosticoTexto,
      recomendacionTexto: condicion.recomendacionTexto || '',
    });
    setMensaje(null);
  };

  const validarCamposBase = () => {
    const reglas = reglasPorSeveridad(form.severidad);
    if (reglas.modoFallaRequerido && !form.modoFalla) return 'Falta completar Modo de falla.';
    if (!form.diagnosticoTexto.trim()) return 'Falta completar Diagnóstico.';
    if (reglas.recomendacionRequerida && !form.recomendacionTexto.trim()) return 'Falta completar Recomendación.';
    return null;
  };

  const insertar = () => {
    const error = validarCamposBase();
    if (error) return setMensaje({ tipo: 'error', texto: error });

    const reglas = reglasPorSeveridad(form.severidad);
    if (reglas.avisoRequerido) {
      return setMensaje({
        tipo: 'error',
        texto: 'Esta severidad requiere un aviso o solicitud asociada. Usa "Nuevo aviso" en vez de "Insertar".',
      });
    }

    if (esDuplicadoReciente(equipo.id, form)) {
      return setMensaje({
        tipo: 'error',
        texto: 'Este diagnóstico parece un duplicado del último registrado hace menos de 5 minutos.',
      });
    }

    crearDiagnostico(equipo.id, form, evidenciasPendientes);
    setForm(FORM_VACIO);
    setEvidenciasPendientes([]);
    setMensaje({ tipo: 'ok', texto: 'Diagnóstico registrado.' });
  };

  const abrirModalAviso = () => {
    const error = validarCamposBase();
    if (error) return setMensaje({ tipo: 'error', texto: error });
    const reglas = reglasPorSeveridad(form.severidad);
    if (!reglas.avisoRequerido) {
      return setMensaje({ tipo: 'error', texto: 'Nuevo aviso solo aplica para severidad Alerta o Alarma.' });
    }
    setMensaje(null);
    setMostrarModalAviso(true);
  };

  const confirmarSolicitudAviso = (avisoData) => {
    solicitarAviso(equipo.id, form, avisoData, evidenciasPendientes);
    setForm(FORM_VACIO);
    setEvidenciasPendientes([]);
    setMostrarModalAviso(false);
    setMensaje({ tipo: 'ok', texto: 'Solicitud de aviso registrada junto al diagnóstico.' });
  };

  const reglas = reglasPorSeveridad(form.severidad);
  const color = (sev) => colorDeSeveridad(sev, SEVERIDAD_EN_COLOR);

  const panelProps = equipo && {
    equipo,
    areaNombre: data.areas.find((a) => a.id === equipo.areaId)?.nombre,
    condicion,
    historialEquipo,
    avisosEquipo,
    form,
    setForm,
    mensaje,
    evidenciasPendientes,
    reglas,
    color,
    pickSeveridad,
    cargarUltimaCondicion,
    handlePasteEvidencia,
    insertar,
    abrirModalAviso,
    onAbrirHistorial: setDetalleHistorial,
  };

  return (
    <div style={{ minHeight: '100%', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 'var(--space-6)',
          padding: 'var(--space-6) var(--space-8)',
          borderBottom: '1px solid var(--color-divider)',
        }}
      >
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>
            Estación del analista
          </div>
          <h1 style={{ fontSize: 40, margin: 'var(--space-1) 0 0', letterSpacing: '0.01em' }}>CONDICIÓN DE ACTIVOS</h1>
        </div>

        <div className="seg">
          {VISTAS.map((v) => (
            <label key={v.id} className="seg-opt">
              <input type="radio" checked={vista === v.id} onChange={() => setVista(v.id)} />
              <span>{v.label}</span>
            </label>
          ))}
        </div>

        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-neutral-600)' }}>
          Sesión: analista.demo · Datos de prueba locales
        </span>
      </header>

      {vista === 'equipos' && <TablaEquipos data={data} filtro={filtro} onAbrirEquipo={abrirDesdeTabla} color={color} />}
      {vista === 'historico' && (
        <HistoricoDiagnosticos data={data} filtro={filtro} color={color} onAbrirDetalle={setDetalleHistorial} />
      )}
      {vista === 'dashboard' && <Dashboard data={data} filtro={filtro} />}

      {mostrarModalDiagnostico && equipo && (
        <div className="dialog-backdrop" onClick={() => setMostrarModalDiagnostico(false)} style={{ zIndex: 90 }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(1100px, 96vw)', maxHeight: '92vh', overflowY: 'auto', background: 'var(--color-bg)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 'var(--space-2) var(--space-4) 0' }}>
              <button className="btn btn-icon btn-secondary" onClick={() => setMostrarModalDiagnostico(false)}>✕</button>
            </div>
            <EquipoDiagnosticoPanel {...panelProps} />
          </div>
        </div>
      )}

      {detalleHistorial && (
        <HistorialDetalleModal
          diagnostico={detalleHistorial}
          aviso={data.avisos.find((a) => a.diagnosticoOrigenId === detalleHistorial.id)}
          onClose={() => setDetalleHistorial(null)}
        />
      )}

      {mostrarModalAviso && (
        <NuevoAvisoModal
          equipo={equipo}
          diagnosticoForm={form}
          onCancel={() => setMostrarModalAviso(false)}
          onSolicitar={confirmarSolicitudAviso}
        />
      )}
    </div>
  );
}
