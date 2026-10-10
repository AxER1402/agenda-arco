import EstadoRecordatorio from '@/components/citas/EstadoRecordatorio';
import { Badge } from '@/components/ui/badge';
import {
  dpi as formatoDpi,
  fechaConDiaSemana,
  fechaHora,
  fechaLarga,
  hora12,
  telefono as formatoTelefono,
  varianteEstado,
  varianteVencimiento,
} from '@/lib/formato';

/** MySQL devuelve 1/0/null: sí, no, o no se le preguntó. */
function textoWhatsapp(valor) {
  if (valor === null || valor === undefined) return 'No se preguntó';
  return valor ? 'Sí' : 'No';
}

/** Días que le quedan a la orden, contados desde el día de la cita. */
function textoDiasParaVencer(dias) {
  if (dias === null || dias === undefined) return '';
  if (dias < 0) return 'ya vencida el día de la cita';
  if (dias === 0) return 'vence el mismo día';
  return dias === 1 ? '1 día de margen' : `${dias} días de margen`;
}

/** Un dato con su etiqueta. Lo vacío se dice, no se deja en blanco. */
function Dato({ etiqueta, children, ancho = false }) {
  const vacio =
    children === null || children === undefined || children === '' || children === false;

  return (
    <div className={ancho ? 'sm:col-span-2 lg:col-span-3' : undefined}>
      <dt className="text-xs text-muted-foreground">{etiqueta}</dt>
      <dd className={vacio ? 'text-muted-foreground' : 'break-words'}>
        {vacio ? 'Sin dato' : children}
      </dd>
    </div>
  );
}

function Grupo({ titulo, children }) {
  return (
    <section className="flex flex-col gap-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </h4>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </dl>
    </section>
  );
}

/**
 * Todo lo que se ingresó al registrar la cita, en un solo vistazo: el paciente,
 * la orden del IGSS que trae y la cita en sí.
 *
 * La fila de la agenda solo cabe con lo imprescindible; esto es lo que se
 * despliega debajo cuando hace falta el resto.
 */
function DetalleCita({ cita }) {
  return (
    <div className="flex flex-col gap-5">
      <Grupo titulo="Paciente">
        <Dato etiqueta="Nombre">{cita.paciente_nombre}</Dato>
        <Dato etiqueta="Teléfono">{formatoTelefono(cita.paciente_telefono)}</Dato>
        <Dato etiqueta="DPI">{cita.paciente_dpi && formatoDpi(cita.paciente_dpi)}</Dato>
        <Dato etiqueta="¿Tiene WhatsApp?">{textoWhatsapp(cita.paciente_tiene_whatsapp)}</Dato>
      </Grupo>

      <Grupo titulo="Orden del IGSS">
        <Dato etiqueta="Fecha de recepción">{fechaLarga(cita.fecha_entrega)}</Dato>
        <Dato etiqueta="Vencimiento">
          {cita.fecha_vencimiento && (
            <span className="flex flex-wrap items-center gap-2">
              <Badge variant={varianteVencimiento(cita.dias_para_vencer)}>
                {fechaLarga(cita.fecha_vencimiento)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {textoDiasParaVencer(cita.dias_para_vencer)}
              </span>
            </span>
          )}
        </Dato>
        <Dato etiqueta="Fecha cita IGSS">
          {cita.fecha_cita_igss ? fechaLarga(cita.fecha_cita_igss) : 'No la indicó'}
        </Dato>
        <Dato etiqueta="Último día para la cita">{fechaLarga(cita.fecha_limite)}</Dato>
        {cita.numero_orden && <Dato etiqueta="Número de orden">{cita.numero_orden}</Dato>}
        {cita.orden_observaciones && (
          <Dato etiqueta="Observaciones de la orden" ancho>
            {cita.orden_observaciones}
          </Dato>
        )}
      </Grupo>

      <Grupo titulo="Cita">
        <Dato etiqueta="Día y hora">
          <span className="capitalize">{fechaConDiaSemana(cita.fecha)}</span>,{' '}
          {hora12(String(cita.hora))}
        </Dato>
        <Dato etiqueta="Estado">
          <Badge variant={varianteEstado(cita.estado)}>{cita.estado_nombre}</Badge>
        </Dato>
        <Dato etiqueta="Recordatorio">
          <EstadoRecordatorio cita={cita} />
        </Dato>
        <Dato etiqueta={`Exámenes (${cita.examenes.length})`} ancho>
          {cita.examenes.length > 0 && (
            <ul className="flex flex-col gap-1">
              {cita.examenes.map((examen) => (
                <li key={examen.id}>
                  {examen.nombre}
                  {examen.categoria_nombre && (
                    <span className="text-muted-foreground"> · {examen.categoria_nombre}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Dato>
        <Dato etiqueta="Notas" ancho>
          {cita.notas && <span className="whitespace-pre-line">{cita.notas}</span>}
        </Dato>
        <Dato etiqueta="Registrada">
          {[cita.registrada_por, fechaHora(cita.registrada_en)].filter(Boolean).join(' — ')}
        </Dato>
      </Grupo>
    </div>
  );
}

export default DetalleCita;
