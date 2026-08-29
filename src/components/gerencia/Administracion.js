import React, { useRef, useState } from 'react';
import Blueprint from '../../theme/Blueprint';
import { CATALOGO_MODO_FALLA } from '../../analista/mockData';
import { SCADA_ICONOS } from '../../gerencia/scadaIconos';
import { formaAJsx } from '../../gerencia/tiposPersonalizados';
import { puntoDeContactoCercano } from '../../gerencia/formas';
import { descargarDisposicionPlanta, importarDisposicionPlanta } from '../../analista/plantaCsv';
import './gerenciaHMI.css';

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

// Crea un tipo de equipo nuevo (fuera del catálogo fijo de mockData.js), o
// edita uno personalizado ya creado (tipoExistente) — a partir de formas
// simples (círculo/rectángulo/línea/texto) + puertos de conexión opcionales.
// Solo visual por ahora: no tiene modos de falla propios, así que el
// Analista todavía no puede diagnosticar equipos de este tipo. Se monta con
// `key={tipoExistente?.id || 'nuevo'}` desde SeccionEquipos para que cambiar
// de tipo a editar (o volver a "crear nuevo") reinicie el formulario solo.
function CrearTipoEquipo({ data, crearTipoPersonalizado, actualizarTipoPersonalizado, tipoExistente, alTerminarEdicion }) {
  const editando = !!tipoExistente;
  const svgRef = useRef(null);
  const [nombre, setNombre] = useState(tipoExistente?.nombre || '');
  const [anchoBase, setAnchoBase] = useState(tipoExistente?.anchoBase || 40);
  const [altoBase, setAltoBase] = useState(tipoExistente?.altoBase || 40);
  const [formas, setFormas] = useState(tipoExistente?.formas || []);
  const [puertos, setPuertos] = useState(
    tipoExistente ? Object.entries(tipoExistente.puertos || {}).map(([nombrePuerto, p]) => ({ nombre: nombrePuerto, ...p })) : []
  );
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
    if (formas.length === 0) return setMensaje({ tipo: 'error', texto: 'Agrega al menos una forma.' });

    const puertosObj = {};
    puertos.forEach((p) => {
      if (p.nombre.trim()) puertosObj[p.nombre.trim()] = { x: p.x, y: p.y, dir: p.dir };
    });

    if (editando) {
      actualizarTipoPersonalizado(tipoExistente.id, { nombre: nombreLimpio, anchoBase, altoBase, formas, puertos: puertosObj });
      setMensaje({ tipo: 'ok', texto: `Tipo "${nombreLimpio}" actualizado.` });
      return;
    }

    const clave = nombreLimpio
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '');
    if (!clave) return setMensaje({ tipo: 'error', texto: 'El nombre debe tener al menos una letra o número.' });
    const tiposExistentes = [...Object.keys(CATALOGO_MODO_FALLA), ...(data.tiposPersonalizados || []).map((t) => t.clave)];
    if (tiposExistentes.includes(clave)) return setMensaje({ tipo: 'error', texto: `Ya existe un tipo de equipo "${clave}".` });

    crearTipoPersonalizado({ clave, nombre: nombreLimpio, anchoBase, altoBase, formas, puertos: puertosObj });
    setMensaje({ tipo: 'ok', texto: `Tipo "${nombreLimpio}" creado — ya aparece en "Tipo" y en el Portal SCADA.` });
    setNombre('');
    setFormas([]);
    setPuertos([]);
  };

  return (
    <Blueprint as="section" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>Alta de recursos</div>
      <h3 style={{ fontSize: 20, margin: 0 }}>{editando ? `Editar tipo · ${tipoExistente.clave}` : 'Crear tipo de equipo'}</h3>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--color-neutral-700)' }}>
        {editando
          ? 'Los equipos ya creados con este tipo van a usar la forma nueva apenas guardes.'
          : 'Para equipos que no están en el catálogo fijo (motor, bomba, tanque, agitador, compresor, clarificador, secador). Solo visual por ahora: no tiene modos de falla propios, así que el Analista todavía no puede diagnosticarlo.'}
      </p>
      <Mensaje mensaje={mensaje} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 280px', gap: 'var(--space-4)', alignItems: 'start' }}>
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

          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-primary" onClick={crear} style={{ alignSelf: 'flex-start' }}>
              {editando ? 'Guardar cambios' : 'Crear tipo'}
            </button>
            {editando && (
              <button className="btn btn-secondary" onClick={alTerminarEdicion} style={{ alignSelf: 'flex-start' }}>
                Cancelar edición
              </button>
            )}
          </div>
        </div>

        <div>
          <div style={{ ...kicker, marginBottom: 6 }}>Vista previa</div>
          <div style={{ border: '1px solid var(--color-divider)', background: '#001830', padding: 8 }}>
            <svg
              ref={svgRef}
              viewBox={`-4 -4 ${anchoBase + 8} ${altoBase + 8}`}
              width="100%"
              height={260}
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

