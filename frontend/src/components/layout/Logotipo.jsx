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
 * El logotipo es de trazo cian sobre fondo transparente: sobre el azul marino
 * de la barra se lee de sobra (6,7:1), pero sobre el blanco de la barra
 * superior se queda en 2,3:1 y desaparece. Por eso, cuando le toca ir sobre una
 * superficie clara, se apoya en una placa de marino en lugar de ir suelto.
 *
 * @param {object} props
 * @param {boolean} [props.sobreClaro] Añade la placa de marino. Necesario en
 *   todo lo que vaya sobre papel.
 * @param {string} [props.alt] Vacío cuando el bloque que lo contiene ya está
 *   marcado como decorativo.
 */
function Logotipo({ className, sobreClaro = false, alt = 'El Arco Laboratorios' }) {
  return (
    <img
      src="/logo.png"
      alt={alt}
      className={cn(
        'w-auto shrink-0 object-contain',
        sobreClaro && 'border-2 border-trazo bg-marino px-2.5 py-1.5',
        className,
      )}
    />
  );
}

export default Logotipo;
