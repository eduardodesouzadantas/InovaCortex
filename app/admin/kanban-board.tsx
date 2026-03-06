"use client";

import { useState, useId } from "react";
import { DndContext, DragEndEvent, closestCorners } from "@dnd-kit/core";
import { KanbanColumn } from "./kanban-column";
import { KanbanCard } from "./kanban-card";

export type PipelineStatus = "Novo" | "Qualificado" | "Contatado" | "Agendado" | "Fechado" | "Perdido";

const STATUSES: PipelineStatus[] = ["Novo", "Qualificado", "Contatado", "Agendado", "Fechado", "Perdido"];

export function KanbanBoard({ initialLeads }: { initialLeads: any[] }) {
    const [leads, setLeads] = useState(initialLeads);

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (!over) return;

        const leadId = active.id as string;
        const newStatus = over.id as PipelineStatus;

        const lead = leads.find(l => l.id === leadId);
        if (!lead || lead.status === newStatus) return;

        // Optimistic update
        setLeads(current =>
            current.map(l => l.id === leadId ? { ...l, status: newStatus } : l)
        );

        // Fetch to backend
        try {
            await fetch(`/api/admin/leads/${leadId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
        } catch (error) {
            console.error("Failed to update status", error);
            // Revert changes on fail
            setLeads(initialLeads);
        }
    };

    const dndId = useId();
    return (
        <DndContext id={dndId} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
            <div className="flex gap-4 overflow-x-auto pb-4 pt-2 -mx-4 px-4 snap-x">
                {STATUSES.map(status => {
                    const columnLeads = leads.filter(l => l.status === status);
                    return (
                        <div key={status} className="snap-start">
                            <KanbanColumn id={status} title={status} count={columnLeads.length}>
                                {columnLeads.map(lead => (
                                    <DraggableCard key={lead.id} lead={lead} />
                                ))}
                            </KanbanColumn>
                        </div>
                    );
                })}
            </div>
        </DndContext>
    );
}

// Wrapper to make KanbanCard draggable
import { useDraggable } from "@dnd-kit/core";
function DraggableCard({ lead }: { lead: any }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: lead.id,
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: isDragging ? 50 : undefined,
        opacity: isDragging ? 0.8 : undefined,
    } : undefined;

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing pb-2">
            <KanbanCard lead={lead} />
        </div>
    );
}
