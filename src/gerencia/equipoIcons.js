// Formas simplificadas por tipo de equipo para el diagrama HMI. Placeholder hasta
// contar con símbolos P&ID reales del layout de planta (sección 7 del documento fuente).
export const EQUIPO_ICONOS = {
  bomba: (color) => (
    <svg width="40" height="40" viewBox="0 0 64 64" fill="none" stroke={color} strokeWidth="3">
      <circle cx="32" cy="36" r="16" />
      <path d="M16 36H8" />
      <path d="M32 20V8h12" />
      <path d="M20 52h24" />
    </svg>
  ),
  tanque: (color) => (
    <svg width="40" height="40" viewBox="0 0 80 80" fill="none" stroke={color} strokeWidth="3">
      <path d="M16 12h32v36a4 4 0 01-4 4H20a4 4 0 01-4-4V12z" />
      <path d="M16 12c0-4 32-4 32 0" />
    </svg>
  ),
  agitador: (color) => (
    <svg width="40" height="46" viewBox="0 0 60 70" fill="none" stroke={color} strokeWidth="3">
      <rect x="20" y="5" width="20" height="12" rx="2" />
      <line x1="30" y1="17" x2="30" y2="55" />
      <path d="M20 50 L40 60 M20 60 L40 50" strokeLinecap="round" />
    </svg>
  ),
  compresor: (color) => (
    <svg width="40" height="40" viewBox="0 0 64 64" fill="none" stroke={color} strokeWidth="3">
      <path d="M12 44V20l32-8v40l-32-8z" />
      <path d="M44 32h12" />
      <circle cx="52" cy="32" r="2" fill={color} />
    </svg>
  ),
  clarificador: (color) => (
    <svg width="40" height="40" viewBox="0 0 64 64" fill="none" stroke={color} strokeWidth="3">
      <circle cx="32" cy="32" r="26" />
      <circle cx="32" cy="32" r="4" fill={color} />
      <line x1="32" y1="6" x2="32" y2="58" />
      <line x1="6" y1="32" x2="58" y2="32" />
    </svg>
  ),
  secador: (color) => (
    <svg width="40" height="40" viewBox="0 0 64 64" fill="none" stroke={color} strokeWidth="3">
      <rect x="8" y="24" width="48" height="16" rx="8" />
      <line x1="20" y1="24" x2="20" y2="40" />
      <line x1="32" y1="24" x2="32" y2="40" />
      <line x1="44" y1="24" x2="44" y2="40" />
    </svg>
  ),
};
