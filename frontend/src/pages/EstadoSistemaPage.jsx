import { Activity, Database, MessageCircle, RefreshCw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useEstadoSistema } from '@/hooks/useEstadoSistema';

function IndicadorServicio({ icono: Icono, nombre, descripcion, estado }) {
  const etiquetas = {
    ok: { texto: 'En línea', variante: 'success' },
    error: { texto: 'Sin conexión', variante: 'destructive' },
    pendiente: { texto: 'Pendiente', variante: 'secondary' },
  };
  const { texto, variante } = etiquetas[estado] ?? etiquetas.pendiente;

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Icono className="size-5" aria-hidden="true" />
          </span>
          <div>
            <CardTitle className="text-lg">{nombre}</CardTitle>
            <CardDescription className="text-xs">{descripcion}</CardDescription>
          </div>
        </div>
        <Badge variant={variante}>{texto}</Badge>
      </CardHeader>
    </Card>
  );
}

/**
 * Página de verificación de la instalación (fase 1).
 * Sirve para comprobar de un vistazo que los cuatro servicios de Docker
 * levantaron y que el frontend alcanza al backend.
 */
function EstadoSistemaPage() {
  const { estado, cargando, error, recargar } = useEstadoSistema();

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header>
          <p className="text-sm text-muted-foreground">Laboratorio Clínico Biológico</p>
          <h1 className="mt-1 text-2xl leading-tight sm:text-3xl">El Arco Laboratorios</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Sistema de gestión de citas. Instalación base verificada.
          </p>
        </header>

        <section className="flex flex-col gap-4" aria-label="Estado de los servicios">
          <IndicadorServicio
            icono={Activity}
            nombre="Backend"
            descripcion="API REST en Node.js + Express"
            estado={cargando ? 'pendiente' : estado?.backend}
          />
          <IndicadorServicio
            icono={Database}
            nombre="Base de datos"
            descripcion="MySQL 8"
            estado={cargando ? 'pendiente' : estado?.baseDatos}
          />
          <IndicadorServicio
            icono={MessageCircle}
            nombre="WhatsApp Service"
            descripcion="Se integra en la fase 7"
            estado="pendiente"
          />
        </section>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div>
          <Button onClick={recargar} disabled={cargando} variant="outline">
            <RefreshCw className={cargando ? 'animate-spin' : undefined} aria-hidden="true" />
            {cargando ? 'Comprobando...' : 'Volver a comprobar'}
          </Button>
        </div>
      </div>
    </main>
  );
}

export default EstadoSistemaPage;
