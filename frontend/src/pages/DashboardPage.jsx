import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, MessageCircle, PhoneCall, Users } from 'lucide-react';
import { toast } from 'sonner';

import AccionesCita from '@/components/citas/AccionesCita';
import EstadoRecordatorio from '@/components/citas/EstadoRecordatorio';
import { TituloSeccion } from '@/components/layout/EncabezadoModulo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { obtenerResumen } from '@/services/cita.service';
import { obtenerResumenRecordatorios } from '@/services/recordatorio.service';
import { useAuth } from '@/context/AuthContext';
import {
  fechaLarga,
  hora12,
  telefono as formatoTelefono,
  varianteEstado,
} from '@/lib/formato';

/**
 * El contraste de tamaños es lo que hace legible el panel: rótulo diminuto en
 * versalitas, cifra grande, y el detalle de vuelta a cuerpo pequeño. Se lee el
 * número desde lejos y el resto solo si hace falta.
 *
 * Los tres llevan el mismo bloque de bruma en el icono, no uno de cada color:
 * tres tarjetas de tonos distintos en fila hacían del panel un mosaico. Lo que
 * distingue a cada una es el dato.
 */
function Indicador({ titulo, valor, detalle, icono: Icono, variante }) {
  return (
    <Card>
      <CardHeader className="gap-3 pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardDescription className="rotulo pt-1.5">{titulo}</CardDescription>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Icono className="size-5" aria-hidden="true" />
          </span>
        </div>
        <p className={`cifra text-4xl ${variante ?? ''}`}>{valor}</p>
      </CardHeader>
      <CardContent>
        <p className="text-xs leading-relaxed text-muted-foreground">{detalle}</p>
      </CardContent>
    </Card>
  );
}

