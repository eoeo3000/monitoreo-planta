import React, { useState } from 'react';
import TopBar from './components/TopBar';
import PlantView from './components/PlantView';
import LevelView from './components/LevelView';
import { usePlantData } from './store';

export default function App() {
  const {
    data,
    addLevel,
    addEquipment,
    updateEquipmentPosition,
    updateFichaTecnica,
    addInforme,
    deleteEquipment,
  } = usePlantData();
  const [role, setRole] = useState('tecnico');
  const [currentLevelId, setCurrentLevelId] = useState(null);

  const currentLevel = data.levels.find((l) => l.id === currentLevelId);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        height: '100vh',
        background: '#f5f5f5',
        color: '#222',
      }}
    >
      <TopBar
        role={role}
        setRole={setRole}
        levelName={currentLevel?.name}
        onBack={() => setCurrentLevelId(null)}
      />

      {!currentLevel ? (
        <PlantView
          levels={data.levels}
          equipment={data.equipment}
          onEnterLevel={setCurrentLevelId}
          onAddLevel={addLevel}
          role={role}
        />
      ) : (
        <LevelView
          equipment={data.equipment.filter((eq) => eq.levelId === currentLevel.id)}
          role={role}
          onAddEquipment={(tipo, position) => addEquipment(currentLevel.id, tipo, position)}
          onMoveEquipment={updateEquipmentPosition}
          onUpdateFicha={updateFichaTecnica}
          onAddInforme={addInforme}
          onDeleteEquipment={deleteEquipment}
        />
      )}
    </div>
  );
}
