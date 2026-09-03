import React, { useState } from 'react';
import TopBar from './components/TopBar';
import AnalistaApp from './components/analista/AnalistaApp';
import Administracion from './components/gerencia/Administracion';
import PortalSCADA from './components/gerencia/PortalSCADA';
import VistaOperacion from './components/gerencia/VistaOperacion';
import EnsayoLayout from './components/gerencia/EnsayoLayout';
import { useAnalistaData } from './analista/store';

export default function App() {
  const [vista, setVista] = useState('analista');
  const analista = useAnalistaData();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh' }}>
      <TopBar vista={vista} setVista={setVista} onResetear={analista.resetearDatos} />
      <div style={{ flexGrow: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto' }}>
        {vista === 'analista' && <AnalistaApp {...analista} />}
        {vista === 'administracion' && <Administracion {...analista} />}
        {vista === 'portalScada' && <PortalSCADA {...analista} />}
        {vista === 'operacion' && <VistaOperacion {...analista} />}
        {vista === 'ensayoLayout' && <EnsayoLayout {...analista} />}
      </div>
    </div>
  );
}