function DashboardPage() {
  const { usuario } = useAuth();
  const [resumen, setResumen] = useState(null);
  const [recordatorios, setRecordatorios] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [agenda, avisos] = await Promise.all([
        obtenerResumen(),
        obtenerResumenRecordatorios().catch(() => null),
      ]);
      setResumen(agenda);
      setRecordatorios(avisos);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (cargando && !resumen) {
    return <p className="rotulo">Cargando panel...</p>;
  }

  // Tasa de entrega sobre los recordatorios ya procesados: los pendientes
  // todavía no cuentan como éxito ni como fallo.
  const enviados = recordatorios?.conteo?.ENVIADO ?? 0;
  const fallidos = recordatorios?.conteo?.FALLIDO ?? 0;
  const procesados = enviados + fallidos;
  const porcentajeEntrega = procesados ? Math.round((enviados / procesados) * 100) : null;

  const llamadas = resumen?.llamadas_pendientes ?? 0;

  return (
    <div className="flex flex-col gap-10">
      {/* El panel es la primera pantalla del turno. El saludo va como titular
          de página, no como bloque de color: lo que lo destaca es el tamaño. */}
      <header>
        <p className="text-sm text-muted-foreground">{fechaLarga(resumen?.fecha)}</p>
        <h1 className="mt-1 text-2xl leading-tight sm:text-3xl">
          Hola, {usuario?.nombre_completo}
        </h1>
        <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">
          Este es el resumen del día. Todo lo que está agendado, en un vistazo.
        </p>
      </header>

      <section aria-label="Indicadores" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Indicador
          titulo="Pacientes programados hoy"
          valor={resumen?.pacientes_programados ?? 0}
          detalle={`Capacidad diaria: ${resumen?.capacidad_diaria ?? 0}`}
          icono={Users}
        />
        <Indicador
          titulo="Espacios disponibles"
          valor={resumen?.espacios_disponibles ?? 0}
          detalle={
            resumen?.espacios_disponibles === 0
              ? 'El día está lleno.'
              : 'Todavía se pueden agendar citas para hoy.'
          }
          icono={CalendarCheck}
          variante={resumen?.espacios_disponibles === 0 ? 'text-destructive' : undefined}
        />
        <Indicador
          titulo="Recordatorios exitosos"
          valor={`${enviados}/${procesados}`}
          detalle={
            !recordatorios?.whatsapp?.listo
              ? 'WhatsApp sin vincular: revise la configuración.'
              : porcentajeEntrega === null
                ? 'Todavía no se ha enviado ningún recordatorio.'
                : `${porcentajeEntrega}% de entrega · ${fallidos} fallido(s).`
          }
          icono={MessageCircle}
          variante={fallidos ? 'text-destructive' : undefined}
        />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TituloSeccion>Citas de hoy</TituloSeccion>
          <Button asChild size="sm" variant="outline">
            <Link to="/agenda">Ver agenda</Link>
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hora</TableHead>
              <TableHead>Paciente</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(resumen?.citas_hoy ?? []).length === 0 ? (
              <TableEmpty colSpan={5}>No hay citas programadas para hoy.</TableEmpty>
            ) : (
              resumen.citas_hoy.map((cita) => (
                <TableRow key={cita.id}>
                  <TableCell className="whitespace-nowrap font-medium">
                    {hora12(String(cita.hora))}
                  </TableCell>
                  <TableCell>{cita.paciente_nombre}</TableCell>
                  <TableCell>{formatoTelefono(cita.paciente_telefono)}</TableCell>
                  <TableCell>
                    <Badge variant={varianteEstado(cita.estado)}>{cita.estado_nombre}</Badge>
                  </TableCell>
                  <TableCell>
                    <AccionesCita cita={cita} onCambiada={cargar} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TituloSeccion>Citas de mañana</TituloSeccion>

          {llamadas > 0 && (
            <Badge variant="destructive">
              <PhoneCall aria-hidden="true" className="mr-1.5 size-3.5" />
              {llamadas} paciente(s) a los que hay que llamar
            </Badge>
          )}
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hora</TableHead>
              <TableHead>Paciente</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Aviso</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(resumen?.citas_manana ?? []).length === 0 ? (
              <TableEmpty colSpan={5}>No hay citas programadas para mañana.</TableEmpty>
            ) : (
              resumen.citas_manana.map((cita) => (
                <TableRow key={cita.id}>
                  <TableCell className="whitespace-nowrap font-medium">{cita.hora_texto}</TableCell>
                  <TableCell>{cita.paciente_nombre}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatoTelefono(cita.paciente_telefono)}
                  </TableCell>
                  <TableCell>
                    {cita.necesita_llamada ? (
                      <Badge
                        variant="destructive"
                        title={
                          cita.paciente_tiene_whatsapp === 0
                            ? 'Ese número no tiene WhatsApp.'
                            : `El recordatorio falló: ${cita.recordatorio_error ?? 'sin detalle'}`
                        }
                      >
                        <PhoneCall aria-hidden="true" className="mr-1.5 size-3.5" />
                        Llamar
                      </Badge>
                    ) : (
                      <EstadoRecordatorio cita={cita} />
                    )}
                  </TableCell>
                  <TableCell>
                    <AccionesCita cita={cita} onCambiada={cargar} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>

      <section className="flex flex-col gap-3">
        <TituloSeccion>Citas de ayer</TituloSeccion>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hora</TableHead>
              <TableHead>Paciente</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(resumen?.citas_ayer ?? []).length === 0 ? (
              <TableEmpty colSpan={4}>No hubo citas ayer.</TableEmpty>
            ) : (
              resumen.citas_ayer.map((cita) => (
                <TableRow key={cita.id}>
                  <TableCell className="whitespace-nowrap font-medium">{cita.hora_texto}</TableCell>
                  <TableCell>{cita.paciente_nombre}</TableCell>
                  <TableCell>
                    <Badge variant={varianteEstado(cita.estado)}>{cita.estado_nombre}</Badge>
                  </TableCell>
                  <TableCell>
                    <AccionesCita cita={cita} onCambiada={cargar} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}

export default DashboardPage;
