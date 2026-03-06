"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, X, ArrowRight, Lightbulb, Target, TrendingUp } from "lucide-react";
import { HELP_CONTENT, HelpTopic } from "@/lib/help/help-content";

interface Props {
    topic: HelpTopic;
    children?: React.ReactNode; // Optional: can trigger on custom element
    className?: string;
}

export function HelpPopover({ topic, children, className }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const content = HELP_CONTENT[topic];
    const popoverRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    if (!content) return null;

    return (
        <div className={`relative inline-block ${className}`} ref={popoverRef}>
            {/* Trigger */}
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="cursor-help transition-transform active:scale-95"
            >
                {children || (
                    <motion.div
                        animate={{
                            scale: [1, 1.1, 1],
                            opacity: [0.7, 1, 0.7]
                        }}
                        transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        className="w-5 h-5 rounded-full bg-[#d4af37]/20 border border-[#d4af37]/40 flex items-center justify-center group hover:bg-[#d4af37]/40 hover:border-[#d4af37] transition-colors"
                    >
                        <HelpCircle className="w-3 h-3 text-[#d4af37]" />
                    </motion.div>
                )}
            </div>

            {/* Popover Card */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-72 z-50 overflow-hidden"
                    >
                        <div className="bg-[#0f0f0f]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_20px_rgba(212,175,55,0.1)] overflow-hidden">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-[#d4af37]/20 to-transparent p-4 flex items-center justify-between border-b border-white/5">
                                <div className="flex items-center gap-2">
                                    <Target className="w-4 h-4 text-[#d4af37]" />
                                    <span className="text-xs font-black uppercase tracking-wider text-[#d4af37]">{content.title}</span>
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1 hover:bg-white/5 rounded-full transition-colors"
                                >
                                    <X className="w-3 h-3 text-muted-foreground" />
                                </button>
                            </div>

                            <div className="p-4 space-y-4">
                                {/* Description */}
                                <p className="text-sm text-white/90 leading-relaxed italic">
                                    "{content.description}"
                                </p>

                                {/* Benchmark Section */}
                                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <TrendingUp className="w-3 h-3 text-[#d4af37]" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-[#d4af37]">Mercado / Benchmark</span>
                                    </div>
                                    <p className="text-xs font-bold text-white/80">{content.benchmark}</p>
                                </div>

                                {/* Actions */}
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Lightbulb className="w-3 h-3 text-[#d4af37]" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Como melhorar:</span>
                                    </div>
                                    <div className="space-y-1.5 text-xs">
                                        {content.actions.map((action, i) => (
                                            <div key={i} className="flex items-start gap-2 text-white/60 hover:text-white transition-colors">
                                                <ArrowRight className="w-2.5 h-2.5 mt-0.5 text-[#d4af37]" />
                                                <span>{action}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="p-3 bg-white/5 border-t border-white/5 flex justify-center">
                                <button className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d4af37] hover:text-white transition-colors">
                                    Ver Playbook Completo
                                </button>
                            </div>
                        </div>
                        {/* Arrow */}
                        <div className="w-3 h-3 bg-[#0f0f0f] border-r border-b border-white/10 rotate-45 mx-auto -mt-1.5 shadow-xl" />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Removed local TrendingUp definition as it is now imported from lucide-react
