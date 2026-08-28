import React, { useRef, useState } from 'react';
import Blueprint from '../../theme/Blueprint';
import { CATALOGO_MODO_FALLA } from '../../analista/mockData';
import { CATALOGO_SIMBOLOS, GRUPOS_SIMBOLOS, GRUPOS_INFO } from '../../gerencia/simbolosHMI';
import { formaAJsx } from '../../gerencia/tiposPersonalizados';
import { puntoDeContactoCercano } from '../../gerencia/formas';
import { descargarDisposicionPlanta, importarDisposicionPlanta } from '../../analista/plantaCsv';
import './gerenciaHMI.css';

const MOSTRAR_CODIGOS = true; // handoff §4 prop "mostrarCodigos"
const SELECCION_MULTIPLE = true; // handoff §4 prop "seleccionMultiple"
const GROSOR_TRAZO = 1.5; // handoff §4 prop "grosorTrazo" (1–2)
const TIPOS_FORMA_LABEL = { circulo: 'Círculo', rectangulo: 'Rectángulo', linea: 'Línea', texto: 'Texto' };
const DIRECCIONES_PUERTO = ['N', 'S', 'E', 'W'];

const kicker = { fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-neutral-600)' };
const SECCIONES = [
  { id: 'equipos', label: 'Equipos' },
  { id: 'planta', label: 'Planta y ubicaciones técnicas' },
];

function Mensaje({ mensaje }) {
  if (!mensaje) return null;
  return (
    <div
      style={{
        borderLeft: `2px solid ${mensaje.tipo === 'error' ? '#c62828' : 'var(--color-accent-700)'}`,
        padding: 'var(--space-2) var(--space-3)',
        fontSize: 13,
        color: mensaje.tipo === 'error' ? '#c62828' : 'var(--color-accent-700)',
        background: 'var(--color-neutral-100)',
      }}
    >
      {mensaje.texto}
    </div>
  );
}

