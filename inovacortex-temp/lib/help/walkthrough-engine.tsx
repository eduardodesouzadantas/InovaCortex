
"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, ChevronRight, ChevronLeft, Target } from "lucide-react";

export interface WalkthroughStep {
    targetId: string;
    title: string;
    content: string;
    position?: "top" | "bottom" | "left" | "right";
}

interface WalkthroughContextType {
    isActive: boolean;
    currentStepIndex: number;
    startWalkthrough: (steps: WalkthroughStep[]) => void;
    stopWalkthrough: () => void;
    nextStep: () => void;
    prevStep: () => void;
    steps: WalkthroughStep[];
}

const WalkthroughContext = createContext<WalkthroughContextType | undefined>(undefined);

export function WalkthroughProvider({ children }: { children: React.ReactNode }) {
    const [isActive, setIsActive] = useState(false);
    const [steps, setSteps] = useState<WalkthroughStep[]>([]);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

    const startWalkthrough = useCallback((newSteps: WalkthroughStep[]) => {
        setSteps(newSteps);
        setCurrentStepIndex(0);
        setIsActive(true);
    }, []);

    const stopWalkthrough = useCallback(() => {
        setIsActive(false);
        setTargetRect(null);
    }, []);

    const nextStep = useCallback(() => {
        if (currentStepIndex < steps.length - 1) {
            setCurrentStepIndex(prev => prev + 1);
        } else {
            stopWalkthrough();
        }
    }, [currentStepIndex, steps.length, stopWalkthrough]);

    const prevStep = useCallback(() => {
        if (currentStepIndex > 0) {
            setCurrentStepIndex(prev => prev - 1);
        }
    }, [currentStepIndex]);

    // Update target rectangle when step changes
    useEffect(() => {
        if (!isActive || steps.length === 0) return;

        const step = steps[currentStepIndex];
        const element = document.getElementById(step.targetId);

        if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
            setTargetRect(element.getBoundingClientRect());

            // Add a visual highlight class if we want
            element.classList.add("walkthrough-highlight");

            return () => {
                element.classList.remove("walkthrough-highlight");
            };
        } else {
            console.warn(`Walkthrough target not found: ${step.targetId}`);
            // Skip missing step?
        }
    }, [isActive, steps, currentStepIndex]);

    // Re-calculate rect on resize/scroll
    useEffect(() => {
        if (!isActive) return;
        const handleUpdate = () => {
            const step = steps[currentStepIndex];
            const element = document.getElementById(step.targetId);
            if (element) setTargetRect(element.getBoundingClientRect());
        };
        window.addEventListener("resize", handleUpdate);
        window.addEventListener("scroll", handleUpdate);
        return () => {
            window.removeEventListener("resize", handleUpdate);
            window.removeEventListener("scroll", handleUpdate);
        };
    }, [isActive, steps, currentStepIndex]);

    return (
        <WalkthroughContext.Provider value={{
            isActive,
            currentStepIndex,
            startWalkthrough,
            stopWalkthrough,
            nextStep,
            prevStep,
            steps
        }}>
            {children}
            <AnimatePresence>
                {isActive && targetRect && (
                    <WalkthroughOverlay
                        rect={targetRect}
                        step={steps[currentStepIndex]}
                        onNext={nextStep}
                        onPrev={prevStep}
                        onClose={stopWalkthrough}
                        current={currentStepIndex + 1}
                        total={steps.length}
                    />
                )}
            </AnimatePresence>
        </WalkthroughContext.Provider>
    );
}

export function useWalkthrough() {
    const context = useContext(WalkthroughContext);
    if (!context) throw new Error("useWalkthrough must be used within WalkthroughProvider");
    return context;
}

// ─── Internal Components ───────────────────────────────────────────────────

function WalkthroughOverlay({
    rect, step, onNext, onPrev, onClose, current, total
}: {
    rect: DOMRect;
    step: WalkthroughStep;
    onNext: () => void;
    onPrev: () => void;
    onClose: () => void;
    current: number;
    total: number;
}) {
    const padding = 10;

    return (
        <div className="fixed inset-0 z-[100] pointer-events-none">
            {/* Dimmed Background with Hole (SVG mask) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-auto">
                <defs>
                    <mask id="walkthrough-mask">
                        <rect x="0" y="0" width="100%" height="100%" fill="white" />
                        <rect
                            x={rect.left - padding}
                            y={rect.top - padding}
                            width={rect.width + padding * 2}
                            height={rect.height + padding * 2}
                            fill="black"
                            rx="12"
                        />
                    </mask>
                </defs>
                <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.8)" mask="url(#walkthrough-mask)" />
            </svg>

            {/* Floating Dialog */}
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{
                    opacity: 1,
                    scale: 1,
                    left: rect.left + rect.width / 2,
                    top: rect.top + rect.height + 40
                }}
                style={{ translateX: "-50%" }}
                className="absolute w-80 pointer-events-auto"
            >
                <div className="bg-[#0f0f0f] border border-[#d4af37]/30 rounded-2xl shadow-[0_0_50px_rgba(212,175,55,0.2)] overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-[#d4af37]/20 to-transparent p-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Target className="w-4 h-4 text-[#d4af37]" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#d4af37]">Tour: Passo {current} de {total}</span>
                        </div>
                        <button onClick={onClose} className="hover:bg-white/5 p-1 rounded-full transition-colors">
                            <X className="w-3 h-3 text-muted-foreground" />
                        </button>
                    </div>

                    <div className="p-5 space-y-4">
                        <h4 className="text-lg font-black tracking-tight text-white">{step.title}</h4>
                        <p className="text-sm text-white/60 leading-relaxed">{step.content}</p>

                        <div className="flex items-center justify-between pt-2">
                            <div className="flex gap-1">
                                {Array.from({ length: total }).map((_, i) => (
                                    <div
                                        key={i}
                                        className={`h-1 rounded-full transition-all ${i === current - 1 ? "w-4 bg-[#d4af37]" : "w-1 bg-white/10"}`}
                                    />
                                ))}
                            </div>

                            <div className="flex gap-2">
                                {current > 1 && (
                                    <button
                                        onClick={onPrev}
                                        className="p-2 hover:bg-white/5 rounded-xl text-muted-foreground transition-colors"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                )}
                                <button
                                    onClick={onNext}
                                    className="px-4 py-2 bg-[#d4af37] text-black font-black text-xs rounded-xl flex items-center gap-2 hover:bg-[#d4af37]/80 transition-all active:scale-95"
                                >
                                    {current === total ? "Finalizar" : "Próximo"}
                                    <ChevronRight className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
