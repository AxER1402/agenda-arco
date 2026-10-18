import { useEffect, useRef } from 'react';

const URL_SCRIPT = 'https://accounts.google.com/gsi/client';

/** Una sola descarga del script aunque el botón se monte varias veces. */
let cargaScript = null;

function cargarScriptGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve();

  if (!cargaScript) {
    cargaScript = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = URL_SCRIPT;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        // Se olvida la promesa fallida para que el próximo montaje lo reintente.
        cargaScript = null;
        reject(new Error('No se pudo cargar el acceso con Google. Revise la conexión.'));
      };
      document.head.appendChild(script);
    });
  }

  return cargaScript;
}

/**
 * «Continuar con Google», con el botón oficial.
 *
 * Lo dibuja Google dentro de un iframe, así que no lleva los estilos del
 * sistema: es lo que exigen sus normas de marca, y es también lo único que
 * entrega la credencial firmada que verifica el backend. Se elige la variante
 * de contorno y rectangular, la más cercana al canto vivo del resto.
 *
 * @param {object} props
 * @param {string} props.clientId Identificador de cliente OAuth (lo da el backend).
 * @param {(credencial: string) => void} props.onCredencial
 * @param {(mensaje: string) => void} [props.onError] Si el script no carga.
 */
function BotonGoogle({ clientId, onCredencial, onError }) {
  const contenedor = useRef(null);

  // Google guarda la función que se le da al inicializar. Pasarle una que lea
  // de la referencia evita reinicializarlo cada vez que cambian las props.
  const alRecibir = useRef(onCredencial);
  const alFallar = useRef(onError);
  useEffect(() => {
    alRecibir.current = onCredencial;
    alFallar.current = onError;
  });

  useEffect(() => {
    let cancelado = false;

    cargarScriptGoogle()
      .then(() => {
        if (cancelado || !contenedor.current) return;

        const { id } = window.google.accounts;
        id.initialize({
          client_id: clientId,
          callback: ({ credential }) => alRecibir.current(credential),
        });
        id.renderButton(contenedor.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'rectangular',
          text: 'continue_with',
          logo_alignment: 'center',
          locale: 'es',
          // Google pide el ancho en píxeles y no admite más de 400.
          width: Math.min(400, contenedor.current.offsetWidth || 400),
        });
      })
      .catch((error) => {
        if (!cancelado) alFallar.current?.(error.message);
      });

    return () => {
      cancelado = true;
    };
  }, [clientId]);

  return <div ref={contenedor} className="flex min-h-10 w-full justify-center" />;
}

export default BotonGoogle;
