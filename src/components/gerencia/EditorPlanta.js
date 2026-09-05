import React, { useEffect, useMemo, useRef, useState } from 'react';
import { condicionActual } from '../../analista/store';
import { iconoBaseDe } from '../../gerencia/iconos';
import { puntoPerimetroCercano, puertoElegido, puertoHacia, rutaHaciaPunto, rutaEntreEquipos } from '../../gerencia/puertos';
import { SCADA_ICONOS } from '../../gerencia/scadaIconos';
import { calcularLayoutCompacto } from '../../gerencia/layout/compactado';
import { escalaVisible, anchoDeTitulo } from '../../gerencia/layout/grilla';
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
// Del Portal se conservan sus herramientas de autoría: arrastre de equipos,
// quiebres manuales de cañería (el tirador redondo sobre cada trazo; doble
// clic lo suelta), títulos de área movibles, zoom, renombrar y duplicar
// equipos, y el generador de la planta de prueba.

const ESTADO_COLOR = { normal: 'var(--e-normal)', observacion: 'var(--e-observacion)', alerta: 'var(--e-alerta)', alarma: 'var(--e-alarma)' };
const SIN_DIAGNOSTICO = 'var(--e-sindiagnostico)';
const TIPOS_VASIJA = ['tanque', 'agitador'];
const FONT_SIZE_TAG = 13;
// Alto de una línea de título de área: lo que baja un título al esquivar a otro.
const ALTO_TITULO_TXT = 16;
// Largo del cabo del conector de salida (la conexión que sigue en otra vista).
const LARGO_SALIDA = 20;
const DIR_VECTOR_SALIDA = { N: { x: 0, y: -1 }, S: { x: 0, y: 1 }, E: { x: 1, y: 0 }, W: { x: -1, y: 0 } };
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
  renombrarEquipo,
  duplicarEquipo,
  moverTituloArea,
  actualizarConexion,
  generarPlantaDePrueba,
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
  const [tituloArrastre, setTituloArrastre] = useState(null); // { areaId, dx, dy, live }
  const [quiebreArrastre, setQuiebreArrastre] = useState(null); // { conexionId, live }
  // La conexión elegida. Las manijas de sus EXTREMOS se dibujan solo para
  // ella: con 173 cañerías en la vista de la demo, dos manijas por conexión
  // taparían el dibujo. El codo, en cambio, está siempre: es por donde se
  // la agarra.
  const [conexionSel, setConexionSel] = useState(null);
  const [extremoArrastre, setExtremoArrastre] = useState(null); // { conexionId, extremo: 'de'|'a', live }
  // Puntero mientras se elige el destino de una conexión nueva, para dibujar
  // la línea de previsualización. Solo se sigue en modo conectar y con
  // origen elegido: seguirlo siempre re-renderiza 500 íconos por movimiento.
  const [punteroConectar, setPunteroConectar] = useState(null);

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

  // Piezas por id de equipo: lo necesitan las manijas de extremo (para pegar
  // el punto al perímetro del equipo) y la previsualización.
  const piezaPorId = useMemo(() => new Map((vista?.piezas || []).map((p) => [p.eq.id, p])), [vista]);
  const iconoConEscala = (pieza) => {
    const base = iconoBaseDe(pieza.eq.tipo, data);
    return base ? { ...base, escala: pieza.escala } : null;
  };

  // Rutas a dibujar. Mientras se arrastra el codo o un extremo, la del
  // arrastre se recalcula en cada movimiento: antes solo se movía el
  // tirador y la cañería se quedaba quieta hasta soltar, así que no se veía
  // lo que se estaba haciendo. Es UNA ruta por cuadro, y sin esquivar
  // obstáculos —con quiebre a mano el ruteo no los mira—, así que es barato.
  const rutasDibujo = useMemo(() => {
    const rutas = caneriasVista?.rutas || [];
    const enVuelo = quiebreArrastre?.live ? quiebreArrastre : extremoArrastre?.live ? extremoArrastre : null;
    if (!enVuelo) return rutas;
    return rutas.map((r) => {
      if (r.conexion?.id !== enVuelo.conexionId) return r;
      const de = piezaPorId.get(r.conexion.deId);
      const a = piezaPorId.get(r.conexion.aId);
      const iconoDe = de && iconoConEscala(de);
      const iconoA = a && iconoConEscala(a);
      if (!iconoDe || !iconoA) return r;

      let provisoria = r.conexion;
      if (enVuelo === quiebreArrastre) {
        provisoria = { ...r.conexion, quiebreManual: enVuelo.live };
      } else {
        const pieza = piezaPorId.get(enVuelo.equipoId);
        const icono = pieza && iconoConEscala(pieza);
        const punto = icono && puntoPerimetroCercano({ x: pieza.x, y: pieza.y }, icono, enVuelo.live);
        if (!punto) return r;
        provisoria = { ...r.conexion, ...(enVuelo.extremo === 'de' ? { puertoDe: punto } : { puertoA: punto }) };
      }
      const nueva = rutaEntreEquipos(provisoria, de.eq, a.eq, { x: de.x, y: de.y }, { x: a.x, y: a.y }, iconoDe, iconoA);
      return nueva ? { ...nueva, conexion: r.conexion } : r;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caneriasVista, quiebreArrastre, extremoArrastre, piezaPorId, data]);

  // En qué vista quedó cada equipo. Solo el escalonado reparte en vistas;
  // los otros dos métodos dibujan la planta entera, así que ahí no cruza
  // nada y esto queda vacío.
  const vistaDeEquipo = useMemo(() => {
    const mapa = new Map();
    vistasEscalonado.forEach((v, i) => v.piezas.forEach((p) => mapa.set(p.eq.id, i)));
    return mapa;
  }, [vistasEscalonado]);

  // Conexiones con UN extremo en esta vista y el otro en otra. Hoy
  // desaparecen del lienzo sin dejar rastro —solo una línea de texto en el
  // panel— y son pocas: medido, 3 de 470 en la planta demo a 28 px de
  // mínimo, 6 a 48 px. Se dibujan como conector de salida de P&ID: un cabo
  // corto que apunta AFUERA del dibujo (no hacia donde está el otro equipo,
  // que vive en otro lienzo y cuya posición acá no querría decir nada) con
  // el TAG del otro extremo y a qué vista ir.
  const salidasDeVista = useMemo(() => {
    if (metodo !== 'escalonado' || !vista || piezaPorId.size === 0) return [];
    const centro = { x: (vista.metricas?.lienzoAncho || 0) / 2, y: (vista.metricas?.lienzoAlto || 0) / 2 };
    // El viewBox agrega 20 de aire por lado; ese es el borde real de lo visible.
    const izqVisible = -20;
    const arribaVisible = -20;
    const derVisible = (vista.metricas?.lienzoAncho || 0) + 20;
    const abajoVisible = (vista.metricas?.lienzoAlto || 0) + 20;
    const salidas = [];
    conexionesDePlanta.forEach((c) => {
      const aca = piezaPorId.get(c.deId) || piezaPorId.get(c.aId);
      const otroId = piezaPorId.has(c.deId) ? c.aId : c.deId;
      if (!aca || piezaPorId.has(otroId)) return;
      const vistaOtro = vistaDeEquipo.get(otroId);
      if (vistaOtro === undefined) return; // el otro extremo no está en ninguna vista
      const icono = iconoConEscala(aca);
      if (!icono) return;
      // Un objetivo bien lejos en la dirección opuesta al centro: el puerto
      // que elige es el que mira hacia el borde más cercano.
      const afuera = { x: aca.x + (aca.x - centro.x) * 10, y: aca.y + (aca.y - centro.y) * 10 };
      const puerto = puertoHacia({ x: aca.x, y: aca.y }, icono, afuera);
      if (!puerto) return;
      const v = DIR_VECTOR_SALIDA[puerto.dir];
      const x2 = puerto.x + v.x * LARGO_SALIDA;
      const y2 = puerto.y + v.y * LARGO_SALIDA;
      const sale = piezaPorId.has(c.deId); // el equipo de acá es el origen
      const tagOtro = data.equipos.find((e) => e.id === otroId)?.tag || otroId;
      const texto = `${sale ? '▸ ' : '◂ '}${tagOtro} · vista ${vistaOtro + 1}`;

      // El cartel se acota al lienzo VISIBLE. Sin esto, un equipo pegado al
      // borde lo manda afuera del viewBox y no se dibuja: medido, 4 de 6
      // conectores de la planta demo quedaban invisibles — justo el mal que
      // esto viene a curar. Si no entra del lado de afuera, el texto se pasa
      // al otro lado del cabo en vez de salirse.
      const ancho = texto.length * 5.6 + 8;
      let ancla = v.x < 0 ? 'end' : v.x > 0 ? 'start' : 'middle';
      let xTexto = x2 + (ancla === 'end' ? -6 : ancla === 'start' ? 6 : 0);
      if (ancla === 'start' && xTexto + ancho > derVisible) { ancla = 'end'; xTexto = x2 - 6; }
      else if (ancla === 'end' && xTexto - ancho < izqVisible) { ancla = 'start'; xTexto = x2 + 6; }
      if (ancla === 'middle') xTexto = Math.min(derVisible - ancho / 2, Math.max(izqVisible + ancho / 2, xTexto));
      else if (ancla === 'start') xTexto = Math.min(xTexto, derVisible - ancho);
      else xTexto = Math.max(xTexto, izqVisible + ancho);
      const yTexto = Math.min(abajoVisible - 2, Math.max(arribaVisible + 10, y2 - 6));

      salidas.push({ id: c.id, sale, tagOtro, vistaOtro, texto, x1: puerto.x, y1: puerto.y, x2, y2, ancla, xTexto, yTexto });
    });
    return salidas;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metodo, vista, piezaPorId, conexionesDePlanta, vistaDeEquipo, data]);

  // Dónde va el título de cada área: la esquina superior izquierda de sus
  // equipos ya ubicados, más el desplazamiento que el usuario le haya dado.
  // Se calcula de las piezas y no de una caja reservada, igual que el resto.
  const titulosDeArea = useMemo(() => {
    if (!vista) return [];
    const porArea = new Map();
    vista.piezas.forEach((p) => {
      const x = p.x - p.anchoIcono / 2;
      const y = p.y - p.altoIcono;
      const prev = porArea.get(p.eq.areaId);
      if (!prev) porArea.set(p.eq.areaId, { x, y });
      else porArea.set(p.eq.areaId, { x: Math.min(prev.x, x), y: Math.min(prev.y, y) });
    });

    // Dos áreas vecinas comparten borde de arriba y sus títulos se dibujan
    // uno encima del otro: medido en la planta semilla, 2 de 4 pares. No es
    // evitable acomodando mejor —el escalonado entrelaza las áreas por
    // construcción, de ahí el contorno escalonado—, así que se recorren de
    // arriba hacia abajo y cada uno BAJA hasta encontrar lugar. Un título
    // movido a mano no se toca: ahí mandó quien lo movió.
    const puestos = [];
    return [...porArea.entries()]
      .map(([areaId, esquina]) => ({ areaId, esquina, area: areasDePlanta.find((a) => a.id === areaId) }))
      .sort((a, b) => a.esquina.y - b.esquina.y || a.esquina.x - b.esquina.x)
      .map(({ areaId, esquina, area }) => {
        const enVuelo = tituloArrastre?.areaId === areaId ? tituloArrastre.live : null;
        const off = enVuelo || area?.tituloOffset || { dx: 0, dy: 0 };
        const aMano = off.dx !== 0 || off.dy !== 0;
        const nombre = area?.nombre || '';
        const ancho = anchoDeTitulo(nombre);
        const x = esquina.x + off.dx;
        let y = esquina.y - 6 + off.dy;
        const choca = (yy) =>
          puestos.some((q) => x < q.x + q.ancho && x + ancho > q.x && yy - ALTO_TITULO_TXT < q.y && yy > q.y - ALTO_TITULO_TXT);
        let intentos = 0;
        while (!aMano && choca(y) && intentos < 20) {
          y += ALTO_TITULO_TXT;
          intentos += 1;
        }
        puestos.push({ x, y, ancho });
        // `base` es el ancla SIN esquivar. El arrastre parte de la posición
        // dibujada y no del ancla: si no, agarrar un título que bajó para
        // esquivar a otro lo haría saltar hacia arriba en el primer clic.
        return { areaId, nombre, x, y, base: { x: esquina.x, y: esquina.y - 6 } };
      });
  }, [vista, areasDePlanta, tituloArrastre]);

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

        {/* El generador de la planta de prueba vivía en el Portal, que se
            retiró: sin este botón los 500 equipos quedaban inalcanzables
            desde la pantalla, y son el caso con el que se mide todo. */}
        <button
          onClick={() => {
            const id = generarPlantaDePrueba();
            if (id) setPlantaId(id);
          }}
          style={{ width: '100%', marginBottom: 'var(--space-3)', background: 'var(--scada-panel)', color: 'var(--scada-texto-2)', border: '1px solid var(--scada-borde)', padding: '5px 6px', fontFamily: 'inherit', fontSize: 11.5, cursor: 'pointer' }}
        >
          Generar planta de prueba (500 equipos)
        </button>

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

          {/* Panel de la conexión elegida. Antes el único modo de borrar era
              "borrar todas" las de un equipo: con cuatro conexiones y una de
              más había que borrar las cuatro y rehacer tres. */}
          {conexionSel && (() => {
            const c = conexionesDePlanta.find((x) => x.id === conexionSel);
            if (!c) return null;
            const tag = (id) => data.equipos.find((e) => e.id === id)?.tag || id;
            const enVista = caneriasVista?.rutas.some((r) => r.conexion?.id === c.id);
            return (
              <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--scada-texto-2)', lineHeight: 1.5, borderTop: '1px solid var(--scada-borde)', paddingTop: 8 }}>
                <div style={{ color: 'var(--scada-titulo)', fontWeight: 700 }}>
                  {tag(c.deId)} → {tag(c.aId)}
                </div>
                {!enVista && <div>No se dibuja en esta vista: alguno de sus extremos cayó en otra.</div>}
                <div>
                  Quiebre: {c.quiebreManual ? 'a mano' : 'automático'} · extremos: {c.puertoDe ? 'de fijado' : 'de auto'}, {c.puertoA ? 'a fijado' : 'a auto'}
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                  {(c.quiebreManual || c.puertoDe || c.puertoA) && (
                    <button
                      onClick={() => actualizarConexion(c.id, { quiebreManual: undefined, puertoDe: undefined, puertoA: undefined })}
                      style={{ background: 'none', color: 'var(--scada-titulo)', border: 'none', fontSize: 11, cursor: 'pointer', padding: 0 }}
                    >
                      volver al ruteo automático
                    </button>
                  )}
                  <button
                    onClick={() => {
                      eliminarConexion(c.id);
                      setConexionSel(null);
                    }}
                    style={{ background: 'none', color: 'var(--e-alarma)', border: 'none', fontSize: 11, cursor: 'pointer', padding: 0 }}
                  >
                    borrar esta conexión
                  </button>
                </div>
              </div>
            );
          })()}

          {seleccionado && (
            <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--scada-texto-2)', lineHeight: 1.5 }}>
              {(() => {
                const eq = equiposDePlanta.find((x) => x.id === seleccionado);
                if (!eq) return null;
                const suyas = conexionesDePlanta.filter((c) => c.deId === eq.id || c.aId === eq.id);
                return (
                  <>
                    <input
                      key={eq.id}
                      defaultValue={eq.tag}
                      onBlur={(e) => renombrarEquipo(eq.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.target.blur();
                      }}
                      style={{ width: '100%', background: 'var(--scada-subpanel)', color: 'var(--scada-texto)', border: '1px solid var(--scada-borde)', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, padding: '4px 6px', marginBottom: 4 }}
                    />
                    <div>{eq.tipo}{eq.posicionPropia ? ' · movido a mano' : ' · posición calculada'}</div>
                    <button
                      onClick={() => setSeleccionado(duplicarEquipo(eq.id))}
                      style={{ background: 'none', color: 'var(--scada-titulo)', border: 'none', fontSize: 11, cursor: 'pointer', padding: '4px 0 0' }}
                    >
                      Duplicar equipo
                    </button>
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
              const p = puntoSvg(e);
              if (!p) return;
              if (arrastre) setArrastre({ ...arrastre, live: { x: Math.round(p.x + arrastre.dx), y: Math.round(p.y + arrastre.dy) } });
              else if (tituloArrastre) setTituloArrastre({ ...tituloArrastre, live: { dx: Math.round(p.x - tituloArrastre.dx), dy: Math.round(p.y - tituloArrastre.dy) } });
              else if (quiebreArrastre) setQuiebreArrastre({ ...quiebreArrastre, live: { x: Math.round(p.x), y: Math.round(p.y) } });
              else if (extremoArrastre) setExtremoArrastre({ ...extremoArrastre, live: { x: Math.round(p.x), y: Math.round(p.y) } });
              else if (modoConectar && origenConexion) setPunteroConectar({ x: Math.round(p.x), y: Math.round(p.y) });
            }}
            onMouseUp={() => {
              if (arrastre) {
                if (arrastre.live) moverEquipoPropio(arrastre.id, arrastre.live);
                setArrastre(null);
              }
              if (tituloArrastre) {
                if (tituloArrastre.live) moverTituloArea(tituloArrastre.areaId, tituloArrastre.live);
                setTituloArrastre(null);
              }
              if (quiebreArrastre) {
                // Sin movimiento no hubo arrastre: fue un clic, y un clic
                // ELIGE la conexión. Es lo que da un lugar para borrarla de
                // a una y para mostrar las manijas de sus extremos, sin
                // agregar más tiradores al lienzo.
                if (quiebreArrastre.live) actualizarConexion(quiebreArrastre.conexionId, { quiebreManual: quiebreArrastre.live });
                else setConexionSel((prev) => (prev === quiebreArrastre.conexionId ? null : quiebreArrastre.conexionId));
                setQuiebreArrastre(null);
              }
              if (extremoArrastre) {
                // El extremo se pega al perímetro del equipo: nunca queda un
                // punto suelto en el aire. rutaPuertos intercala después el
                // tramo que haga falta para llegar ortogonal.
                if (extremoArrastre.live) {
                  const pieza = piezaPorId.get(extremoArrastre.equipoId);
                  const icono = pieza && iconoConEscala(pieza);
                  const punto = icono && puntoPerimetroCercano({ x: pieza.x, y: pieza.y }, icono, extremoArrastre.live);
                  if (punto) actualizarConexion(extremoArrastre.conexionId, extremoArrastre.extremo === 'de' ? { puertoDe: punto } : { puertoA: punto });
                }
                setExtremoArrastre(null);
              }
            }}
            onMouseLeave={() => {
              setArrastre(null);
              setTituloArrastre(null);
              setQuiebreArrastre(null);
              setExtremoArrastre(null);
              setPunteroConectar(null);
            }}
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
              rutasDibujo.map((r, i) => (
                <path
                  key={`cx-${r.conexion?.id || i}`}
                  d={r.d}
                  fill="none"
                  stroke={r.conexion?.id === conexionSel ? 'var(--scada-titulo)' : 'var(--scada-tuberia)'}
                  strokeWidth={r.conexion?.id === conexionSel ? 3 : 2}
                  strokeLinecap="butt"
                  shapeRendering="crispEdges"
                />
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

            {/* Los títulos van DESPUÉS de los equipos: un título que bajó
                para esquivar a otro cae sobre un ícono, y el rectángulo de
                clic transparente del equipo —dibujado antes— se comía su
                mousedown, así que dejaba de poder arrastrarse. Además, como
                etiqueta, corresponde que se dibuje encima. */}
            {titulosDeArea.map((t) => (
              <text
                key={`ti-${t.areaId}`}
                data-titulo-area={t.areaId}
                x={t.x}
                y={t.y}
                fontSize={13}
                fontWeight={700}
                letterSpacing="0.04em"
                fill={colorDeArea[t.areaId] || 'var(--scada-titulo)'}
                style={{ cursor: 'grab', userSelect: 'none' }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  const q = puntoSvg(e);
                  const off = { dx: t.x - t.base.x, dy: t.y - t.base.y };
                  if (q) setTituloArrastre({ areaId: t.areaId, dx: q.x - off.dx, dy: q.y - off.dy, live: null });
                }}
              >
                {t.nombre.toUpperCase()}
              </text>
            ))}


            {/* Línea de previsualización mientras se elige el destino: sin
                ella el segundo clic se hace a ciegas. Sale del puerto del
                origen orientado hacia el puntero, igual que saldrá la
                cañería definitiva. */}
            {modoConectar && origenConexion && punteroConectar && (() => {
              const pieza = piezaPorId.get(origenConexion);
              const icono = pieza && iconoConEscala(pieza);
              if (!icono) return null;
              const puerto = puertoElegido({ x: pieza.x, y: pieza.y }, icono, punteroConectar, undefined);
              if (!puerto) return null;
              const r = rutaHaciaPunto(puerto, punteroConectar);
              return <path d={r.d} fill="none" stroke="var(--scada-titulo)" strokeWidth={1.5} strokeDasharray="5 4" opacity={0.9} />;
            })()}

            {/* Conectores de salida: la conexión sigue en otra vista. El
                cabo apunta afuera del dibujo y el texto dice a dónde ir;
                un clic lleva a esa vista. */}
            {salidasDeVista.map((sal) => (
              <g key={`sal-${sal.id}`} style={{ cursor: 'pointer' }} onClick={() => setVistaActiva(sal.vistaOtro)} data-salida={sal.id}>
                <path
                  d={`M ${sal.x1} ${sal.y1} L ${sal.x2} ${sal.y2}`}
                  fill="none"
                  stroke="var(--scada-tuberia)"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  shapeRendering="crispEdges"
                />
                <circle cx={sal.x2} cy={sal.y2} r={3} fill="none" stroke="var(--scada-tuberia)" strokeWidth={1.5} />
                <text
                  x={sal.xTexto}
                  y={sal.yTexto}
                  textAnchor={sal.ancla}
                  fontSize={10}
                  fontWeight={700}
                  fill="var(--scada-tuberia)"
                  style={{ userSelect: 'none' }}
                >
                  {sal.texto}
                </text>
                <title>
                  {sal.sale ? `Sigue hacia ${sal.tagOtro}` : `Viene de ${sal.tagOtro}`}, en la vista {sal.vistaOtro + 1}. Clic para ir.
                </title>
              </g>
            ))}

            {/* La × que tenían las líneas en el Portal, pero solo en la
                conexión elegida: ahí no es un clic al voleo sobre una línea
                cualquiera —hubo que elegirla antes—, así que borra directo,
                igual que el botón del panel. Con 173 cañerías en la vista de
                la demo, una × por conexión sería puro ruido. */}
            {caneriasVista &&
              rutasDibujo
                .filter((r) => r.conexion && r.conexion.id === conexionSel)
                .map((r) => {
                  const medio = r.medio;
                  return (
                    <g
                      key={`x-${r.conexion.id}`}
                      data-borrar={r.conexion.id}
                      transform={`translate(${medio.x + 14}, ${medio.y - 14})`}
                      style={{ cursor: 'pointer' }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        eliminarConexion(r.conexion.id);
                        setConexionSel(null);
                      }}
                    >
                      <circle r={7} fill="var(--scada-subpanel)" stroke="var(--e-alarma)" strokeWidth={1} />
                      <text textAnchor="middle" dominantBaseline="central" fontSize={9} fontWeight={700} fill="var(--e-alarma)" style={{ userSelect: 'none' }}>
                        ×
                      </text>
                      <title>Borrar esta conexión</title>
                    </g>
                  );
                })}

            {/* Manijas de los EXTREMOS, solo de la conexión elegida: fijan
                por qué punto del perímetro sale la cañería (conexion.puertoDe
                / puertoA). Doble clic devuelve el extremo al automático. */}
            {caneriasVista &&
              rutasDibujo
                .filter((r) => r.conexion && r.conexion.id === conexionSel)
                .flatMap((r) =>
                  [
                    { extremo: 'de', equipoId: r.conexion.deId, punto: r.inicio, fijado: r.conexion.puertoDe },
                    { extremo: 'a', equipoId: r.conexion.aId, punto: r.fin, fijado: r.conexion.puertoA },
                  ].map(({ extremo, equipoId, punto, fijado }) => {
                    const p = punto;
                    return (
                      <g
                        key={`ex-${r.conexion.id}-${extremo}`}
                        data-extremo={`${r.conexion.id}-${extremo}`}
                        style={{ cursor: 'grab' }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setExtremoArrastre({ conexionId: r.conexion.id, extremo, equipoId, live: null });
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          actualizarConexion(r.conexion.id, extremo === 'de' ? { puertoDe: undefined } : { puertoA: undefined });
                        }}
                      >
                        <circle cx={p.x} cy={p.y} r={8} fill="transparent" />
                        <circle cx={p.x} cy={p.y} r={3.5} fill={fijado ? 'var(--scada-titulo)' : 'var(--scada-tuberia)'} stroke="var(--scada-titulo)" strokeWidth={1} />
                        <title>{fijado ? 'Extremo fijado a mano — doble clic para soltarlo' : 'Arrastrar para elegir por dónde sale'}</title>
                      </g>
                    );
                  })
                )}

            {/* Tiradores de quiebre, al final a propósito: el rectángulo de
                clic transparente de cada equipo se dibuja antes y, si el
                tirador quedara debajo, el mousedown nunca le llegaría. */}
            {caneriasVista &&
              rutasDibujo.map((r) => {
                if (!r.conexion) return null;
                const medio = r.medio;
                return (
                  <circle
                    key={`q-${r.conexion.id}`}
                    data-quiebre={r.conexion.id}
                    cx={medio.x}
                    cy={medio.y}
                    r={5}
                    fill={r.conexion.quiebreManual ? 'var(--scada-titulo)' : 'var(--scada-tuberia)'}
                    stroke={r.conexion.id === conexionSel ? 'var(--scada-titulo)' : 'none'}
                    strokeWidth={2}
                    opacity={0.85}
                    style={{ cursor: 'grab' }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setQuiebreArrastre({ conexionId: r.conexion.id, live: null });
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      actualizarConexion(r.conexion.id, { quiebreManual: undefined });
                    }}
                  >
                    <title>{r.conexion.quiebreManual ? 'Quiebre fijado a mano — doble clic para soltarlo. Un clic elige la conexión.' : 'Arrastrar para fijar por dónde pasa. Un clic elige la conexión.'}</title>
                  </circle>
                );
              })}
          </svg>
        )}
      </div>
    </div>
  );
}
