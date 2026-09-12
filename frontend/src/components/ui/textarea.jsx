import { cn } from '@/lib/utils';

/** Igual que `Input`, con alto para varias líneas. */
function Textarea({ className, ...props }) {
  return (
    <textarea
      className={cn(
        'flex min-h-[88px] w-full rounded-md border border-input bg-transparent px-3 py-2.5 text-base shadow-xs outline-none transition-[color,box-shadow] md:text-sm',
        'placeholder:text-muted-foreground',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
