import { useCallback, useEffect, useState } from 'react';

// Preferencias de quien está mirando — "en qué estaba", no datos de planta.
// Van en su PROPIA clave de localStorage, separada de la de store.js: no
// son dato de negocio, y mezclarlas haría que restablecer los datos de
// prueba se llevara puesta la selección (y que exportar la planta arrastrara
// algo que no le pertenece).
const CLAVE = 'condicion-activos-ui-v1';

function leer() {
  try {
    const raw = localStorage.getItem(CLAVE);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    // localStorage no disponible o dato corrupto: se arranca sin preferencias
    return {};
  }
}

// Qué planta se está mirando, COMPARTIDA por las tres pantallas de planta y
// persistida. Antes cada pantalla tenía su propia variable local, y como
// App.js las monta con render condicional, cambiar de pestaña destruía esa
// variable: al volver se caía siempre en data.plantas[0] —la semilla— y no
// en la planta que se estaba mirando.
//
// El valor guardado se VALIDA contra las plantas que existen ahora en vez de
// usarse tal cual: si esa planta se borró o los datos se restablecieron, el
// id apuntaría a la nada y las pantallas quedarían vacías sin explicación.
export function usePlantaSeleccionada(plantas) {
  const [guardado, setGuardado] = useState(() => leer().plantaId || null);

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify({ ...leer(), plantaId: guardado }));
    } catch (e) {
      // sin persistencia, pero la sesión sigue funcionando
    }
  }, [guardado]);

  const elegir = useCallback((id) => setGuardado(id), []);
  const existe = plantas.some((p) => p.id === guardado);
  return [existe ? guardado : plantas[0]?.id || null, elegir];
}
