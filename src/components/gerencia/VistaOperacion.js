import React, { useEffect, useMemo, useRef, useState } from 'react';
import { condicionActual } from '../../analista/store';
import { iconoBaseDe } from '../../gerencia/iconos';
import { contornosDeArea, repartirEnVistas } from '../../gerencia/layout/escalonado';
import './portalScada.css';

// Vista de OPERACIÓN: mirar una planta, no editarla. No hay un solo control
// que escriba en los datos — ni arrastre, ni doble clic, ni compactar. Lo
// que se dibuja se recalcula en cada render con el método escalonado, así
// que tampoco depende de que alguien haya compactado antes.
//
// Es de VIGILANCIA DE CONDICIÓN, no un diagrama de proceso. Por eso NO
// dibuja cañerías: el escalonado reacomoda los equipos ignorando el proceso
// para meter la mayor cantidad legible por pantalla, y encima de ese orden
// las conexiones saldrían como un ovillo. El diagrama de proceso, con sus
// cañerías ruteadas, es el Portal SCADA — son complementarias.

const ESTADO_COLOR = { normal: 'var(--e-normal)', observacion: 'var(--e-observacion)', alerta: 'var(--e-alerta)', alarma: 'var(--e-alarma)' };
const SIN_DIAGNOSTICO = 'var(--e-sindiagnostico)';
const ESTADOS = [
  { id: 'alarma', label: 'Alarma' },
  { id: 'alerta', label: 'Alerta' },
  { id: 'observacion', label: 'Observación' },
  { id: 'normal', label: 'Normal' },
  { id: 'sinDiagnostico', label: 'Sin diagnóstico' },
];
const TIPOS_VASIJA = ['tanque', 'agitador'];
const FONT_SIZE_TAG = 13;

// Tamaño legible del ícono, en píxeles de pantalla. El mínimo es lo que
// DEFINE cuántos equipos entran (ver escalonado.js): el encuadre normaliza
// la escala interna, así que lo único que mueve el tamaño en pantalla es la
// cantidad. Si no entran, se reparten en varias vistas. Son las cifras con
// las que están medidos los repartos anotados en CLAUDE.md.
const TAM_MIN_PX = 28;
const TAM_MAX_PX = 180;

const PALETA_AREAS = ['#00a2e8', '#ff00ff', '#f2b705', '#2ecc71', '#e8590c', '#9b59b6', '#1abc9c', '#e74c3c'];

