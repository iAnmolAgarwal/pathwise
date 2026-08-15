import * as React from "react";

import { cn } from "@/lib/utils";

const fieldClasses = [
  "w-full min-w-0 rounded-card border border-line bg-glass text-[15px] text-ink-1 outline-none",
  "transition-[border-color,background-color,box-shadow] duration-(--dur-fast)",
  "placeholder:text-ink-3",
  "hover:border-line-strong",
  "focus-visible:border-line-strong focus-visible:bg-glass-strong focus-visible:ring-4 focus-visible:ring-brand/10",
  "disabled:pointer-events-none disabled:opacity-40",
  "aria-invalid:border-coral-line aria-invalid:ring-4 aria-invalid:ring-coral/10",
].join(" ");

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(fieldClasses, "h-[46px] px-4", className)}
      {...props}
    />
  );
}

export { Input, fieldClasses };
