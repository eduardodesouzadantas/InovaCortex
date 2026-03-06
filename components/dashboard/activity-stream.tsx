"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DollarSign, Calendar, AlertTriangle, Rocket, ArrowRight, UserPlus, CheckCircle } from "lucide-react";

interface SystemEvent {
    id: string;
    type: string;
    createdAt: string;
    payloadJson: string;
}

interface ActivityStreamProps {
    orgSlug: string;
}

export function ActivityStream({ orgSlug }: ActivityStreamProps) {
    const [events, setEvents] = useState<SystemEvent[]>([]);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        // Connect to Server-Sent Events endpoint
        const evtSource = new EventSource(`/api/org/${orgSlug}/realtime/events`);

        evtSource.onopen = () => setIsConnected(true);

        evtSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.status === "ok") return; // Initial ping

                // Prepend new event, max 100 items
                setEvents((prev) => [data, ...prev].slice(0, 100));
            } catch (err) {
                console.error("SSE Parse Error", err);
            }
        };

        evtSource.onerror = () => {
            setIsConnected(false);
            evtSource.close();
            // Simple reconnect logic
            setTimeout(() => {
                setIsConnected(true);
            }, 5000);
        };

        return () => {
            evtSource.close();
        };
    }, [orgSlug]);

    const getEventIcon = (type: string) => {
        switch (type) {
            case "payment_received": return <DollarSign className="w-4 h-4 text-emerald-400" />;
            case "meeting_scheduled": return <Calendar className="w-4 h-4 text-blue-400" />;
            case "profit_leak_detected": return <AlertTriangle className="w-4 h-4 text-rose-500" />;
            case "workspace_provisioned": return <Rocket className="w-4 h-4 text-indigo-400" />;
            case "lead_created": return <UserPlus className="w-4 h-4 text-zinc-400" />;
            case "contract_signed": return <CheckCircle className="w-4 h-4 text-emerald-500" />;
            default: return <ArrowRight className="w-4 h-4 text-zinc-500" />;
        }
    };

    const formatEventMessage = (evt: SystemEvent) => {
        try {
            const payload = JSON.parse(evt.payloadJson);
            switch (evt.type) {
                case "payment_received":
                    return `Payment received — R$ ${(payload.amountCents / 100).toLocaleString('pt-BR')} (${payload.client || 'Client'})`;
                case "meeting_scheduled":
                    return `Meeting scheduled — ${payload.client || 'Lead'}`;
                case "profit_leak_detected":
                    return `Alert: ${payload.title} — ${payload.description}`;
                case "workspace_provisioned":
                    return `Workspace activated — ${payload.client || 'New Project'}`;
                case "lead_created":
                    return `High-ticket lead captured: ${payload.company}`;
                case "contract_signed":
                    return `Contract signed — ${payload.client || 'Deal Closed'}`;
                default:
                    return `System Action: ${evt.type.replace(/_/g, ' ')}`;
            }
        } catch {
            return `New event: ${evt.type}`;
        }
    };

    return (
        <div className="bg-zinc-900/40 border border-white/5 backdrop-blur-md rounded-2xl p-6 h-[400px] flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest">
                    Activity Stream
                </h3>
                <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                        {isConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                    </span>
                    <span className="text-xs text-zinc-500 uppercase">{isConnected ? 'Live' : 'Disconnected'}</span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                <AnimatePresence initial={false}>
                    {events.length === 0 && (
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-xs text-zinc-500 text-center mt-10"
                        >
                            Listening for platform events...
                        </motion.p>
                    )}
                    {events.map((evt) => (
                        <motion.div
                            key={evt.id}
                            layout
                            initial={{ top: -20, opacity: 0, scale: 0.95 }}
                            animate={{ top: 0, opacity: 1, scale: 1 }}
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                            className="relative bg-zinc-800/50 border border-white/5 rounded-lg p-3 flex items-start gap-3 w-full"
                        >
                            <div className="mt-0.5 bg-black/40 p-2 rounded-md shadow-inner">
                                {getEventIcon(evt.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-zinc-300 font-medium leading-relaxed">
                                    {formatEventMessage(evt)}
                                </p>
                                <p className="text-[10px] text-zinc-500 mt-1 uppercase">
                                    {new Date(evt.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
}
