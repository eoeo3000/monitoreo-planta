import React, { useCallback, useEffect, useRef, useState } from 'react';
import { condicionActual } from '../../analista/store';
import { SEVERIDAD, SEVERIDAD_ORDEN } from '../../analista/severidad';
import { SCADA_ICONOS, CLASES_ESCALA } from '../../gerencia/scadaIconos';
import { iconoDeTipoPersonalizado } from '../../gerencia/tiposPersonalizados';
import { puertoHacia, puertoElegido, puntoPerimetroCercano, puntoDeManual, rutaPuertos, rutaHaciaPunto } from '../../gerencia/puertos';
import VistaSectores from './VistaSectores';
import './portalScada.css';

// El lienzo se ajusta al contenido real (ver ajustarLienzo más abajo) en
// vez de tener un tamaño fijo — MARGEN_AJUSTE es el aire que se deja
// alrededor de la caja real de zonas+equipos+TAGs al calcular ese ajuste.
const MARGEN_AJUSTE = 24;
const ZOOM_FACTOR_RUEDA = 1.15;
const ZOOM_MIN_REL = 0.25; // 25%
const ZOOM_MAX_REL = 4; // 400%
const ZOOM_UMBRAL_TAGS = 0.5; // por debajo de este zoom relativo, los TAGs se ocultan (mapa de calor)
const FONT_SIZE_TAG_PX = 12; // tamaño del TAG y del título de zona EN PANTALLA, constante sin importar el zoom
const PAD_ZONA = 40; // margen del cuadro punteado de la ubicación alrededor de sus equipos
const PAD_HIT = 8; // margen del área invisible de clic/arrastre alrededor del glifo
const UMBRAL_ARRASTRE = 4; // px de movimiento antes de considerar que es un arrastre y no un clic
const CUADRICULA = 20; // px por celda — al mover un equipo, su posición se ajusta a este tamaño
const ESTADO_COLOR = { normal: 'var(--e-normal)', observacion: 'var(--e-observacion)', alerta: 'var(--e-alerta)', alarma: 'var(--e-alarma)' };
const SIN_DIAGNOSTICO = 'var(--e-sindiagnostico)';
// Regla dura de la piel "Overlook HMI": el único elemento con relieve/degradado
// permitido es el estanque metálico (tanque/agitador) — todo lo demás va plano,
// teñido directamente en el color de estado, sin gradiente ni mezcla.
const TIPOS_VASIJA = ['tanque', 'agitador'];

const ajustarACuadricula = (v) => Math.round(v / CUADRICULA) * CUADRICULA;

// Resuelve el ícono de un tipo tanto si es de fábrica (scadaIconos.js) como
// si fue creado por el usuario (data.tiposPersonalizados) — el resto del
// componente no distingue entre ambos casos.
function iconoBaseDe(tipo, data) {
  if (SCADA_ICONOS[tipo]) return SCADA_ICONOS[tipo];
  const personalizado = (data.tiposPersonalizados || []).find((t) => t.clave === tipo);
  return personalizado ? iconoDeTipoPersonalizado(personalizado) : null;
}

// El tamaño de cada tipo sale de su CLASE fija (mayor/inline/bubble, ver
// scadaIconos.js) — no de una escala libre que rompía la proporción del
// conjunto. El panel "Tamaños de equipo" solo permite un ajuste fino de
// ±20% sobre esa clase (data.escalasPorTipo, ahora un multiplicador
// 0.8-1.2, no una escala absoluta); se clampa también al LEER, no solo al
// escribir, por si quedó un valor viejo guardado bajo el sistema anterior.
// El doble clic sobre UN equipo sigue siendo una excepción libre y
// consciente (eq.escalaPropia, sin clamp) para casos puntuales.
function iconoConEscala(eq, data) {
  const base = iconoBaseDe(eq.tipo, data);
  if (!base) return null;
  if (eq.escalaPropia != null) return { ...base, escala: eq.escalaPropia };
  const escalaBase = CLASES_ESCALA[base.clase] ?? 1;
  const ajusteFino = Math.min(1.2, Math.max(0.8, data.escalasPorTipo?.[eq.tipo] ?? 1));
  return { ...base, escala: escalaBase * ajusteFino };
}

// `conexion` puede traer puertoDe/puertoA (fijados a mano arrastrando el
// extremo) y quiebreManual (el tramo medio movido a mano) — cuando no los
// trae, se comporta como antes: puerto automático según dirección, quiebre
// automático a mitad de camino.
function rutaEntreEquiposScada(conexion, deEq, aEq, posDe, posA, data) {
  const iconoDe = iconoConEscala(deEq, data);
  const iconoA = iconoConEscala(aEq, data);
  if (!iconoDe || !iconoA) return null;
  const puertoDe = puertoElegido(posDe, iconoDe, posA, conexion.puertoDe);
  const puertoA = puertoElegido(posA, iconoA, posDe, conexion.puertoA);
  if (!puertoDe || !puertoA) return null;
  return rutaPuertos(puertoDe, puertoA, conexion.quiebreManual);
}

