import React, { useEffect, useRef, useState } from 'react';
import { condicionActual } from '../../analista/store';
import { SEVERIDAD, SEVERIDAD_ORDEN } from '../../analista/severidad';
import { SCADA_ICONOS } from '../../gerencia/scadaIconos';
import { iconoConEscala } from '../../gerencia/iconos';
import { puertoHacia, puertoElegido, puntoPerimetroCercano, puntoDeManual, rutaPuertos, rutaHaciaPunto, cajaEquipo } from '../../gerencia/puertos';
import VistaSectores from './VistaSectores';
import './portalScada.css';

// Tiene que alcanzar para que el cuadro de una ubicación con el ícono más
// alto del catálogo (tanque/agitador, 90 unidades) no quede cortado contra
// el borde del lienzo cuando ese equipo está cerca del origen.
const PAD_LIENZO = 90;
// Tope de qué tan grande puede ponerse el lienzo (evita que un equipo
// aislado fuerce el zoom-out de toda la planta): más allá de esto, el
// encuadre se centra en la mediana de las posiciones en vez de en el
// mínimo/máximo real. Generoso a propósito — este tope solo mira
// posiciones de equipos, no títulos de área, así que si se activa puede
// volver a recortar un título que la medición real (getBBox) sí incluía;
// mejor que rara vez se active en una planta grande pero bien organizada,
// y quede solo para el caso de un equipo realmente aislado (para eso está
// además "Reunir equipos dispersos", que corrige la causa de raíz).
const MAX_LADO_LIENZO = 3500;
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 3;
const ZOOM_PASO = 0.1;
// Tamaño de fuente del TAG, calibrado para que a 100% de zoom se vea con un
// tamaño legible típico de pantallas HMI industriales (aprox. 12-13px en
// una ventana normal) — ni tan chico que cueste leerlo, ni tan grande que
// domine sobre el ícono del equipo.
const FONT_SIZE_TAG = 13;
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
// Separación mínima entre equipos al corregir un solapamiento, y hasta dónde
// se aleja la búsqueda del hueco libre más cercano — mismo patrón en espiral
// que usa puertos.js para buscar un quiebre libre al esquivar una tubería.
const MARGEN_SOLAPAMIENTO = 4;
const RADIO_LIBRE_MAX = 1000;

const cajasSolapan = (a, b, margen) => a.izq - margen < b.der && a.der + margen > b.izq && a.arriba - margen < b.abajo && a.abajo + margen > b.arriba;

// Al soltar un equipo, si su posición final queda pisando a otro, busca en
// espiral (en pasos de CUADRICULA) el hueco libre más cercano — nunca deja
// dos equipos exactamente superpuestos ni el que "gana" el clic dependiendo
// de cuál se dibujó último. Si no encuentra hueco dentro de RADIO_LIBRE_MAX
// (zona realmente saturada), se resigna y deja la posición pedida.
function buscarPosicionSinSolape(posDeseada, iconoMovido, idExcluir, equiposDePlanta, data, posicionDe) {
  const otrasCajas = equiposDePlanta
    .filter((eq) => eq.id !== idExcluir)
    .map((eq) => cajaEquipo(posicionDe(eq), iconoConEscala(eq, data)))
    .filter(Boolean);
  const libre = (pos) => {
    const caja = cajaEquipo(pos, iconoMovido);
    return !otrasCajas.some((otra) => cajasSolapan(caja, otra, MARGEN_SOLAPAMIENTO));
  };
  if (libre(posDeseada)) return posDeseada;
  for (let radio = CUADRICULA; radio <= RADIO_LIBRE_MAX; radio += CUADRICULA) {
    for (let dx = -radio; dx <= radio; dx += CUADRICULA) {
      for (let dy = -radio; dy <= radio; dy += CUADRICULA) {
        if (Math.abs(dx) !== radio && Math.abs(dy) !== radio) continue;
        const candidato = { x: ajustarACuadricula(posDeseada.x + dx), y: ajustarACuadricula(posDeseada.y + dy) };
        if (libre(candidato)) return candidato;
      }
    }
  }
  return posDeseada;
}