export default function VistaOperacion({ data }) {
  const [plantaId, setPlantaId] = useState(data.plantas[0]?.id || null);
  const [vistaActiva, setVistaActiva] = useState(0);
  const [panel, setPanel] = useState(null);
  const svgRef = useRef(null);

  // El panel real donde se dibuja es una entrada del problema, no una
  // constante: la capacidad depende de su área en píxeles, no solo de su
  // proporción. Se mide después de cada render, con guard de "sin cambios
  // reales" para no entrar en loop, más un listener de resize.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const medir = () => {
      const el = svgRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      setPanel((prev) => (prev && Math.abs(prev.ancho - r.width) < 1 && Math.abs(prev.alto - r.height) < 1 ? prev : { ancho: r.width, alto: r.height }));
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  });

  const areasDePlanta = useMemo(() => data.areas.filter((a) => a.plantaId === plantaId), [data.areas, plantaId]);
  const equiposDePlanta = useMemo(
    () => data.equipos.filter((eq) => areasDePlanta.some((a) => a.id === eq.areaId)),
    [data.equipos, areasDePlanta]
  );

  const estadoDe = (eq) => {
    const cond = condicionActual(eq.id, data.diagnosticos);
    return cond ? cond.severidad : null;
  };

  const colorDeArea = useMemo(() => {
    const m = {};
    areasDePlanta.forEach((a, i) => {
      m[a.id] = PALETA_AREAS[i % PALETA_AREAS.length];
    });
    return m;
  }, [areasDePlanta]);

  const resumen = useMemo(() => {
    const acc = { alarma: 0, alerta: 0, observacion: 0, normal: 0, sinDiagnostico: 0 };
    equiposDePlanta.forEach((eq) => {
      acc[estadoDe(eq) || 'sinDiagnostico'] += 1;
    });
    return acc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equiposDePlanta, data.diagnosticos]);

  const vistas = useMemo(() => {
    if (!panel || equiposDePlanta.length === 0) return [];
    const arObjetivo = panel.ancho / panel.alto;
    const repartidas = repartirEnVistas(equiposDePlanta, data, { arObjetivo, panel, tamMinPx: TAM_MIN_PX, tamMaxPx: TAM_MAX_PX });
    return repartidas.map((v) => ({
      piezas: v.layout.colocadas.map((c) => ({ eq: c.eq, escala: c.escala, anchoIcono: c.anchoIcono, altoIcono: c.altoIcono, x: c.x + c.ancho / 2, y: c.y + c.altoIcono })),
      contornos: v.layout.spans.flatMap((s) => contornosDeArea(s.spans).map((c) => ({ ...c, areaId: s.areaId }))),
      lienzo: { ancho: v.layout.ancho, alto: v.layout.alto },
      areaIds: v.areas.map((a) => a.areaId),
      equipos: v.areas.reduce((n, a) => n + a.eqs.length, 0),
      minimoInalcanzable: v.minimoInalcanzable || false,
    }));
  }, [equiposDePlanta, data, panel]);

  // Todas las vistas se dibujan a la MISMA escala: se toma el lienzo más
  // grande de todas. Si cada una se encuadrara por su cuenta, una vista
  // menos llena se dibujaría más acercada y el mismo motor saldría hasta
  // tres veces más grande al cambiar de vista. Una vista menos llena tiene
  // que quedar con aire, no agrandada.
  const lienzoComun = useMemo(() => {
    if (vistas.length === 0) return null;
    return { ancho: Math.max(...vistas.map((v) => v.lienzo.ancho)), alto: Math.max(...vistas.map((v) => v.lienzo.alto)) };
  }, [vistas]);

  const vista = vistas[Math.min(vistaActiva, vistas.length - 1)] || null;
  const nombreDeArea = (id) => areasDePlanta.find((a) => a.id === id)?.nombre;

  const etiquetaSelect = { display: 'block', fontSize: 12, color: 'var(--scada-texto-2)', marginBottom: 4 };
  const estiloSelect = {
    width: '100%',
    background: 'var(--scada-panel)',
    color: 'var(--scada-texto)',
    border: '1px solid var(--scada-borde)',
    padding: 6,
    fontFamily: 'inherit',
    marginBottom: 'var(--space-3)',
  };

  return (
    <div className="scada" style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <div style={{ width: 280, flexShrink: 0, padding: 'var(--space-4)', borderRight: '1px solid var(--scada-borde)', background: 'var(--scada-subpanel)', overflowY: 'auto' }}>
        <h2 style={{ margin: '0 0 var(--space-3)', fontSize: 15, color: 'var(--scada-titulo)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Vista de operación
        </h2>

        <label style={etiquetaSelect}>Planta</label>
        <select
          value={plantaId || ''}
          onChange={(e) => {
            setPlantaId(e.target.value);
            setVistaActiva(0);
          }}
          style={estiloSelect}
        >
          {data.plantas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>

        {vistas.length > 0 && (
          <>
            <label style={etiquetaSelect}>
              Vista {vistas.length > 1 ? `— ${vistas.length} en total` : '— entra todo en una'}
            </label>
            <select value={Math.min(vistaActiva, vistas.length - 1)} onChange={(e) => setVistaActiva(Number(e.target.value))} style={estiloSelect}>
              {vistas.map((v, i) => {
                const nombres = v.areaIds.map(nombreDeArea).filter(Boolean);
                const resumenAreas = nombres.length <= 2 ? nombres.join(' · ') : `${nombres[0]} … ${nombres[nombres.length - 1]}`;
                return (
                  <option key={v.areaIds.join('-')} value={i}>
                    {i + 1}/{vistas.length} — {v.areaIds.length} áreas · {v.equipos} equipos — {resumenAreas}
                  </option>
                );
              })}
            </select>
          </>
        )}

        <div style={{ fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--scada-texto-2)', margin: '0 0 8px' }}>
          Estado de los equipos
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 'var(--space-3)' }}>
          <tbody>
            {ESTADOS.map((e) => (
              <tr key={e.id}>
                <td style={{ padding: '3px 0', width: 14 }}>
                  <span style={{ display: 'block', width: 10, height: 10, background: e.id === 'sinDiagnostico' ? SIN_DIAGNOSTICO : ESTADO_COLOR[e.id] }} />
                </td>
                <td style={{ padding: '3px 0 3px 8px', color: 'var(--scada-texto-2)' }}>{e.label}</td>
                <td style={{ padding: '3px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{resumen[e.id]}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={2} style={{ padding: '6px 0 0', borderTop: '1px solid var(--scada-borde)', color: 'var(--scada-texto-2)' }}>
                Total · {areasDePlanta.length} áreas
              </td>
              <td style={{ padding: '6px 0 0', borderTop: '1px solid var(--scada-borde)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                {equiposDePlanta.length}
              </td>
            </tr>
          </tbody>
        </table>

        {vista?.minimoInalcanzable && (
          <p style={{ fontSize: 11.5, color: 'var(--scada-titulo)', lineHeight: 1.5, margin: 0 }}>
            Con {equiposDePlanta.length} equipos no se llega al tamaño mínimo legible de {TAM_MIN_PX} px en esta pantalla ni con un área sola, así que
            partir no ganaría nada: entra todo en una vista.
          </p>
        )}
      </div>

      <div style={{ flexGrow: 1, minWidth: 0, padding: 'var(--space-3)', background: 'var(--scada-subpanel)' }}>
        <svg
          ref={svgRef}
          viewBox={lienzoComun ? `-20 -20 ${lienzoComun.ancho + 40} ${lienzoComun.alto + 40}` : '0 0 100 100'}
          preserveAspectRatio="xMinYMin meet"
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          <defs>
            <linearGradient id="operacionGradMetal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8f9497" />
              <stop offset="35%" stopColor="#e2e4e5" />
              <stop offset="70%" stopColor="#b0b4b6" />
              <stop offset="100%" stopColor="#6f7477" />
            </linearGradient>
          </defs>

          {vista && (
            <>
              {vista.contornos.map((c, i) => (
                <path
                  key={`${c.areaId}-${i}`}
                  d={c.d}
                  fill="none"
                  stroke={colorDeArea[c.areaId] || 'var(--scada-zona)'}
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  opacity={0.75}
                />
              ))}

              {vista.piezas.map((p) => {
                const icono = iconoBaseDe(p.eq.tipo, data);
                if (!icono) return null;
                const estado = estadoDe(p.eq);
                const color = estado ? ESTADO_COLOR[estado] : SIN_DIAGNOSTICO;
                const esVasija = TIPOS_VASIJA.includes(p.eq.tipo);
                return (
                  <g key={p.eq.id} transform={`translate(${p.x - p.anchoIcono / 2}, ${p.y - p.altoIcono})`}>
                    <g transform={`scale(${p.escala})`}>
                      {esVasija ? (
                        <>
                          <g fill="url(#operacionGradMetal)" stroke="var(--scada-subpanel)" strokeWidth={1}>
                            {icono.silueta}
                          </g>
                          <rect x={4} y={-10} width={icono.anchoBase - 8} height={8} fill={color} stroke="var(--scada-subpanel)" strokeWidth={1} />
                        </>
                      ) : (
                        <g fill={color} stroke="var(--scada-subpanel)" strokeWidth={1}>
                          {icono.silueta}
                        </g>
                      )}
                      {icono.decoracion}
                    </g>
                    <text
                      x={p.anchoIcono / 2}
                      y={p.altoIcono + 13}
                      textAnchor="middle"
                      fontSize={FONT_SIZE_TAG}
                      fontWeight={700}
                      letterSpacing="0.02em"
                      fill={colorDeArea[p.eq.areaId] || 'var(--scada-texto)'}
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {p.eq.tag}
                    </text>
                  </g>
                );
              })}
            </>
          )}
        </svg>
      </div>
    </div>
  );
}
