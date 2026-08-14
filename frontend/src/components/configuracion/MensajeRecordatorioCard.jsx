import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import CampoFormulario from '@/components/CampoFormulario';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useTerminoRetrasado } from '@/hooks/useTerminoRetrasado';
import {
  guardarPlantilla,
  obtenerPlantilla,
  previsualizarPlantilla,
} from '@/services/recordatorio.service';

const FORMATOS = 'image/png,image/jpeg,image/webp';

/**
 * Tamaño máximo de la imagen. El backend admite algo más, pero se avisa aquí
 * para no hacer subir un archivo que va a acabar rechazado.
 */
const PESO_MAXIMO = 1024 * 1024;

/** Lee un archivo del disco como data URI, que es como se guarda y se envía. */
function leerComoDataUri(archivo) {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(String(lector.result));
    lector.onerror = () => rechazar(new Error('No fue posible leer la imagen.'));
    lector.readAsDataURL(archivo);
  });
}

/**
 * Redacción del recordatorio de cita: el texto que recibe el paciente y la
 * imagen que lo acompaña.
 *
 * La vista previa la arma el backend, que es quien sabe rellenar los datos de
 * la cita: así lo que se ve aquí es exactamente lo que se va a enviar.
 */
function MensajeRecordatorioCard() {
  const [plantilla, setPlantilla] = useState('');
  const [imagen, setImagen] = useState(null);
  const [marcadores, setMarcadores] = useState({});
  const [porDefecto, setPorDefecto] = useState('');
  const [vistaPrevia, setVistaPrevia] = useState('');
  const [guardando, setGuardando] = useState(false);

  const areaTexto = useRef(null);
  const selectorArchivo = useRef(null);

  const cargar = useCallback(async () => {
    try {
      const datos = await obtenerPlantilla();

      setPlantilla(datos.plantilla);
      setImagen(datos.imagen);
      setMarcadores(datos.marcadores);
      setPorDefecto(datos.por_defecto);
      setVistaPrevia(datos.ejemplo);
    } catch (error) {
      toast.error(error.message);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Se espera a que deje de escribir: la vista previa no vale una petición por
  // cada tecla.
  const plantillaRetrasada = useTerminoRetrasado(plantilla, 400);

  useEffect(() => {
    let cancelado = false;

    if (!plantillaRetrasada.trim()) {
      setVistaPrevia('');
      return undefined;
    }

    previsualizarPlantilla(plantillaRetrasada)
      .then((datos) => {
        if (!cancelado) setVistaPrevia(datos.mensaje);
      })
      .catch(() => {
        // Un fallo aquí solo deja la vista previa como estaba; el error que
        // importa es el de guardar.
      });

    return () => {
      cancelado = true;
    };
  }, [plantillaRetrasada]);

  /** Escribe un dato entre llaves donde esté el cursor. */
  function insertarMarcador(nombre) {
    const area = areaTexto.current;
    const texto = `{${nombre}}`;

    if (!area) {
      setPlantilla((previo) => previo + texto);
      return;
    }

    const { selectionStart, selectionEnd } = area;
    setPlantilla((previo) => previo.slice(0, selectionStart) + texto + previo.slice(selectionEnd));

    // Deja el cursor detrás de lo insertado para poder seguir escribiendo.
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(selectionStart + texto.length, selectionStart + texto.length);
    });
  }

  async function elegirImagen(evento) {
    const archivo = evento.target.files?.[0];
    evento.target.value = '';

    if (!archivo) return;

    if (archivo.size > PESO_MAXIMO) {
      toast.error('La imagen pesa más de 1 MB. Use una más liviana.');
      return;
    }

    try {
      setImagen(await leerComoDataUri(archivo));
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function guardar(evento) {
    evento.preventDefault();
    setGuardando(true);

    try {
      // La imagen se manda siempre: vacía es como se pide quitarla.
      const datos = await guardarPlantilla({ plantilla, imagen: imagen ?? '' });

      setPlantilla(datos.plantilla);
      setImagen(datos.imagen);
      setVistaPrevia(datos.ejemplo);
      toast.success('Mensaje del recordatorio actualizado.');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Mensaje del recordatorio</CardTitle>
        <CardDescription>
          Lo que recibe el paciente por WhatsApp el día antes de su cita. Los datos entre llaves se
          sustituyen por los de cada cita.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form className="grid gap-6 lg:grid-cols-2" onSubmit={guardar}>
          <div className="flex flex-col gap-4">
            <CampoFormulario
              id="plantilla"
              etiqueta="Texto"
              ayuda="Una línea que solo contenga datos vacíos no se envía."
            >
              {(props) => (
                <Textarea
                  {...props}
                  ref={areaTexto}
                  className="min-h-[220px] font-mono text-xs leading-relaxed"
                  value={plantilla}
                  onChange={(evento) => setPlantilla(evento.target.value)}
                />
              )}
            </CampoFormulario>

            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium">Datos que puede intercalar</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(marcadores).map(([nombre, descripcion]) => (
                  <button
                    key={nombre}
                    type="button"
                    title={descripcion}
                    onClick={() => insertarMarcador(nombre)}
                    className="border-2 border-trazo bg-secondary px-2 py-1 font-mono text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {`{${nombre}}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium">Imagen adjunta (opcional)</p>

              <input
                ref={selectorArchivo}
                type="file"
                accept={FORMATOS}
                className="sr-only"
                aria-label="Elegir imagen para el recordatorio"
                onChange={elegirImagen}
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => selectorArchivo.current?.click()}
                >
                  <ImagePlus aria-hidden="true" />
                  {imagen ? 'Cambiar imagen' : 'Elegir imagen'}
                </Button>

                {imagen && (
                  <Button type="button" size="sm" variant="outline" onClick={() => setImagen(null)}>
                    <Trash2 aria-hidden="true" />
                    Quitar imagen
                  </Button>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                PNG, JPG o WEBP de hasta 1 MB. Se envía junto al texto, en un solo mensaje.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={guardando || !plantilla.trim()}>
                {guardando ? 'Guardando...' : 'Guardar mensaje'}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => setPlantilla(porDefecto)}
                disabled={!porDefecto || plantilla === porDefecto}
              >
                <RotateCcw aria-hidden="true" />
                Texto original
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium">Vista previa</p>

            <div className="flex flex-col gap-2 border-2 border-trazo bg-secondary p-3">
              {imagen && (
                <img
                  src={imagen}
                  alt="Imagen que acompaña al recordatorio"
                  className="max-h-56 w-full border-2 border-trazo object-contain"
                />
              )}

              <p className="whitespace-pre-wrap text-sm">
                {vistaPrevia || 'Escriba el mensaje para ver cómo queda.'}
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              Ejemplo con una cita inventada. Al enviarse se usan los datos reales del paciente.
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default MensajeRecordatorioCard;