// `conexion` puede traer puertoDe/puertoA (fijados a mano arrastrando el
// extremo) y quiebreManual (el tramo medio movido a mano) — cuando no los
// trae, se comporta como antes: puerto automático según dirección, quiebre
// automático a mitad de camino (o esquivando obstáculos si `cajasEquipos`
// trae las cajas de los demás equipos de la planta — ver rutaPuertos).
function rutaEntreEquiposScada(conexion, deEq, aEq, posDe, posA, data, cajasEquipos) {
  const iconoDe = iconoConEscala(deEq, data);
  const iconoA = iconoConEscala(aEq, data);
  if (!iconoDe || !iconoA) return null;
  const puertoDe = puertoElegido(posDe, iconoDe, posA, conexion.puertoDe);
  const puertoA = puertoElegido(posA, iconoA, posDe, conexion.puertoA);
  if (!puertoDe || !puertoA) return null;
  const obstaculos = cajasEquipos ? cajasEquipos.filter((c) => c.id !== deEq.id && c.id !== aEq.id).map((c) => c.caja) : undefined;
  return rutaPuertos(puertoDe, puertoA, conexion.quiebreManual, obstaculos);
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
  reunirEquiposDispersos,
  compactarPlanta,
}) {
  const svgRef = useRef(null);
  // Tamaño real en píxeles del panel del lienzo — lo usa el encuadre de más
  // abajo para estirar el rectángulo visible a la proporción exacta del
  // panel (ver anchoFinal/altoFinal) y evitar que preserveAspectRatio deje
  // franjas vacías (letterboxing) repartidas en los bordes.
  const [tamanioSvg, setTamanioSvg] = useState(null);
  const contenidoRef = useRef(null);
  // Caja real del contenido (zonas + títulos + conexiones + equipos + sus
  // TAGs), medida con getBBox() después de cada render — no una
  // aproximación a mano a partir de las posiciones de los equipos, que se
  // queda corta con títulos arrastrados aparte o TAGs largos y deja algo
  // asomando por el borde del lienzo.
  const [cajaMedida, setCajaMedida] = useState(null);
  const tagInputRef = useRef(null);
  const [plantaId, setPlantaId] = useState(data.plantas[0]?.id || null);
  // Sector elegido en la Vista de Sectores (null = todavía no se eligió
  // ninguno, o la planta no tiene sectores y se muestra el lienzo completo
  // como siempre). Guarda también los areaIds ya resueltos del grupo para no
  // tener que buscar "sin sector" de nuevo al filtrar.
  const [grupoActivo, setGrupoActivo] = useState(null);
  const [panelColapsado, setPanelColapsado] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [zoomLienzo, setZoomLienzo] = useState(1);
  const cambiarZoomLienzo = (delta) => setZoomLienzo((z) => Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z + delta)) * 100) / 100);
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
  // Caja de cada equipo de la planta, recalculada en cada render — la usa el
  // ruteo de conexiones (rutaEntreEquiposScada) para saber qué esquivar al
  // trazar una tubería. Vive acá y no dentro de rutaEntreEquiposScada porque
  // esta última se llama una vez por conexión y no tiene por qué recorrer
  // todos los equipos cada vez.
  const cajasEquiposPlanta = equiposDePlanta
    .map((eq) => ({ id: eq.id, caja: cajaEquipo(posicionDe(eq), iconoConEscala(eq, data)) }))
    .filter((c) => c.caja);
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
    const bordes = eqs.map((eq) => cajaEquipo(posicionDe(eq), iconoConEscala(eq, data)) || { izq: 0, der: 0, arriba: 0, abajo: 0 });
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

  // Caja del lienzo: se ajusta a lo que REALMENTE está dibujado (medido con
  // getBBox más abajo) — no un tamaño fijo ni una aproximación a partir de
  // las posiciones de los equipos, que no ve títulos arrastrados aparte ni
  // el ancho real de los TAGs y deja cosas asomando por el borde. Mientras
  // no haya una medición todavía (primer render) se usa un cálculo a partir
  // de los equipos como piso de emergencia. Un único equipo aislado no
  // puede estirar el lienzo sin límite gracias a MAX_LADO_LIENZO (se centra
  // en la mediana en ese caso). El zoom manual (panel, solo en modo
  // edición) divide este tamaño ya ajustado, no un tamaño fijo.
  const posicionesEquipos = equiposDePlanta.map(posicionDe);
  const xsEquipos = posicionesEquipos.map((p) => p.x);
  const ysEquipos = posicionesEquipos.map((p) => p.y);
  const MARGEN_MEDIDO = 24;
  let baseMinX;
  let baseMinY;
  let baseMaxX;
  let baseMaxY;
  if (cajaMedida) {
    baseMinX = cajaMedida.x - MARGEN_MEDIDO;
    baseMinY = cajaMedida.y - MARGEN_MEDIDO;
    baseMaxX = cajaMedida.x + cajaMedida.width + MARGEN_MEDIDO;
    baseMaxY = cajaMedida.y + cajaMedida.height + MARGEN_MEDIDO;
  } else {
    baseMinX = (xsEquipos.length ? Math.min(...xsEquipos) : 0) - PAD_LIENZO;
    baseMinY = (ysEquipos.length ? Math.min(...ysEquipos) : 0) - PAD_LIENZO;
    baseMaxX = (xsEquipos.length ? Math.max(...xsEquipos) : 900) + PAD_LIENZO;
    baseMaxY = (ysEquipos.length ? Math.max(...ysEquipos) : 900) + PAD_LIENZO;
  }
  const mediana = (valores) => {
    const ordenados = [...valores].sort((a, b) => a - b);
    const n = ordenados.length;
    if (!n) return 0;
    const mitad = Math.floor(n / 2);
    return n % 2 ? ordenados[mitad] : (ordenados[mitad - 1] + ordenados[mitad]) / 2;
  };
  if (baseMaxX - baseMinX > MAX_LADO_LIENZO) {
    const centroX = mediana(xsEquipos);
    baseMinX = centroX - MAX_LADO_LIENZO / 2;
    baseMaxX = centroX + MAX_LADO_LIENZO / 2;
  }
  if (baseMaxY - baseMinY > MAX_LADO_LIENZO) {
    const centroY = mediana(ysEquipos);
    baseMinY = centroY - MAX_LADO_LIENZO / 2;
    baseMaxY = centroY + MAX_LADO_LIENZO / 2;
  }
  const centroXBase = (baseMinX + baseMaxX) / 2;
  const centroYBase = (baseMinY + baseMaxY) / 2;
  const anchoBase = (baseMaxX - baseMinX) / zoomLienzo;
  const altoBase = (baseMaxY - baseMinY) / zoomLienzo;
  const minX = centroXBase - anchoBase / 2;
  const minY = centroYBase - altoBase / 2;
  // Si ya se conoce la proporción real del panel (tamanioSvg, medido más
  // abajo), se estira SOLO el lado que haga falta — nunca los dos — para
  // igualar esa proporción, sin mover minX/minY. El aire de más que hace
  // falta agregar para calzar la proporción queda siempre a la derecha o
  // abajo, nunca a la izquierda ni arriba: junto con
  // preserveAspectRatio="xMinYMin meet" del <svg>, el contenido arranca
  // pegado a la esquina superior izquierda del panel en vez de quedar
  // centrado con aire sobrante repartido en los cuatro bordes — y de paso
  // deja el zoom al máximo posible sin recortar nada.
  let anchoFinal = anchoBase;
  let altoFinal = altoBase;
  if (tamanioSvg && tamanioSvg.ancho > 0 && tamanioSvg.alto > 0) {
    const arPanel = tamanioSvg.ancho / tamanioSvg.alto;
    const arContenido = anchoBase / altoBase;
    if (arContenido < arPanel) {
      anchoFinal = altoBase * arPanel;
    } else {
      altoFinal = anchoBase / arPanel;
    }
  }
  const maxX = minX + anchoFinal;
  const maxY = minY + altoFinal;

  // Mide el tamaño real en píxeles del panel después de cada render (mismo
  // patrón que la medición de cajaMedida, más abajo: sin lista de
  // dependencias puntual, con guard de "sin cambios reales" para no entrar
  // en loop) — más un listener de resize de la ventana, que no dispara un
  // re-render por sí solo.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const medir = () => {
      const el = svgRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      setTamanioSvg((prev) =>
        prev && Math.abs(prev.ancho - rect.width) < 1 && Math.abs(prev.alto - rect.height) < 1 ? prev : { ancho: rect.width, alto: rect.height }
      );
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  });

  // Mide la caja real del contenido después de cada render (no engancha a
  // ninguna dependencia puntual — moverse, arrastrar un título, crear un
  // equipo, cambiar de planta, todo cambia el DOM y amerita re-medir). El
  // guard de "sin cambios reales" de más abajo (no una lista de
  // dependencias) es lo que evita que esto dispare un loop de renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!contenidoRef.current) return;
    const caja = contenidoRef.current.getBBox();
    if (!caja.width || !caja.height) return;
    setCajaMedida((prev) => {
      if (prev && Math.abs(prev.x - caja.x) < 0.5 && Math.abs(prev.y - caja.y) < 0.5 && Math.abs(prev.width - caja.width) < 0.5 && Math.abs(prev.height - caja.height) < 0.5) {
        return prev;
      }
      return { x: caja.x, y: caja.y, width: caja.width, height: caja.height };
    });
  });

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

  const onMouseDownNodo = (event, eq) => {
    if (!modoEdicion) return;
    event.stopPropagation();
    const p = puntoSvg(event);
    const pos = eq.posicion || { x: 80, y: 80 };
    setMousedownInfo({ id: eq.id, startX: p.x, startY: p.y, offsetX: p.x - pos.x, offsetY: p.y - pos.y });
  };

  const onMouseDownExtremoConexion = (event, conexionId, extremo) => {
    if (!modoEdicion) return;
    event.stopPropagation();
    const p = puntoSvg(event);
    setConexionArrastre({ id: conexionId, extremo, startX: p.x, startY: p.y, activo: false });
  };

  const onMouseDownTitulo = (event, area) => {
    if (!modoEdicion) return;
    event.stopPropagation();
    const p = puntoSvg(event);
    setTituloArrastre({ areaId: area.id, startX: p.x, startY: p.y, offsetBase: area.tituloOffset || { dx: 0, dy: 0 }, activo: false, live: area.tituloOffset || { dx: 0, dy: 0 } });
  };

  const onMouseDownEtiqueta = (event, eq) => {
    if (!modoEdicion) return;
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
      const ruta = rutaEntreEquiposScada(c, de, a, posicionDe(de), posicionDe(a), data, cajasEquiposPlanta);
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
      const eqArrastrado = equiposDePlanta.find((e) => e.id === posicionArrastre.id);
      const iconoArrastrado = eqArrastrado ? iconoConEscala(eqArrastrado, data) : null;
      const posFinal = iconoArrastrado
        ? buscarPosicionSinSolape({ x: posicionArrastre.x, y: posicionArrastre.y }, iconoArrastrado, posicionArrastre.id, equiposDePlanta, data, posicionDe)
        : { x: posicionArrastre.x, y: posicionArrastre.y };
      moverEquipo(posicionArrastre.id, posFinal);
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
    if (!modoEdicion) return;
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

  return (
    <div className="scada" style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 1, padding: 'var(--space-3)', flexWrap: 'wrap', borderBottom: '1px solid var(--scada-borde)' }}>
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
        <div style={{ width: panelColapsado ? 26 : 220, flexShrink: 0, borderRight: '1px solid var(--scada-borde)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
                  <div key={area.id} className="scada-sistema" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', fontSize: 12 }}>
                    <span>{area.nombre}</span>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: peor ? ESTADO_COLOR[peor] : SIN_DIAGNOSTICO }} />
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

          {modoEdicion && (
            <>
              <button
                onClick={() => {
                  if (window.confirm('Esto reubica los equipos que quedaron lejos del resto, pegándolos al grupo principal. No se puede deshacer. ¿Continuar?')) {
                    reunirEquiposDispersos(plantaId);
                  }
                }}
                title="Busca equipos alejados del resto de la planta y los reubica junto al grupo principal"
                style={{ background: 'var(--scada-panel)', color: 'var(--scada-texto)', border: '1px solid var(--scada-borde)', fontFamily: 'inherit', fontSize: 12, padding: '8px 10px', cursor: 'pointer', textAlign: 'left' }}
              >
                Reunir equipos dispersos
              </button>
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      'Esto reacomoda TODOS los equipos de la planta en una grilla apretada, área por área, agranda los equipos mientras eso siga aprovechando mejor el espacio del panel, y reubica las áreas mismas una al lado de la otra sin huecos (según la proporción real del panel). También fija el tamaño de cada equipo (ya no va a cambiar solo si después ajustás el tamaño del tipo) y resetea los quiebres/puertos de conexión, los títulos de área y los TAG movidos a mano (vuelven a su posición por defecto). No se puede deshacer. ¿Continuar?'
                    )
                  ) {
                    compactarPlanta(plantaId, tamanioSvg ? tamanioSvg.ancho / tamanioSvg.alto : undefined);
                  }
                }}
                title="Reacomoda y agranda equipos y áreas para aprovechar al máximo el espacio del panel"
                style={{ background: 'var(--scada-panel)', color: 'var(--scada-texto)', border: '1px solid var(--scada-borde)', fontFamily: 'inherit', fontSize: 12, padding: '8px 10px', cursor: 'pointer', textAlign: 'left' }}
              >
                Compactar planta
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <span style={{ color: 'var(--scada-texto-2)' }}>Zoom</span>
                <button
                  onClick={() => cambiarZoomLienzo(-ZOOM_PASO)}
                  style={{ background: 'var(--scada-panel)', color: 'var(--scada-texto)', border: '1px solid var(--scada-borde)', width: 24, height: 24, cursor: 'pointer' }}
                >
                  −
                </button>
                <span style={{ minWidth: 40, textAlign: 'center' }}>{Math.round(zoomLienzo * 100)}%</span>
                <button
                  onClick={() => cambiarZoomLienzo(ZOOM_PASO)}
                  style={{ background: 'var(--scada-panel)', color: 'var(--scada-texto)', border: '1px solid var(--scada-borde)', width: 24, height: 24, cursor: 'pointer' }}
                >
                  +
                </button>
                {zoomLienzo !== 1 && (
                  <button
                    onClick={() => setZoomLienzo(1)}
                    style={{ background: 'var(--scada-panel)', color: 'var(--scada-texto)', border: '1px solid var(--scada-borde)', fontSize: 11, padding: '4px 6px', cursor: 'pointer' }}
                  >
                    100%
                  </button>
                )}
              </div>
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
                    const escalaActual = data.escalasPorTipo?.[tipo] ?? 1;
                    const cambiar = (delta) => cambiarEscalaTipo(tipo, Math.min(4, Math.max(0.3, Math.round((escalaActual + delta) * 100) / 100)));
                    return (
                      <div key={tipo} style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <span style={{ flexGrow: 1, fontSize: 11, textTransform: 'capitalize', padding: '4px 6px', background: 'var(--scada-panel)' }}>{tipo}</span>
                        <button onClick={() => cambiar(-0.1)} style={botonMini}>
                          −
                        </button>
                        <span style={{ width: 32, textAlign: 'center', fontSize: 11, background: 'var(--scada-panel)', fontVariantNumeric: 'tabular-nums' }}>{escalaActual.toFixed(2)}</span>
                        <button onClick={() => cambiar(0.1)} style={botonMini}>
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
                  const escalaActual = eqSel.escalaPropia ?? data.escalasPorTipo?.[eqSel.tipo] ?? 1;
                  const iconoSel = iconoConEscala(eqSel, data);
                  const altoIconoSel = iconoSel ? iconoSel.altoBase * iconoSel.escala : 0;
                  const posSel = eqSel.posicion || { x: 80, y: 80 };
                  return (
                    <div style={{ borderTop: '1px solid var(--scada-borde)', paddingTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={tituloSeccion}>Equipo seleccionado · {eqSel.tipo}</div>
                      <div style={{ fontSize: 11, color: 'var(--scada-texto-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        Tamaño: {escalaActual.toFixed(2)} ({tienePropio ? 'personalizado de este equipo' : 'del tipo'})
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
                        "Y" alinea bordes inferiores — solo coincide con el centro si ambos equipos miden lo mismo de alto. Para alinear
                        centros entre equipos de tamaños distintos, usa el mismo "Centro Y" en los dos.
                      </p>
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
            </>
          )}
          </div>
          )}
        </div>

        <div style={{ flexGrow: 1, minWidth: 0, padding: 'var(--space-3)', background: 'var(--scada-subpanel)' }}>
          {!plantaId ? (
            <p style={{ color: 'var(--scada-texto-2)' }}>No hay plantas creadas todavía.</p>
          ) : (
            <svg
              ref={svgRef}
              viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
              preserveAspectRatio="xMinYMin meet"
              style={{ width: '100%', height: '100%', display: 'block', cursor: modoConectar && origenConexion ? 'crosshair' : undefined }}
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

              {/* Único grupo que se mide con getBBox para el ajuste del lienzo —
                  zonas, títulos, conexiones y equipos con sus TAGs. Deja afuera a
                  propósito la grilla de fondo y las manijas/previsualizaciones de
                  edición, que no son parte del contenido real de la planta. */}
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
                      <text x={tituloX} y={tituloY} fontSize={13} fontWeight={700} letterSpacing="0.04em" fill="var(--scada-titulo)">
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
                const ruta = rutaEntreEquiposScada(c, de, a, posicionDe(de), posicionDe(a), data, cajasEquiposPlanta);
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
                      strokeWidth={seleccionado || origen ? 1 : 0}
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
                    <text
                      x={anchoIcono / 2 + offsetEtiqueta.dx}
                      y={altoIcono + 13 + offsetEtiqueta.dy}
                      textAnchor="middle"
                      fontSize={FONT_SIZE_TAG}
                      fontWeight={700}
                      letterSpacing="0.02em"
                      fill={origen ? 'var(--scada-titulo)' : 'var(--scada-texto)'}
                      style={{ fontVariantNumeric: 'tabular-nums', cursor: !modoEdicion ? 'default' : etiquetaArrastre?.id === eq.id ? 'grabbing' : 'grab' }}
                      onMouseDown={(e) => onMouseDownEtiqueta(e, eq)}
                    >
                      {eq.tag}
                    </text>
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
                  const ruta = rutaEntreEquiposScada(c, de, a, posicionDe(de), posicionDe(a), data, cajasEquiposPlanta);
                  if (!ruta) return null;
                  return (
                    <g key={`manijas-${c.id}`}>
                      <g onMouseDown={(e) => onMouseDownExtremoConexion(e, c.id, 'de')} style={{ cursor: 'grab' }}>
                        <circle cx={ruta.inicio.x} cy={ruta.inicio.y} r={8} fill="transparent" />
                        <circle cx={ruta.inicio.x} cy={ruta.inicio.y} r={3.5} fill="var(--scada-tuberia)" stroke="var(--scada-titulo)" strokeWidth={1} />
                      </g>
                      <g onMouseDown={(e) => onMouseDownExtremoConexion(e, c.id, 'a')} style={{ cursor: 'grab' }}>
                        <circle cx={ruta.fin.x} cy={ruta.fin.y} r={8} fill="transparent" />
                        <circle cx={ruta.fin.x} cy={ruta.fin.y} r={3.5} fill="var(--scada-tuberia)" stroke="var(--scada-titulo)" strokeWidth={1} />
                      </g>
                      <g
                        transform={`translate(${ruta.medio.x}, ${ruta.medio.y})`}
                        onMouseDown={(e) => onMouseDownExtremoConexion(e, c.id, 'elbo')}
                        style={{ cursor: 'move' }}
                      >
                        <circle r={7} fill="var(--scada-subpanel)" stroke="var(--scada-tuberia)" strokeWidth={1} />
                        <text textAnchor="middle" dominantBaseline="central" fontSize={9} fill="var(--scada-texto)">
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
                    const rutaTentativa = rutaEntreEquiposScada({ ...conexion, quiebreManual: alineado }, de, a, posicionDe(de), posicionDe(a), data, cajasEquiposPlanta);
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
    <div style={{ background: 'var(--scada-panel)', padding: '4px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 72 }}>
      <span style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--scada-texto-2)' }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 700, color: color || 'var(--scada-texto)', fontVariantNumeric: 'tabular-nums' }}>{valor}</span>
    </div>
  );
}
