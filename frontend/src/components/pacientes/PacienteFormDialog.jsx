import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import CampoFormulario from '@/components/CampoFormulario';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useTerminoRetrasado } from '@/hooks/useTerminoRetrasado';
import {
  actualizarPaciente,
  buscarPorTelefono,
  crearPaciente,
} from '@/services/paciente.service';
import { nombreEnMayusculas } from '@/lib/formato';
import {
  esTelefonoValido,
  normalizarTelefono,
  validarDpi,
  validarFormulario,
  validarNombre,
  validarTelefono,
} from '@/lib/validaciones';

const VACIO = {
  nombreCompleto: '',
  telefono: '',
  dpi: '',
  tieneWhatsapp: '',
  notas: '',
  // '' = tiene su propio número; si no, el id del titular cuyo número usa.
  titularId: '',
};

/** El dato guardado de WhatsApp, en el formato del selector. */
function whatsappComoTexto(paciente) {
  return paciente?.tiene_whatsapp === null || paciente?.tiene_whatsapp === undefined
    ? ''
    : String(Boolean(paciente.tiene_whatsapp));
}

const RESPUESTAS_WHATSAPP = [
  { valor: '', texto: 'Sin comprobar' },
  { valor: 'true', texto: 'Sí tiene' },
  { valor: 'false', texto: 'No tiene' },
];

/**
 * Alta y edición de pacientes.
 *
 * Un paciente puede ser beneficiario de otro: el hijo que llega con su papá y
 * no tiene teléfono usa el de él. Al escribir un número que ya es de alguien,
 * el formulario ofrece ligarlo como beneficiario; ligado, el teléfono es el del
 * titular y no se edita aquí.
 *
 * @param {object|null} paciente Si viene, el formulario edita; si no, registra.
 * @param {object|null} titularInicial Para registrar directamente a un
 *   beneficiario de ese paciente.
 */
