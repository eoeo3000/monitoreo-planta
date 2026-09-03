import React, { useEffect, useMemo, useRef, useState } from 'react';
import { condicionActual } from '../../analista/store';
import { iconoBaseDe } from '../../gerencia/iconos';
import { calcularLayoutCompacto } from '../../gerencia/layout/compactado';
import { escalaVisible } from '../../gerencia/layout/grilla';
import { empaquetarLibre, metricas, cajasPorArea, solapamientoDeCajas } from '../../gerencia/layout/ensayo';
import { contornosDeArea, repartirEnVistas } from '../../gerencia/layout/escalonado';
import './portalScada.css';

const ESTADO_COLOR = { normal: 'var(--e-normal)', observacion: 'var(--e-observacion)', alerta: 'var(--e-alerta)', alarma: 'var(--e-alarma)' };
const SIN_DIAGNOSTICO = 'var(--e-sindiagnostico)';
const TIPOS_VASIJA = ['tanque', 'agitador'];
const FONT_SIZE_TAG = 13;
const ALTO_TAG = 18;

// La pantalla donde se va a ver la planta es una VARIABLE del problema, no
// una constante. Y no alcanza con su proporción: la capacidad depende del
// área en píxeles, así que un ultrawide de 2560×1080 se lleva unas tres
// veces los equipos de un 1280×720 al mismo tamaño legible.
//
// El primero es el de referencia: las cifras anotadas en CLAUDE.md están
// medidas con ese. Para comparar métodos entre sí hay que dejar la pantalla
// fija; para saber cuántas vistas hacen falta en un monitor concreto, se
// elige ese monitor.
const PANTALLAS = [
  { id: 'ref', nombre: 'Referencia · 1280×720 (16:9)', ancho: 1280, alto: 720 },
  { id: 'fhd', nombre: 'Monitor · 1920×1080 (16:9)', ancho: 1920, alto: 1080 },
  { id: 'wxga', nombre: 'Notebook · 1440×900 (16:10)', ancho: 1440, alto: 900 },
  { id: 'ultra', nombre: 'Ultrawide · 2560×1080 (21:9)', ancho: 2560, alto: 1080 },
  { id: 'vertical', nombre: 'Vertical · 1080×1920 (9:16)', ancho: 1080, alto: 1920 },
  { id: 'real', nombre: 'Panel real de esta ventana', ancho: 0, alto: 0 },
];

const PALETA_AREAS = ['#00a2e8', '#ff00ff', '#f2b705', '#2ecc71', '#e8590c', '#9b59b6', '#1abc9c', '#e74c3c'];

