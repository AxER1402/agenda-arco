import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Pencil, Trash2, UserCheck, UserCog, UserPlus, UserX } from 'lucide-react';
import { toast } from 'sonner';

import DialogoConfirmacion from '@/components/DialogoConfirmacion';
import EncabezadoModulo from '@/components/layout/EncabezadoModulo';
import ContrasenaDialog from '@/components/usuarios/ContrasenaDialog';
import UsuarioFormDialog from '@/components/usuarios/UsuarioFormDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  actualizarUsuario,
  desactivarUsuario,
  eliminarUsuario,
  listarRoles,
  listarUsuarios,
  restablecerContrasena,
} from '@/services/usuario.service';
import { useAuth } from '@/context/AuthContext';

function UsuariosPage() {
  const { usuario: usuarioActual } = useAuth();

  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);

  // Un solo diálogo abierto a la vez, y siempre sobre una fila concreta.
  const [dialogo, setDialogo] = useState({ tipo: null, usuario: null });

  const cargar = useCallback(async () => {
    try {
      const [lista, catalogoRoles] = await Promise.all([listarUsuarios(true), listarRoles()]);
      setUsuarios(lista);
      setRoles(catalogoRoles);
    } catch (error) {
      toast.error(error.message);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrir = (tipo, usuario = null) => setDialogo({ tipo, usuario });
  const cerrar = () => setDialogo({ tipo: null, usuario: null });

  /**
   * Los errores de estas tres suben al diálogo, que los muestra dentro sin
   * cerrarse: si la contraseña no era la correcta, hay que poder reintentar.
   */
  async function desactivar() {
    await desactivarUsuario(dialogo.usuario.id);
    toast.success('Usuario desactivado.');
    cargar();
  }

  async function eliminar({ contrasena }) {
    await eliminarUsuario(dialogo.usuario.id, contrasena);
    toast.success('Usuario eliminado.');
    cargar();
  }

  async function restablecer(nueva) {
    await restablecerContrasena(dialogo.usuario.id, nueva);
    toast.success('Contraseña restablecida.');
  }

  /** Devolver el acceso es inocuo y reversible: no pide confirmación. */
  async function activar(usuario) {
    try {
      await actualizarUsuario(usuario.id, { activo: true });
      toast.success('Usuario activado.');
      cargar();
    } catch (error) {
      toast.error(error.message);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoModulo
        icono={UserCog}
        titulo="Usuarios"
        descripcion="Personal con acceso al sistema."
        acciones={
          <Button onClick={() => abrir('formulario')}>
            <UserPlus aria-hidden="true" />
            Crear usuario
          </Button>
        }
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Usuario</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {usuarios.length === 0 ? (
            <TableEmpty colSpan={5}>Cargando...</TableEmpty>
          ) : (
            usuarios.map((fila) => {
              const esUnoMismo = fila.id === usuarioActual?.id;

              return (
                <TableRow key={fila.id}>
                  <TableCell className="font-medium">{fila.nombre_completo}</TableCell>
                  <TableCell>{fila.usuario}</TableCell>
                  <TableCell>{fila.rol_nombre}</TableCell>
                  <TableCell>
                    <Badge variant={fila.activo ? 'success' : 'outline'}>
                      {fila.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Editar"
                        onClick={() => abrir('formulario', fila)}
                      >
                        <Pencil aria-hidden="true" />
                        <span className="sr-only">Editar a {fila.nombre_completo}</span>
                      </Button>

                      <Button
                        size="icon"
                        variant="ghost"
                        title="Cambiar la contraseña"
                        onClick={() => abrir('contrasena', fila)}
                      >
                        <KeyRound aria-hidden="true" />
                        <span className="sr-only">
                          Cambiar la contraseña de {fila.nombre_completo}
                        </span>
                      </Button>

                      {!esUnoMismo &&
                        (fila.activo ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Desactivar"
                            onClick={() => abrir('desactivar', fila)}
                          >
                            <UserX aria-hidden="true" />
                            <span className="sr-only">Desactivar a {fila.nombre_completo}</span>
                          </Button>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Activar"
                            onClick={() => activar(fila)}
                          >
                            <UserCheck aria-hidden="true" />
                            <span className="sr-only">Activar a {fila.nombre_completo}</span>
                          </Button>
                        ))}

                      {!esUnoMismo && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          title="Eliminar"
                          onClick={() => abrir('eliminar', fila)}
                        >
                          <Trash2 aria-hidden="true" />
                          <span className="sr-only">Eliminar a {fila.nombre_completo}</span>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <UsuarioFormDialog
        abierto={dialogo.tipo === 'formulario'}
        usuario={dialogo.usuario}
        roles={roles}
        onCerrar={cerrar}
        onGuardado={cargar}
      />

      <DialogoConfirmacion
        abierto={dialogo.tipo === 'desactivar'}
        onCerrar={cerrar}
        onConfirmar={desactivar}
        titulo={`¿Desactivar el acceso de ${dialogo.usuario?.nombre_completo}?`}
        descripcion="No podrá iniciar sesión, pero su nombre se conserva en las citas que registró. Puede volver a activarlo más adelante."
        textoConfirmar="Desactivar acceso"
      />

      <DialogoConfirmacion
        abierto={dialogo.tipo === 'eliminar'}
        onCerrar={cerrar}
        onConfirmar={eliminar}
        titulo={`¿Eliminar a ${dialogo.usuario?.nombre_completo}?`}
        descripcion="El usuario desaparece de la lista y no se puede recuperar. Las citas y las órdenes que registró se conservan, pero dejan de tener a quién atribuirlas. Si solo quiere quitarle el acceso, desactívelo."
        textoConfirmar="Eliminar definitivamente"
        destructivo
        pedirContrasena
      />

      <ContrasenaDialog
        abierto={dialogo.tipo === 'contrasena'}
        onCerrar={cerrar}
        onGuardar={restablecer}
        titulo={`Nueva contraseña para ${dialogo.usuario?.nombre_completo}`}
        descripcion="La contraseña anterior deja de servir en cuanto se guarde. Comuníquesela a la persona para que pueda entrar."
        textoGuardar="Restablecer"
      />
    </div>
  );
}

export default UsuariosPage;