function PacienteFormDialog({
  abierto,
  onCerrar,
  paciente = null,
  titularInicial = null,
  onGuardado,
}) {
  const editando = Boolean(paciente);

  const [valores, setValores] = useState(VACIO);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  /** Quienes ya usan el número escrito y pueden ser titulares. */
  const [candidatos, setCandidatos] = useState([]);

  // El titular que ya viene dado: el del beneficiario que se edita, o aquel a
  // quien se le agrega un beneficiario.
  const titularFijo = useMemo(() => {
    if (paciente?.titular_id) {
      return {
        id: paciente.titular_id,
        nombre_completo: paciente.titular_nombre,
        telefono: paciente.telefono,
      };
    }
    return titularInicial ?? null;
  }, [paciente, titularInicial]);

  const titulares =
    titularFijo && !candidatos.some((candidato) => candidato.id === titularFijo.id)
      ? [titularFijo, ...candidatos]
      : candidatos;

  useEffect(() => {
    if (!abierto) return;

    if (paciente) {
      setValores({
        nombreCompleto: paciente.nombre_completo ?? '',
        telefono: paciente.telefono ?? '',
        dpi: paciente.dpi ?? '',
        tieneWhatsapp: whatsappComoTexto(paciente),
        notas: paciente.notas ?? '',
        titularId: paciente.titular_id ? String(paciente.titular_id) : '',
      });
    } else if (titularInicial) {
      setValores({
        ...VACIO,
        telefono: titularInicial.telefono ?? '',
        tieneWhatsapp: whatsappComoTexto(titularInicial),
        titularId: String(titularInicial.id),
      });
    } else {
      setValores(VACIO);
    }
    setCandidatos([]);
    setErrores({});
  }, [abierto, paciente, titularInicial]);

  // Quien es titular de otros no puede volverse beneficiario: solo hay un nivel.
  const puedeSerBeneficiario = !(paciente?.beneficiarios > 0);
  const titular = titulares.find((candidato) => String(candidato.id) === valores.titularId);

  // Al escribir un número que ya usa alguien, se ofrece ligarlo a esa persona.
  const telefonoRetrasado = useTerminoRetrasado(valores.telefono, 400);
  useEffect(() => {
    if (!abierto || titularInicial || !puedeSerBeneficiario || valores.titularId) return undefined;
    if (!esTelefonoValido(telefonoRetrasado)) {
      setCandidatos([]);
      return undefined;
    }

    let cancelado = false;

    (async () => {
      try {
        const encontrados = (await buscarPorTelefono(normalizarTelefono(telefonoRetrasado))) ?? [];
        if (cancelado) return;

        // Solo pueden ser titulares los que tienen número propio.
        const posibles = encontrados.filter(
          (candidato) => !candidato.titular_id && candidato.id !== paciente?.id,
        );
        setCandidatos(posibles);

        // Al registrar, lo normal con un número que ya es de alguien es que
        // sea su beneficiario: se propone, y se puede cambiar.
        if (!editando && posibles.length > 0) {
          setValores((previo) => ({
            ...previo,
            titularId: String(posibles[0].id),
            tieneWhatsapp: whatsappComoTexto(posibles[0]),
          }));
        }
      } catch {
        if (!cancelado) setCandidatos([]);
      }
    })();

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, telefonoRetrasado, titularInicial, puedeSerBeneficiario]);

  function elegirTitular(evento) {
    const id = evento.target.value;
    const elegido = titulares.find((candidato) => String(candidato.id) === id);

    setValores((previo) => ({
      ...previo,
      titularId: id,
      // Ligado, el número es el del titular, y con él lo que se sabe de su
      // WhatsApp.
      ...(elegido?.telefono ? { telefono: elegido.telefono } : {}),
      ...(elegido && elegido.tiene_whatsapp !== undefined
        ? { tieneWhatsapp: whatsappComoTexto(elegido) }
        : {}),
    }));
  }

  function cambiar(campo) {
    return (evento) => {
      setValores((previo) => ({ ...previo, [campo]: evento.target.value }));
      setErrores((previo) => ({ ...previo, [campo]: undefined }));
    };
  }

  async function enviar(evento) {
    evento.preventDefault();

    const encontrados = validarFormulario({
      nombreCompleto: validarNombre(valores.nombreCompleto),
      telefono: validarTelefono(valores.telefono),
      dpi: validarDpi(valores.dpi),
    });

    if (Object.keys(encontrados).length > 0) {
      setErrores(encontrados);
      return;
    }

    setGuardando(true);

    // '' significa "sin comprobar", que en la base es NULL.
    const { titularId, ...resto } = valores;
    const datos = {
      ...resto,
      tieneWhatsapp: valores.tieneWhatsapp === '' ? null : valores.tieneWhatsapp === 'true',
    };

    // El vínculo solo viaja si cambió: así editar el nombre de un beneficiario
    // no vuelve a comprobar a su titular.
    const titularAntes = paciente?.titular_id ? String(paciente.titular_id) : '';
    if (!editando || titularId !== titularAntes) {
      datos.titularId = titularId ? Number(titularId) : null;
    }

    try {
      if (editando) {
        await actualizarPaciente(paciente.id, datos);
        toast.success('Paciente actualizado.');
      } else {
        const { avisos } = await crearPaciente(datos);
        toast.success('Paciente registrado.');
        avisos?.forEach((aviso) => toast.warning(aviso, { duration: 8000 }));
      }

      onGuardado?.();
      onCerrar();
    } catch (error) {
      toast.error(error.message);
      // El backend puede señalar el campo exacto que falló.
      if (Array.isArray(error.detalles)) {
        setErrores(
          Object.fromEntries(error.detalles.map((detalle) => [detalle.campo, detalle.mensaje])),
        );
      }
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(valor) => !valor && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editando
              ? 'Editar paciente'
              : titularInicial
                ? 'Agregar beneficiario'
                : 'Registrar paciente'}
          </DialogTitle>
          <DialogDescription>
            {titularInicial
              ? `Usará el número de ${titularInicial.nombre_completo}: ahí le llega el recordatorio.`
              : 'El teléfono se usa para enviar el recordatorio de la cita.'}
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={enviar} noValidate>
          <CampoFormulario
            id="nombreCompleto"
            etiqueta="Nombre completo"
            error={errores.nombreCompleto}
            requerido
          >
            {(props) => (
              <Input
                {...props}
                value={valores.nombreCompleto}
                onChange={(evento) =>
                  cambiar('nombreCompleto')({
                    target: { value: nombreEnMayusculas(evento.target.value) },
                  })
                }
                autoFocus
              />
            )}
          </CampoFormulario>

          <CampoFormulario
            id="telefono"
            etiqueta="Teléfono"
            error={errores.telefono}
            ayuda={
              titular
                ? `Es el número de su titular, ${titular.nombre_completo}.`
                : 'Ocho dígitos. Ejemplo: 55555555'
            }
            requerido
          >
            {(props) => (
              <Input
                {...props}
                inputMode="numeric"
                maxLength={12}
                value={valores.telefono}
                onChange={cambiar('telefono')}
                readOnly={Boolean(titular)}
              />
            )}
          </CampoFormulario>

          {/* Beneficiario: solo aparece si alguien ya usa ese número. */}
          {puedeSerBeneficiario && titulares.length > 0 && (
            <CampoFormulario
              id="titularId"
              etiqueta="¿Es beneficiario?"
              ayuda={
                titular
                  ? 'Usa el número de su titular. El recordatorio le llega a él, con el nombre del beneficiario.'
                  : 'Comparte el número, pero queda como paciente independiente.'
              }
            >
              {(props) => (
                <Select
                  {...props}
                  value={valores.titularId}
                  onChange={elegirTitular}
                  disabled={Boolean(titularInicial)}
                >
                  {titulares.map((candidato) => (
                    <option key={candidato.id} value={String(candidato.id)}>
                      Sí, de {candidato.nombre_completo}
                    </option>
                  ))}
                  <option value="">No, tiene su propio número</option>
                </Select>
              )}
            </CampoFormulario>
          )}

          <CampoFormulario
            id="dpi"
            etiqueta="DPI"
            error={errores.dpi}
            ayuda="Opcional. Si se registra, son 13 dígitos"
          >
            {(props) => (
              <Input
                {...props}
                inputMode="numeric"
                maxLength={17}
                placeholder="Opcional"
                value={valores.dpi}
                onChange={cambiar('dpi')}
              />
            )}
          </CampoFormulario>

          <CampoFormulario
            id="tieneWhatsapp"
            etiqueta="WhatsApp"
            ayuda={
              titular
                ? 'Es el mismo número de su titular: lo que marque vale para los dos.'
                : 'Si no tiene, habrá que llamarle en lugar de mandarle el recordatorio.'
            }
          >
            {(props) => (
              <Select
                {...props}
                value={valores.tieneWhatsapp}
                onChange={cambiar('tieneWhatsapp')}
              >
                {RESPUESTAS_WHATSAPP.map(({ valor, texto }) => (
                  <option key={texto} value={valor}>
                    {texto}
                  </option>
                ))}
              </Select>
            )}
          </CampoFormulario>

          <CampoFormulario id="notas" etiqueta="Notas" error={errores.notas}>
            {(props) => (
              <Textarea {...props} value={valores.notas} onChange={cambiar('notas')} rows={2} />
            )}
          </CampoFormulario>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default PacienteFormDialog;
