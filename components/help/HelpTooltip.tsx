"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HELP_CONTENT, HelpTopic } from "@/lib/help/help-content";

interface Props {
    topic: HelpTopic;
    children: React.ReactNode;
    className?: string;
}

export function HelpTooltip({ topic, children, className }: Props) {
    const [isVisible, setIsVisible] = useState(false);
    const content = HELP_CONTENT[topic];

    if (!content) return <>{children}</>;

    return (
        <div
            className={`relative inline-block ${className}`}
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            {children}

            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 5 }}
                        transition={{ duration: 0.15 }}
                        className="absolute z-[100] bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-[#0a0a0a] border border-white/10 rounded-lg shadow-xl pointer-events-none"
                    >
                        <div className="text-[10px] font-black uppercase tracking-widest text-[#d4af37] mb-1">
                            {content.title}
                        </div>
                        <p className="text-[11px] text-white/70 leading-relaxed">
                            {content.description}
                        </p>
                        {/* Arrow */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[5px] w-2 h-2 bg-[#0a0a0a] border-r border-b border-white/10 rotate-45" />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