// Importa/exporta la disposición completa (equipos + conexiones) en un CSV con
// columnas TAG, Planta, Área, Tipo, Descripción, Conecta a — el mismo formato en
// ambos sentidos, para poder descargar, editar en Excel y volver a subir.
function ImportarExportarPlanta({ data, crearPlanta, crearArea, crearEquipo, crearConexion }) {
  const inputRef = useRef(null);
  const [resultado, setResultado] = useState(null);

  const onArchivoSeleccionado = (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = () => {
      const r = importarDisposicionPlanta(String(lector.result), { data, crearPlanta, crearArea, crearEquipo, crearConexion });
      setResultado(r);
    };
    lector.readAsText(archivo, 'utf-8');
    e.target.value = ''; // permite volver a elegir el mismo archivo si hace falta reintentar
  };

  return (
    <Blueprint as="section" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>Carga masiva</div>
      <h3 style={{ fontSize: 20, margin: 0 }}>Importar / exportar disposición</h3>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--color-neutral-700)' }}>
        Columnas: TAG, Planta, Área, Tipo, Descripción, Conecta a (TAG del siguiente equipo en el flujo). Planta y
        Área se crean solas si no existen todavía.
      </p>

      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <button className="btn btn-secondary" onClick={() => descargarDisposicionPlanta(data)}>
          Descargar disposición actual (CSV)
        </button>
        <button className="btn btn-primary" onClick={() => inputRef.current?.click()}>
          Importar desde CSV
        </button>
        <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={onArchivoSeleccionado} style={{ display: 'none' }} />
      </div>

      {resultado && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <div
            style={{
              borderLeft: '2px solid var(--color-accent-700)',
              padding: 'var(--space-2) var(--space-3)',
              fontSize: 13,
              color: 'var(--color-accent-700)',
              background: 'var(--color-neutral-100)',
            }}
          >
            {resultado.creados} equipo(s) creado(s), {resultado.conexiones} conexión(es) creada(s).
          </div>
          {resultado.errores.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#c62828' }}>
              {resultado.errores.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Blueprint>
  );
}

// "Planta y ubicaciones técnicas": alta y listado de plantas y sus áreas.
function SeccionPlanta({ data, crearPlanta, crearArea, crearEquipo, crearConexion }) {
  const [plantaId, setPlantaId] = useState(data.plantas[0]?.id || '');
  const [mensaje, setMensaje] = useState(null);
  const areasDePlanta = data.areas.filter((a) => a.plantaId === plantaId);

  const agregarPlanta = () => {
    const nombre = window.prompt('Nombre de la nueva planta:');
    if (nombre && nombre.trim()) {
      const id = crearPlanta(nombre.trim());
      setPlantaId(id);
      setMensaje({ tipo: 'ok', texto: `Planta "${nombre.trim()}" creada.` });
    }
  };

  const agregarArea = () => {
    if (!plantaId) return;
    const nombre = window.prompt('Nombre de la nueva ubicación técnica (área):');
    if (nombre && nombre.trim()) {
      crearArea(plantaId, nombre.trim());
      setMensaje({ tipo: 'ok', texto: `Ubicación técnica "${nombre.trim()}" creada.` });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <ImportarExportarPlanta data={data} crearPlanta={crearPlanta} crearArea={crearArea} crearEquipo={crearEquipo} crearConexion={crearConexion} />

      <Blueprint as="section" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>Alta de recursos</div>
        <h3 style={{ fontSize: 20, margin: 0 }}>Plantas</h3>
        <Mensaje mensaje={mensaje} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          {data.plantas.map((p) => (
            <span
              key={p.id}
              onClick={() => setPlantaId(p.id)}
              className={p.id === plantaId ? 'tag tag-accent' : 'tag tag-neutral'}
              style={{ cursor: 'pointer', fontFamily: 'var(--font-heading)', letterSpacing: '0.03em' }}
            >
              {p.nombre}
            </span>
          ))}
          <button className="btn btn-secondary" onClick={agregarPlanta}>+ Nueva planta</button>
        </div>
      </Blueprint>

      {plantaId && (
        <Blueprint as="section" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>
            {data.plantas.find((p) => p.id === plantaId)?.nombre}
          </div>
          <h3 style={{ fontSize: 20, margin: 0 }}>Ubicaciones técnicas (áreas)</h3>
          {areasDePlanta.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-neutral-600)' }}>Esta planta todavía no tiene ubicaciones técnicas.</p>
          ) : (
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th style={{ width: 120 }}>Equipos</th>
                </tr>
              </thead>
              <tbody>
                {areasDePlanta.map((a) => (
                  <tr key={a.id}>
                    <td>{a.nombre}</td>
                    <td>{data.equipos.filter((eq) => eq.areaId === a.id).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button className="btn btn-secondary" onClick={agregarArea} style={{ alignSelf: 'flex-start' }}>
            + Nueva ubicación técnica
          </button>
        </Blueprint>
      )}
    </div>
  );
}

// Punto visible chico (no tapa el dibujo) + área de clic invisible más
// grande alrededor, para poder agarrarlo sin que las manijas se vean
// enormes ni se encimen entre sí cuando quedan varias juntas.
function Manija({ x, y, onMouseDown, onDoubleClick }) {
  return (
    <g style={{ cursor: 'grab' }} onMouseDown={onMouseDown} onDoubleClick={onDoubleClick}>
      <circle cx={x} cy={y} r={6} fill="transparent" />
      <circle cx={x} cy={y} r={1.8} fill="#00a2e8" />
    </g>
  );
}

// No fusiona geométricamente dos formas superpuestas — apaga el borde de
// ESTA forma nomás. Si la forma que queda tapada por otra no tiene borde
// propio, ya no se ve la línea cruzada entre las dos siluetas.
function CasillaBorde({ sinTrazo, onToggle }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-neutral-600)' }}>
      <input type="checkbox" checked={!sinTrazo} onChange={onToggle} />
      con borde
    </label>
  );
}

function CampoMini({ label, valor, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12 }}>
      <span style={{ color: 'var(--color-neutral-500)' }}>{label}</span>
      <input className="input" type="number" style={{ width: 52, padding: '2px 4px' }} value={valor} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

// Crea un tipo de equipo nuevo (fuera del catálogo fijo de mockData.js) a
// partir de formas simples (círculo/rectángulo/línea) + puertos de conexión
// opcionales. Solo visual por ahora: no tiene modos de falla propios, así que
// el Analista todavía no puede diagnosticar equipos de este tipo.
function CrearTipoEquipo({ data, crearTipoPersonalizado }) {
  const svgRef = useRef(null);
  const [nombre, setNombre] = useState('');
  const [anchoBase, setAnchoBase] = useState(40);
  const [altoBase, setAltoBase] = useState(40);
  const [formas, setFormas] = useState([]);
  const [puertos, setPuertos] = useState([]);
  const [mensaje, setMensaje] = useState(null);
  // Arrastre de una forma en la vista previa — {indice, modo, offsetX, offsetY}.
  // modo: 'circulo' (mueve cx/cy), 'rectangulo' (mueve x/y, mismo tamaño),
  // 'texto' (mueve x/y), 'linea1'/'linea2' (mueve ese extremo nada más).
  const [formaArrastre, setFormaArrastre] = useState(null);

  const agregarForma = (tipoForma) => {
    setMensaje(null);
    if (tipoForma === 'circulo') {
      setFormas((f) => [...f, { tipo: tipoForma, cx: Math.round(anchoBase / 2), cy: Math.round(altoBase / 2), r: Math.round(Math.min(anchoBase, altoBase) / 3), sinTrazo: false }]);
    } else if (tipoForma === 'rectangulo') {
      setFormas((f) => [
        ...f,
        { tipo: tipoForma, x: Math.round(anchoBase * 0.2), y: Math.round(altoBase * 0.2), ancho: Math.round(anchoBase * 0.6), alto: Math.round(altoBase * 0.6), sinTrazo: false },
      ]);
    } else if (tipoForma === 'linea') {
      setFormas((f) => [...f, { tipo: tipoForma, x1: 0, y1: Math.round(altoBase / 2), x2: anchoBase, y2: Math.round(altoBase / 2) }]);
    } else if (tipoForma === 'texto') {
      setFormas((f) => [...f, { tipo: tipoForma, x: Math.round(anchoBase / 2), y: Math.round(altoBase / 2), tamano: 10, contenido: 'texto', color: '#000000' }]);
    }
  };
  const actualizarForma = (i, campo, valor) =>
    setFormas((fs) =>
      fs.map((f, idx) => (idx === i ? { ...f, [campo]: campo === 'contenido' || campo === 'color' ? valor : Number(valor) } : f))
    );
  const alternarTrazo = (i) => setFormas((fs) => fs.map((f, idx) => (idx === i ? { ...f, sinTrazo: !f.sinTrazo } : f)));
  const quitarForma = (i) => setFormas((fs) => fs.filter((_, idx) => idx !== i));

  // Arrastrar un extremo de línea directo en la vista previa, sin depender
  // solo de los campos numéricos — getScreenCTM deshace el escalado del
  // viewBox sin necesitar saber el tamaño real en pantalla del SVG.
  const puntoSvg = (event) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: Math.round(p.x), y: Math.round(p.y) };
  };
  // offsetX/Y guarda dónde dentro de la forma se hizo clic, para que no
  // "salte" a tener su punto de referencia justo bajo el cursor al arrastrar
  // (salvo en los extremos de línea, donde sí queremos que el punto siga
  // exacto al cursor, como si lo estuvieras dibujando de nuevo).
  const onMouseDownForma = (event, indice, forma, modo) => {
    event.stopPropagation();
    const p = puntoSvg(event);
    let offsetX = 0;
    let offsetY = 0;
    if (modo === 'circulo') {
      offsetX = p.x - forma.cx;
      offsetY = p.y - forma.cy;
    } else if (modo === 'rectangulo' || modo === 'texto') {
      offsetX = p.x - forma.x;
      offsetY = p.y - forma.y;
    }
    setFormaArrastre({ indice, modo, offsetX, offsetY });
  };
  // En los extremos de línea y el punto del texto (formas "de punto"), si el
  // punto queda a 4 unidades o menos del borde de OTRA forma, se ajusta
  // (snap) justo a ese borde — así un eje puede quedar pegado al cuerpo de
  // un agitador, sin dejar un hueco, para cuando haga falta que se vean
  // conectados.
  const onMouseMovePreview = (event) => {
    if (!formaArrastre) return;
    const p = puntoSvg(event);
    const { indice, modo, offsetX, offsetY } = formaArrastre;
    setFormas((fs) =>
      fs.map((f, idx) => {
        if (idx !== indice) return f;
        if (modo === 'circulo') return { ...f, cx: p.x - offsetX, cy: p.y - offsetY };
        if (modo === 'rectangulo') return { ...f, x: p.x - offsetX, y: p.y - offsetY };
        if (modo === 'texto') {
          const libre = { x: p.x - offsetX, y: p.y - offsetY };
          const contacto = puntoDeContactoCercano(fs, libre, indice);
          return contacto ? { ...f, x: contacto.x, y: contacto.y } : { ...f, x: libre.x, y: libre.y };
        }
        if (modo === 'linea1' || modo === 'linea2') {
          const contacto = puntoDeContactoCercano(fs, p, indice);
          const punto = contacto || p;
          return modo === 'linea1' ? { ...f, x1: punto.x, y1: punto.y } : { ...f, x2: punto.x, y2: punto.y };
        }
        return f;
      })
    );
  };
  const onMouseUpPreview = () => setFormaArrastre(null);

  const editarTexto = (i, contenidoActual) => {
    const nuevo = window.prompt('Texto:', contenidoActual);
    if (nuevo === null) return;
    setFormas((fs) => fs.map((f, idx) => (idx === i ? { ...f, contenido: nuevo } : f)));
  };

  const agregarPuerto = () => setPuertos((ps) => [...ps, { nombre: `puerto${ps.length + 1}`, x: 0, y: Math.round(altoBase / 2), dir: 'W' }]);
  const actualizarPuerto = (i, campo, valor) => setPuertos((ps) => ps.map((p, idx) => (idx === i ? { ...p, [campo]: campo === 'x' || campo === 'y' ? Number(valor) : valor } : p)));
  const quitarPuerto = (i) => setPuertos((ps) => ps.filter((_, idx) => idx !== i));

  const crear = () => {
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) return setMensaje({ tipo: 'error', texto: 'El nombre es obligatorio.' });
    const clave = nombreLimpio
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '');
    if (!clave) return setMensaje({ tipo: 'error', texto: 'El nombre debe tener al menos una letra o número.' });
    const tiposExistentes = [...Object.keys(CATALOGO_MODO_FALLA), ...(data.tiposPersonalizados || []).map((t) => t.clave)];
    if (tiposExistentes.includes(clave)) return setMensaje({ tipo: 'error', texto: `Ya existe un tipo de equipo "${clave}".` });
    if (formas.length === 0) return setMensaje({ tipo: 'error', texto: 'Agrega al menos una forma.' });

    const puertosObj = {};
    puertos.forEach((p) => {
      if (p.nombre.trim()) puertosObj[p.nombre.trim()] = { x: p.x, y: p.y, dir: p.dir };
    });

    crearTipoPersonalizado({ clave, nombre: nombreLimpio, anchoBase, altoBase, formas, puertos: puertosObj });
    setMensaje({ tipo: 'ok', texto: `Tipo "${nombreLimpio}" creado — ya aparece en "Tipo" y en el Portal SCADA.` });
    setNombre('');
    setFormas([]);
    setPuertos([]);
  };

  return (
    <Blueprint as="section" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>Alta de recursos</div>
      <h3 style={{ fontSize: 20, margin: 0 }}>Crear tipo de equipo</h3>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--color-neutral-700)' }}>
        Para equipos que no están en el catálogo fijo (motor, bomba, tanque, agitador, compresor, clarificador, secador). Solo
        visual por ahora: no tiene modos de falla propios, así que el Analista todavía no puede diagnosticarlo.
      </p>
      <Mensaje mensaje={mensaje} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 200px', gap: 'var(--space-4)', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'flex-end' }}>
            <label className="field" style={{ minWidth: 180 }}>
              <span style={kicker}>Nombre</span>
              <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Mezclador" />
            </label>
            <label className="field" style={{ width: 100 }}>
              <span style={kicker}>Ancho</span>
              <input className="input" type="number" min={10} value={anchoBase} onChange={(e) => setAnchoBase(Number(e.target.value) || 10)} />
            </label>
            <label className="field" style={{ width: 100 }}>
              <span style={kicker}>Alto</span>
              <input className="input" type="number" min={10} value={altoBase} onChange={(e) => setAltoBase(Number(e.target.value) || 10)} />
            </label>
          </div>

          <div>
            <div style={{ ...kicker, marginBottom: 2 }}>Formas</div>
            <p style={{ margin: '0 0 6px', fontSize: 11, color: 'var(--color-neutral-500)' }}>
              También se pueden arrastrar directo en la vista previa →
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {formas.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ width: 80, fontSize: 11, textTransform: 'uppercase', color: 'var(--color-neutral-600)' }}>{TIPOS_FORMA_LABEL[f.tipo]}</span>
                  {f.tipo === 'circulo' && (
                    <>
                      <CampoMini label="cx" valor={f.cx} onChange={(v) => actualizarForma(i, 'cx', v)} />
                      <CampoMini label="cy" valor={f.cy} onChange={(v) => actualizarForma(i, 'cy', v)} />
                      <CampoMini label="r" valor={f.r} onChange={(v) => actualizarForma(i, 'r', v)} />
                      <CasillaBorde sinTrazo={f.sinTrazo} onToggle={() => alternarTrazo(i)} />
                    </>
                  )}
                  {f.tipo === 'rectangulo' && (
                    <>
                      <CampoMini label="x" valor={f.x} onChange={(v) => actualizarForma(i, 'x', v)} />
                      <CampoMini label="y" valor={f.y} onChange={(v) => actualizarForma(i, 'y', v)} />
                      <CampoMini label="ancho" valor={f.ancho} onChange={(v) => actualizarForma(i, 'ancho', v)} />
                      <CampoMini label="alto" valor={f.alto} onChange={(v) => actualizarForma(i, 'alto', v)} />
                      <CasillaBorde sinTrazo={f.sinTrazo} onToggle={() => alternarTrazo(i)} />
                    </>
                  )}
                  {f.tipo === 'linea' && (
                    <>
                      <CampoMini label="x1" valor={f.x1} onChange={(v) => actualizarForma(i, 'x1', v)} />
                      <CampoMini label="y1" valor={f.y1} onChange={(v) => actualizarForma(i, 'y1', v)} />
                      <CampoMini label="x2" valor={f.x2} onChange={(v) => actualizarForma(i, 'x2', v)} />
                      <CampoMini label="y2" valor={f.y2} onChange={(v) => actualizarForma(i, 'y2', v)} />
                    </>
                  )}
                  {f.tipo === 'texto' && (
                    <>
                      <input
                        className="input"
                        style={{ width: 100 }}
                        value={f.contenido}
                        onChange={(e) => actualizarForma(i, 'contenido', e.target.value)}
                        placeholder="Texto"
                      />
                      <CampoMini label="x" valor={f.x} onChange={(v) => actualizarForma(i, 'x', v)} />
                      <CampoMini label="y" valor={f.y} onChange={(v) => actualizarForma(i, 'y', v)} />
                      <CampoMini label="tamaño" valor={f.tamano} onChange={(v) => actualizarForma(i, 'tamano', v)} />
                      <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12 }}>
                        <span style={{ color: 'var(--color-neutral-500)' }}>color</span>
                        <input
                          type="color"
                          value={f.color || '#000000'}
                          onChange={(e) => actualizarForma(i, 'color', e.target.value)}
                          style={{ width: 28, height: 24, padding: 0, border: '1px solid var(--color-divider)', background: 'none' }}
                        />
                      </label>
                    </>
                  )}
                  <button className="btn btn-ghost" onClick={() => quitarForma(i)} style={{ fontSize: 12 }}>
                    Quitar
                  </button>
                </div>
              ))}
              {formas.length === 0 && <p style={{ margin: 0, fontSize: 12, color: 'var(--color-neutral-600)' }}>Sin formas todavía.</p>}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button className="btn btn-secondary" onClick={() => agregarForma('circulo')}>
                + Círculo
              </button>
              <button className="btn btn-secondary" onClick={() => agregarForma('rectangulo')}>
                + Rectángulo
              </button>
              <button className="btn btn-secondary" onClick={() => agregarForma('linea')}>
                + Línea
              </button>
              <button className="btn btn-secondary" onClick={() => agregarForma('texto')}>
                + Texto
              </button>
            </div>
          </div>

          <div>
            <div style={{ ...kicker, marginBottom: 6 }}>Puertos de conexión (opcional)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {puertos.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <input className="input" style={{ width: 110 }} value={p.nombre} onChange={(e) => actualizarPuerto(i, 'nombre', e.target.value)} />
                  <CampoMini label="x" valor={p.x} onChange={(v) => actualizarPuerto(i, 'x', v)} />
                  <CampoMini label="y" valor={p.y} onChange={(v) => actualizarPuerto(i, 'y', v)} />
                  <select className="input" style={{ width: 64 }} value={p.dir} onChange={(e) => actualizarPuerto(i, 'dir', e.target.value)}>
                    {DIRECCIONES_PUERTO.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <button className="btn btn-ghost" onClick={() => quitarPuerto(i)} style={{ fontSize: 12 }}>
                    Quitar
                  </button>
                </div>
              ))}
            </div>
            <button className="btn btn-secondary" onClick={agregarPuerto} style={{ marginTop: 6 }}>
              + Puerto
            </button>
          </div>

          <button className="btn btn-primary" onClick={crear} style={{ alignSelf: 'flex-start' }}>
            Crear tipo
          </button>
        </div>

        <div>
          <div style={{ ...kicker, marginBottom: 6 }}>Vista previa</div>
          <div style={{ border: '1px solid var(--color-divider)', background: '#001830', padding: 8 }}>
            <svg
              ref={svgRef}
              viewBox={`-4 -4 ${anchoBase + 8} ${altoBase + 8}`}
              width="100%"
              height={160}
              onMouseMove={onMouseMovePreview}
              onMouseUp={onMouseUpPreview}
              onMouseLeave={onMouseUpPreview}
            >
              <g fill="#a2a29d" stroke="#000" strokeWidth={1}>
                {formas.map((f, i) => formaAJsx(f, i))}
              </g>
              {formas.map((f, i) => {
                if (f.tipo === 'linea') {
                  return (
                    <g key={`manijas-${i}`}>
                      <Manija x={f.x1} y={f.y1} onMouseDown={(e) => onMouseDownForma(e, i, f, 'linea1')} />
                      <Manija x={f.x2} y={f.y2} onMouseDown={(e) => onMouseDownForma(e, i, f, 'linea2')} />
                    </g>
                  );
                }
                if (f.tipo === 'circulo') {
                  return <Manija key={`manija-${i}`} x={f.cx} y={f.cy} onMouseDown={(e) => onMouseDownForma(e, i, f, 'circulo')} />;
                }
                if (f.tipo === 'rectangulo') {
                  return <Manija key={`manija-${i}`} x={f.x + f.ancho / 2} y={f.y + f.alto / 2} onMouseDown={(e) => onMouseDownForma(e, i, f, 'rectangulo')} />;
                }
                if (f.tipo === 'texto') {
                  return (
                    <Manija
                      key={`manija-${i}`}
                      x={f.x}
                      y={f.y}
                      onMouseDown={(e) => onMouseDownForma(e, i, f, 'texto')}
                      onDoubleClick={() => editarTexto(i, f.contenido)}
                    />
                  );
                }
                return null;
              })}
              {puertos.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="#00a2e8" />
              ))}
            </svg>
          </div>
        </div>
      </div>
    </Blueprint>
  );
}

