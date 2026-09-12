import { cn } from '@/lib/utils';

/**
 * Logotipo del laboratorio.
 *
 * La imagen vive en `public/logo.png` y se referencia por URL en vez de
 * importarse: así el laboratorio cambia de imagen sustituyendo un solo fichero.
 *
 * Sustituye al bloque de icono y al rótulo «El Arco / Laboratorios» que había
 * antes: el propio logotipo lleva el nombre escrito, y repetirlo al lado solo
 * robaba ancho. El nombre no se pierde —viaja en el `alt`—, así que un lector
 * de pantalla sigue anunciando de quién es la aplicación.
 *
 * Va suelto, sin placa ni recuadro detrás. El archivo es de trazo cian claro
 * sobre transparente, pensado para fondo oscuro: sobre el blanco del tema se
 * queda en 2,3:1 y desaparece. Por eso, por omisión, se le aplica el filtro de
 * `logotipo-sobre-claro` (index.css), que le baja el brillo hasta un verde
 * azulado legible sin tocar el archivo.
 *
 * @param {object} props
 * @param {boolean} [props.sobreOscuro] Retira el filtro. Solo para el panel de
 *   marca de la pantalla de acceso, que es la única superficie honda del
 *   sistema: ahí el archivo ya se ve como se diseñó y oscurecerlo lo borraría.
 * @param {string} [props.alt] Vacío cuando el bloque que lo contiene ya está
 *   marcado como decorativo.
 */
function Logotipo({ className, sobreOscuro = false, alt = 'El Arco Laboratorios' }) {
  return (
    <img
      src="/logo.png"
      alt={alt}
      className={cn(
        'w-auto shrink-0 object-contain',
        !sobreOscuro && 'logotipo-sobre-claro',
        className,
      )}
    />
  );
}

export default Logotipo;
