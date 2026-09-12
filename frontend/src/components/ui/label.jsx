import * as LabelPrimitive from '@radix-ui/react-label';

import { cn } from '@/lib/utils';

/** Etiqueta de shadcn, sin adaptar. */
function Label({ className, ...props }) {
  return (
    <LabelPrimitive.Root
      className={cn(
        'flex select-none items-center gap-2 text-sm font-medium leading-none',
        'peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className,
      )}
      {...props}
    />
  );
}

export { Label };
