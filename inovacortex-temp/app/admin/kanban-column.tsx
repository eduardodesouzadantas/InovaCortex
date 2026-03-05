"use client";

import { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";

interface KanbanColumnProps {
    id: string; // "Novo", "Qualificado", etc.
    title: string;
    count: number;
    children: ReactNode;
}

export function KanbanColumn({ id, title, count, children }: KanbanColumnProps) {
    const { isOver, setNodeRef } = useDroppable({
        id: id,
    });

    const style = {
        backgroundColor: isOver ? "var(--bg-muted)" : undefined,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="flex-shrink-0 w-[300px] flex flex-col bg-muted/20 border border-border/50 rounded-2xl overflow-hidden transition-colors"
        >
            <div className="p-4 border-b border-border/50 flex justify-between items-center bg-background/50 backdrop-blur-sm sticky top-0 z-10">
                <h3 className="font-bold text-sm text-foreground">{title}</h3>
                <span className="bg-muted text-muted-foreground text-xs font-semibold px-2 py-0.5 rounded-full">
                    {count}
                </span>
            </div>

            <div className="p-3 flex-1 overflow-y-auto space-y-3 min-h-[150px]">
                {children}
            </div>
        </div>
    );
}
