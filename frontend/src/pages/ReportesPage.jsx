import { useState } from 'react';
import { FileDown, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import CampoFormulario from '@/components/CampoFormulario';
import EncabezadoModulo from '@/components/layout/EncabezadoModulo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SelectNativo } from '@/components/ui/select-nativo';
import { descargarReporte } from '@/services/reporte.service';
import { hoyISO } from '@/lib/formato';

/** Los mismos códigos que maneja el backend. */
const ESTADOS = [
  { valor: '', texto: 'Todos los estados' },
  { valor: 'PENDIENTE', texto: 'Pendiente' },
  { valor: 'CONFIRMADA', texto: 'Confirmada' },
  { valor: 'ATENDIDA', texto: 'Atendida' },
  { valor: 'NO_ASISTIO', texto: 'No asistió' },
  { valor: 'CANCELADA', texto: 'Cancelada' },
];

const FORMATOS = [
  { clave: 'pdf', texto: 'PDF' },
  { clave: 'docx', texto: 'Word' },
];

/** Del día 1 del mes en curso hasta hoy: es el periodo que se pide casi siempre. */
function periodoPorDefecto() {
  const hoy = hoyISO();
  return { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy };
}

/**
 * Reportes del sistema.
 *
 * Dos reportes, dos formatos y un solo periodo para los dos: el rango vive
 * arriba y vale para ambos, porque en la práctica se sacan juntos y repetir el
 * par de fechas en cada tarjeta solo daba ocasión de descuadrarlas.
 *
 * El archivo lo arma el backend, no el navegador: así el PDF y el Word salen
 * iguales desde cualquier equipo y no dependen de lo que tenga instalado quien
 * lo pide.
 */
function ReportesPage() {
  const [periodo, setPeriodo] = useState(periodoPorDefecto);
  const [estado, setEstado] = useState('');
  const [descargando, setDescargando] = useState(null);

  const rangoInvertido = Boolean(periodo.desde && periodo.hasta && periodo.desde > periodo.hasta);

  function cambiarPeriodo(campo) {
    return (evento) => setPeriodo((previo) => ({ ...previo, [campo]: evento.target.value }));
  }

  async function descargar(reporte, formato) {
    setDescargando(`${reporte}-${formato}`);

    try {
      await descargarReporte(reporte, {
        formato,
        desde: periodo.desde,
        hasta: periodo.hasta,
        ...(reporte === 'citas' && estado ? { estado } : {}),
      });
      toast.success('Reporte descargado.');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDescargando(null);
    }
  }

  const listo = Boolean(periodo.desde) && Boolean(periodo.hasta) && !rangoInvertido;

  /** Los dos botones de formato de una tarjeta. */
  function Descargas({ reporte }) {
    return (
      <div className="flex flex-wrap gap-2">
        {FORMATOS.map(({ clave, texto }) => {
          const enCurso = descargando === `${reporte}-${clave}`;

          return (
            <Button
              key={clave}
              variant={clave === 'pdf' ? 'default' : 'outline'}
              disabled={!listo || descargando !== null}
              onClick={() => descargar(reporte, clave)}
            >
              {enCurso ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <FileDown aria-hidden="true" />
              )}
              {enCurso ? 'Generando...' : texto}
            </Button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <EncabezadoModulo
        icono={FileText}
        titulo="Reportes"
        descripcion="Se descargan en PDF, para imprimir, o en Word, para editarlos antes de entregarlos."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Periodo</CardTitle>
          <CardDescription>
            Las dos fechas se incluyen, y valen para los dos reportes de abajo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <CampoFormulario
              id="reporte-desde"
              etiqueta="Desde"
              error={rangoInvertido ? 'La fecha inicial no puede ser posterior a la final.' : undefined}
            >
              {(props) => (
                <Input
                  {...props}
                  type="date"
                  max={periodo.hasta || undefined}
                  value={periodo.desde}
                  onChange={cambiarPeriodo('desde')}
                />
              )}
            </CampoFormulario>

            <CampoFormulario id="reporte-hasta" etiqueta="Hasta">
              {(props) => (
                <Input
                  {...props}
                  type="date"
                  min={periodo.desde || undefined}
                  value={periodo.hasta}
                  onChange={cambiarPeriodo('hasta')}
                />
              )}
            </CampoFormulario>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Listado de citas</CardTitle>
          <CardDescription>
            La hoja de trabajo: cada cita del periodo con su fecha, hora, paciente, teléfono,
            exámenes y estado, ordenada como se atiende. Sale apaisada para que los exámenes
            quepan en una línea.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <CampoFormulario
              id="reporte-estado"
              etiqueta="Estado"
              ayuda="Solo afecta a este reporte."
            >
              {(props) => (
                <SelectNativo
                  {...props}
                  value={estado}
                  onChange={(evento) => setEstado(evento.target.value)}
                >
                  {ESTADOS.map(({ valor, texto }) => (
                    <option key={valor} value={valor}>
                      {texto}
                    </option>
                  ))}
                </SelectNativo>
              )}
            </CampoFormulario>
          </div>

          <Descargas reporte="citas" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Resumen de actividad</CardTitle>
          <CardDescription>
            Los números del periodo: cuántas citas hubo y cómo terminaron, el porcentaje de
            asistencia, la ocupación frente al límite diario, los exámenes más pedidos y cómo
            fueron los recordatorios de WhatsApp.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Descargas reporte="actividad" />
        </CardContent>
      </Card>
    </div>
  );
}

export default ReportesPage;