// "Equipos": alta y listado de equipos (la ubicación/planta se elige, no se crea acá).
function SeccionEquipos({ data, crearEquipo, crearTipoPersonalizado }) {
  const [plantaId, setPlantaId] = useState(data.plantas[0]?.id || '');
  const [areaId, setAreaId] = useState('');
  const [tag, setTag] = useState('');
  const tiposDisponibles = [...Object.keys(CATALOGO_MODO_FALLA), ...(data.tiposPersonalizados || []).map((t) => t.clave)];
  const [tipo, setTipo] = useState(tiposDisponibles[0]);
  const [descripcion, setDescripcion] = useState('');
  const [mensaje, setMensaje] = useState(null);

  const areasDePlanta = data.areas.filter((a) => a.plantaId === plantaId);

  const crear = () => {
    const tagLimpio = tag.trim();
    if (!areaId) return setMensaje({ tipo: 'error', texto: 'Selecciona una ubicación técnica (área) primero.' });
    if (!tagLimpio) return setMensaje({ tipo: 'error', texto: 'El TAG es obligatorio.' });
    if (data.equipos.some((eq) => eq.tag.toLowerCase() === tagLimpio.toLowerCase())) {
      return setMensaje({ tipo: 'error', texto: 'Ya existe un equipo con ese TAG.' });
    }
    crearEquipo(areaId, { tag: tagLimpio, tipo, descripcion: descripcion.trim() });
    setTag('');
    setDescripcion('');
    setMensaje({ tipo: 'ok', texto: `Equipo ${tagLimpio} creado.` });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <Blueprint as="section" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>Alta de recursos</div>
        <h3 style={{ fontSize: 20, margin: 0 }}>Crear equipo</h3>
        <Mensaje mensaje={mensaje} />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'flex-end' }}>
          <label className="field" style={{ minWidth: 180 }}>
            <span style={kicker}>Planta</span>
            <select
              className="input"
              value={plantaId}
              onChange={(e) => {
                setPlantaId(e.target.value);
                setAreaId('');
              }}
            >
              {data.plantas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="field" style={{ minWidth: 180 }}>
            <span style={kicker}>Ubicación técnica (área)</span>
            <select className="input" value={areaId} onChange={(e) => setAreaId(e.target.value)} disabled={!plantaId}>
              <option value="">—</option>
              {areasDePlanta.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="field" style={{ minWidth: 140 }}>
            <span style={kicker}>TAG</span>
            <input className="input" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Ej: B-107" />
          </label>

          <label className="field" style={{ minWidth: 140 }}>
            <span style={kicker}>Tipo</span>
            <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {tiposDisponibles.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label className="field" style={{ minWidth: 200, flexGrow: 1 }}>
            <span style={kicker}>Descripción</span>
            <input className="input" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </label>

          <button className="btn btn-primary" onClick={crear} disabled={!areaId}>
            Crear equipo
          </button>
        </div>
      </Blueprint>

      <CrearTipoEquipo data={data} crearTipoPersonalizado={crearTipoPersonalizado} />

      <Blueprint as="section" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <h3 style={{ fontSize: 20, margin: 0 }}>Equipos existentes ({data.equipos.length})</h3>
        {data.equipos.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-neutral-600)' }}>Todavía no hay equipos creados.</p>
        ) : (
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: 110 }}>TAG</th>
                <th style={{ width: 160 }}>Planta</th>
                <th style={{ width: 180 }}>Ubicación técnica</th>
                <th style={{ width: 130 }}>Tipo</th>
                <th>Descripción</th>
              </tr>
            </thead>
            <tbody>
              {data.equipos.map((eq) => {
                const area = data.areas.find((a) => a.id === eq.areaId);
                const planta = data.plantas.find((p) => p.id === area?.plantaId);
                return (
                  <tr key={eq.id}>
                    <td style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.04em' }}>{eq.tag}</td>
                    <td>{planta?.nombre || '—'}</td>
                    <td>{area?.nombre || '—'}</td>
                    <td style={{ textTransform: 'uppercase', fontSize: 12, color: 'var(--color-neutral-600)' }}>{eq.tipo}</td>
                    <td style={{ color: 'var(--color-neutral-700)' }}>{eq.descripcion || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Blueprint>
    </div>
  );
}

function CatalogoSimbolos() {
  const [filtro, setFiltro] = useState('todos');
  const [elegidos, setElegidos] = useState(['agitador', 'transmisorPresion']);
  const [aplicado, setAplicado] = useState(null);

  const toggle = (key) => {
    setAplicado(null);
    setElegidos((prev) => {
      const on = prev.includes(key);
      if (!SELECCION_MULTIPLE) return on ? [] : [key];
      return on ? prev.filter((k) => k !== key) : [...prev, key];
    });
  };

  const grupos = Array.from(new Set(CATALOGO_SIMBOLOS.map((s) => s.grupo)));
  const simbolosDeGrupo = (g) => CATALOGO_SIMBOLOS.filter((s) => s.grupo === g);
  const verGrupo = (g) => filtro === 'todos' || filtro === g;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '232px minmax(0, 1fr) 272px',
        alignItems: 'start',
        gap: 'var(--space-4)',
      }}
    >
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', position: 'sticky', top: 'var(--space-4)' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-neutral-600)', marginBottom: 'var(--space-1)' }}>
          Tipo de equipo
        </div>
        {GRUPOS_SIMBOLOS.map((g) => {
          const on = filtro === g.id;
          const count = g.id === 'todos' ? CATALOGO_SIMBOLOS.length : simbolosDeGrupo(g.id).length;
          return (
            <div
              key={g.id}
              className="filtro"
              onClick={() => setFiltro(g.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                cursor: 'pointer',
                padding: 'var(--space-2) var(--space-3)',
                fontSize: 14,
                color: on ? 'var(--color-accent-900)' : 'var(--color-neutral-600)',
                background: on ? 'var(--color-accent-100)' : 'transparent',
                boxShadow: on ? 'inset 2px 0 0 var(--color-accent)' : 'none',
              }}
            >
              <span style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{g.label}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, fontVariantNumeric: 'tabular-nums', color: 'var(--color-neutral-500)' }}>
                {String(count).padStart(2, '0')}
              </span>
            </div>
          );
        })}
      </nav>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minWidth: 0, strokeWidth: GROSOR_TRAZO }}>
        {grupos.filter(verGrupo).map((g) => {
          const info = GRUPOS_INFO[g];
          return (
            <Blueprint as="section" key={g} style={{ padding: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <span style={{ fontSize: 10, letterSpacing: '0.1em', color: 'var(--color-neutral-500)' }}>{info.orden}</span>
                <h3 style={{ fontSize: 19, margin: 0, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{info.titulo}</h3>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-neutral-600)' }}>{info.nota}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))', gap: 1, background: 'var(--color-neutral-300)' }}>
                {simbolosDeGrupo(g).map((s) => {
                  const on = elegidos.includes(s.key);
                  return (
                    <div
                      key={s.key}
                      className="cell"
                      onClick={() => toggle(s.key)}
                      style={{
                        cursor: 'pointer',
                        padding: 'var(--space-4) var(--space-2)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 'var(--space-3)',
                        textAlign: 'center',
                        background: on ? 'var(--color-accent-100)' : 'var(--color-bg)',
                        boxShadow: on ? 'inset 0 0 0 1px var(--color-accent)' : 'none',
                      }}
                    >
                      <svg
                        width="36"
                        height="36"
                        viewBox="0 0 40 40"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ color: on ? 'var(--color-accent-800)' : 'var(--color-neutral-700)' }}
                      >
                        {s.svg}
                      </svg>
                      <span style={{ fontFamily: 'var(--font-heading)', fontSize: 13, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                        {s.nombre}
                      </span>
                      {MOSTRAR_CODIGOS && (
                        <span style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--color-neutral-500)' }}>{s.codigo}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </Blueprint>
          );
        })}
      </div>

      <Blueprint
        as="aside"
        style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', position: 'sticky', top: 'var(--space-4)' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-3)' }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>Vista HMI</div>
            <h3 style={{ fontSize: 20, margin: 0 }}>Selección</h3>
          </div>
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-heading)', fontSize: 34, lineHeight: 0.9, color: 'var(--color-neutral-500)' }}>
            {String(elegidos.length).padStart(2, '0')}
          </span>
        </div>

        {elegidos.length === 0 && (
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--color-neutral-600)' }}>
            Ningún símbolo seleccionado. Haz clic en una celda del catálogo para añadirla.
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {elegidos.map((key) => {
            const s = CATALOGO_SIMBOLOS.find((x) => x.key === key);
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) 0', borderTop: '1px solid var(--color-neutral-300)' }}>
                <span style={{ width: 6, height: 6, background: 'var(--color-accent)', flexShrink: 0 }} />
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 14, letterSpacing: '0.03em', textTransform: 'uppercase' }}>{s.nombre}</span>
                <span style={{ fontSize: 10, letterSpacing: '0.1em', color: 'var(--color-neutral-500)' }}>{s.codigo}</span>
                <button className="btn btn-ghost" onClick={() => toggle(key)} style={{ marginLeft: 'auto', fontSize: 13 }}>
                  Quitar
                </button>
              </div>
            );
          })}
        </div>

        {aplicado && (
          <div style={{ borderLeft: '2px solid var(--color-accent)', background: 'var(--color-neutral-100)', padding: 'var(--space-2) var(--space-3)', fontSize: 12, color: 'var(--color-accent-900)' }}>
            {aplicado}
          </div>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-2)', borderTop: '1px solid var(--color-neutral-300)', paddingTop: 'var(--space-4)' }}>
          <Blueprint
            as="button"
            className="btn btn-primary"
            disabled={elegidos.length === 0}
            onClick={() => setAplicado(`${elegidos.length} símbolo(s) aplicados a la vista de planta.`)}
            style={{ position: 'relative' }}
          >
            Aplicar a la vista
          </Blueprint>
          <button className="btn btn-secondary" disabled={elegidos.length === 0} onClick={() => { setElegidos([]); setAplicado(null); }}>
            Limpiar
          </button>
        </div>
      </Blueprint>
    </div>
  );
}

