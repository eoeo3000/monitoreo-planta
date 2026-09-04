import React, { useState } from 'react';
import TopBar from './components/TopBar';
import AnalistaApp from './components/analista/AnalistaApp';
import Administracion from './components/gerencia/Administracion';
import VistaOperacion from './components/gerencia/VistaOperacion';
import EditorPlanta from './components/gerencia/EditorPlanta';
import { useAnalistaData } from './analista/store';
import { usePlantaSeleccionada, useTamanoIcono } from './analista/preferencias';

export default function App() {
  const [vista, setVista] = useState('analista');
  const analista = useAnalistaData();
  // Compartida por las tres pantallas de planta y persistida: al cambiar de
  // pestaña React desmonta la pantalla, así que una variable local por
  // pantalla se perdía y se volvía siempre a la primera planta.
  const [plantaId, setPlantaId] = usePlantaSeleccionada(analista.data.plantas);
  const dePlanta = { plantaId, setPlantaId };
  // El tamaño legible del ícono es una decisión, no un parámetro de
  // laboratorio: se ajusta en el ensayo y lo aplica la Vista de operación.
  const [tamanoIcono, setTamanoIcono] = useTamanoIcono();
  const deTamano = { tamanoIcono, setTamanoIcono };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh' }}>
      <TopBar vista={vista} setVista={setVista} onResetear={analista.resetearDatos} />
      <div style={{ flexGrow: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto' }}>
        {vista === 'analista' && <AnalistaApp {...analista} />}
        {vista === 'administracion' && <Administracion {...analista} />}
        {vista === 'operacion' && <VistaOperacion {...analista} {...dePlanta} {...deTamano} />}
        {vista === 'editor' && <EditorPlanta {...analista} {...dePlanta} {...deTamano} />}
      </div>
    </div>
  );
}
