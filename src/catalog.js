const EQUIPMENT_CATALOG = {
    bomba: {
        label: 'Bomba',
        svg: (color) => (
            <svg width="50" height="50" viewBox="0 0 64 64" fill="none" stroke={color} strokeWidth="2">
                {/* Voluta de la bomba (Círculo principal) */}
                <circle cx="32" cy="36" r="16" />
                {/* Succión lateral */}
                <path d="M16 36H8" />
                {/* Descarga tangencial superior */}
                <path d="M32 20V8h12" />
                {/* Base de apoyo */}
                <path d="M20 52h24" />
            </svg>
        ),
    },
    tanque: {
        label: 'Tanque',
        svg: (color) => (
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none" stroke={color} strokeWidth="2">
                {/* Cuerpo del tanque (Cilindro vertical) */}
                <path d="M16 12h32v36a4 4 0 01-4 4H20a4 4 0 01-4-4V12z" />
                {/* Tapa superior convexa */}
                <path d="M16 12c0-4 32-4 32 0" />
            </svg>
        ),
    },
    agitador: {
        label: 'Agitador',
        svg: (color) => (
            <svg width="60" height="70" viewBox="0 0 60 70" fill="none" stroke={color} strokeWidth="2">
                {/* Motor Superior */}
                <rect x="20" y="5" width="20" height="12" rx="2" />

                {/* Eje (Shaft) */}
                <line x1="30" y1="17" x2="30" y2="55" />

                {/* Aspas / Hélice (Impeller) */}
                <path d="M20 50 L40 60 M20 60 L40 50" strokeLinecap="round" />

                {/* Acople al tanque (opcional, línea horizontal) */}
                <line x1="15" y1="25" x2="45" y2="25" strokeDasharray="2 2" />
            </svg>
        ),
    },

    etiqueta: {
        label: 'Etiqueta',
        svg: (color) => (
            <svg width="60" height="30" viewBox="0 0 60 30">
                <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fill={color} fontSize="12" fontWeight="bold">
                    TEXTO
                </text>
            </svg>
        ),
    },
    compresor: {
        label: 'Compresor',
        svg: (color) => (
            <svg width="50" height="50" viewBox="0 0 64 64" fill="none" stroke={color} strokeWidth="2">
                {/* Forma trapezoidal característica */}
                <path d="M12 44V20l32-8v40l-32-8z" />
                {/* Eje de entrada */}
                <path d="M44 32h12" />
                <circle cx="52" cy="32" r="2" fill={color} />
            </svg>
        ),
    },
};

export { EQUIPMENT_CATALOG };