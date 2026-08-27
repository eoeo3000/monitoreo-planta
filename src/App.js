import React, { useState } from 'react';
import TopBar from './components/TopBar';
import AnalistaApp from './components/analista/AnalistaApp';
import Administracion from './components/gerencia/Administracion';
import PlantaConcentradora from './components/gerencia/PlantaConcentradora';
import { useAnalistaData } from './analista/store';

export default function App() {
  const [vista, setVista] = useState('analista');
  const analista = useAnalistaData();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh' }}>
      <TopBar vista={vista} setVista={setVista} onResetear={analista.resetearDatos} />
      <div style={{ flexGrow: 1, minHeight: 0, overflowY: 'auto' }}>
        {vista === 'analista' && <AnalistaApp {...analista} />}
        {vista === 'administracion' && <Administracion {...analista} />}
        {vista === 'plantaConcentradora' && <PlantaConcentradora {...analista} />}
      </div>
    </div>
  );
}
