"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, Zap } from "lucide-react";

export interface WalkthroughStep {
    targetId: string;
    title: string;
    description: string;
    position?: "top" | "bottom" | "left" | "right";
}

interface Props {
    steps: WalkthroughStep[];
    onComplete: () => void;
    isOpen: boolean;
}

export function Walkthrough({ steps, onComplete, isOpen }: Props) {
    const [currentStep, setCurrentStep] = useState(0);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

    const step = steps[currentStep];

    useEffect(() => {
        if (isOpen && step) {
            const element = document.getElementById(step.targetId);
            if (element) {
                element.scrollIntoView({ behavior: "smooth", block: "center" });
                setTargetRect(element.getBoundingClientRect());
            }
        }
    }, [isOpen, currentStep, step]);

    if (!isOpen || !step) return null;

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            onComplete();
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] pointer-events-none">
            {/* Dimmed Overlay with Hole */}
            <div className="absolute inset-0 bg-black/60 pointer-events-auto" style={{
                clipPath: targetRect ? `polygon(0% 0%, 0% 100%, ${targetRect.left}px 100%, ${targetRect.left}px ${targetRect.top}px, ${targetRect.right}px ${targetRect.top}px, ${targetRect.right}px ${targetRect.bottom}px, ${targetRect.left}px ${targetRect.bottom}px, ${targetRect.left}px 100%, 100% 100%, 100% 0%)` : 'none'
            }} />

            {/* Step Card */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="absolute z-[210] pointer-events-auto w-80"
                    style={{
                        top: targetRect ? (step.position === 'bottom' ? targetRect.bottom + 20 : targetRect.top - 20) : '50%',
                        left: targetRect ? targetRect.left + (targetRect.width / 2) : '50%',
                        transform: targetRect ? `translateX(-50%) ${step.position === 'bottom' ? '' : 'translateY(-100%)'}` : 'translate(-50%, -50%)'
                    }}
                >
                    <div className="bg-[#0f0f0f] border border-[#d4af37]/30 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
                        <div className="p-4 bg-gradient-to-r from-[#d4af37]/10 to-transparent flex items-center justify-between border-b border-white/5">
                            <div className="flex items-center gap-2 text-[#d4af37]">
                                <Zap className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-[#d4af37]">Guia do Produto</span>
                            </div>
                            <button onClick={onComplete} className="text-muted-foreground hover:text-white transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-5">
                            <h4 className="text-lg font-black mb-2 text-white">{step.title}</h4>
                            <p className="text-sm text-white/60 leading-relaxed mb-6">
                                {step.description}
                            </p>

                            <div className="flex items-center justify-between">
                                <div className="flex gap-1">
                                    {steps.map((_, i) => (
                                        <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === currentStep ? 'bg-[#d4af37]' : 'bg-white/10'}`} />
                                    ))}
                                </div>

                                <div className="flex gap-2">
                                    {currentStep > 0 && (
                                        <button onClick={handleBack} className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white/60">
                                            <ChevronLeft className="w-5 h-5" />
                                        </button>
                                    )}
                                    <button
                                        onClick={handleNext}
                                        className="flex items-center gap-2 bg-[#d4af37] text-black px-4 py-2 rounded-xl font-black text-xs hover:bg-[#b8962d] transition-colors"
                                    >
                                        {currentStep === steps.length - 1 ? 'Finalizar' : 'Próximo'}
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Arrow */}
                    <div className={`absolute left-1/2 -translate-x-1/2 w-4 h-4 bg-[#0f0f0f] border-r border-b border-[#d4af37]/20 rotate-45 ${step.position === 'bottom' ? '-top-2 border-l border-t border-r-0 border-b-0' : '-bottom-2'}`} />
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
