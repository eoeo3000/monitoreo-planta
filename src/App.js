import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  applyEdgeChanges,
  applyNodeChanges,
  Panel,
  Handle,    // <--- Agrega esto
  Position
} from 'reactflow';
import 'reactflow/dist/style.css';
import { EQUIPMENT_CATALOG } from './catalog';


// --- 2. COMPONENTE DE NODO PERSONALIZADO ---
const EquipmentNode = ({ data, id, selected }) => {
  const equipment = EQUIPMENT_CATALOG[data.tipo];
  if (!equipment) return null;
  const color = data.status === 'error' ? '#ff4d4f' : '#333';

  // Usamos estilos dinámicos para resaltar si está seleccionado
  const borderStyle = selected ? '2px solid #4ec9b0' : 'none';

  return (
    <div style={{
      position: 'relative',
      width: '80px',
      height: '80px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      border: borderStyle,
      borderRadius: '8px'
    }}>
      <Handle type="target" position={Position.Left} style={{ background: '#555' }} />

      {/* ICONO CENTRAL */}
      <div style={{ cursor: 'grab' }}>
        {equipment.svg(color)}
      </div>

      {/* ETIQUETA REFORMULADA: Nombre */}
      <div
        className="nodrag" // Esto es clave: permite interactuar sin mover el nodo
        style={{
          position: 'absolute',
          top: data.labelOffset?.y || -30,
          left: data.labelOffset?.x || 0,
          padding: '2px 6px',
          background: selected ? '#fff' : 'transparent',
          border: selected ? '1px dashed #4ec9b0' : 'none',
          cursor: 'text',
          fontSize: '11px',
          fontWeight: 'bold',
          pointerEvents: 'all' // Permite el click para editar o mover
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          const val = window.prompt("Nombre:", data.label);
          if (val) data.onChangeLabel(id, val);
        }}
      >
        {data.label}
      </div>

      <Handle type="source" position={Position.Right} style={{ background: '#555' }} />
    </div>
  );
};

const nodeTypes = { equipmentNode: EquipmentNode };

