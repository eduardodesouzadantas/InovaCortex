import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { MemoryCenterClient } from "./memory-center-client";
import { Brain, Database } from "lucide-react";

export default async function MemoryCenterPage({ params }: { params: { slug: string } }) {
    const { slug } = params;

    const org = await prisma.organization.findUnique({
        where: { slug },
        select: { id: true, name: true }
    });

    if (!org) return notFound();

    return (
        <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#050505] text-slate-100">
            <header className="px-8 py-4 border-b border-slate-800/50 flex items-center justify-between bg-black/40 backdrop-blur-md z-10">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <Brain size={16} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 to-purple-400">
                            Memory Center • {org.name}
                        </h1>
                        <p className="text-xs text-slate-500 font-mono tracking-widest uppercase">
                            Knowledge Hub • Semantic RAG • V33
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 text-xs text-indigo-400/60 font-mono border border-indigo-500/20 px-3 py-1 rounded-full">
                        <Database size={10} />
                        RAG Engine Active
                    </span>
                </div>
            </header>

            <Suspense fallback={
                <div className="flex-1 flex items-center justify-center font-mono text-indigo-500/50">
                    Initializing Memory Center...
                </div>
            }>
                <MemoryCenterClient slug={slug} />
            </Suspense>
        </div>
    );
}
