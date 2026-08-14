import { useCallback, useEffect, useState } from 'react';
import { KeyRound, UserCog, UserPlus, UserX } from 'lucide-react';
import { toast } from 'sonner';

import CampoFormulario from '@/components/CampoFormulario';
import DialogoConfirmacion from '@/components/DialogoConfirmacion';
import EncabezadoModulo from '@/components/layout/EncabezadoModulo';
import { Badge } from '@/components/ui/badge';
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
import { SelectNativo } from '@/components/ui/select-nativo';
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
  crearUsuario,
  desactivarUsuario,
  listarRoles,
  listarUsuarios,
  restablecerContrasena,
} from '@/services/usuario.service';
import { useAuth } from '@/context/AuthContext';

const VACIO = { nombreCompleto: '', usuario: '', contrasena: '', rol: 'PERSONAL_CITAS' };

function UsuariosPage() {
  const { usuario: usuarioActual } = useAuth();

  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [valores, setValores] = useState(VACIO);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [desactivando, setDesactivando] = useState(null);
  const [restableciendo, setRestableciendo] = useState(null);

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

  function cambiar(campo) {
    return (evento) => {
      setValores((previo) => ({ ...previo, [campo]: evento.target.value }));
      setErrores((previo) => ({ ...previo, [campo]: undefined }));
    };
  }

  async function crear(evento) {
    evento.preventDefault();
    setGuardando(true);

    try {
      await crearUsuario(valores);
      toast.success('Usuario creado.');
      setDialogoAbierto(false);
      setValores(VACIO);
      cargar();
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

  /** Los errores suben al diálogo, que los muestra sin cerrarse. */
  async function desactivar() {
    await desactivarUsuario(desactivando.id);
    toast.success('Usuario desactivado.');
    cargar();
  }

  async function restablecer({ valor: nueva }) {
    await restablecerContrasena(restableciendo.id, nueva);
    toast.success('Contraseña restablecida.');
  }

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoModulo
        icono={UserCog}
        titulo="Usuarios"
        descripcion="Personal con acceso al sistema."
        acciones={
          <Button onClick={() => setDialogoAbierto(true)}>
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
            usuarios.map((fila) => (
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
                    <Button size="sm" variant="ghost" onClick={() => setRestableciendo(fila)}>
                      <KeyRound aria-hidden="true" />
                      Contraseña
                    </Button>
                    {fila.activo && fila.id !== usuarioActual?.id && (
                      <Button size="sm" variant="ghost" onClick={() => setDesactivando(fila)}>
                        <UserX aria-hidden="true" />
                        Desactivar
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={dialogoAbierto} onOpenChange={setDialogoAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear usuario</DialogTitle>
            <DialogDescription>
              El usuario podrá cambiar su contraseña después de iniciar sesión.
            </DialogDescription>
          </DialogHeader>

          <form className="flex flex-col gap-4" onSubmit={crear} noValidate>
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

            <CampoFormulario
              id="usuario-contrasena"
              etiqueta="Contraseña"
              error={errores.contrasena}
              ayuda="Mínimo 8 caracteres."
              requerido
            >
              {(props) => (
                <Input
                  {...props}
                  type="password"
                  value={valores.contrasena}
                  onChange={cambiar('contrasena')}
                />
              )}
            </CampoFormulario>

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

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogoAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={guardando}>
                {guardando ? 'Creando...' : 'Crear usuario'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DialogoConfirmacion
        abierto={Boolean(desactivando)}
        onCerrar={() => setDesactivando(null)}
        onConfirmar={desactivar}
        titulo={`¿Desactivar el acceso de ${desactivando?.nombre_completo}?`}
        descripcion="No podrá iniciar sesión, pero su nombre se conserva en las citas que registró. Puede volver a activarlo más adelante."
        textoConfirmar="Desactivar acceso"
      />

      <DialogoConfirmacion
        abierto={Boolean(restableciendo)}
        onCerrar={() => setRestableciendo(null)}
        onConfirmar={restablecer}
        titulo={`Nueva contraseña para ${restableciendo?.nombre_completo}`}
        descripcion="La contraseña anterior deja de servir en cuanto se guarde. Comuníquesela a la persona para que pueda entrar."
        textoConfirmar="Restablecer"
        campo={{
          etiqueta: 'Nueva contraseña',
          ayuda: 'Mínimo 8 caracteres.',
          tipo: 'password',
          requerido: true,
          minimo: 8,
        }}
      />
    </div>
  );
}

export default UsuariosPage;
