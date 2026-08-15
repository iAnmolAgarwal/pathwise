import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * Badges come in three families:
 *  - kind badges (course / project / assessment): quiet mono chips
 *  - status chips (acquired / progress / gap / unrelated): tracked caps with a dot
 *  - eyebrow: the glowing-dot glass pill from the hero
 */
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-2 whitespace-nowrap border transition-colors [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        kind: "rounded-chip border-line bg-surface-2 px-2 py-[3px] font-mono text-[11px] leading-4 text-ink-2",
        mono: "rounded-chip border-line bg-transparent px-2 py-[3px] font-mono text-[11px] leading-4 text-ink-3",
        eyebrow:
          "glass label-caps rounded-pill px-[13px] py-2 text-ink-2 backdrop-blur-[14px]",
        status: "label-caps rounded-pill px-3 py-2",
        acquired:
          "label-caps rounded-pill border-status-acquired-line bg-status-acquired-soft px-3 py-2 text-status-acquired",
        progress:
          "label-caps rounded-pill border-status-progress-line bg-status-progress-soft px-3 py-2 text-status-progress",
        gap: "label-caps rounded-pill border-status-gap-line bg-status-gap-soft px-3 py-2 text-status-gap",
        unrelated:
          "label-caps rounded-pill border-status-unrelated-line bg-status-unrelated-soft px-3 py-2 text-status-unrelated",
        violet:
          "label-caps rounded-pill border-violet-line bg-violet-soft px-3 py-2 text-violet",
      },
    },
    defaultVariants: {
      variant: "kind",
    },
  },
);

function Badge({
  className,
  variant = "kind",
  asChild = false,
  dot = false,
  children,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean; dot?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    >
      {dot ? (
        <i
          aria-hidden
          className={cn(
            "size-[6px] shrink-0 rounded-full bg-current",
            variant === "eyebrow" && "bg-violet shadow-glow-dot",
          )}
        />
      ) : null}
      {children}
    </Comp>
  );
}

export { Badge, badgeVariants };