// Una celda de la galería de tipos — el mismo dibujo (formaAJsx) que usa la
// vista previa del formulario, ajustado a un viewBox propio por tipo para
// que quepan bien tipos de tamaño muy distinto (26×29 la bomba, 90×50 el
// secador) uno al lado del otro.
function CeldaTipo({ nombre, clave, anchoBase, altoBase, formas, editable, onDoubleClick }) {
  return (
    <div
      className="cell"
      onDoubleClick={editable ? onDoubleClick : undefined}
      title={editable ? 'Doble clic para editar' : 'Tipo de fábrica — para cambiarlo, pedímelo por chat'}
      style={{
        cursor: editable ? 'pointer' : 'default',
        padding: 'var(--space-3) var(--space-2)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-2)',
        textAlign: 'center',
        background: 'var(--color-bg)',
      }}
    >
      <svg width={56} height={56} viewBox={`-4 -4 ${anchoBase + 8} ${altoBase + 8}`}>
        <g fill="#a2a29d" stroke="#000" strokeWidth={1}>
          {formas.map((f, i) => formaAJsx(f, i))}
        </g>
      </svg>
      <span style={{ fontFamily: 'var(--font-heading)', fontSize: 12, letterSpacing: '0.02em', textTransform: 'uppercase' }}>{nombre}</span>
      <span style={{ fontSize: 10, color: 'var(--color-neutral-500)' }}>{clave}</span>
    </div>
  );
}

// Reemplaza al viejo Catálogo HMI (símbolos de línea fina de simbolosHMI.js,
// sin relación con los tipos reales): esto muestra los tipos de equipo que
// realmente existen en la app — de fábrica (fijos en scadaIconos.js) y
// personalizados (data.tiposPersonalizados) — y deja editar estos últimos
// con doble clic.
function GaleriaTiposEquipo({ data, onEditar }) {
  const [filtro, setFiltro] = useState('fabrica');
  const personalizados = data.tiposPersonalizados || [];
  const clavesFabrica = Object.keys(SCADA_ICONOS);

  return (
    <Blueprint as="section" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: 20, margin: 0 }}>Tipos de equipo</h3>
        <div className="seg" style={{ marginLeft: 'auto' }}>
          <label className="seg-opt">
            <input type="radio" checked={filtro === 'fabrica'} onChange={() => setFiltro('fabrica')} />
            <span>De fábrica ({clavesFabrica.length})</span>
          </label>
          <label className="seg-opt">
            <input type="radio" checked={filtro === 'personalizados'} onChange={() => setFiltro('personalizados')} />
            <span>Personalizados ({personalizados.length})</span>
          </label>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--color-neutral-600)' }}>
        {filtro === 'fabrica'
          ? 'Fijos en el código de la app — para cambiar uno, pedímelo por chat.'
          : personalizados.length > 0
          ? 'Doble clic sobre un tipo para editarlo.'
          : 'Todavía no creaste ningún tipo personalizado — usa el formulario de arriba.'}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 1, background: 'var(--color-neutral-300)' }}>
        {filtro === 'fabrica'
          ? clavesFabrica.map((clave) => (
              <CeldaTipo
                key={clave}
                nombre={clave}
                clave={clave}
                anchoBase={SCADA_ICONOS[clave].anchoBase}
                altoBase={SCADA_ICONOS[clave].altoBase}
                formas={SCADA_ICONOS[clave].formas}
                editable={false}
              />
            ))
          : personalizados.map((t) => (
              <CeldaTipo key={t.id} nombre={t.nombre} clave={t.clave} anchoBase={t.anchoBase} altoBase={t.altoBase} formas={t.formas} editable onDoubleClick={() => onEditar(t)} />
            ))}
      </div>
    </Blueprint>
  );
}

// "Equipos": alta de equipos (la ubicación/planta se elige, no se crea acá) +
// alta/edición de tipos de equipo personalizados.
function SeccionEquipos({ data, crearEquipo, crearTipoPersonalizado, actualizarTipoPersonalizado }) {
  const [tipoEditando, setTipoEditando] = useState(null);
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

      <CrearTipoEquipo
        key={tipoEditando?.id || 'nuevo'}
        data={data}
        crearTipoPersonalizado={crearTipoPersonalizado}
        actualizarTipoPersonalizado={actualizarTipoPersonalizado}
        tipoExistente={tipoEditando}
        alTerminarEdicion={() => setTipoEditando(null)}
      />

      <GaleriaTiposEquipo data={data} onEditar={setTipoEditando} />
    </div>
  );
}

export default function Administracion({ data, crearPlanta, crearArea, crearEquipo, crearConexion, crearTipoPersonalizado, actualizarTipoPersonalizado }) {
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
          <SeccionEquipos
            data={data}
            crearEquipo={crearEquipo}
            crearTipoPersonalizado={crearTipoPersonalizado}
            actualizarTipoPersonalizado={actualizarTipoPersonalizado}
          />
        )}
      </div>
    </div>
  );
}
