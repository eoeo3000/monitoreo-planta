import React, { useEffect, useMemo, useRef, useState } from 'react';
import { condicionActual } from '../../analista/store';
import { iconoBaseDe } from '../../gerencia/iconos';
import { SCADA_ICONOS } from '../../gerencia/scadaIconos';
import { calcularLayoutCompacto } from '../../gerencia/layout/compactado';
import { escalaVisible } from '../../gerencia/layout/grilla';
import { empaquetarLibre, metricas, cajasPorArea, solapamientoDeCajas, metricasDeCanerias } from '../../gerencia/layout/ensayo';
import { contornosDeArea, repartirEnVistas } from '../../gerencia/layout/escalonado';
import './portalScada.css';

// EDITOR DE PLANTA. Unifica lo que antes eran dos pantallas: el Portal SCADA
// (que editaba posiciones guardadas) y el ensayo de layout (que comparaba
// métodos sin tocar datos). Lo que se arma acá es exactamente lo que muestra
// la Vista de operación — mismo método, mismo reparto en vistas — así que se
// edita viendo el resultado, no una aproximación.
//
// El cambio de modelo que hizo posible unirlas: las posiciones ya NO son
// dato. El escalonado las calcula en cada render desde los tipos y las áreas.
// Lo que una persona autora son las ENTRADAS del layout: las conexiones, los
// tamaños, el mínimo legible que decide cuántas vistas hacen falta, y el
// orden de las áreas. Arrastrar un equipo no guarda un layout: deja un
// override sobre el cálculo (eq.posicionPropia), igual que escalaPropia pisa
// a la escala del tipo. "Restablecer posiciones" los borra.
//
// Todavía no migrado del Portal: quiebres manuales de cañería, títulos de
// área movibles, renombrar y duplicar equipos. Las acciones siguen en el
// store, sin pantalla que las llame.

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