// Portal de gerencia: gramática visual aparte de Industry (piel "Overlook
// HMI"). Reemplaza también al editor de Planta — mismas funciones de edición
// (mover, conectar, seleccionar/renombrar/duplicar, tamaños por tipo) sobre
// los mismos datos reales, ahora en un único lugar. No incluye KPIs de
// producción, color de tubería por fluido ni tendencias: no hay ninguna
// fuente de esos datos en la app todavía.
export default function PortalSCADA({
  data,
  moverEquipo,
  crearPlanta,
  generarPlantaDePrueba,
  crearConexion,
  eliminarConexion,
  actualizarConexion,
  renombrarEquipo,
  duplicarEquipo,
  cambiarEscalaTipo,
  cambiarEscalaEquipo,
  moverTituloArea,
  moverEtiquetaEquipo,
}) {
  const svgRef = useRef(null);
  const contenidoRef = useRef(null);
  const tagInputRef = useRef(null);
  const [plantaId, setPlantaId] = useState(data.plantas[0]?.id || null);
  // Sector elegido en la Vista de Sectores (null = todavía no se eligió
  // ninguno, o la planta no tiene sectores y se muestra el lienzo completo
  // como siempre). Guarda también los areaIds ya resueltos del grupo para no
  // tener que buscar "sin sector" de nuevo al filtrar.
  const [grupoActivo, setGrupoActivo] = useState(null);
  // Colapsado por defecto en ventanas angostas — hay poco lugar para el
  // panel lateral y el lienzo (la parte importante) sin achicarse de más.
  const [panelColapsado, setPanelColapsado] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1400);
  const [modoEdicion, setModoEdicion] = useState(false);
  // El viewBox real: {x, y, w, h} en unidades de contenido. Se guarda un
  // valor por planta (useRef: no dispara render por sí solo) junto con el
  // ancho de referencia de su último "Ajustar" (el 100% de zoom de esa
  // planta) — así el zoom no se pierde al cambiar de sector y volver, pero
  // una planta nueva (o la primera vez que se abre la pantalla) arranca
  // ajustada al contenido real.
  const [viewport, setViewport] = useState(null);
  const viewportsPorPlanta = useRef({});
  const anchoAjustePorPlanta = useRef({});
  const [escalaPx, setEscalaPx] = useState(1); // unidades de contenido -> px de pantalla, medido de verdad
  const [espacioPresionado, setEspacioPresionado] = useState(false);
  const [paneo, setPaneo] = useState(null); // { startClientX, startClientY, viewportInicial, unidadesPorPxX, unidadesPorPxY }
  const [modoConectar, setModoConectar] = useState(false);
  const [origenConexion, setOrigenConexion] = useState(null);
  const [equipoSeleccionado, setEquipoSeleccionado] = useState(null);
  const [mousePos, setMousePos] = useState(null);
  const [mousedownInfo, setMousedownInfo] = useState(null);
  const [arrastre, setArrastre] = useState(null);
  const [posicionArrastre, setPosicionArrastre] = useState(null);
  // Arrastre de un extremo o del quiebre medio de una conexión ya creada —
  // { id, extremo: 'de'|'a'|'elbo', startX, startY, activo }. `activo` recién
  // pasa a true tras superar el umbral de arrastre, igual que con los nodos:
  // así un clic corto sobre el quiebre sigue sirviendo para eliminar la
  // conexión (comportamiento previo) sin que un pequeño temblor de mano lo
  // confunda con un arrastre.
  const [conexionArrastre, setConexionArrastre] = useState(null);
  // Arrastre del título de una zona — { areaId, startX, startY, offsetBase,
  // activo, live }. `offsetBase` es el desplazamiento ya guardado antes de
  // este arrastre; `live` es el desplazamiento en vivo mientras se arrastra.
  const [tituloArrastre, setTituloArrastre] = useState(null);
  // Arrastre de la etiqueta (TAG) de un equipo — mismo patrón que
  // tituloArrastre, para poder reposicionarla cuando el ícono del equipo
  // (sobre todo uno personalizado) no deja el espacio de abajo libre.
  const [etiquetaArrastre, setEtiquetaArrastre] = useState(null);

  const sectoresDePlanta = (data.sectores || []).filter((s) => s.plantaId === plantaId);
  const areasDePlantaCompleta = data.areas.filter((a) => a.plantaId === plantaId);
  // Mientras se muestra la Vista de Sectores (grupoActivo === null con
  // sectores disponibles), se usan TODAS las áreas de la planta — así la
  // franja de KPIs arriba sigue mostrando el total macro de la planta, y
  // recién al elegir un sector el lienzo (y sus KPIs) se filtran a ese grupo.
  const areasDePlanta = grupoActivo ? areasDePlantaCompleta.filter((a) => grupoActivo.areaIds.includes(a.id)) : areasDePlantaCompleta;
  const equiposDePlanta = data.equipos.filter((eq) => areasDePlanta.some((a) => a.id === eq.areaId));
  const conexionesDePlanta = data.conexiones.filter((c) => c.plantaId === plantaId);

  const posicionDe = (eq) => (posicionArrastre?.id === eq.id ? posicionArrastre : eq.posicion) || { x: 80, y: 80 };
  const estadoDe = (eq) => {
    const cond = condicionActual(eq.id, data.diagnosticos);
    return cond ? cond.severidad : null;
  };

  // KPIs derivados del arreglo de equipos, nunca escritos a mano.
  const conteoPorEstado = equiposDePlanta.reduce((acc, eq) => {
    const est = estadoDe(eq) || 'sinDiagnostico';
    acc[est] = (acc[est] || 0) + 1;
    return acc;
  }, {});

  const peorEstadoDeArea = (area) => {
    const eqs = equiposDePlanta.filter((eq) => eq.areaId === area.id);
    let peor = null;
    eqs.forEach((eq) => {
      const est = estadoDe(eq);
      if (est && (!peor || SEVERIDAD_ORDEN.indexOf(est) > SEVERIDAD_ORDEN.indexOf(peor))) peor = est;
    });
    return peor;
  };

  // La caja "natural" de la zona, calculada solo de las posiciones de los
  // equipos — el título se ancla a su esquina (+8,+14) antes de aplicarle el
  // desplazamiento a mano.
  const cajaEquiposDeArea = (area) => {
    const eqs = equiposDePlanta.filter((eq) => eq.areaId === area.id);
    if (eqs.length === 0) return null;
    // eq.posicion es el CENTRO horizontal y el borde INFERIOR vertical del
    // ícono (bordeInferior === altoBase) — un margen plano sobre ese punto
    // no encierra la silueta real cuando los íconos son altos (tanque y
    // agitador miden 90 de alto): con PAD_ZONA chico, el título terminaba
    // tapado por el propio ícono. Se calcula el borde real de cada equipo
    // (centro ± mitad del ancho, borde inferior menos el alto) y PAD_ZONA
    // queda como lo que debería ser: aire extra alrededor de la silueta.
    const bordes = eqs.map((eq) => {
      const pos = posicionDe(eq);
      const icono = iconoConEscala(eq, data);
      const ancho = icono ? icono.anchoBase * icono.escala : 0;
      const alto = icono ? icono.altoBase * icono.escala : 0;
      return { izq: pos.x - ancho / 2, der: pos.x + ancho / 2, arriba: pos.y - alto, abajo: pos.y };
    });
    const minX = Math.min(...bordes.map((b) => b.izq));
    const maxX = Math.max(...bordes.map((b) => b.der));
    const minY = Math.min(...bordes.map((b) => b.arriba));
    const maxY = Math.max(...bordes.map((b) => b.abajo));
    return {
      x: minX - PAD_ZONA,
      y: minY - PAD_ZONA - 18,
      width: maxX - minX + PAD_ZONA * 2,
      height: maxY - minY + PAD_ZONA * 2 + 18,
    };
  };

  // El cuadro punteado que se dibuja: la caja de los equipos, agrandada si
  // hace falta para seguir encerrando el título — si se arrastra afuera, el
  // cuadro crece con él en vez de dejarlo flotando fuera del borde.
  const PAD_TITULO = 10;
  const cajaVisibleDeArea = (cajaEquipos, tituloX, tituloY) => {
    const x = Math.min(cajaEquipos.x, tituloX - PAD_TITULO);
    const y = Math.min(cajaEquipos.y, tituloY - 14 - PAD_TITULO);
    const maxX = Math.max(cajaEquipos.x + cajaEquipos.width, tituloX + PAD_TITULO);
    const maxY = Math.max(cajaEquipos.y + cajaEquipos.height, tituloY + PAD_TITULO);
    return { x, y, width: maxX - x, height: maxY - y };
  };

  // Ajusta el viewBox a la caja real del contenido ya dibujado (zonas +
  // conexiones + equipos + sus TAGs, medida con getBBox — no una
  // aproximación analítica a mano, así entra el ancho real del texto de
  // cada TAG). Guarda el resultado como el "100% de zoom" de esta planta.
  const ajustarLienzo = useCallback(() => {
    if (!contenidoRef.current) return;
    const caja = contenidoRef.current.getBBox();
    if (!caja.width || !caja.height) return;
    const nuevo = { x: caja.x - MARGEN_AJUSTE, y: caja.y - MARGEN_AJUSTE, w: caja.width + MARGEN_AJUSTE * 2, h: caja.height + MARGEN_AJUSTE * 2 };
    anchoAjustePorPlanta.current[plantaId] = nuevo.w;
    viewportsPorPlanta.current[plantaId] = nuevo;
    setViewport(nuevo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantaId]);

  // Estado inicial al abrir la pantalla y al cambiar de planta: si ya hay
  // un viewport guardado para esta planta se reutiliza (no se pierde al
  // cambiar de sector y volver); si es la primera vez, se ajusta al
  // contenido real apenas termina de pintarse. También depende de
  // grupoActivo: cuando una planta tiene sectores, el primer intento de
  // ajuste ocurre mientras se muestra la Vista de Sectores (sin lienzo
  // montado todavía) y no encuentra nada que medir — recién al entrar a un
  // sector existe contenido real, así que hace falta reintentar en ese
  // momento también.
  useEffect(() => {
    if (!plantaId) return;
    const guardado = viewportsPorPlanta.current[plantaId];
    if (guardado) {
      setViewport(guardado);
      return;
    }
    const id = requestAnimationFrame(ajustarLienzo);
    return () => cancelAnimationFrame(id);
  }, [plantaId, grupoActivo, ajustarLienzo]);

  const minX = viewport?.x ?? 0;
  const minY = viewport?.y ?? 0;
  const maxX = minX + (viewport?.w ?? 800);
  const maxY = minY + (viewport?.h ?? 600);
  const anchoAjusteActual = anchoAjustePorPlanta.current[plantaId] || viewport?.w || 1;
  const zoomRelativo = viewport ? anchoAjusteActual / viewport.w : 1;
  const mostrarTags = zoomRelativo >= ZOOM_UMBRAL_TAGS;
  const fontSizeTag = FONT_SIZE_TAG_PX / escalaPx;

  const puntoSvg = (event) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  // Zoom centrado en el puntero: ancla el punto de contenido que está bajo
  // el cursor (calculado ANTES de tocar el viewport) para que no se mueva
  // en pantalla al hacer zoom — fórmula estándar de "zoom to point".
  const zoomEnPunto = (factor, anclaContenido) => {
    setViewport((v) => {
      if (!v) return v;
      const anchoAjuste = anchoAjustePorPlanta.current[plantaId] || v.w;
      const wMin = anchoAjuste / ZOOM_MAX_REL;
      const wMax = anchoAjuste / ZOOM_MIN_REL;
      const nuevoW = Math.min(wMax, Math.max(wMin, v.w / factor));
      const escalaAplicada = nuevoW / v.w;
      const nuevo = {
        x: anclaContenido.x - (anclaContenido.x - v.x) * escalaAplicada,
        y: anclaContenido.y - (anclaContenido.y - v.y) * escalaAplicada,
        w: nuevoW,
        h: v.h * escalaAplicada,
      };
      viewportsPorPlanta.current[plantaId] = nuevo;
      return nuevo;
    });
  };

  const onWheelLienzo = (event) => {
    if (!viewport) return;
    event.preventDefault();
    const factor = event.deltaY < 0 ? ZOOM_FACTOR_RUEDA : 1 / ZOOM_FACTOR_RUEDA;
    zoomEnPunto(factor, puntoSvg(event));
  };
  // React adjunta onWheel como listener PASIVO por defecto (no deja hacer
  // preventDefault) — hace falta el addEventListener nativo con
  // passive:false para que la rueda haga zoom en vez de (intentar) scrollear
  // la página. onWheelLienzoRef evita closures viejas sobre viewport/plantaId.
  const onWheelLienzoRef = useRef(onWheelLienzo);
  onWheelLienzoRef.current = onWheelLienzo;
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handler = (e) => onWheelLienzoRef.current(e);
    svg.addEventListener('wheel', handler, { passive: false });
    return () => svg.removeEventListener('wheel', handler);
  }, [plantaId]);

  // Pan: botón central en cualquier lado, espacio+arrastre en cualquier
  // lado, o clic izquierdo sobre el FONDO vacío en modo edición (los nodos/
  // títulos/etiquetas/manijas ya frenan la propagación arriba, así que este
  // handler del <svg> solo se dispara cuando el clic no vino de ninguno).
  const onMouseDownFondo = (event) => {
    if (!viewport) return;
    const esCentral = event.button === 1;
    const esFondoEnEdicion = modoEdicion && event.button === 0;
    const esEspacio = espacioPresionado && event.button === 0;
    if (!esCentral && !esFondoEnEdicion && !esEspacio) return;
    event.preventDefault();
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!ctm) return;
    setPaneo({ startClientX: event.clientX, startClientY: event.clientY, viewportInicial: viewport, unidadesPorPxX: 1 / ctm.a, unidadesPorPxY: 1 / ctm.d });
  };

  const onMouseDownNodo = (event, eq) => {
    if (!modoEdicion || event.button !== 0) return; // solo botón izquierdo: el central queda libre para hacer pan
    event.stopPropagation();
    const p = puntoSvg(event);
    const pos = eq.posicion || { x: 80, y: 80 };
    setMousedownInfo({ id: eq.id, startX: p.x, startY: p.y, offsetX: p.x - pos.x, offsetY: p.y - pos.y });
  };

  const onMouseDownExtremoConexion = (event, conexionId, extremo) => {
    if (!modoEdicion || event.button !== 0) return; // solo botón izquierdo: el central queda libre para hacer pan
    event.stopPropagation();
    const p = puntoSvg(event);
    setConexionArrastre({ id: conexionId, extremo, startX: p.x, startY: p.y, activo: false });
  };

  const onMouseDownTitulo = (event, area) => {
    if (!modoEdicion || event.button !== 0) return; // solo botón izquierdo: el central queda libre para hacer pan
    event.stopPropagation();
    const p = puntoSvg(event);
    setTituloArrastre({ areaId: area.id, startX: p.x, startY: p.y, offsetBase: area.tituloOffset || { dx: 0, dy: 0 }, activo: false, live: area.tituloOffset || { dx: 0, dy: 0 } });
  };

  const onMouseDownEtiqueta = (event, eq) => {
    if (!modoEdicion || event.button !== 0) return; // solo botón izquierdo: el central queda libre para hacer pan
    event.stopPropagation();
    const p = puntoSvg(event);
    setEtiquetaArrastre({ id: eq.id, startX: p.x, startY: p.y, offsetBase: eq.etiquetaOffset || { dx: 0, dy: 0 }, activo: false, live: eq.etiquetaOffset || { dx: 0, dy: 0 } });
  };

  // Si al soltar el quiebre medio el punto quedó muy cerca (6px) de un
  // extremo o quiebre de OTRA conexión, se ajusta exacto a esa coordenada en
  // X y/o Y por separado — así dos líneas que se cruzan cerca quedan
  // cuadradas entre sí en vez de casi-alineadas.
  const UMBRAL_ALINEAR = 6;
  const alinearConOtrasLineas = (punto, idExcluir) => {
    let mejorX = null;
    let distX = UMBRAL_ALINEAR;
    let mejorY = null;
    let distY = UMBRAL_ALINEAR;
    conexionesDePlanta.forEach((c) => {
      if (c.id === idExcluir) return;
      const de = equiposDePlanta.find((eq) => eq.id === c.deId);
      const a = equiposDePlanta.find((eq) => eq.id === c.aId);
      if (!de || !a) return;
      const ruta = rutaEntreEquiposScada(c, de, a, posicionDe(de), posicionDe(a), data);
      if (!ruta) return;
      [ruta.inicio, ruta.medio, ruta.fin].forEach((p) => {
        const dx = Math.abs(punto.x - p.x);
        if (dx < distX) {
          distX = dx;
          mejorX = p.x;
        }
        const dy = Math.abs(punto.y - p.y);
        if (dy < distY) {
          distY = dy;
          mejorY = p.y;
        }
      });
    });
    return { x: mejorX ?? punto.x, y: mejorY ?? punto.y };
  };

  // Al soltar un extremo, se ajusta (snap) al puerto declarado más cercano al
  // punto donde se soltó — nunca queda un punto suelto en el aire. Al soltar
  // el quiebre medio, se guarda el punto libre (alineado con otras líneas
  // cercanas si corresponde) — rutaPuertos intercala el tramo extra que haga
  // falta para llegar ortogonal a cada extremo.
  const comprometerConexionArrastre = (arr, pMouse) => {
    const conexion = conexionesDePlanta.find((c) => c.id === arr.id);
    if (!conexion) return;
    const de = equiposDePlanta.find((eq) => eq.id === conexion.deId);
    const a = equiposDePlanta.find((eq) => eq.id === conexion.aId);
    if (!de || !a) return;
    if (arr.extremo === 'elbo') {
      actualizarConexion(conexion.id, { quiebreManual: alinearConOtrasLineas(pMouse, conexion.id) });
      return;
    }
    const eq = arr.extremo === 'de' ? de : a;
    const icono = iconoConEscala(eq, data);
    const puntoLibre = puntoPerimetroCercano(posicionDe(eq), icono, pMouse);
    if (!puntoLibre) return;
    actualizarConexion(conexion.id, arr.extremo === 'de' ? { puertoDe: puntoLibre } : { puertoA: puntoLibre });
  };

  const onMouseMove = (event) => {
    if (paneo) {
      const dxPx = event.clientX - paneo.startClientX;
      const dyPx = event.clientY - paneo.startClientY;
      const nuevo = {
        x: paneo.viewportInicial.x - dxPx * paneo.unidadesPorPxX,
        y: paneo.viewportInicial.y - dyPx * paneo.unidadesPorPxY,
        w: paneo.viewportInicial.w,
        h: paneo.viewportInicial.h,
      };
      viewportsPorPlanta.current[plantaId] = nuevo;
      setViewport(nuevo);
      return;
    }
    const p = puntoSvg(event);
    if (mousedownInfo && !arrastre) {
      const dist = Math.hypot(p.x - mousedownInfo.startX, p.y - mousedownInfo.startY);
      if (dist > UMBRAL_ARRASTRE) {
        setArrastre({ id: mousedownInfo.id, offsetX: mousedownInfo.offsetX, offsetY: mousedownInfo.offsetY });
      }
    }
    if (arrastre) {
      // La cuadrícula ajusta el CENTRO visual, no el punto guardado (que es
      // el borde inferior) — si ajustara el borde inferior directo, dos
      // tipos de alto distinto quedarían con el centro en lugares distintos
      // relativos a la grilla, aunque ambos "calzaran" con sus propios
      // puntos de anclaje.
      const eqArrastrado = equiposDePlanta.find((e) => e.id === arrastre.id);
      const iconoArrastrado = eqArrastrado ? iconoConEscala(eqArrastrado, data) : null;
      const altoIconoArrastrado = iconoArrastrado ? iconoArrastrado.altoBase * iconoArrastrado.escala : 0;
      const xLibre = p.x - arrastre.offsetX;
      const yLibre = p.y - arrastre.offsetY;
      const centroYAjustado = ajustarACuadricula(yLibre - altoIconoArrastrado / 2);
      setPosicionArrastre({
        id: arrastre.id,
        x: ajustarACuadricula(xLibre),
        y: centroYAjustado + altoIconoArrastrado / 2,
      });
    }
    if (modoConectar && origenConexion) {
      setMousePos(p);
    }
    if (conexionArrastre) {
      if (!conexionArrastre.activo) {
        const dist = Math.hypot(p.x - conexionArrastre.startX, p.y - conexionArrastre.startY);
        if (dist > UMBRAL_ARRASTRE) setConexionArrastre((c) => ({ ...c, activo: true }));
      }
      if (conexionArrastre.activo) setMousePos(p);
    }
    if (tituloArrastre) {
      if (!tituloArrastre.activo) {
        const dist = Math.hypot(p.x - tituloArrastre.startX, p.y - tituloArrastre.startY);
        if (dist > UMBRAL_ARRASTRE) setTituloArrastre((t) => ({ ...t, activo: true }));
      }
      if (tituloArrastre.activo) {
        setTituloArrastre((t) => ({ ...t, live: { dx: t.offsetBase.dx + (p.x - t.startX), dy: t.offsetBase.dy + (p.y - t.startY) } }));
      }
    }
    if (etiquetaArrastre) {
      if (!etiquetaArrastre.activo) {
        const dist = Math.hypot(p.x - etiquetaArrastre.startX, p.y - etiquetaArrastre.startY);
        if (dist > UMBRAL_ARRASTRE) setEtiquetaArrastre((t) => ({ ...t, activo: true }));
      }
      if (etiquetaArrastre.activo) {
        setEtiquetaArrastre((t) => ({ ...t, live: { dx: t.offsetBase.dx + (p.x - t.startX), dy: t.offsetBase.dy + (p.y - t.startY) } }));
      }
    }
  };

  const onMouseUp = () => {
    if (paneo) {
      setPaneo(null);
      return;
    }
    if (tituloArrastre) {
      if (tituloArrastre.activo) moverTituloArea(tituloArrastre.areaId, tituloArrastre.live);
      setTituloArrastre(null);
      return;
    }
    if (etiquetaArrastre) {
      if (etiquetaArrastre.activo) moverEtiquetaEquipo(etiquetaArrastre.id, etiquetaArrastre.live);
      setEtiquetaArrastre(null);
      return;
    }
    if (conexionArrastre) {
      if (conexionArrastre.activo && mousePos) {
        comprometerConexionArrastre(conexionArrastre, mousePos);
      } else if (!conexionArrastre.activo && conexionArrastre.extremo === 'elbo') {
        // Sin arrastre real: fue un clic sobre el quiebre, no un arrastre.
        const c = conexionesDePlanta.find((x) => x.id === conexionArrastre.id);
        if (c && window.confirm('¿Eliminar esta conexión?')) eliminarConexion(c.id);
      }
      setConexionArrastre(null);
      setMousePos(null);
      return;
    }
    if (posicionArrastre) {
      moverEquipo(posicionArrastre.id, { x: posicionArrastre.x, y: posicionArrastre.y });
    } else if (mousedownInfo && modoConectar) {
      const eq = equiposDePlanta.find((e) => e.id === mousedownInfo.id);
      if (eq) onClickNodo(eq);
    } else if (mousedownInfo) {
      setEquipoSeleccionado((sel) => (sel === mousedownInfo.id ? null : mousedownInfo.id));
    }
    setMousedownInfo(null);
    setArrastre(null);
    setPosicionArrastre(null);
  };

  // Doble clic: tamaño de ESTE equipo en particular, por encima del tamaño
  // del tipo. Vacío vuelve a usar el tamaño del tipo (quita la sobrescritura).
  const onDobleClickEquipo = (event, eq) => {
    if (!modoEdicion || event.button !== 0) return; // solo botón izquierdo: el central queda libre para hacer pan
    event.stopPropagation();
    const tienePropio = eq.escalaPropia != null;
    const actual = eq.escalaPropia ?? data.escalasPorTipo?.[eq.tipo] ?? 1;
    const origen = tienePropio ? 'personalizado de este equipo' : `heredado del tipo "${eq.tipo}"`;
    const respuesta = window.prompt(`Tamaño de ${eq.tag}: ${actual.toFixed(2)} (${origen}). Vacío = usar el tamaño del tipo:`, actual.toFixed(2));
    if (respuesta === null) return;
    if (respuesta.trim() === '') {
      cambiarEscalaEquipo(eq.id, null);
      return;
    }
    const num = Number(respuesta.replace(',', '.'));
    if (!Number.isFinite(num) || num <= 0) return;
    cambiarEscalaEquipo(eq.id, Math.min(6, Math.max(0.1, num)));
  };

  const onClickNodo = (eq) => {
    if (!origenConexion) {
      setOrigenConexion(eq.id);
    } else if (origenConexion === eq.id) {
      setOrigenConexion(null);
    } else {
      crearConexion(plantaId, origenConexion, eq.id);
      setOrigenConexion(null);
    }
  };

  const alternarModoConectar = () => {
    setModoConectar((m) => !m);
    setOrigenConexion(null);
    setEquipoSeleccionado(null);
  };

  useEffect(() => {
    if (!modoEdicion) return;
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      setOrigenConexion(null);
      setEquipoSeleccionado(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modoEdicion]);

  // Barra espaciadora como modificador de pan, y "0" como atajo de
  // "Ajustar" — funcionan siempre (no solo en modo edición), salvo que el
  // foco esté en un campo de texto (para no interferir con escribir).
  useEffect(() => {
    const enCampoDeTexto = () => ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
    const onKeyDown = (e) => {
      if (enCampoDeTexto()) return;
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setEspacioPresionado(true);
      } else if (e.key === '0' && !e.repeat) {
        ajustarLienzo();
      }
    };
    const onKeyUp = (e) => {
      if (e.code === 'Space') setEspacioPresionado(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [ajustarLienzo]);

  // escalaPx: cuántos px de pantalla mide una unidad de contenido — se usa
  // para que el TAG, el título de zona, el contorno de selección y las
  // manijas de conexión midan siempre lo mismo EN PANTALLA sin importar el
  // zoom. Se recalcula con un ResizeObserver (cambios de tamaño del propio
  // <svg>: ventana, panel lateral) y cada vez que cambia el viewport (zoom/
  // ajustar/pan) — el observer se crea una sola vez y lee el viewport más
  // reciente por ref, para no recrearlo en cada tick de un arrastre.
  const viewportRef = useRef(viewport);
  const recalcularEscalaPx = useCallback(() => {
    const svg = svgRef.current;
    const v = viewportRef.current;
    if (!svg || !v) return;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    setEscalaPx(Math.min(rect.width / v.w, rect.height / v.h));
  }, []);

  useEffect(() => {
    viewportRef.current = viewport;
    recalcularEscalaPx();
  }, [viewport, recalcularEscalaPx]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const obs = new ResizeObserver(recalcularEscalaPx);
    obs.observe(svg);
    return () => obs.disconnect();
  }, [recalcularEscalaPx]);

  useEffect(() => {
    if (equipoSeleccionado && tagInputRef.current) {
      tagInputRef.current.focus();
      tagInputRef.current.select();
    }
  }, [equipoSeleccionado]);

  const agregarPlanta = () => {
    const nombre = window.prompt('Nombre de la nueva planta:');
    if (nombre && nombre.trim()) {
      const id = crearPlanta(nombre.trim());
      setPlantaId(id);
      setGrupoActivo(null);
      setEquipoSeleccionado(null);
    }
  };

  const generarDemoEscala = () => {
    if (
      !window.confirm(
        'Esto crea una planta nueva de prueba con 10 sectores, 200 ubicaciones y 500 equipos de nombres genéricos, para probar la Vista de Sectores. No modifica ninguna planta existente. ¿Continuar?'
      )
    )
      return;
    const id = generarPlantaDePrueba();
    setPlantaId(id);
    setGrupoActivo(null);
    setEquipoSeleccionado(null);
  };

  // Compacta una zona dispersa: reordena sus equipos en una retícula de
  // columnas de 160 y filas de 190 unidades, respetando el orden actual de
  // izquierda a derecha (no se reordena por tipo ni por TAG, solo por
  // dónde está cada uno hoy). El origen de la retícula es la posición del
  // primer equipo (más a la izquierda), así la zona no salta de lugar.
  const POR_FILA_RETICULA = 4;
  const ordenarAreaEnReticula = (area) => {
    const eqs = equiposDePlanta.filter((eq) => eq.areaId === area.id).sort((a, b) => posicionDe(a).x - posicionDe(b).x);
    if (!eqs.length) return;
    const origen = posicionDe(eqs[0]);
    eqs.forEach((eq, i) => {
      moverEquipo(eq.id, { x: origen.x + (i % POR_FILA_RETICULA) * 160, y: origen.y + Math.floor(i / POR_FILA_RETICULA) * 190 });
    });
  };

  return (
    <div className="scada" style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 1, padding: '4px 8px', flexWrap: 'wrap', borderBottom: '1px solid var(--scada-borde)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <select
            value={plantaId || ''}
            onChange={(e) => {
              setPlantaId(e.target.value);
              setGrupoActivo(null);
              setEquipoSeleccionado(null);
            }}
            style={{ background: 'var(--scada-panel)', color: 'var(--scada-texto)', border: '1px solid var(--scada-borde)', fontFamily: 'inherit', fontSize: 13, padding: '0 10px', height: '100%' }}
          >
            {data.plantas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
          <button
            onClick={agregarPlanta}
            title="Nueva planta"
            style={{ background: 'var(--scada-panel)', color: 'var(--scada-texto)', border: '1px solid var(--scada-borde)', fontFamily: 'inherit', fontSize: 15, width: 30, cursor: 'pointer' }}
          >
            +
          </button>
          <button
            onClick={generarDemoEscala}
            title="Generar planta de prueba a gran escala (10 sectores, 200 ubicaciones, 500 equipos)"
            style={{ background: 'var(--scada-panel)', color: 'var(--scada-texto)', border: '1px solid var(--scada-borde)', fontFamily: 'inherit', fontSize: 11, padding: '0 10px', cursor: 'pointer' }}
          >
            Demo escala
          </button>
          {sectoresDePlanta.length > 0 && grupoActivo && (
            <button
              onClick={() => setGrupoActivo(null)}
              style={{ background: 'var(--scada-panel)', color: 'var(--scada-titulo)', border: '1px solid var(--scada-borde)', fontFamily: 'inherit', fontSize: 12, padding: '0 10px', cursor: 'pointer' }}
            >
              ‹ Sectores · {grupoActivo.nombre}
            </button>
          )}
        </div>
        <KpiTile label="Equipos" valor={equiposDePlanta.length} />
        <KpiTile label="Alarma" valor={conteoPorEstado.alarma || 0} color="var(--e-alarma)" />
        <KpiTile label="Alerta" valor={conteoPorEstado.alerta || 0} color="var(--e-alerta)" />
        <KpiTile label="Observación" valor={conteoPorEstado.observacion || 0} color="var(--e-observacion)" />
        <KpiTile label="Normal" valor={conteoPorEstado.normal || 0} color="var(--e-normal)" />
      </div>

      {sectoresDePlanta.length > 0 && !grupoActivo ? (
        <VistaSectores
          sectores={sectoresDePlanta}
          areas={areasDePlantaCompleta}
          equipos={data.equipos.filter((eq) => areasDePlantaCompleta.some((a) => a.id === eq.areaId))}
          diagnosticos={data.diagnosticos}
          onSeleccionar={(grupo) => setGrupoActivo(grupo)}
        />
      ) : (
      <div style={{ display: 'flex', flexGrow: 1, minHeight: 0 }}>
        <div style={{ width: panelColapsado ? 26 : 190, flexShrink: 0, borderRight: '1px solid var(--scada-borde)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <button
            onClick={() => setPanelColapsado((c) => !c)}
            title={panelColapsado ? 'Mostrar panel' : 'Ocultar panel — más espacio para el lienzo'}
            style={{ background: 'var(--scada-panel)', color: 'var(--scada-texto)', border: 'none', borderBottom: '1px solid var(--scada-borde)', cursor: 'pointer', padding: '6px 0', fontSize: 12, flexShrink: 0 }}
          >
            {panelColapsado ? '»' : '«'}
          </button>
          {!panelColapsado && (
          <div style={{ padding: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', overflowY: 'auto', flexGrow: 1, minWidth: 196 }}>
          <div>
            <div style={tituloSeccion}>Sistemas</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {areasDePlanta.map((area) => {
                const peor = peorEstadoDeArea(area);
                return (
                  <div key={area.id} className="scada-sistema" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', fontSize: 12, gap: 4 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{area.nombre}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {modoEdicion && (
                        <button
                          onClick={() => ordenarAreaEnReticula(area)}
                          title="Ordenar en retícula — compacta los equipos de esta zona en columnas/filas parejas"
                          style={{ background: 'none', color: 'var(--scada-texto-2)', border: '1px solid var(--scada-borde)', fontSize: 9, lineHeight: 1, padding: '2px 4px', cursor: 'pointer' }}
                        >
                          ▦
                        </button>
                      )}
                      <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: peor ? ESTADO_COLOR[peor] : SIN_DIAGNOSTICO }} />
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div style={tituloSeccion}>Estado</div>
            {SEVERIDAD_ORDEN.map((s) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, marginBottom: 4 }}>
                <span style={{ width: 8, height: 8, flexShrink: 0, background: ESTADO_COLOR[s] }} />
                {SEVERIDAD[s].label.toUpperCase()}
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span style={{ width: 8, height: 8, flexShrink: 0, background: SIN_DIAGNOSTICO }} />
              SIN DIAGNÓSTICO
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', border: '1px solid var(--scada-borde)', fontSize: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={modoEdicion}
              onChange={(e) => {
                setModoEdicion(e.target.checked);
                setModoConectar(false);
                setOrigenConexion(null);
                setEquipoSeleccionado(null);
              }}
            />
            Modo edición
          </label>
          </div>
          )}
        </div>

        <div style={{ flexGrow: 1, minWidth: 0, padding: 4, background: 'var(--scada-subpanel)', position: 'relative' }}>
          {!plantaId ? (
            <p style={{ color: 'var(--scada-texto-2)' }}>No hay plantas creadas todavía.</p>
          ) : (
            <>
            {modoEdicion && (
              <div
                style={{
                  position: 'absolute',
                  left: 12,
                  bottom: 12,
                  zIndex: 5,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  background: 'var(--scada-panel)',
                  border: '1px solid var(--scada-borde)',
                  padding: 8,
                  width: 240,
                  maxHeight: 'calc(100% - 24px)',
                  overflowY: 'auto',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <span style={{ color: 'var(--scada-texto-2)' }}>Zoom</span>
                  <button
                    onClick={() => zoomEnPunto(1 / ZOOM_FACTOR_RUEDA, { x: (minX + maxX) / 2, y: (minY + maxY) / 2 })}
                    style={{ background: 'var(--scada-panel)', color: 'var(--scada-texto)', border: '1px solid var(--scada-borde)', width: 24, height: 24, cursor: 'pointer' }}
                  >
                    −
                  </button>
                  <span style={{ minWidth: 40, textAlign: 'center' }}>{Math.round(zoomRelativo * 100)}%</span>
                  <button
                    onClick={() => zoomEnPunto(ZOOM_FACTOR_RUEDA, { x: (minX + maxX) / 2, y: (minY + maxY) / 2 })}
                    style={{ background: 'var(--scada-panel)', color: 'var(--scada-texto)', border: '1px solid var(--scada-borde)', width: 24, height: 24, cursor: 'pointer' }}
                  >
                    +
                  </button>
                  <button
                    onClick={ajustarLienzo}
                    title="Ajustar al contenido (tecla 0)"
                    style={{ background: 'var(--scada-panel)', color: 'var(--scada-texto)', border: '1px solid var(--scada-borde)', fontSize: 11, padding: '4px 6px', cursor: 'pointer' }}
                  >
                    Ajustar
                  </button>
                </div>
                <p style={{ fontSize: 10, color: 'var(--scada-texto-2)', margin: 0 }}>
                  Rueda: zoom. Botón central o espacio+arrastre: mover la vista.
                </p>
                <button
                  onClick={alternarModoConectar}
                  style={{
                    background: 'var(--scada-panel)',
                    color: modoConectar ? 'var(--scada-titulo)' : 'var(--scada-texto)',
                    border: `1px solid ${modoConectar ? 'var(--scada-titulo)' : 'var(--scada-borde)'}`,
                    fontFamily: 'inherit',
                    fontSize: 12,
                    padding: '8px 10px',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {!modoConectar ? '+ Conectar equipos' : !origenConexion ? 'Elige el equipo de origen…' : 'Elige el equipo de destino…'}
                </button>
                <p style={{ fontSize: 11, color: 'var(--scada-texto-2)', margin: 0 }}>
                  {modoConectar
                    ? origenConexion
                      ? 'Haz clic en el equipo de destino. Clic de nuevo en el origen, o Esc, para cancelar.'
                      : 'Haz clic en el equipo de origen.'
                    : 'Arrastra un equipo para reposicionarlo, haz clic para seleccionarlo, o activa "Conectar equipos".'}
                </p>

                <details>
                  <summary style={{ ...tituloSeccion, marginBottom: 0, cursor: 'pointer' }}>Tamaños de equipo</summary>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 6 }}>
                    {[...Object.keys(SCADA_ICONOS), ...(data.tiposPersonalizados || []).map((t) => t.clave)].map((tipo) => {
                      const ajusteActual = Math.min(1.2, Math.max(0.8, data.escalasPorTipo?.[tipo] ?? 1));
                      const cambiar = (delta) => cambiarEscalaTipo(tipo, Math.min(1.2, Math.max(0.8, Math.round((ajusteActual + delta) * 100) / 100)));
                      return (
                        <div key={tipo} style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <span style={{ flexGrow: 1, fontSize: 11, textTransform: 'capitalize', padding: '4px 6px', background: 'var(--scada-panel)' }}>{tipo}</span>
                          <button onClick={() => cambiar(-0.05)} style={botonMini}>
                            −
                          </button>
                          <span style={{ width: 40, textAlign: 'center', fontSize: 11, background: 'var(--scada-panel)', fontVariantNumeric: 'tabular-nums' }}>
                            {ajusteActual === 1 ? '0%' : `${ajusteActual > 1 ? '+' : ''}${Math.round((ajusteActual - 1) * 100)}%`}
                          </span>
                          <button onClick={() => cambiar(0.05)} style={botonMini}>
                            +
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </details>

                {!modoConectar &&
                  equipoSeleccionado &&
                  (() => {
                    const eqSel = equiposDePlanta.find((eq) => eq.id === equipoSeleccionado);
                    if (!eqSel) return null;
                    const tienePropio = eqSel.escalaPropia != null;
                    const escalaActual = iconoConEscala(eqSel, data)?.escala ?? 1;
                    const iconoSel = iconoConEscala(eqSel, data);
                    const altoIconoSel = iconoSel ? iconoSel.altoBase * iconoSel.escala : 0;
                    const posSel = eqSel.posicion || { x: 80, y: 80 };
                    return (
                      <div style={{ borderTop: '1px solid var(--scada-borde)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={tituloSeccion}>Equipo seleccionado · {eqSel.tipo}</div>
                        <div style={{ fontSize: 11, color: 'var(--scada-texto-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          Tamaño: {escalaActual.toFixed(2)} ({tienePropio ? 'personalizado de este equipo' : 'de la clase del tipo'})
                          {tienePropio && (
                            <button
                              onClick={() => cambiarEscalaEquipo(eqSel.id, null)}
                              style={{ background: 'none', color: 'var(--scada-titulo)', border: 'none', fontSize: 11, cursor: 'pointer', padding: 0 }}
                            >
                              Quitar
                            </button>
                          )}
                        </div>
                        <input
                          key={eqSel.id}
                          ref={tagInputRef}
                          defaultValue={eqSel.tag}
                          onBlur={(e) => renombrarEquipo(eqSel.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.target.blur();
                          }}
                          style={{ background: 'var(--scada-subpanel)', color: 'var(--scada-texto)', border: '1px solid var(--scada-borde)', fontFamily: 'inherit', fontSize: 13, padding: '6px 8px' }}
                        />
                        <div style={{ display: 'flex', gap: 6 }}>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 10, color: 'var(--scada-texto-2)', flex: 1 }}>
                            X
                            <input
                              key={`${eqSel.id}-x`}
                              type="number"
                              defaultValue={Math.round((eqSel.posicion || { x: 80, y: 80 }).x)}
                              onBlur={(e) => moverEquipo(eqSel.id, { ...(eqSel.posicion || { x: 80, y: 80 }), x: Number(e.target.value) || 0 })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') e.target.blur();
                              }}
                              style={{ background: 'var(--scada-subpanel)', color: 'var(--scada-texto)', border: '1px solid var(--scada-borde)', fontFamily: 'inherit', fontSize: 13, padding: '6px 8px', width: '100%' }}
                            />
                          </label>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 10, color: 'var(--scada-texto-2)', flex: 1 }}>
                            Y
                            <input
                              key={`${eqSel.id}-y`}
                              type="number"
                              defaultValue={Math.round((eqSel.posicion || { x: 80, y: 80 }).y)}
                              onBlur={(e) => moverEquipo(eqSel.id, { ...(eqSel.posicion || { x: 80, y: 80 }), y: Number(e.target.value) || 0 })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') e.target.blur();
                              }}
                              style={{ background: 'var(--scada-subpanel)', color: 'var(--scada-texto)', border: '1px solid var(--scada-borde)', fontFamily: 'inherit', fontSize: 13, padding: '6px 8px', width: '100%' }}
                            />
                          </label>
                        </div>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 10, color: 'var(--scada-texto-2)' }}>
                          Centro Y (compara equipos de cualquier tamaño)
                          <input
                            key={`${eqSel.id}-centroy`}
                            type="number"
                            defaultValue={Math.round(posSel.y - altoIconoSel / 2)}
                            onBlur={(e) => moverEquipo(eqSel.id, { ...posSel, y: Math.round(Number(e.target.value) + altoIconoSel / 2) })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') e.target.blur();
                            }}
                            style={{ background: 'var(--scada-subpanel)', color: 'var(--scada-texto)', border: '1px solid var(--scada-borde)', fontFamily: 'inherit', fontSize: 13, padding: '6px 8px', width: '100%' }}
                          />
                        </label>
                        <p style={{ fontSize: 10, color: 'var(--scada-texto-2)', margin: 0 }}>
                          Arrastrá el TAG del equipo en el lienzo para reposicionarlo (útil cuando un ícono personalizado tapa la etiqueta).
                        </p>
                        {eqSel.etiquetaOffset && (eqSel.etiquetaOffset.dx || eqSel.etiquetaOffset.dy) && (
                          <button
                            onClick={() => moverEtiquetaEquipo(eqSel.id, { dx: 0, dy: 0 })}
                            style={{ background: 'var(--scada-panel)', color: 'var(--scada-texto)', border: '1px solid var(--scada-borde)', fontFamily: 'inherit', fontSize: 12, padding: '8px 10px', cursor: 'pointer' }}
                          >
                            Restablecer posición del TAG
                          </button>
                        )}
                        <button
                          onClick={() => setEquipoSeleccionado(duplicarEquipo(eqSel.id))}
                          style={{ background: 'var(--scada-panel)', color: 'var(--scada-texto)', border: '1px solid var(--scada-borde)', fontFamily: 'inherit', fontSize: 12, padding: '8px 10px', cursor: 'pointer' }}
                        >
                          Duplicar equipo
                        </button>
                      </div>
                    );
                  })()}
              </div>
            )}
            <svg
              ref={svgRef}
              viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
              preserveAspectRatio="xMidYMid meet"
              style={{
                width: '100%',
                height: '100%',
                display: 'block',
                cursor: paneo ? 'grabbing' : espacioPresionado ? 'grab' : modoConectar && origenConexion ? 'crosshair' : undefined,
              }}
              onMouseDown={onMouseDownFondo}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
            >
              <defs>
                <linearGradient id="scadaGradMetal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8f9497" />
                  <stop offset="35%" stopColor="#e2e4e5" />
                  <stop offset="70%" stopColor="#b0b4b6" />
                  <stop offset="100%" stopColor="#6f7477" />
                </linearGradient>
                <pattern id="scadaCuadricula" width={CUADRICULA} height={CUADRICULA} patternUnits="userSpaceOnUse">
                  <circle cx={1} cy={1} r={1} fill="var(--scada-borde)" />
                </pattern>
              </defs>

              {modoEdicion && <rect x={minX} y={minY} width={maxX - minX} height={maxY - minY} fill="url(#scadaCuadricula)" pointerEvents="none" />}

              {/* Único grupo que "Ajustar" mide con getBBox — zonas, conexiones y
                  equipos (con sus TAGs). Deja afuera a propósito la grilla de fondo
                  y las manijas de edición, que no son parte del contenido real. */}
              <g ref={contenidoRef}>
              {areasDePlanta.map((area) => {
                const cajaEquipos = cajaEquiposDeArea(area);
                if (!cajaEquipos) return null;
                const offset = tituloArrastre?.areaId === area.id && tituloArrastre.activo ? tituloArrastre.live : area.tituloOffset || { dx: 0, dy: 0 };
                const tituloX = cajaEquipos.x + 8 + offset.dx;
                const tituloY = cajaEquipos.y + 14 + offset.dy;
                const caja = cajaVisibleDeArea(cajaEquipos, tituloX, tituloY);
                return (
                  <g key={area.id}>
                    <rect className="scada-zona" x={caja.x} y={caja.y} width={caja.width} height={caja.height} fill="none" stroke="var(--scada-zona)" strokeWidth={1} strokeDasharray="4 3" />
                    <g
                      onMouseDown={(e) => onMouseDownTitulo(e, area)}
                      style={{ cursor: !modoEdicion ? 'default' : tituloArrastre?.areaId === area.id ? 'grabbing' : 'grab' }}
                    >
                      <text x={tituloX} y={tituloY} fontSize={fontSizeTag} fontWeight={700} letterSpacing="0.04em" fill="var(--scada-titulo)">
                        {area.nombre.toUpperCase()}
                      </text>
                    </g>
                  </g>
                );
              })}

              {conexionesDePlanta.map((c) => {
                const de = equiposDePlanta.find((eq) => eq.id === c.deId);
                const a = equiposDePlanta.find((eq) => eq.id === c.aId);
                if (!de || !a) return null;
                const ruta = rutaEntreEquiposScada(c, de, a, posicionDe(de), posicionDe(a), data);
                if (!ruta) return null;
                return (
                  <g key={c.id}>
                    <path d={ruta.d} fill="none" stroke="var(--scada-tuberia)" strokeWidth={2} strokeLinecap="butt" shapeRendering="crispEdges" />
                    {!modoEdicion && (
                      <>
                        <circle cx={ruta.inicio.x} cy={ruta.inicio.y} r={2.5} fill="var(--scada-tuberia)" />
                        <circle cx={ruta.fin.x} cy={ruta.fin.y} r={2.5} fill="var(--scada-tuberia)" />
                      </>
                    )}
                  </g>
                );
              })}

              {equiposDePlanta.map((eq) => {
                const icono = iconoConEscala(eq, data);
                if (!icono) return null;
                const pos = posicionDe(eq);
                const estado = estadoDe(eq);
                const colorEstado = estado ? ESTADO_COLOR[estado] : SIN_DIAGNOSTICO;
                const esVasija = TIPOS_VASIJA.includes(eq.tipo);
                const anchoIcono = icono.anchoBase * icono.escala;
                const altoIcono = icono.altoBase * icono.escala;
                const origen = origenConexion === eq.id;
                const seleccionado = equipoSeleccionado === eq.id;
                const offsetEtiqueta = etiquetaArrastre?.id === eq.id && etiquetaArrastre.activo ? etiquetaArrastre.live : eq.etiquetaOffset || { dx: 0, dy: 0 };
                return (
                  <g
                    key={eq.id}
                    transform={`translate(${pos.x - anchoIcono / 2}, ${pos.y - altoIcono})`}
                    onMouseDown={(e) => onMouseDownNodo(e, eq)}
                    onDoubleClick={(e) => onDobleClickEquipo(e, eq)}
                    style={{ cursor: !modoEdicion ? 'default' : arrastre?.id === eq.id ? 'grabbing' : 'grab' }}
                  >
                    <rect
                      x={-PAD_HIT}
                      y={-PAD_HIT}
                      width={anchoIcono + PAD_HIT * 2}
                      height={altoIcono + PAD_HIT * 2}
                      fill="transparent"
                      stroke={seleccionado || origen ? 'var(--scada-titulo)' : 'none'}
                      strokeWidth={seleccionado || origen ? 1.5 / escalaPx : 0}
                      strokeDasharray={origen ? '3 2' : undefined}
                    />
                    <g transform={`scale(${icono.escala})`}>
                      {esVasija ? (
                        <>
                          {/* Único elemento con relieve permitido: el silo/estanque metálico. */}
                          <g fill="url(#scadaGradMetal)" stroke="var(--scada-subpanel)" strokeWidth={1}>
                            {icono.silueta}
                          </g>
                          <rect x={4} y={-10} width={icono.anchoBase - 8} height={8} fill={colorEstado} stroke="var(--scada-subpanel)" strokeWidth={1} />
                        </>
                      ) : (
                        <g fill={colorEstado} stroke="var(--scada-subpanel)" strokeWidth={1}>
                          {icono.silueta}
                        </g>
                      )}
                      {icono.decoracion}
                    </g>
                    {mostrarTags && (
                      <text
                        x={anchoIcono / 2 + offsetEtiqueta.dx}
                        y={altoIcono + 13 + offsetEtiqueta.dy}
                        textAnchor="middle"
                        fontSize={fontSizeTag}
                        fontWeight={700}
                        letterSpacing="0.02em"
                        fill={origen ? 'var(--scada-titulo)' : 'var(--scada-texto)'}
                        style={{ fontVariantNumeric: 'tabular-nums', cursor: !modoEdicion ? 'default' : etiquetaArrastre?.id === eq.id ? 'grabbing' : 'grab' }}
                        onMouseDown={(e) => onMouseDownEtiqueta(e, eq)}
                      >
                        {eq.tag}
                      </text>
                    )}
                  </g>
                );
              })}
              </g>

              {/* Manijas de conexión y previsualizaciones: por encima de los equipos a
                  propósito — si el punto libre quedó pegado al contorno de un equipo,
                  su propio dibujo (pintado después, más arriba) las tapaba y las hacía
                  imposibles de ver o clickear. */}
              {modoEdicion &&
                conexionesDePlanta.map((c) => {
                  const de = equiposDePlanta.find((eq) => eq.id === c.deId);
                  const a = equiposDePlanta.find((eq) => eq.id === c.aId);
                  if (!de || !a) return null;
                  const ruta = rutaEntreEquiposScada(c, de, a, posicionDe(de), posicionDe(a), data);
                  if (!ruta) return null;
                  return (
                    <g key={`manijas-${c.id}`}>
                      <g onMouseDown={(e) => onMouseDownExtremoConexion(e, c.id, 'de')} style={{ cursor: 'grab' }}>
                        <circle cx={ruta.inicio.x} cy={ruta.inicio.y} r={8 / escalaPx} fill="transparent" />
                        <circle cx={ruta.inicio.x} cy={ruta.inicio.y} r={3.5 / escalaPx} fill="var(--scada-tuberia)" stroke="var(--scada-titulo)" strokeWidth={1 / escalaPx} />
                      </g>
                      <g onMouseDown={(e) => onMouseDownExtremoConexion(e, c.id, 'a')} style={{ cursor: 'grab' }}>
                        <circle cx={ruta.fin.x} cy={ruta.fin.y} r={8 / escalaPx} fill="transparent" />
                        <circle cx={ruta.fin.x} cy={ruta.fin.y} r={3.5 / escalaPx} fill="var(--scada-tuberia)" stroke="var(--scada-titulo)" strokeWidth={1 / escalaPx} />
                      </g>
                      <g
                        transform={`translate(${ruta.medio.x}, ${ruta.medio.y})`}
                        onMouseDown={(e) => onMouseDownExtremoConexion(e, c.id, 'elbo')}
                        style={{ cursor: 'move' }}
                      >
                        <circle r={7 / escalaPx} fill="var(--scada-subpanel)" stroke="var(--scada-tuberia)" strokeWidth={1 / escalaPx} />
                        <text textAnchor="middle" dominantBaseline="central" fontSize={9 / escalaPx} fill="var(--scada-texto)">
                          ×
                        </text>
                      </g>
                    </g>
                  );
                })}

              {modoConectar &&
                origenConexion &&
                mousePos &&
                (() => {
                  const eqOrigen = equiposDePlanta.find((eq) => eq.id === origenConexion);
                  if (!eqOrigen) return null;
                  const posOrigen = posicionDe(eqOrigen);
                  const iconoOrigen = iconoConEscala(eqOrigen, data);
                  const puertoOrigen = puertoHacia(posOrigen, iconoOrigen, mousePos);
                  if (!puertoOrigen) return null;
                  const ruta = rutaHaciaPunto(puertoOrigen, mousePos);
                  return <path d={ruta.d} fill="none" stroke="var(--scada-tuberia)" strokeWidth={2} strokeLinecap="round" strokeDasharray="4 3" pointerEvents="none" />;
                })()}

              {conexionArrastre?.activo &&
                mousePos &&
                (() => {
                  const conexion = conexionesDePlanta.find((c) => c.id === conexionArrastre.id);
                  if (!conexion) return null;
                  const de = equiposDePlanta.find((eq) => eq.id === conexion.deId);
                  const a = equiposDePlanta.find((eq) => eq.id === conexion.aId);
                  if (!de || !a) return null;
                  if (conexionArrastre.extremo === 'elbo') {
                    const alineado = alinearConOtrasLineas(mousePos, conexion.id);
                    const rutaTentativa = rutaEntreEquiposScada({ ...conexion, quiebreManual: alineado }, de, a, posicionDe(de), posicionDe(a), data);
                    if (!rutaTentativa) return null;
                    return <path d={rutaTentativa.d} fill="none" stroke="var(--scada-titulo)" strokeWidth={2} strokeDasharray="4 3" pointerEvents="none" />;
                  }
                  const eq = conexionArrastre.extremo === 'de' ? de : a;
                  const icono = iconoConEscala(eq, data);
                  const candidato = puntoPerimetroCercano(posicionDe(eq), icono, mousePos);
                  if (!candidato) return null;
                  const puntoCandidato = puntoDeManual(posicionDe(eq), icono, candidato);
                  return <circle cx={puntoCandidato.x} cy={puntoCandidato.y} r={6} fill="none" stroke="var(--scada-titulo)" strokeWidth={2} pointerEvents="none" />;
                })()}
            </svg>
            </>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

const tituloSeccion = { fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--scada-titulo)', marginBottom: 6 };
const botonMini = { background: 'var(--scada-panel)', color: 'var(--scada-texto)', border: 'none', fontFamily: 'inherit', fontSize: 12, width: 24, cursor: 'pointer' };

function KpiTile({ label, valor, color }) {
  return (
    <div style={{ background: 'var(--scada-panel)', height: 44, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 8, minWidth: 72 }}>
      <span style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--scada-texto-2)' }}>{label}</span>
      <span style={{ fontSize: 18, fontWeight: 700, color: color || 'var(--scada-texto)', fontVariantNumeric: 'tabular-nums' }}>{valor}</span>
    </div>
  );
}