// --- 3. COMPONENTE PRINCIPAL (Centro de Mando) ---
export default function App() {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const onNodeClick = (event, node) => setSelectedNode(node);

  // Simulación de datos en tiempo real para todos los equipos
  useEffect(() => {
    const interval = setInterval(() => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.type === 'equipmentNode') {
            // Simulamos una pequeña variación en el valor (ej: +/- 0.5)
            const currentVal = parseFloat(node.data.value);
            const variation = (Math.random() - 0.5).toFixed(1);
            return {
              ...node,
              data: {
                ...node.data,
                value: (currentVal + parseFloat(variation)).toFixed(1)
              }
            };
          }
          return node;
        })
      );
    }, 3000); // Actualiza cada 3 segundos

    return () => clearInterval(interval);
  }, []);

  const addSubNode = useCallback((parentId, nodeType) => {
    const id = `sub_${Date.now()}`;

    // Buscamos el nodo padre para saber su posición actual
    const parentNode = nodes.find(n => n.id === parentId);
    if (!parentNode) return;

    const newNode = {
      id,
      type: 'default', // Usamos el tipo estándar para que sea solo una caja de texto
      parentNode: parentId,
      // Lo posicionamos un poco desplazado para que sea visible al crearse
      position: { x: 10, y: -40 },
      data: {
        label: nodeType === 'LIVE_DATA' ? '---' : 'Nuevo Texto',
        isLive: nodeType === 'LIVE_DATA'
      },
      // El estilo varía si es dato o texto
      style: {
        fontSize: '11px',
        background: nodeType === 'LIVE_DATA' ? '#e6f7ff' : 'transparent',
        border: nodeType === 'LIVE_DATA' ? '1px solid #1890ff' : 'none',
        borderRadius: '4px',
        padding: '2px 6px',
        minWidth: '60px',
        textAlign: 'center'
      },
      draggable: true,
    };

    setNodes((nds) => nds.concat(newNode));
  }, [nodes, setNodes]);

  // --- FUNCIONES DE GESTIÓN (Requeridas por usuario) ---

  const createProduct = useCallback((type, position) => {
    const id = `node_${Date.now()}`;
    const infoEquipo = EQUIPMENT_CATALOG[type]; // Buscamos en el catálogo

    const newNode = {
      id,
      type: 'equipmentNode',
      position,
      data: {
        tipo: type,
        // Si infoEquipo existe usamos su label, si no, un genérico
        label: infoEquipo ? `${infoEquipo.label} ${nodes.length + 1}` : `Equipo ${nodes.length + 1}`,
        status: 'ok',
        value: (Math.random() * 100).toFixed(1),
        labelOffset: { x: 0, y: -40 }, // Posición inicial del nombre
        valueOffset: { x: 0, y: 45 }   // Posición inicial del número
      },
    };
    setNodes((nds) => nds.concat(newNode));
  }, [nodes.length]);

  const updateProduct = (id, newData) => {
    setNodes((nds) => nds.map((node) => node.id === id ? { ...node, data: { ...node.data, ...newData } } : node));
  };

  const deleteProduct = (id) => {
    setNodes((nds) => nds.filter((node) => node.id !== id));
  };

  // --- LÓGICA DE DRAG & DROP ---
  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = useCallback((event) => {
    event.preventDefault();

    const type = event.dataTransfer.getData('application/reactflow');
    if (!type) return;

    // Ya no necesitamos reactFlowWrapper.current.getBoundingClientRect()
    // screenToFlowPosition recibe directamente las coordenadas del cliente
    const position = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    createProduct(type, position);
  }, [reactFlowInstance, createProduct]);

  // Agrega esta función antes del return para definir el estilo de línea recta
  const onConnect = useCallback((params) => {
    const edgeStyle = {
      ...params,
      type: 'straight', // <--- Esto hace que las líneas sean rectas
      animated: true,    // Mantiene la animación de flujo
      style: { stroke: '#333', strokeWidth: 2 },
      markerEnd: {
        type: 'arrowclosed', // Flecha al final
        color: '#333',
      },
    };
    setEdges((eds) => addEdge(edgeStyle, eds));
  }, [setEdges]);

  const addLabelToEquipment = useCallback((parentId, type = 'text') => {
    const labelId = `label_${Date.now()}`;

    const newLabel = {
      id: labelId,
      type: 'default', // Usamos el tipo default para que sea movible
      parentNode: parentId,
      position: { x: 0, y: -40 }, // Aparece arriba por defecto
      data: {
        label: type === 'text' ? 'Nueva Etiqueta' : '0.0', // Si es dato, empieza en 0
        isDynamic: type === 'data'
      },
      draggable: true,
      style: {
        fontSize: '11px',
        background: type === 'data' ? '#f0f7ff' : 'transparent',
        border: type === 'data' ? '1px solid #005fb8' : 'none',
        borderRadius: '3px',
        padding: '2px 5px',
        minWidth: '50px',
        textAlign: 'center'
      }
    };

    setNodes((nds) => nds.concat(newLabel));
  }, [setNodes]);


  const moveLabel = (axis, value) => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === selectedNode.id) {
          const currentOffset = node.data.labelOffset || { x: 0, y: -40 };
          return {
            ...node,
            data: {
              ...node.data,
              labelOffset: { ...currentOffset, [axis]: currentOffset[axis] + value }
            }
          };
        }
        return node;
      })
    );
  };
  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', backgroundColor: '#fff', color: '#333' }}>

      {/* 1. ÁREA DEL DIAGRAMA (Ahora a la izquierda) */}
      <div style={{ flexGrow: 1, position: 'relative' }} ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={(objs) => setNodes((nds) => applyNodeChanges(objs, nds))}
          onEdgesChange={(objs) => setEdges((eds) => applyEdgeChanges(objs, eds))}
          onConnect={(params) => setEdges((eds) => addEdge(params, eds))}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          nodeTypes={nodeTypes}
          onNodeDoubleClick={(e, node) => alert(`Cargando historial de ${node.data.label}...`)}
          fitView
          onNodeContextMenu={(event, node) => {
            event.preventDefault(); // Evita el menú normal del navegador


            if (node.type === 'equipmentNode') {
              const choice = window.prompt(
                "Escribe 'T' para Texto o 'D' para Dato dinámico:"
              );

              if (choice?.toUpperCase() === 'T') addSubNode(node.id, 'STATIC_TEXT');
              if (choice?.toUpperCase() === 'D') addSubNode(node.id, 'LIVE_DATA');
            }
          }}

          onNodeClick={(event, node) => setSelectedNode(node)} // <--- AÑADE ESTO
          onPaneClick={() => setSelectedNode(null)}


        >
          <Background color="#eee" variant="dots" />
          <Controls />
        </ReactFlow>
      </div>

      {/* 2. SIDEBAR DERECHA: BIBLIOTECA DE EQUIPOS */}
      <aside style={{
        width: '200px',
        backgroundColor: '#fff',
        borderLeft: '1px solid #fff', // Borde a la izquierda para separar del lienzo
        display: 'flex',
        flexDirection: 'column',
        padding: '20px',
        zIndex: 5
      }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '20px', color: '#4ec9b0', borderBottom: '1px solid #3c3c3c', paddingBottom: '10px' }}>
          Biblioteca P&ID
        </h2>

        {/* Contenedor con scroll para los 50 equipos */}
        <div style={{ flexGrow: 1, overflowY: 'auto', paddingRight: '5px' }}>
          <p style={{ fontSize: '0.8rem', color: '#858585', marginBottom: '15px' }}>
            Arrastra hacia la izquierda:
          </p>

          {Object.keys(EQUIPMENT_CATALOG).map((key) => (
            <div
              key={key}
              onDragStart={(event) => onDragStart(event, key)}
              draggable
              style={{
                padding: '15px',
                backgroundColor: '#fff',
                border: '1px solid #444',
                borderRadius: '6px',
                marginBottom: '12px',
                cursor: 'grab',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = '#4ec9b0'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = '#444'}
            >
              {EQUIPMENT_CATALOG[key].svg('#4ec9b0')}
              <span style={{ fontSize: '0.85rem', marginTop: '8px', fontWeight: '500' }}>
                {EQUIPMENT_CATALOG[key].label}
              </span>
            </div>
          ))}
        </div>

        {/* ACCIONES SOBRE EQUIPOS (UPDATE/DELETE) */}
        <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #3c3c3c' }}>
          <button
            onClick={() => nodes[0] && updateProduct(nodes[0].id, { status: 'error', value: 'ALERTA' })}
            style={{ width: '100%', padding: '10px', backgroundColor: '#e51400', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginBottom: '8px', fontWeight: 'bold' }}
          >
            Simular Falla
          </button>
          <button
            onClick={() => nodes[0] && deleteProduct(nodes[0].id)}
            style={{ width: '100%', padding: '10px', backgroundColor: 'transparent', color: '#f48771', border: '1px solid #f48771', borderRadius: '4px', cursor: 'pointer' }}
          >
            Eliminar Primero
          </button>
        </div>

        {selectedNode && (
          <div style={{ marginTop: '20px', padding: '10px', background: '#f0f0f0', borderRadius: '8px' }}>
            <h4 style={{ fontSize: '0.8rem' }}>Ajustar Etiqueta</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
              <button onClick={() => moveLabel('y', -5)}>↑ Subir</button>
              <button onClick={() => moveLabel('y', 5)}>↓ Bajar</button>
              <button onClick={() => moveLabel('x', -5)}>← Izq</button>
              <button onClick={() => moveLabel('x', 5)}>Der →</button>
            </div>
            <button
              onClick={() => {
                const nuevoNombre = prompt("Nuevo nombre:", selectedNode.data.label);
                updateProduct(selectedNode.id, { label: nuevoNombre });
              }}
              style={{ marginTop: '10px', width: '100%' }}
            >
              Editar Texto
            </button>
          </div>
        )}
      </aside>

    </div>
  );
}