export default function EditorPlanta({
  data,
  plantaId,
  setPlantaId,
  tamanoIcono,
  setTamanoIcono,
  moverEquipoPropio,
  restablecerPosiciones,
  crearConexion,
  eliminarConexion,
  cambiarEscalaTipo,
  cambiarEscalaEquipo,
  restablecerTamanios,
}) {
  const [metodo, setMetodo] = useState('escalonado');
  const [agruparPorArea, setAgruparPorArea] = useState(true);
  // Compartidos con la Vista de operación y persistidos: mover el mínimo acá
  // cambia también cuántas vistas arma esa pantalla. La PANTALLA de abajo, en
  // cambio, es solo de este ensayo.
  const tamMinPx = tamanoIcono.min;
  const tamMaxPx = tamanoIcono.max;
  const setTamMinPx = (min) => setTamanoIcono({ min });
  const setTamMaxPx = (max) => setTamanoIcono({ max });
  const [vistaActiva, setVistaActiva] = useState(0);
  const [verCanerias, setVerCanerias] = useState(false);
  const [pantallaId, setPantallaId] = useState('ref');
  const [panelReal, setPanelReal] = useState(null);
  const svgRef = useRef(null);

  // Edición. El layout se sigue calculando; lo que el usuario mueve queda
  // como override en eq.posicionPropia (ver store.js), igual que escalaPropia
  // pisa a la escala del tipo.
  const [zoom, setZoom] = useState(1);
  const [seleccionado, setSeleccionado] = useState(null);
  const [modoConectar, setModoConectar] = useState(false);
  const [origenConexion, setOrigenConexion] = useState(null);
  const [arrastre, setArrastre] = useState(null); // { id, dx, dy, live }

  // Un punto del evento, en coordenadas del lienzo. Sin esto el arrastre se
  // mueve a distinta velocidad que el puntero, porque el viewBox no está a
  // escala 1:1 con la pantalla.
  const puntoSvg = (evento) => {
    const svg = svgRef.current;
    if (!svg || !svg.createSVGPoint) return null;
    const pt = svg.createSVGPoint();
    pt.x = evento.clientX;
    pt.y = evento.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

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

  // La posición puesta a mano gana sobre la calculada. Se aplica acá, una
  // sola vez, para que la usen por igual el dibujo, las cañerías y el
  // arrastre en curso.
  const conOverride = (piezas) =>
    piezas.map((p) => {
      const enVuelo = arrastre && arrastre.id === p.eq.id ? arrastre.live : null;
      const pp = enVuelo || p.eq.posicionPropia;
      return pp ? { ...p, x: pp.x, y: pp.y, propia: true } : p;
    });

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
    const conPos = conOverride(piezas);
    const cajas = cajasPorArea(conPos);
    return {
      piezas: conPos,
      cajas,
      metricas: { ...m, solape: solapamientoDeCajas(cajas) / (m.lienzoAncho * m.lienzoAlto) },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantaId, equiposDePlanta, data, agruparPorArea, AR_OBJETIVO, arrastre]);

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
        piezas: conOverride(piezas),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantaId, equiposDePlanta, data, tamMinPx, tamMaxPx, pantalla, AR_OBJETIVO, arrastre]);

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

    const trasladadas = conOverride(piezas.map((p) => ({ ...p, x: p.x - minX, y: p.y - minY })));
    const m = metricas({ ancho: maxX - minX, alto: maxY - minY, areaIconos, arObjetivo: AR_OBJETIVO });
    const cajas = cajasPorArea(trasladadas);
    return {
      piezas: trasladadas,
      cajas,
      metricas: { ...m, solape: solapamientoDeCajas(cajas) / (m.lienzoAncho * m.lienzoAlto) },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantaId, equiposDePlanta, data, AR_OBJETIVO, arrastre]);

  const conexionesDePlanta = useMemo(() => data.conexiones.filter((c) => c.plantaId === plantaId), [data.conexiones, plantaId]);

  // Qué le hace cada método a las cañerías. Apagado por defecto: el ruteo
  // esquiva las cajas de todos los equipos, así que con 500 tarda.
  const canerias = useMemo(() => {
    if (!verCanerias || conexionesDePlanta.length === 0) return {};
    const de = (r) => (r ? metricasDeCanerias(r.piezas, conexionesDePlanta, data) : null);
    return { actual: de(actual), escalonado: de(escalonado), libre: de(libre) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verCanerias, conexionesDePlanta, data, actual, escalonado, libre]);

  const vista = metodo === 'libre' ? libre : metodo === 'escalonado' ? escalonado : actual;
  const caneriasVista = canerias[metodo] || null;

  // Lupa: divide el lienzo alrededor de su centro, sin mover el contenido.
  // Es inspección, no layout — el reparto en vistas no la mira.
  const lienzoDibujo =
    metodo === 'escalonado' && lienzoComun
      ? lienzoComun
      : vista
      ? { ancho: vista.metricas.lienzoAncho, alto: vista.metricas.lienzoAlto }
      : { ancho: 100, alto: 100 };
  const vbAncho = (lienzoDibujo.ancho + 40) / zoom;
  const vbAlto = (lienzoDibujo.alto + 40) / zoom;
  const viewBox = `${(lienzoDibujo.ancho + 40) / 2 - vbAncho / 2 - 20} ${(lienzoDibujo.alto + 40) / 2 - vbAlto / 2 - 20} ${vbAncho} ${vbAlto}`;

  const filas = [
    { clave: 'actual', nombre: 'Actual · bloques por área', r: actual, c: canerias.actual },
    { clave: 'escalonado', nombre: 'Escalonado · flujo continuo', r: escalonado, c: canerias.escalonado },
    { clave: 'libre', nombre: `Libre · por equipo${agruparPorArea ? ' (agrupado)' : ''}`, r: libre, c: canerias.libre },
  ];

  return (
    <div className="scada" style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <div style={{ width: 300, flexShrink: 0, padding: 'var(--space-3)', background: 'var(--scada-subpanel)', overflowY: 'auto' }}>
        <h2 style={{ margin: '0 0 var(--space-3)', fontSize: 15, color: 'var(--scada-titulo)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Editor de planta
        </h2>

        <p style={{ fontSize: 12, color: 'var(--scada-texto-2)', margin: '0 0 var(--space-3)', lineHeight: 1.5 }}>
          Lo que armes acá es lo que ve la Vista de operación: mismo método, mismo reparto en vistas. Las posiciones las CALCULA el escalonado — arrastrar un
          equipo deja un override sobre ese cálculo, no un layout guardado.
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

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 'var(--space-3)' }}>
          <input type="checkbox" checked={verCanerias} onChange={(e) => setVerCanerias(e.target.checked)} />
          Cañerías
          <span style={{ color: 'var(--scada-texto-2)', fontSize: 11 }}>(tarda con 500)</span>
        </label>

        <div style={{ borderTop: '1px solid var(--scada-borde)', paddingTop: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--scada-texto-2)', marginBottom: 8 }}>Edición</div>

          <button
            onClick={() => {
              setModoConectar((v) => !v);
              setOrigenConexion(null);
            }}
            style={{ background: 'var(--scada-panel)', color: modoConectar ? 'var(--scada-titulo)' : 'var(--scada-texto)', border: '1px solid var(--scada-borde)', fontFamily: 'inherit', fontSize: 12, padding: '8px 10px', cursor: 'pointer', textAlign: 'left', width: '100%', marginBottom: 6 }}
          >
            {!modoConectar ? '+ Conectar equipos' : !origenConexion ? 'Elegí el equipo de origen…' : 'Elegí el equipo de destino…'}
          </button>

          <button
            onClick={() => {
              if (window.confirm('Esto borra las posiciones que moviste a mano en esta planta y devuelve todos los equipos al layout calculado. También resetea los títulos de área y los TAG movidos. No se puede deshacer. ¿Continuar?')) {
                restablecerPosiciones(plantaId);
              }
            }}
            style={{ background: 'var(--scada-panel)', color: 'var(--scada-texto)', border: '1px solid var(--scada-borde)', fontFamily: 'inherit', fontSize: 12, padding: '8px 10px', cursor: 'pointer', textAlign: 'left', width: '100%', marginBottom: 6 }}
          >
            Restablecer posiciones
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ color: 'var(--scada-texto-2)' }}>Lupa</span>
            <button onClick={() => setZoom((z) => Math.max(0.3, Math.round((z - 0.1) * 100) / 100))} style={{ background: 'var(--scada-panel)', color: 'var(--scada-texto)', border: '1px solid var(--scada-borde)', width: 24, height: 24, cursor: 'pointer' }}>
              −
            </button>
            <span style={{ minWidth: 40, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(3, Math.round((z + 0.1) * 100) / 100))} style={{ background: 'var(--scada-panel)', color: 'var(--scada-texto)', border: '1px solid var(--scada-borde)', width: 24, height: 24, cursor: 'pointer' }}>
              +
            </button>
            {zoom !== 1 && (
              <button onClick={() => setZoom(1)} style={{ background: 'var(--scada-panel)', color: 'var(--scada-texto)', border: '1px solid var(--scada-borde)', fontSize: 11, padding: '4px 6px', cursor: 'pointer' }}>
                100%
              </button>
            )}
          </div>

          <details style={{ marginTop: 8 }}>
            <summary style={{ fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--scada-texto-2)', cursor: 'pointer' }}>
              Tamaños de equipo
            </summary>
            <p style={{ fontSize: 11, color: 'var(--scada-texto-2)', margin: '6px 0', lineHeight: 1.45 }}>
              El tamaño relativo entre tipos decide la densidad y, con ella, cuántas vistas hacen falta. Doble clic sobre un equipo para el suyo propio.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {[...Object.keys(SCADA_ICONOS), ...(data.tiposPersonalizados || []).map((t) => t.clave)].map((tipo) => {
                const esc = data.escalasPorTipo?.[tipo] ?? 1;
                const cambiar = (d) => cambiarEscalaTipo(tipo, Math.min(4, Math.max(0.3, Math.round((esc + d) * 100) / 100)));
                return (
                  <div key={tipo} style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <span style={{ flexGrow: 1, fontSize: 11, textTransform: 'capitalize', padding: '4px 6px', background: 'var(--scada-panel)' }}>{tipo}</span>
                    <button onClick={() => cambiar(-0.1)} style={{ background: 'var(--scada-panel)', color: 'var(--scada-texto)', border: '1px solid var(--scada-borde)', width: 22, height: 22, cursor: 'pointer' }}>−</button>
                    <span style={{ width: 32, textAlign: 'center', fontSize: 11, background: 'var(--scada-panel)', fontVariantNumeric: 'tabular-nums' }}>{esc.toFixed(2)}</span>
                    <button onClick={() => cambiar(0.1)} style={{ background: 'var(--scada-panel)', color: 'var(--scada-texto)', border: '1px solid var(--scada-borde)', width: 22, height: 22, cursor: 'pointer' }}>+</button>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => {
                if (window.confirm('Esto borra los tamaños guardados equipo por equipo en esta planta y los devuelve a las proporciones del catálogo. No se puede deshacer. ¿Continuar?')) {
                  restablecerTamanios(plantaId);
                }
              }}
              style={{ background: 'none', color: 'var(--scada-titulo)', border: 'none', fontSize: 11, cursor: 'pointer', padding: '6px 0 0' }}
            >
              Restablecer tamaños
            </button>
          </details>

          {seleccionado && (
            <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--scada-texto-2)', lineHeight: 1.5 }}>
              {(() => {
                const eq = equiposDePlanta.find((x) => x.id === seleccionado);
                if (!eq) return null;
                const suyas = conexionesDePlanta.filter((c) => c.deId === eq.id || c.aId === eq.id);
                return (
                  <>
                    <div style={{ color: 'var(--scada-texto)', fontWeight: 700 }}>{eq.tag}</div>
                    <div>{eq.tipo}{eq.posicionPropia ? ' · movido a mano' : ' · posición calculada'}</div>
                    {suyas.length > 0 && (
                      <div style={{ marginTop: 4 }}>
                        {suyas.length} conexión{suyas.length > 1 ? 'es' : ''}{' '}
                        <button
                          onClick={() => suyas.forEach((c) => eliminarConexion(c.id))}
                          style={{ background: 'none', color: 'var(--scada-titulo)', border: 'none', fontSize: 11, cursor: 'pointer', padding: 0 }}
                        >
                          borrar todas
                        </button>
                      </div>
                    )}
                    {eq.posicionPropia && (
                      <button
                        onClick={() => moverEquipoPropio(eq.id, null)}
                        style={{ background: 'none', color: 'var(--scada-titulo)', border: 'none', fontSize: 11, cursor: 'pointer', padding: 0, marginTop: 4 }}
                      >
                        volver a la posición calculada
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* Tamaño del ícono en pantalla. El mínimo no es una preferencia:
            define cuántos equipos entran, porque el encuadre normaliza la
            escala interna y lo único que mueve el tamaño en pantalla es la
            cantidad. Si no entran, hay que repartirlos en varias vistas. */}
        <div style={{ opacity: metodo === 'escalonado' ? 1 : 0.45, marginBottom: 'var(--space-3)' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--scada-texto-2)', marginBottom: 6 }}>
            Tamaño de ícono (px)
          </div>
          <p style={{ fontSize: 11, color: 'var(--scada-texto-2)', margin: '0 0 6px', lineHeight: 1.45 }}>
            Compartido con la Vista de operación: moverlo acá cambia también cuántas vistas arma esa pantalla. La pantalla de destino, en cambio, es
            solo de este ensayo.
          </p>
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
            {caneriasVista && (
              <p style={{ fontSize: 11.5, color: 'var(--scada-texto-2)', margin: '6px 0 0', lineHeight: 1.5 }}>
                {caneriasVista.rutas.length} cañerías dibujadas en esta vista
                {caneriasVista.fuera > 0 && `, y ${caneriasVista.fuera} que salen de ella y no se pueden dibujar`}.
              </p>
            )}
          </div>
        )}

        {verCanerias && (
          <p style={{ fontSize: 11, color: 'var(--scada-texto-2)', margin: '0 0 6px', lineHeight: 1.45 }}>
            Cañería y cruces van POR CONEXIÓN: el escalonado rutea solo las de la vista activa y el compactado las de toda la planta, así que los totales
            no serían comparables.
          </p>
        )}

        <table style={{ width: '100%', fontSize: 11.5, borderCollapse: 'collapse', marginBottom: 'var(--space-3)' }}>
          <thead>
            <tr style={{ color: 'var(--scada-texto-2)' }}>
              <th style={{ textAlign: 'left', padding: '4px 0', borderBottom: '1px solid var(--scada-borde)' }}>Método</th>
              <th style={{ textAlign: 'right', padding: '4px 0', borderBottom: '1px solid var(--scada-borde)' }}>Vacío</th>
              <th style={{ textAlign: 'right', padding: '4px 0', borderBottom: '1px solid var(--scada-borde)' }}>Desvío</th>
              <th style={{ textAlign: 'right', padding: '4px 0', borderBottom: '1px solid var(--scada-borde)' }} title="Cuánto se pisan entre sí las cajas de las áreas. Cero = cada área quedó en su propia zona.">Solape</th>
              {verCanerias && (
                <>
                  <th style={{ textAlign: 'right', padding: '4px 0', borderBottom: '1px solid var(--scada-borde)' }} title="Largo medio de cañería POR CONEXIÓN, en unidades del lienzo. Por conexión y no total, porque el escalonado rutea solo las de la vista activa y el total no sería comparable.">Cañería</th>
                  <th style={{ textAlign: 'right', padding: '4px 0', borderBottom: '1px solid var(--scada-borde)' }} title="Cruces entre cañerías POR CONEXIÓN. Es lo que dice si el diagrama queda legible o hecho un ovillo.">Cruces</th>
                </>
              )}
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
                {verCanerias && (
                  <>
                    <td style={{ textAlign: 'right', padding: '5px 0', borderBottom: '1px solid var(--scada-borde)', fontVariantNumeric: 'tabular-nums' }}>
                      {f.c && f.c.rutas.length ? Math.round(f.c.largo / f.c.rutas.length) : '—'}
                    </td>
                    <td style={{ textAlign: 'right', padding: '5px 0', borderBottom: '1px solid var(--scada-borde)', fontVariantNumeric: 'tabular-nums' }}>
                      {f.c && f.c.rutas.length ? (f.c.cruces / f.c.rutas.length).toFixed(2) : '—'}
                    </td>
                  </>
                )}
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
            ref={svgRef}
            viewBox={viewBox}
            preserveAspectRatio="xMinYMin meet"
            style={{ width: '100%', height: '100%', display: 'block', cursor: modoConectar ? 'crosshair' : 'default' }}
            onMouseMove={(e) => {
              if (!arrastre) return;
              const p = puntoSvg(e);
              if (p) setArrastre({ ...arrastre, live: { x: Math.round(p.x + arrastre.dx), y: Math.round(p.y + arrastre.dy) } });
            }}
            onMouseUp={() => {
              if (!arrastre) return;
              if (arrastre.live) moverEquipoPropio(arrastre.id, arrastre.live);
              setArrastre(null);
            }}
            onMouseLeave={() => setArrastre(null)}
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

            {caneriasVista &&
              caneriasVista.rutas.map((r, i) => (
                <path key={`cx-${i}`} d={r.d} fill="none" stroke="var(--scada-tuberia)" strokeWidth={2} strokeLinecap="butt" shapeRendering="crispEdges" />
              ))}

            {vista.piezas.map((p) => {
              const icono = iconoBaseDe(p.eq.tipo, data);
              if (!icono) return null;
              const estado = estadoDe(p.eq);
              const color = estado ? ESTADO_COLOR[estado] : SIN_DIAGNOSTICO;
              const esVasija = TIPOS_VASIJA.includes(p.eq.tipo);
              return (
                <g
                  key={p.eq.id}
                  transform={`translate(${p.x - p.anchoIcono / 2}, ${p.y - p.altoIcono})`}
                  style={{ cursor: modoConectar ? 'crosshair' : 'grab' }}
                  onMouseDown={(e) => {
                    if (modoConectar) return;
                    const q = puntoSvg(e);
                    if (q) setArrastre({ id: p.eq.id, dx: p.x - q.x, dy: p.y - q.y, live: null });
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    const actual = p.eq.escalaPropia ?? data.escalasPorTipo?.[p.eq.tipo] ?? 1;
                    const factor = p.eq.factorAuto ?? 1;
                    const nota = factor !== 1 ? ` Además lleva un factor de ×${factor.toFixed(2)}.` : '';
                    const r = window.prompt(`Tamaño de ${p.eq.tag}: ${actual.toFixed(2)}.${nota} Vacío = usar el del tipo:`, actual.toFixed(2));
                    if (r === null) return;
                    if (r.trim() === '') return cambiarEscalaEquipo(p.eq.id, null);
                    const num = Number(r.replace(',', '.'));
                    if (Number.isFinite(num) && num > 0) cambiarEscalaEquipo(p.eq.id, Math.min(6, Math.max(0.1, num)));
                  }}
                  onClick={() => {
                    if (!modoConectar) {
                      setSeleccionado(p.eq.id === seleccionado ? null : p.eq.id);
                      return;
                    }
                    if (!origenConexion) return setOrigenConexion(p.eq.id);
                    if (origenConexion !== p.eq.id) crearConexion(plantaId, origenConexion, p.eq.id);
                    setOrigenConexion(null);
                  }}
                >
                  {/* Área de clic alrededor del glifo: sin esto solo se
                      agarra el trazo dibujado, que con un ícono chico es
                      casi imposible de acertar. */}
                  <rect
                    x={-8}
                    y={-8}
                    width={p.anchoIcono + 16}
                    height={p.altoIcono + 16}
                    fill="transparent"
                    stroke={p.eq.id === seleccionado || p.eq.id === origenConexion ? 'var(--scada-titulo)' : 'none'}
                    strokeWidth={1}
                    strokeDasharray="3 2"
                  />
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