export default function Administracion({ data, crearPlanta, crearArea, crearEquipo, crearConexion, crearTipoPersonalizado }) {
  const [seccion, setSeccion] = useState('equipos');

  return (
    <div style={{ minHeight: '100%', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 'var(--space-4)',
          padding: 'var(--space-4) var(--space-6)',
          borderBottom: '1px solid var(--color-divider)',
        }}
      >
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>
            Gerencia · Recursos y símbolos
          </div>
          <h1 style={{ fontSize: 30, margin: 'var(--space-1) 0 0', letterSpacing: '0.01em' }}>ADMINISTRACIÓN</h1>
        </div>

        <div className="seg">
          {SECCIONES.map((s) => (
            <label key={s.id} className="seg-opt">
              <input type="radio" checked={seccion === s.id} onChange={() => setSeccion(s.id)} />
              <span>{s.label}</span>
            </label>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end', gap: 'var(--space-6)' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-neutral-600)' }}>Plantas</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 24, lineHeight: 1 }}>{data.plantas.length}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-neutral-600)' }}>Equipos</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 24, lineHeight: 1 }}>{data.equipos.length}</div>
          </div>
        </div>
      </header>

      <div style={{ padding: 'var(--space-4) var(--space-6) var(--space-6)' }}>
        {seccion === 'planta' && (
          <SeccionPlanta data={data} crearPlanta={crearPlanta} crearArea={crearArea} crearEquipo={crearEquipo} crearConexion={crearConexion} />
        )}
        {seccion === 'equipos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <SeccionEquipos data={data} crearEquipo={crearEquipo} crearTipoPersonalizado={crearTipoPersonalizado} />
            <CatalogoSimbolos />
          </div>
        )}
      </div>
    </div>
  );
}
