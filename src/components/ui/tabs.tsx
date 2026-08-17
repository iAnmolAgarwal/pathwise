"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Tabs as TabsPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn("group/tabs flex gap-6 data-horizontal:flex-col", className)}
      {...props}
    />
  );
}

/**
 * line  — nav-style tabs: quiet text, underline draws in from the right on hover,
 *         stays under the active tab (footer-nav language from the reference).
 * pill  — segmented glass control for small toggles (graph layout, chart view).
 */
const tabsListVariants = cva("group/tabs-list inline-flex w-fit items-center", {
  variants: {
    variant: {
      line: "gap-8 border-b border-line",
      pill: "glass gap-1 rounded-pill p-1",
    },
  },
  defaultVariants: { variant: "line" },
});

function TabsList({
  className,
  variant = "line",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex cursor-pointer items-center gap-2 whitespace-nowrap font-sans outline-none transition-colors duration-(--dur-fast) disabled:pointer-events-none disabled:opacity-40",
        "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand",
        "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-[1.8]",
        // line variant
        "group-data-[variant=line]/tabs-list:pb-3 group-data-[variant=line]/tabs-list:text-[15px] group-data-[variant=line]/tabs-list:font-[430] group-data-[variant=line]/tabs-list:tracking-[-0.02em] group-data-[variant=line]/tabs-list:text-ink-2 group-data-[variant=line]/tabs-list:hover:text-ink-1 group-data-[variant=line]/tabs-list:data-active:text-ink-1",
        "group-data-[variant=line]/tabs-list:after:absolute group-data-[variant=line]/tabs-list:after:inset-x-0 group-data-[variant=line]/tabs-list:after:-bottom-px group-data-[variant=line]/tabs-list:after:h-px group-data-[variant=line]/tabs-list:after:origin-right group-data-[variant=line]/tabs-list:after:scale-x-0 group-data-[variant=line]/tabs-list:after:bg-ink-1 group-data-[variant=line]/tabs-list:after:transition-transform group-data-[variant=line]/tabs-list:after:duration-(--dur-base) group-data-[variant=line]/tabs-list:after:ease-enter",
        "group-data-[variant=line]/tabs-list:hover:after:origin-left group-data-[variant=line]/tabs-list:hover:after:scale-x-100 group-data-[variant=line]/tabs-list:data-active:after:origin-left group-data-[variant=line]/tabs-list:data-active:after:scale-x-100",
        // pill variant
        "group-data-[variant=pill]/tabs-list:h-8 group-data-[variant=pill]/tabs-list:rounded-pill group-data-[variant=pill]/tabs-list:px-3.5 group-data-[variant=pill]/tabs-list:text-[13px] group-data-[variant=pill]/tabs-list:font-[550] group-data-[variant=pill]/tabs-list:text-ink-2 group-data-[variant=pill]/tabs-list:hover:text-ink-1 group-data-[variant=pill]/tabs-list:data-active:bg-brand group-data-[variant=pill]/tabs-list:data-active:text-brand-foreground group-data-[variant=pill]/tabs-list:data-active:hover:text-brand-foreground",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
