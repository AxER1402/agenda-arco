import { Construction } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Marcador de las secciones que se implementan en fases posteriores.
 * Evita enlaces rotos en la navegación mientras el sistema se construye.
 */
function EnConstruccionPage({ titulo, fase }) {
  return (
    <Card className="mx-auto max-w-md text-center">
      <CardHeader className="items-center">
        <span className="mb-3 flex size-12 items-center justify-center border-2 border-trazo bg-accent text-accent-foreground">
          <Construction className="size-6" aria-hidden="true" />
        </span>
        <CardTitle className="text-xl">{titulo}</CardTitle>
        <CardDescription className="rotulo">Sección en construcción</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Se implementa en la {fase}.</p>
      </CardContent>
    </Card>
  );
}

export default EnConstruccionPage;
