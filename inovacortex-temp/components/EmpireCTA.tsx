"use client";

import { motion } from "framer-motion";
import { Crown, ArrowRight } from "lucide-react";
import Link from "next/link";

interface EmpireCTAProps {
    redirectPath: string;
}

export function EmpireCTA({ redirectPath }: EmpireCTAProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
                duration: 0.6,
                delay: 1,
                type: "spring",
                stiffness: 100
            }}
            className="fixed bottom-8 right-8 z-[60]"
        >
            <Link href={redirectPath}>
                <motion.div
                    whileHover={{ scale: 1.05, y: -5 }}
                    whileTap={{ scale: 0.95 }}
                    className="relative group cursor-pointer"
                >
                    {/* Premium Glow Effect */}
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-[#d4af37] via-[#f9d976] to-[#d4af37] rounded-full blur opacity-60 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse" />

                    {/* Button Body */}
                    <div className="relative flex items-center gap-3 px-6 py-3.5 bg-black rounded-full border border-[#d4af37]/50 leading-none">
                        <div className="p-1 px-1.5 rounded-md bg-[#d4af37]/20 border border-[#d4af37]/30">
                            <Crown className="w-4 h-4 text-[#d4af37]" />
                        </div>

                        <div className="flex flex-col items-start translate-y-[1px]">
                            <span className="text-[10px] uppercase tracking-[0.2em] text-[#d4af37]/70 font-bold mb-0.5">Acesso Restrito</span>
                            <span className="text-sm font-black text-white tracking-tight">Entrar no Império</span>
                        </div>

                        <div className="ml-2 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-[#d4af37] transition-colors">
                            <ArrowRight className="w-3.5 h-3.5 text-white" />
                        </div>
                    </div>

                    {/* Shimmer Effect */}
                    <div className="absolute inset-0 rounded-full overflow-hidden">
                        <motion.div
                            animate={{
                                translateX: ["-100%", "200%"]
                            }}
                            transition={{
                                duration: 3,
                                repeat: Infinity,
                                ease: "linear",
                                repeatDelay: 4
                            }}
                            className="absolute top-0 bottom-0 w-1/2 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12"
                        />
                    </div>
                </motion.div>
            </Link>
        </motion.div>
    );
}
