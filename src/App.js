import React, { useState } from 'react';
import TopBar from './components/TopBar';
import AnalistaApp from './components/analista/AnalistaApp';
import GerenciaApp from './components/gerencia/GerenciaApp';
import CatalogoIconos from './components/gerencia/CatalogoIconos';
import CatalogoHMI from './components/gerencia/CatalogoHMI';
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
        {vista === 'gerencia' && <GerenciaApp {...analista} />}
        {vista === 'catalogo' && <CatalogoIconos />}
        {vista === 'catalogoHMI' && <CatalogoHMI />}
        {vista === 'plantaConcentradora' && <PlantaConcentradora />}
      </div>
    </div>
  );
}
