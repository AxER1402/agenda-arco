import { Label } from '@/components/ui/label';

/**
 * Etiqueta + control + mensaje de error, con la relación aria correcta para
 * que un lector de pantalla anuncie el error junto al campo.
 */
function CampoFormulario({ id, etiqueta, error, ayuda, requerido = false, children }) {
  const idError = error ? `${id}-error` : undefined;
  const idAyuda = ayuda ? `${id}-ayuda` : undefined;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>
        {etiqueta}
        {requerido && <span className="ml-0.5 text-destructive">*</span>}
      </Label>

      {typeof children === 'function'
        ? children({
            id,
            'aria-invalid': error ? true : undefined,
            'aria-describedby': [idError, idAyuda].filter(Boolean).join(' ') || undefined,
          })
        : children}

      {ayuda && !error && (
        <p id={idAyuda} className="text-xs text-muted-foreground">
          {ayuda}
        </p>
      )}

      {error && (
        <p id={idError} className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export default CampoFormulario;
