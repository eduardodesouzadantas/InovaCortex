import { Suspense } from "react";
import { AiChatClient } from "./ai-chat-client";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export default async function AiControlRoomPage({ params }: { params: { slug: string } }) {
    const { slug } = params;

    const org = await prisma.organization.findUnique({
        where: { slug },
        select: { id: true, name: true }
    });

    if (!org) return notFound();

    return (
        <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#050505] text-slate-100">
            <header className="px-8 py-4 border-b border-slate-800/50 flex items-center justify-between bg-black/40 backdrop-blur-md z-10">
                <div>
                    <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-200 to-indigo-400">
                        AI Control Room • {org.name}
                    </h1>
                    <p className="text-xs text-slate-500 font-mono tracking-widest uppercase">
                        War Room Intelligence • V31 Refined
                    </p>
                </div>
            </header>

            <Suspense fallback={<div className="flex-1 flex items-center justify-center font-mono text-amber-500/50">Initializing War Room...</div>}>
                <AiChatClient slug={slug} orgName={org.name} />
            </Suspense>
        </div>
    );
}
