import * as React from "react";

import { cn } from "@/lib/utils";
import { fieldClasses } from "@/components/ui/input";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(fieldClasses, "min-h-[92px] resize-none px-4 py-3 leading-[1.6] field-sizing-content", className)}
      {...props}
    />
  );
}

export { Textarea };
