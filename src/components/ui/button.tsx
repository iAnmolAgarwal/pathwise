import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "group/button inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap select-none outline-none",
    "font-sans font-[550] transition-[transform,background-color,border-color,box-shadow,color] duration-(--dur-fast) ease-out",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
    "disabled:pointer-events-none disabled:opacity-40",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px] [&_svg]:stroke-[1.8]",
    // arrow slide: any svg flagged as inline-end nudges right on hover
    "[&_svg[data-icon=inline-end]]:transition-transform [&_svg[data-icon=inline-end]]:duration-(--dur-fast) hover:[&_svg[data-icon=inline-end]]:translate-x-[3px]",
  ],
  {
    variants: {
      variant: {
        primary:
          "rounded-pill bg-brand text-brand-foreground font-[650] shadow-brand hover:-translate-y-[2px] hover:shadow-brand-hover active:translate-y-0",
        secondary:
          "glass rounded-pill text-ink-2 hover:-translate-y-[2px] hover:border-line-strong hover:bg-glass-strong hover:text-ink-1 active:translate-y-0",
        ghost:
          "rounded-pill text-ink-2 hover:bg-glass-strong hover:text-ink-1",
        outline:
          "rounded-card border border-line bg-transparent text-ink-1 hover:border-line-strong hover:bg-glass",
        destructive:
          "rounded-pill border border-coral-line bg-coral-soft text-coral hover:bg-coral/20",
        chip: [
          "glass rounded-pill text-ink-2 hover:border-line-strong hover:text-ink-1",
          "aria-pressed:border-transparent aria-pressed:bg-brand aria-pressed:text-brand-foreground",
          "data-[tone=gap]:aria-pressed:bg-coral-soft data-[tone=gap]:aria-pressed:border-coral-line data-[tone=gap]:aria-pressed:text-coral",
        ],
        link: [
          "relative rounded-none px-0 text-ink-1 after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-right after:scale-x-0 after:bg-current after:transition-transform after:duration-(--dur-base) after:ease-enter",
          "hover:after:origin-left hover:after:scale-x-100",
        ],
      },
      size: {
        sm: "h-10 gap-2 px-4 text-[13px]",
        default: "h-[46px] gap-3 px-[21px] text-[14px]",
        lg: "h-[52px] gap-3 px-6 text-[15px]",
        icon: "size-[46px]",
        "icon-sm": "size-10",
        chip: "h-8 gap-1.5 px-3.5 text-[13px] [&_svg:not([class*='size-'])]:size-3.5",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "primary",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
