import { Badge } from '@/components/ui/badge';
import { fechaHora } from '@/lib/formato';

/**
 * Si al paciente ya se le avisó por WhatsApp o todavía no.
 *
 * Son cuatro situaciones distintas y conviene no confundirlas: que el aviso
 * salió, que está preparado pero aún no ha salido, que se intentó y falló, y que
 * no hay nada preparado. Un simple "sí/no" dejaría el fallo pareciendo un "no",
 * cuando es justo el caso que alguien tiene que atender.
 */
const ESTADOS = {
  ENVIADO: { texto: 'Notificado', variante: 'success' },
  PENDIENTE: { texto: 'Programado', variante: 'secondary' },
  FALLIDO: { texto: 'Falló', variante: 'destructive' },
};

function EstadoRecordatorio({ cita }) {
  const estado = ESTADOS[cita.recordatorio_estado];

  if (!estado) {
    // Una cita cerrada a la que nunca se avisó no tiene nada que reportar.
    return ['ATENDIDA', 'NO_ASISTIO', 'CANCELADA'].includes(cita.estado) ? (
      <span className="text-muted-foreground">—</span>
    ) : (
      <Badge variant="outline" title="Todavía no se le ha enviado el recordatorio.">
        Sin notificar
      </Badge>
    );
  }

  const detalle =
    cita.recordatorio_estado === 'ENVIADO'
      ? fechaHora(cita.recordatorio_enviado_en)
      : cita.recordatorio_estado === 'PENDIENTE'
        ? `Se enviará el ${fechaHora(cita.recordatorio_programado_para)}`
        : cita.recordatorio_error;

  return (
    <div className="flex flex-col items-start gap-1">
      <Badge variant={estado.variante} title={detalle ?? undefined}>
        {estado.texto}
      </Badge>
      {detalle && (
        <span className="max-w-[14rem] truncate text-xs text-muted-foreground" title={detalle}>
          {detalle}
        </span>
      )}
    </div>
  );
}

export default EstadoRecordatorio;
