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

// Tamaño legible del ícono, en píxeles de pantalla. Es una DECISIÓN sobre
// qué se considera legible, no un parámetro de laboratorio: por eso se
// comparte entre el ensayo (donde se ajusta con los sliders) y la Vista de
// operación (que lo aplica), y se persiste.
//
// El selector de PANTALLA del ensayo, en cambio, no se comparte y no debe:
// la Vista de operación tiene que usar el panel donde realmente dibuja.
// Simular otra pantalla ahí no querría decir nada.
export const TAMANO_ICONO_DEFAULT = { min: 28, max: 180 };

// Mismos topes que los sliders del ensayo. Se acota al leer para que un dato
// viejo o corrupto no deje a las dos pantallas calculando con un mínimo
// absurdo (un mínimo enorme fragmenta la planta en decenas de vistas).
const acotar = ({ min, max }) => ({
  min: Math.min(80, Math.max(10, Number(min) || TAMANO_ICONO_DEFAULT.min)),
  max: Math.min(400, Math.max(60, Number(max) || TAMANO_ICONO_DEFAULT.max)),
});

// Es POR PLANTA. El mínimo decide cuántas vistas hacen falta, y eso depende
// de la planta: una de 500 equipos no quiere el mismo mínimo que una de 13.
// Al cambiar de planta en el selector, vuelve el valor con el que la estabas
// mirando; una planta que nunca se tocó arranca en el default.
//
// Lo que SÍ se comparte es entre PANTALLAS: el editor y la Vista de
// operación leen el mismo valor para la misma planta, porque si no el
// reparto en vistas de una no coincidiría con el de la otra.
export function useTamanoIcono(plantaId) {
  const [porPlanta, setPorPlanta] = useState(() => leer().tamanoIconoPorPlanta || {});

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify({ ...leer(), tamanoIconoPorPlanta: porPlanta }));
    } catch (e) {
      // sin persistencia, pero la sesión sigue funcionando
    }
  }, [porPlanta]);

  const tamano = acotar({ ...TAMANO_ICONO_DEFAULT, ...(porPlanta[plantaId] || {}) });
  const cambiar = useCallback(
    (cambios) => {
      if (!plantaId) return;
      setPorPlanta((prev) => ({
        ...prev,
        [plantaId]: acotar({ ...TAMANO_ICONO_DEFAULT, ...(prev[plantaId] || {}), ...cambios }),
      }));
    },
    [plantaId]
  );
  return [tamano, cambiar];
}

// Si la Vista de operación dibuja las cañerías. Apagado por defecto: esa
// pantalla es de VIGILANCIA DE CONDICIÓN y el escalonado acomoda ignorando
// el proceso, así que las conexiones salen cruzadas —medido, 1.86 cruces por
// conexión contra 0.19 del compactado—. Pero es información real que a veces
// hace falta ("¿de dónde viene este equipo?"), así que se puede prender.
//
// Va en preferencias y no en estado local por lo mismo que la planta elegida:
// App.js desmonta la pantalla al cambiar de pestaña, y una variable local se
// perdería en cada ida y vuelta.
export function useVerCaneriasOperacion() {
  const [ver, setVer] = useState(() => Boolean(leer().verCaneriasOperacion));

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify({ ...leer(), verCaneriasOperacion: ver }));
    } catch (e) {
      // sin persistencia, pero la sesión sigue funcionando
    }
  }, [ver]);

  return [ver, setVer];
}