export default function EnsayoLayout({ data }) {
  const [plantaId, setPlantaId] = useState(data.plantas[0]?.id || null);
  const [metodo, setMetodo] = useState('escalonado');
  const [agruparPorArea, setAgruparPorArea] = useState(true);
  const [tamMinPx, setTamMinPx] = useState(28);
  const [tamMaxPx, setTamMaxPx] = useState(180);
  const [vistaActiva, setVistaActiva] = useState(0);
  const [pantallaId, setPantallaId] = useState('ref');
  const [panelReal, setPanelReal] = useState(null);
  const svgRef = useRef(null);

  // Mide el panel de verdad, para la opción "Panel real". Mismo patrón que
  // PortalSCADA.js: sin lista de dependencias, con guarda de "sin cambios"
  // para no entrar en bucle, más un listener de resize que por sí solo no
  // dispara un re-render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const medir = () => {
      const el = svgRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      setPanelReal((prev) =>
        prev && Math.abs(prev.ancho - r.width) < 1 && Math.abs(prev.alto - r.height) < 1
          ? prev
          : { ancho: Math.round(r.width), alto: Math.round(r.height) }
      );
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  });

  const pantalla = useMemo(() => {
    const elegida = PANTALLAS.find((p) => p.id === pantallaId) || PANTALLAS[0];
    if (elegida.id !== 'real') return elegida;
    return panelReal ? { ...elegida, ...panelReal } : PANTALLAS[0];
  }, [pantallaId, panelReal]);

  const AR_OBJETIVO = pantalla.ancho / pantalla.alto;

  const areasDePlanta = useMemo(() => data.areas.filter((a) => a.plantaId === plantaId), [data.areas, plantaId]);
  const equiposDePlanta = useMemo(() => {
    const ids = new Set(areasDePlanta.map((a) => a.id));
    return data.equipos.filter((eq) => ids.has(eq.areaId));
  }, [data.equipos, areasDePlanta]);

  const colorDeArea = useMemo(() => {
    const mapa = {};
    areasDePlanta.forEach((a, i) => { mapa[a.id] = PALETA_AREAS[i % PALETA_AREAS.length]; });
    return mapa;
  }, [areasDePlanta]);

  const estadoDe = (eq) => {
    const cond = condicionActual(eq.id, data.diagnosticos);
    return cond ? cond.severidad : null;
  };

  // --- Método libre: empaqueta equipos sueltos -------------------------
  const libre = useMemo(() => {
    if (!plantaId || equiposDePlanta.length === 0) return null;
    const r = empaquetarLibre(equiposDePlanta, data, { arObjetivo: AR_OBJETIVO, agruparPorArea });
    if (!r) return null;
    const areaIconos = r.colocadas.reduce((acc, c) => acc + c.anchoIcono * c.altoIcono, 0);
    const piezas = r.colocadas.map((c) => ({
      eq: c.eq,
      escala: c.escala,
      // Dentro de su celda, el ícono va centrado y pegado arriba; el TAG
      // queda debajo, en el alto que la celda ya le reservó.
      x: c.x + c.ancho / 2,
      y: c.y + c.altoIcono,
      anchoIcono: c.anchoIcono,
      altoIcono: c.altoIcono,
    }));
    const m = metricas({ ancho: r.ancho, alto: r.alto, areaIconos, arObjetivo: AR_OBJETIVO });
    const cajas = cajasPorArea(piezas);
    return {
      piezas,
      cajas,
      metricas: { ...m, solape: solapamientoDeCajas(cajas) / (m.lienzoAncho * m.lienzoAlto) },
    };
  }, [plantaId, equiposDePlanta, data, agruparPorArea, AR_OBJETIVO]);

  // --- Método escalonado: flujo continuo, límite de área no rectangular --
  // Repartido en vistas: se agregan áreas mientras el ícono más chico siga
  // por encima del mínimo legible; el resto pasa a la vista siguiente.
  const vistasEscalonado = useMemo(() => {
    if (!plantaId || equiposDePlanta.length === 0) return [];
    return repartirEnVistas(equiposDePlanta, data, {
      arObjetivo: AR_OBJETIVO,
      panel: pantalla,
      tamMinPx,
      tamMaxPx,
    }).map((v) => {
      const r = v.layout;
      const areaIconos = r.colocadas.reduce((acc, c) => acc + c.anchoIcono * c.altoIcono, 0);
      const piezas = r.colocadas.map((c) => ({
        eq: c.eq,
        escala: c.escala,
        x: c.x + c.ancho / 2,
        y: c.y + c.altoIcono,
        anchoIcono: c.anchoIcono,
        altoIcono: c.altoIcono,
      }));
      const m = metricas({ ancho: r.ancho, alto: r.alto, areaIconos, arObjetivo: AR_OBJETIVO });
      return {
        piezas,
        cajas: [],
        // El contorno sigue las celdas realmente ocupadas, así que por
        // construcción dos áreas nunca se pisan: el solape es cero.
        contornos: r.spans.flatMap((s) => contornosDeArea(s.spans).map((c) => ({ ...c, areaId: s.areaId }))),
        metricas: { ...m, solape: 0 },
        encuadre: v.encuadre,
        minimoInalcanzable: v.minimoInalcanzable || false,
        areaIds: v.areas.map((a) => a.areaId),
      };
    });
  }, [plantaId, equiposDePlanta, data, tamMinPx, tamMaxPx, pantalla, AR_OBJETIVO]);

  const escalonado = vistasEscalonado[Math.min(vistaActiva, vistasEscalonado.length - 1)] || null;

  // Lienzo COMÚN a todas las vistas: el más grande de todas. Sin esto cada
  // vista se encuadra por su cuenta y el mismo motor se dibuja de distinto
  // tamaño según en qué vista caiga —medido: 39 px en la vista 1 contra 105
  // en la 4, porque la 4 está menos llena y la cámara se le acerca—. Para
  // un operador que cambia de vista, el mismo equipo tiene que verse igual;
  // una vista menos llena debe quedar con aire, no agrandada.
  //
  // Todos los lienzos ya vienen con la proporción del panel (los ajusta
  // `metricas`), así que tomar el máximo de cada lado da el mayor de todos
  // sin deformar nada.
  const lienzoComun = useMemo(() => {
    if (vistasEscalonado.length === 0) return null;
    return {
      ancho: Math.max(...vistasEscalonado.map((v) => v.metricas.lienzoAncho)),
      alto: Math.max(...vistasEscalonado.map((v) => v.metricas.lienzoAlto)),
    };
  }, [vistasEscalonado]);

  // --- Método actual: el compactado de producción, sin escribir nada ---
  const actual = useMemo(() => {
    if (!plantaId || equiposDePlanta.length === 0) return null;
    const { equipos } = calcularLayoutCompacto(data, plantaId, AR_OBJETIVO);
    const ids = new Set(equiposDePlanta.map((eq) => eq.id));
    const piezas = equipos
      .filter((eq) => ids.has(eq.id))
      .map((eq) => {
        const icono = iconoBaseDe(eq.tipo, data);
        if (!icono) return null;
        const escala = escalaVisible(eq, data);
        return {
          eq,
          escala,
          x: eq.posicion.x,
          y: eq.posicion.y,
          anchoIcono: icono.anchoBase * escala,
          altoIcono: icono.altoBase * escala,
        };
      })
      .filter(Boolean);
    if (piezas.length === 0) return null;

    const minX = Math.min(...piezas.map((p) => p.x - p.anchoIcono / 2));
    const maxX = Math.max(...piezas.map((p) => p.x + p.anchoIcono / 2));
    const minY = Math.min(...piezas.map((p) => p.y - p.altoIcono));
    const maxY = Math.max(...piezas.map((p) => p.y + ALTO_TAG));
    const areaIconos = piezas.reduce((acc, p) => acc + p.anchoIcono * p.altoIcono, 0);

    const trasladadas = piezas.map((p) => ({ ...p, x: p.x - minX, y: p.y - minY }));
    const m = metricas({ ancho: maxX - minX, alto: maxY - minY, areaIconos, arObjetivo: AR_OBJETIVO });
    const cajas = cajasPorArea(trasladadas);
    return {
      piezas: trasladadas,
      cajas,
      metricas: { ...m, solape: solapamientoDeCajas(cajas) / (m.lienzoAncho * m.lienzoAlto) },
    };
  }, [plantaId, equiposDePlanta, data, AR_OBJETIVO]);

  const vista = metodo === 'libre' ? libre : metodo === 'escalonado' ? escalonado : actual;

  const filas = [
    { clave: 'actual', nombre: 'Actual · bloques por área', r: actual },
    { clave: 'escalonado', nombre: 'Escalonado · flujo continuo', r: escalonado },
    { clave: 'libre', nombre: `Libre · por equipo${agruparPorArea ? ' (agrupado)' : ''}`, r: libre },
  ];

  return (
    <div className="scada" style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <div style={{ width: 300, flexShrink: 0, padding: 'var(--space-3)', background: 'var(--scada-subpanel)', overflowY: 'auto' }}>
        <h2 style={{ margin: '0 0 var(--space-3)', fontSize: 15, color: 'var(--scada-titulo)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Ensayo de layout
        </h2>

        <p style={{ fontSize: 12, color: 'var(--scada-texto-2)', margin: '0 0 var(--space-3)', lineHeight: 1.5 }}>
          Compara métodos de acomodado sin tocar tus datos: solo previsualiza. El método libre ubica cada equipo
          por separado, sin el rectángulo de área, para ver cuánto lienzo vacío se puede recuperar.
        </p>

        <label style={{ display: 'block', fontSize: 12, color: 'var(--scada-texto-2)', marginBottom: 4 }}>Planta</label>
        <select
          value={plantaId || ''}
          onChange={(e) => setPlantaId(e.target.value)}
          style={{ width: '100%', marginBottom: 'var(--space-3)', background: 'var(--scada-panel)', color: 'var(--scada-texto)', border: '1px solid var(--scada-borde)', padding: 6, fontFamily: 'inherit' }}
        >
          {data.plantas.map((p) => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>

        {/* La pantalla de destino cambia todo: la proporción decide la forma
            que busca el empaquetado, y el área en píxeles decide cuántos
            equipos entran al mismo tamaño legible. Para comparar métodos
            entre sí hay que dejarla fija. */}
        <label style={{ display: 'block', fontSize: 12, color: 'var(--scada-texto-2)', marginBottom: 4 }}>Pantalla de destino</label>
        <select
          value={pantallaId}
          onChange={(e) => { setPantallaId(e.target.value); setVistaActiva(0); }}
          style={{ width: '100%', marginBottom: 4, background: 'var(--scada-panel)', color: 'var(--scada-texto)', border: '1px solid var(--scada-borde)', padding: 6, fontFamily: 'inherit' }}
        >
          {PANTALLAS.map((p) => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
        <p style={{ fontSize: 11.5, color: 'var(--scada-texto-2)', margin: '0 0 var(--space-3)', lineHeight: 1.5 }}>
          {pantalla.ancho} × {pantalla.alto} · proporción {AR_OBJETIVO.toFixed(2)} ·{' '}
          {((pantalla.ancho * pantalla.alto) / (1280 * 720)).toFixed(2)}× el área de la de referencia
        </p>

        <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--space-3)' }}>
          {[{ id: 'actual', t: 'Actual' }, { id: 'escalonado', t: 'Escalonado' }, { id: 'libre', t: 'Libre' }].map((m) => (
            <button
              key={m.id}
              onClick={() => setMetodo(m.id)}
              style={{
                flex: 1,
                padding: '6px 4px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 12,
                background: metodo === m.id ? 'var(--scada-titulo)' : 'var(--scada-panel)',
                color: metodo === m.id ? '#000' : 'var(--scada-texto)',
                border: '1px solid var(--scada-borde)',
              }}
            >
              {m.t}
            </button>
          ))}
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 'var(--space-3)', opacity: metodo === 'libre' ? 1 : 0.45 }}>
          <input type="checkbox" checked={agruparPorArea} disabled={metodo !== 'libre'} onChange={(e) => setAgruparPorArea(e.target.checked)} />
          Agrupar por área
        </label>

        {/* Tamaño del ícono en pantalla. El mínimo no es una preferencia:
            define cuántos equipos entran, porque el encuadre normaliza la
            escala interna y lo único que mueve el tamaño en pantalla es la
            cantidad. Si no entran, hay que repartirlos en varias vistas. */}
        <div style={{ opacity: metodo === 'escalonado' ? 1 : 0.45, marginBottom: 'var(--space-3)' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--scada-texto-2)', marginBottom: 6 }}>
            Tamaño de ícono (px)
          </div>
          {[
            { etiqueta: 'Mínimo', valor: tamMinPx, set: setTamMinPx, min: 10, max: 80 },
            { etiqueta: 'Máximo', valor: tamMaxPx, set: setTamMaxPx, min: 60, max: 400 },
          ].map((c) => (
            <label key={c.etiqueta} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 4 }}>
              <span style={{ width: 52 }}>{c.etiqueta}</span>
              <input
                type="range"
                min={c.min}
                max={c.max}
                value={c.valor}
                disabled={metodo !== 'escalonado'}
                onChange={(e) => { c.set(Number(e.target.value)); setVistaActiva(0); }}
                style={{ flex: 1, minWidth: 0 }}
              />
              <span style={{ width: 34, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{c.valor}</span>
            </label>
          ))}
        </div>

        {metodo === 'escalonado' && vistasEscalonado.length > 0 && (
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--scada-texto-2)', marginBottom: 4 }}>
              Vista {vistasEscalonado.length > 1 ? `(${vistasEscalonado.length} en total)` : '(entra todo en una)'}
            </label>
            <select
              value={Math.min(vistaActiva, vistasEscalonado.length - 1)}
              onChange={(e) => setVistaActiva(Number(e.target.value))}
              style={{ width: '100%', background: 'var(--scada-panel)', color: 'var(--scada-texto)', border: '1px solid var(--scada-borde)', padding: 6, fontFamily: 'inherit' }}
            >
              {vistasEscalonado.map((v, i) => {
                const nombres = v.areaIds.map((id) => areasDePlanta.find((a) => a.id === id)?.nombre).filter(Boolean);
                const resumen = nombres.length <= 2 ? nombres.join(' · ') : `${nombres[0]} … ${nombres[nombres.length - 1]}`;
                return (
                  <option key={v.areaIds.join('-')} value={i}>
                    {i + 1}/{vistasEscalonado.length} — {v.areaIds.length} áreas · {v.piezas.length} equipos — {resumen}
                  </option>
                );
              })}
            </select>
            {escalonado?.encuadre && (
              <p style={{ fontSize: 11.5, color: 'var(--scada-texto-2)', margin: '6px 0 0', lineHeight: 1.5 }}>
                Ícono más chico a {escalonado.encuadre.minPx.toFixed(0)} px, el más grande a {escalonado.encuadre.maxPx.toFixed(0)} px
                {escalonado.encuadre.topado && ' · la cámara frenó en el máximo'}.
                {escalonado.minimoInalcanzable && (
                  <>
                    {' '}
                    <span style={{ color: 'var(--scada-titulo)' }}>
                      El mínimo de {tamMinPx} px no es alcanzable en esta pantalla ni con una sola área, así que partir no ganaría nada: entra todo lo que
                      quedaba en esta vista.
                    </span>
                  </>
                )}
              </p>
            )}
          </div>
        )}

        <table style={{ width: '100%', fontSize: 11.5, borderCollapse: 'collapse', marginBottom: 'var(--space-3)' }}>
          <thead>
            <tr style={{ color: 'var(--scada-texto-2)' }}>
              <th style={{ textAlign: 'left', padding: '4px 0', borderBottom: '1px solid var(--scada-borde)' }}>Método</th>
              <th style={{ textAlign: 'right', padding: '4px 0', borderBottom: '1px solid var(--scada-borde)' }}>Vacío</th>
              <th style={{ textAlign: 'right', padding: '4px 0', borderBottom: '1px solid var(--scada-borde)' }}>Desvío</th>
              <th style={{ textAlign: 'right', padding: '4px 0', borderBottom: '1px solid var(--scada-borde)' }} title="Cuánto se pisan entre sí las cajas de las áreas. Cero = cada área quedó en su propia zona.">Solape</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.clave} style={{ color: metodo === f.clave ? 'var(--scada-titulo)' : 'var(--scada-texto)' }}>
                <td style={{ padding: '5px 0', borderBottom: '1px solid var(--scada-borde)' }}>{f.nombre}</td>
                <td style={{ textAlign: 'right', padding: '5px 0', borderBottom: '1px solid var(--scada-borde)', fontVariantNumeric: 'tabular-nums' }}>
                  {f.r ? `${(f.r.metricas.vacio * 100).toFixed(1)}%` : '—'}
                </td>
                <td style={{ textAlign: 'right', padding: '5px 0', borderBottom: '1px solid var(--scada-borde)', fontVariantNumeric: 'tabular-nums' }}>
                  {f.r ? f.r.metricas.desvio.toFixed(3) : '—'}
                </td>
                <td style={{ textAlign: 'right', padding: '5px 0', borderBottom: '1px solid var(--scada-borde)', fontVariantNumeric: 'tabular-nums' }}>
                  {f.r ? `${(f.r.metricas.solape * 100).toFixed(1)}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {vista && (
          <p style={{ fontSize: 11.5, color: 'var(--scada-texto-2)', lineHeight: 1.6, margin: '0 0 var(--space-3)' }}>
            Contenido {vista.metricas.ancho} × {vista.metricas.alto} · proporción {vista.metricas.ar.toFixed(2)} contra un
            objetivo de {AR_OBJETIVO.toFixed(2)}. Tras el encuadre el lienzo mide {vista.metricas.lienzoAncho} × {vista.metricas.lienzoAlto}.
          </p>
        )}

        <div style={{ fontSize: 11.5, color: 'var(--scada-texto-2)' }}>
          <div style={{ marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Áreas</div>
          {areasDePlanta.map((a) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ width: 10, height: 10, background: colorDeArea[a.id], flexShrink: 0 }} />
              {a.nombre}
            </div>
          ))}
        </div>
      </div>

      <div style={{ flexGrow: 1, minWidth: 0, padding: 'var(--space-3)', background: 'var(--scada-subpanel)' }}>
        {!vista ? (
          <p style={{ color: 'var(--scada-texto-2)' }}>Esta planta no tiene equipos para acomodar.</p>
        ) : (
          <svg
            viewBox={`-20 -20 ${(metodo === 'escalonado' && lienzoComun ? lienzoComun.ancho : vista.metricas.lienzoAncho) + 40} ${(metodo === 'escalonado' && lienzoComun ? lienzoComun.alto : vista.metricas.lienzoAlto) + 40}`}
            preserveAspectRatio="xMinYMin meet"
            style={{ width: '100%', height: '100%', display: 'block' }}
          >
            <defs>
              <linearGradient id="ensayoGradMetal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8f9497" />
                <stop offset="35%" stopColor="#e2e4e5" />
                <stop offset="70%" stopColor="#b0b4b6" />
                <stop offset="100%" stopColor="#6f7477" />
              </linearGradient>
            </defs>

            {/* Borde del lienzo que realmente se vería, ya con el aire que
                agrega el encuadre — es el área contra la que se mide "vacío". */}
            <rect x={0} y={0} width={vista.metricas.lienzoAncho} height={vista.metricas.lienzoAlto} fill="none" stroke="var(--scada-zona)" strokeWidth={1} strokeDasharray="6 4" />

            {/* Cuadro de cada área, calculado igual que en el Portal: de las
                posiciones que quedaron, no reservado de antemano. Si no se
                pisan entre sí, este método puede conservar el cuadro. */}
            {vista.cajas.map((c) => (
              <rect
                key={c.areaId}
                x={c.x}
                y={c.y}
                width={c.ancho}
                height={c.alto}
                fill="none"
                stroke={colorDeArea[c.areaId] || 'var(--scada-zona)'}
                strokeWidth={1}
                strokeDasharray="4 3"
                opacity={0.7}
              />
            ))}

            {/* Límite escalonado: sigue las celdas ocupadas en vez de ser un
                rectángulo, así un área puede cederle a la siguiente el
                sobrante de su última fila sin que los límites se crucen. */}
            {(vista.contornos || []).map((c, i) => (
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
                        <g fill="url(#ensayoGradMetal)" stroke="var(--scada-subpanel)" strokeWidth={1}>{icono.silueta}</g>
                        <rect x={4} y={-10} width={icono.anchoBase - 8} height={8} fill={color} stroke="var(--scada-subpanel)" strokeWidth={1} />
                      </>
                    ) : (
                      <g fill={color} stroke="var(--scada-subpanel)" strokeWidth={1}>{icono.silueta}</g>
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
          </svg>
        )}
      </div>
    </div>
  );
}
