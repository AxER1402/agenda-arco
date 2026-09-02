import { useEffect, useState } from 'react';
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
import { InputContrasena } from '@/components/ui/input-contrasena';
import { SelectNativo } from '@/components/ui/select-nativo';
import { actualizarUsuario, crearUsuario } from '@/services/usuario.service';

const VACIO = {
  nombreCompleto: '',
  usuario: '',
  contrasena: '',
  rol: 'PERSONAL_CITAS',
  activo: 'true',
};

/**
 * Alta y edición de un usuario.
 *
 * Es el mismo formulario porque son los mismos datos; solo cambian dos piezas:
 * al crear se pide una contraseña —que después ya no se toca aquí, sino en su
 * propio diálogo— y al editar aparece el estado, que es la única forma de
 * devolverle el acceso a alguien que se desactivó.
 *
 * @param {object} props
 * @param {boolean} props.abierto
 * @param {object|null} [props.usuario] Usuario a editar; sin él, se crea uno.
 * @param {Array<{id: number, codigo: string, nombre: string}>} props.roles
 * @param {() => void} props.onCerrar
 * @param {() => void} props.onGuardado
 */
function UsuarioFormDialog({ abierto, usuario = null, roles, onCerrar, onGuardado }) {
  const editando = Boolean(usuario);

  const [valores, setValores] = useState(VACIO);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;

    setErrores({});
    setGuardando(false);
    setValores(
      usuario
        ? {
            ...VACIO,
            nombreCompleto: usuario.nombre_completo ?? '',
            usuario: usuario.usuario ?? '',
            rol: usuario.rol ?? VACIO.rol,
            activo: usuario.activo ? 'true' : 'false',
          }
        : VACIO,
    );
  }, [abierto, usuario]);

  function cambiar(campo) {
    return (evento) => {
      setValores((previo) => ({ ...previo, [campo]: evento.target.value }));
      setErrores((previo) => ({ ...previo, [campo]: undefined }));
    };
  }

  async function guardar(evento) {
    evento.preventDefault();
    setGuardando(true);

    try {
      if (editando) {
        // Solo se envía lo que de verdad cambió: mandar el mismo nombre de
        // acceso haría que el backend lo comprobara contra sí mismo.
        const cambios = {};
        if (valores.nombreCompleto !== usuario.nombre_completo) {
          cambios.nombreCompleto = valores.nombreCompleto;
        }
        if (valores.usuario !== usuario.usuario) cambios.usuario = valores.usuario;
        if (valores.rol !== usuario.rol) cambios.rol = valores.rol;
        if ((valores.activo === 'true') !== Boolean(usuario.activo)) {
          cambios.activo = valores.activo === 'true';
        }

        if (Object.keys(cambios).length === 0) {
          toast.info('No hay ningún cambio que guardar.');
          onCerrar();
          return;
        }

        await actualizarUsuario(usuario.id, cambios);
        toast.success('Usuario actualizado.');
      } else {
        await crearUsuario({
          nombreCompleto: valores.nombreCompleto,
          usuario: valores.usuario,
          contrasena: valores.contrasena,
          rol: valores.rol,
        });
        toast.success('Usuario creado.');
      }

      onCerrar();
      onGuardado();
    } catch (error) {
      toast.error(error.message);

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
    <Dialog open={abierto} onOpenChange={(visible) => !visible && !guardando && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar usuario' : 'Crear usuario'}</DialogTitle>
          <DialogDescription>
            {editando
              ? 'La contraseña no se cambia aquí: use el botón «Contraseña» de la fila.'
              : 'El usuario podrá cambiar su contraseña después de iniciar sesión.'}
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={guardar} noValidate>
          <CampoFormulario
            id="usuario-nombre"
            etiqueta="Nombre completo"
            error={errores.nombreCompleto}
            requerido
          >
            {(props) => (
              <Input {...props} value={valores.nombreCompleto} onChange={cambiar('nombreCompleto')} />
            )}
          </CampoFormulario>

          <CampoFormulario
            id="usuario-acceso"
            etiqueta="Nombre de acceso"
            error={errores.usuario}
            ayuda="Entre 4 y 50 caracteres: letras, números, punto, guion o guion bajo."
            requerido
          >
            {(props) => <Input {...props} value={valores.usuario} onChange={cambiar('usuario')} />}
          </CampoFormulario>

          {!editando && (
            <CampoFormulario
              id="usuario-contrasena"
              etiqueta="Contraseña"
              error={errores.contrasena}
              ayuda="Mínimo 8 caracteres."
              requerido
            >
              {(props) => (
                <InputContrasena
                  {...props}
                  autoComplete="new-password"
                  value={valores.contrasena}
                  onChange={cambiar('contrasena')}
                />
              )}
            </CampoFormulario>
          )}

          <CampoFormulario id="usuario-rol" etiqueta="Rol" error={errores.rol} requerido>
            {(props) => (
              <SelectNativo {...props} value={valores.rol} onChange={cambiar('rol')}>
                {roles.map((rol) => (
                  <option key={rol.id} value={rol.codigo}>
                    {rol.nombre}
                  </option>
                ))}
              </SelectNativo>
            )}
          </CampoFormulario>

          {editando && (
            <CampoFormulario
              id="usuario-activo"
              etiqueta="Estado"
              error={errores.activo}
              ayuda="Un usuario inactivo no puede iniciar sesión, pero su nombre sigue en las citas que registró."
            >
              {(props) => (
                <SelectNativo {...props} value={valores.activo} onChange={cambiar('activo')}>
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </SelectNativo>
              )}
            </CampoFormulario>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCerrar} disabled={guardando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear usuario'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default UsuarioFormDialog;
