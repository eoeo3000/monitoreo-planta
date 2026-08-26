export const STATUS = {
  operativo: { label: 'Operativo', color: '#2e7d32' },
  alerta: { label: 'Alerta', color: '#f9a825' },
  falla: { label: 'Falla', color: '#c62828' },
  fuera_servicio: { label: 'Fuera de servicio', color: '#616161' },
};

const RANK = ['operativo', 'alerta', 'falla', 'fuera_servicio'];

export function worstStatus(statuses) {
  if (!statuses.length) return null;
  return statuses.reduce(
    (worst, s) => (RANK.indexOf(s) > RANK.indexOf(worst) ? s : worst),
    'operativo'
  );
}
