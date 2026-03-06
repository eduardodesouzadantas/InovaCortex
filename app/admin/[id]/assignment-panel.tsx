"use client";

import { useState } from "react";
import { UserPlus, Check, ChevronDown, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface SalesRep {
    id: string;
    name: string;
    role: string;
}

interface AssignmentPanelProps {
    assessmentId: string;
    currentRep?: { id: string; name: string } | null;
    reps: SalesRep[];
}

export function AssignmentPanel({ assessmentId, currentRep, reps }: AssignmentPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [selectedRepId, setSelectedRepId] = useState(currentRep?.id || "");

    const handleAssign = async (repId: string) => {
        setIsUpdating(true);
        try {
            const res = await fetch(`/api/org/current/sales/assign`, { // Note: slug resolution handle in real env
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ assessmentId, salesRepId: repId }),
            });

            if (res.ok) {
                setSelectedRepId(repId);
                setIsOpen(false);
                // Refresh page to show audit logs
                window.location.reload();
            }
        } catch (error) {
            console.error("Assignment failed", error);
        } finally {
            setIsUpdating(false);
        }
    };

    const activeRep = reps.find(r => r.id === selectedRepId);

    return (
        <div className="glass-panel p-4 rounded-xl border border-border/50 relative">
            <p className="text-[10px] text-muted-foreground uppercase font-bold mb-2 flex items-center gap-1">
                <UserPlus className="w-3 h-3" /> Responsável Comercial
            </p>

            <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={isUpdating}
                className="w-full flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
            >
                <div className="flex items-center gap-2 text-sm">
                    {activeRep ? (
                        <>
                            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                                {activeRep.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <span className="font-semibold">{activeRep.name}</span>
                        </>
                    ) : (
                        <span className="text-muted-foreground italic">Não atribuído</span>
                    )}
                </div>
                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-0 right-0 mt-2 z-50 bg-background border border-border shadow-2xl rounded-xl p-2 max-h-[200px] overflow-y-auto"
                    >
                        {reps.map((rep) => (
                            <button
                                key={rep.id}
                                onClick={() => handleAssign(rep.id)}
                                className="w-full text-left p-2 rounded-lg hover:bg-muted transition-colors flex items-center justify-between group"
                            >
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium">{rep.name}</span>
                                    <span className="text-[10px] text-muted-foreground uppercase">{rep.role}</span>
                                </div>
                                {selectedRepId === rep.id && <Check className="w-4 h-4 text-primary" />}
                            </button>
                        ))}

                        {reps.length === 0 && (
                            <p className="text-center py-4 text-xs text-muted-foreground">Nenhum vendedor cadastrado.</p>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
