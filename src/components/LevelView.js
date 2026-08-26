import React, { useCallback, useState } from 'react';
import ReactFlow, { Background, Controls, applyNodeChanges } from 'reactflow';
import 'reactflow/dist/style.css';
import { EQUIPMENT_CATALOG } from '../catalog';
import { STATUS } from '../statusConfig';
import EquipmentPanel from './EquipmentPanel';

const EquipmentNode = ({ data, selected }) => {
  const equipment = EQUIPMENT_CATALOG[data.tipo];
  if (!equipment) return null;
  const color = STATUS[data.status]?.color || '#333';

  return (
    <div
      onClick={() => data.onSelect(data.equipmentId)}
      style={{
        position: 'relative',
        width: 80,
        height: 80,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        border: selected ? '2px solid #1976d2' : `3px solid ${color}`,
        borderRadius: '50%',
        background: '#fff',
        cursor: 'pointer',
      }}
    >
      {equipment.svg(color)}
      <div
        style={{
          position: 'absolute',
          top: -22,
          fontSize: 11,
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
        }}
      >
        {data.label}
      </div>
    </div>
  );
};

const nodeTypes = { equipmentNode: EquipmentNode };

function buildNodes(equipment, prevNodes, onSelect) {
  return equipment.map((eq) => {
    const prev = prevNodes.find((n) => n.id === eq.id);
    return {
      id: eq.id,
      type: 'equipmentNode',
      position: prev ? prev.position : eq.position,
      data: {
        tipo: eq.tipo,
        label: eq.label,
        status: eq.status,
        equipmentId: eq.id,
        onSelect,
      },
    };
  });
}

export default function LevelView({
  equipment,
  role,
  onAddEquipment,
  onMoveEquipment,
  onUpdateFicha,
  onAddInforme,
  onDeleteEquipment,
}) {
  const [rfInstance, setRfInstance] = useState(null);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState(null);
  const [nodes, setNodes] = useState(() => buildNodes(equipment, [], setSelectedEquipmentId));

  React.useEffect(() => {
    setNodes((nds) => buildNodes(equipment, nds, setSelectedEquipmentId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipment]);

  const onNodesChange = useCallback(
    (changes) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
      changes.forEach((c) => {
        if (c.type === 'position' && c.position && c.dragging === false) {
          onMoveEquipment(c.id, c.position);
        }
      });
    },
    [onMoveEquipment]
  );

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const tipo = event.dataTransfer.getData('application/reactflow');
      if (!tipo || !rfInstance) return;
      const position = rfInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      onAddEquipment(tipo, position);
    },
    [rfInstance, onAddEquipment]
  );

  const selectedEquipment = equipment.find((e) => e.id === selectedEquipmentId);

  return (
    <div style={{ display: 'flex', flexGrow: 1, minHeight: 0 }}>
      <div style={{ flexGrow: 1, position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={[]}
          onNodesChange={onNodesChange}
          nodeTypes={nodeTypes}
          onInit={setRfInstance}
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          onPaneClick={() => setSelectedEquipmentId(null)}
          nodesConnectable={false}
          fitView
        >
          <Background color="#eee" variant="dots" />
          <Controls />
        </ReactFlow>
      </div>

      {role === 'tecnico' && (
        <aside style={{ width: 180, padding: 16, borderLeft: '1px solid #e0e0e0', overflowY: 'auto' }}>
          <h3 style={{ fontSize: '0.9rem' }}>Agregar equipo</h3>
          {Object.keys(EQUIPMENT_CATALOG)
            .filter((key) => key !== 'etiqueta')
            .map((key) => (
              <div
                key={key}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', key);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                style={{
                  border: '1px solid #ddd',
                  borderRadius: 6,
                  padding: 10,
                  marginBottom: 8,
                  cursor: 'grab',
                  textAlign: 'center',
                }}
              >
                {EQUIPMENT_CATALOG[key].svg('#333')}
                <div style={{ fontSize: '0.75rem' }}>{EQUIPMENT_CATALOG[key].label}</div>
              </div>
            ))}
        </aside>
      )}

      {selectedEquipment && (
        <EquipmentPanel
          equipment={selectedEquipment}
          role={role}
          onClose={() => setSelectedEquipmentId(null)}
          onUpdateFicha={onUpdateFicha}
          onAddInforme={onAddInforme}
          onDelete={onDeleteEquipment}
        />
      )}
    </div>
  );
}
