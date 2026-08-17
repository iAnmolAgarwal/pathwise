"use client";

import { MessageSquare, PanelRight } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { Rail, type RailProps } from "./Rail";
import styles from "./shell.module.css";

export type PaneTab = { id: string; label: string };

type Props = {
  rail: Omit<RailProps, "children">;
  /** Chat column header (title + Nova presence). */
  chatHeader: ReactNode;
  chat: ReactNode;
  /** Right pane: line-tabs plus whatever sits at the header's right edge. */
  tabs: PaneTab[];
  tab: string;
  onTabChange: (id: string) => void;
  paneAside?: ReactNode;
  pane: ReactNode;
  /** Anything that must overlay the shell (drawers, banners). */
  children?: ReactNode;
};

/**
 * The three-region app shell (§9.1): icon rail · chat · switchable pane.
 * On laptops both columns show side by side; under 1024px one of them is on
 * screen at a time and the rail carries the switch.
 */
export function AppShell({ rail, chatHeader, chat, tabs, tab, onTabChange, paneAside, pane, children }: Props) {
  const [view, setView] = useState<"chat" | "pane">("chat");

  return (
    <TooltipProvider>
      <main className={styles.shell} data-view={view}>
        <Rail {...rail}>
          <div className={styles.viewSwitch} role="group" aria-label="Show">
            <button
              type="button"
              className={cn(styles.railButton, view === "chat" && styles.railButtonActive)}
              onClick={() => setView("chat")}
              aria-pressed={view === "chat"}
              aria-label="Show chat"
            >
              <MessageSquare />
            </button>
            <button
              type="button"
              className={cn(styles.railButton, view === "pane" && styles.railButtonActive)}
              onClick={() => setView("pane")}
              aria-pressed={view === "pane"}
              aria-label="Show workspace"
            >
              <PanelRight />
            </button>
          </div>
        </Rail>

        <section className={styles.chatColumn} aria-label="Conversation">
          <header className={styles.columnHeader}>{chatHeader}</header>
          <div className={styles.chatBody}>{chat}</div>
        </section>

        <section className={styles.paneColumn} aria-label="Workspace">
          <Tabs value={tab} onValueChange={onTabChange} className="contents">
            <header className={cn(styles.columnHeader, styles.paneHeader)}>
              <TabsList variant="line" className={styles.tabsList}>
                {tabs.map((t) => (
                  <TabsTrigger key={t.id} value={t.id} data-testid={`tab-${t.id}`}>
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {paneAside && <div className={styles.paneAside}>{paneAside}</div>}
            </header>
            {/* Every trigger's aria-controls resolves; only the active panel carries content. */}
            {tabs.map((t) => (
              <TabsContent key={t.id} value={t.id} forceMount className={cn(styles.paneBody, t.id !== tab && "hidden")}>
                {t.id === tab ? pane : null}
              </TabsContent>
            ))}
          </Tabs>
        </section>

        {children}
      </main>
    </TooltipProvider>
  );
}
