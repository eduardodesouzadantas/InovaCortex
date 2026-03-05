"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Terminal, Play, CheckCircle2, Loader2, ArrowRight } from "lucide-react";

type Step = {
    id: string;
    text: string;
    duration: number;
};

type Mission = {
    id: string;
    title: string;
    description: string;
    steps: Step[];
    result: string;
};

const missions: Mission[] = [
    {
        id: "m1",
        title: "Qualificar Lead Enterprise",
        description: "Analisar site corporativo, extrair tech stack e gerar email hyper-personalizado.",
        steps: [
            { id: "s1", text: "Iniciando Web Scraper Agent na URL alvo...", duration: 1500 },
            { id: "s2", text: "Extraindo tecnologias e dados públicos (LinkedIn)...", duration: 2000 },
            { id: "s3", text: "Sintetizando perfil ideal do cliente (ICP)...", duration: 1800 },
            { id: "s4", text: "Criando draft de cold email focado na dor identificada...", duration: 2200 }
        ],
        result: "Draft salvo no CRM. Pitch tech aprovado com 95% de aderência."
    },
    {
        id: "m2",
        title: "Triagem de Suporte N1",
        description: "Analisar ticket complexo, encontrar documentação e sugerir código de resolução.",
        steps: [
            { id: "s1", text: "Recebendo log de ticket (Nginx 502 Bad Gateway)...", duration: 1200 },
            { id: "s2", text: "Acessando base de conhecimento técnica da empresa...", duration: 1800 },
            { id: "s3", text: "Correlacionando erro com deploy recente de infraestrutura...", duration: 2500 },
            { id: "s4", text: "Gerando script de rollback com instruções passo a passo...", duration: 2000 }
        ],
        result: "Resposta enviada ao cliente com script de solução em 4.2 segundos."
    },
    {
        id: "m3",
        title: "Conciliação Fatura",
        description: "Ler 50 PDFs de notas fiscais, extrair valores e bater com o extrato bancário.",
        steps: [
            { id: "s1", text: "Extraindo texto via módulo OCR paralelo (50 documentos)...", duration: 2000 },
            { id: "s2", text: "Estruturando dados extraídos em JSON formatado...", duration: 1500 },
            { id: "s3", text: "Consultando API bancária para validação de transações...", duration: 2500 },
            { id: "s4", text: "Criando relatório de divergências (2 notas ausentes)...", duration: 1800 }
        ],
        result: "Worksheet de conciliação atualizada diretamente no ERP."
    }
];

export function MissionSimulator() {
    const [activeMission, setActiveMission] = useState<Mission | null>(null);
    const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1);
    const [isCompleted, setIsCompleted] = useState(false);
    const [progress, setProgress] = useState(0);

    const startMission = (mission: Mission) => {
        setActiveMission(mission);
        setCurrentStepIndex(0);
        setIsCompleted(false);
        setProgress(0);
    };

    useEffect(() => {
        if (!activeMission || currentStepIndex === -1) return;

        if (currentStepIndex >= activeMission.steps.length) {
            setTimeout(() => setIsCompleted(true), 500);
            return;
        }

        const currentStep = activeMission.steps[currentStepIndex];
        let interval: NodeJS.Timeout;

        // Simulate progress bar for current step
        const startTime = Date.now();
        interval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const stepProgress = Math.min((elapsed / currentStep.duration) * 100, 100);

            // Calculate total progress
            const percentPerStep = 100 / activeMission.steps.length;
            const baseProgress = currentStepIndex * percentPerStep;
            setProgress(baseProgress + (stepProgress * percentPerStep) / 100);

            if (stepProgress >= 100) {
                clearInterval(interval);
                setCurrentStepIndex(prev => prev + 1);
            }
        }, 50);

        return () => clearInterval(interval);
    }, [currentStepIndex, activeMission]);

    return (
        <section className="py-24 relative overflow-hidden bg-background">
            <div className="absolute inset-0 bg-primary/5 [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)] z-0" />

            <div className="container mx-auto px-4 md:px-8 max-w-screen-xl relative z-10">
                <div className="text-center max-w-2xl mx-auto mb-16">
                    <Badge variant="outline" className="mb-4 font-normal border-primary/30 bg-primary/5 text-primary">
                        Mission Simulator
                    </Badge>
                    <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
                        Não é chatbot, é <span className="text-gradient">ação.</span>
                    </h2>
                    <p className="text-lg text-muted-foreground leading-relaxed">
                        Selecione uma missão complexa e observe em tempo real como nosso Córtex decompõe um objetivo de alto nível em sub-tarefas autônomas.
                    </p>
                </div>

                <div className="grid lg:grid-cols-2 gap-12 items-start">

                    {/* Controls */}
                    <div className="space-y-6">
                        <h3 className="text-xl font-semibold mb-6 flex items-center">
                            <Terminal className="mr-3 h-5 w-5 text-primary" />
                            Selecione o Objetivo
                        </h3>

                        {missions.map((mission) => (
                            <Card
                                key={mission.id}
                                className={`p-6 cursor-pointer transition-all border ${activeMission?.id === mission.id
                                        ? "border-primary shadow-[0_0_30px_-5px_hsl(var(--primary)/0.3)] bg-primary/5"
                                        : "border-border/50 hover:border-primary/50 bg-background/50 hover:bg-muted/30"
                                    }`}
                                onClick={() => startMission(mission)}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-lg text-foreground">{mission.title}</h4>
                                    {activeMission?.id === mission.id && !isCompleted ? (
                                        <Loader2 className="h-5 w-5 text-primary animate-spin" />
                                    ) : (
                                        <Play className={`h-5 w-5 ${activeMission?.id === mission.id ? "text-primary" : "text-muted-foreground opacity-50"}`} />
                                    )}
                                </div>
                                <p className="text-muted-foreground text-sm leading-relaxed">
                                    {mission.description}
                                </p>
                            </Card>
                        ))}
                    </div>

                    {/* Terminal / Output */}
                    <div className="rounded-xl border border-border/50 bg-[#0A0A0A] shadow-2xl overflow-hidden relative min-h-[450px] flex flex-col font-mono">
                        {/* Terminal Header */}
                        <div className="flex items-center px-4 py-3 bg-[#111111] border-b border-white/5 space-x-2">
                            <div className="flex space-x-2">
                                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                                <div className="w-3 h-3 rounded-full bg-green-500/80" />
                            </div>
                            <div className="flex-1 text-center text-xs text-muted-foreground opacity-70">
                                cortex-agent-runtime
                            </div>
                        </div>

                        {/* Terminal Content */}
                        <div className="p-6 flex-1 flex flex-col">
                            {!activeMission ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-50">
                                    <Terminal className="h-12 w-12 mb-4" />
                                    <p>Aguardando input do operador...</p>
                                </div>
                            ) : (
                                <div className="space-y-6 flex-1">
                                    <div className="text-sm">
                                        <span className="text-primary mr-2">➜</span>
                                        <span className="text-white">Run Mission: </span>
                                        <span className="text-accent">{activeMission.title}</span>
                                    </div>

                                    <div className="space-y-4">
                                        {activeMission.steps.map((step, idx) => {
                                            const isPast = currentStepIndex > idx;
                                            const isCurrent = currentStepIndex === idx;
                                            const isFuture = currentStepIndex < idx;

                                            if (isFuture) return null;

                                            return (
                                                <div key={step.id} className="flex text-sm items-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                                                    <div className="min-w-[50px] text-muted-foreground text-xs mt-0.5">
                                                        [{idx + 1}/{activeMission.steps.length}]
                                                    </div>
                                                    <div className="flex-1">
                                                        <span className={isPast ? "text-muted-foreground" : "text-white"}>
                                                            {step.text}
                                                        </span>
                                                        {isCurrent && (
                                                            <span className="inline-block w-1.5 h-3 ml-2 bg-primary animate-[pulse_1s_ease-in-out_infinite]" />
                                                        )}
                                                    </div>
                                                    <div className="ml-4">
                                                        {isPast && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                                                        {isCurrent && <Loader2 className="h-4 w-4 text-primary animate-spin" />}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {isCompleted && (
                                        <div className="mt-8 pt-6 border-t border-white/10 animate-in fade-in duration-500">
                                            <div className="flex items-center text-green-400 mb-2">
                                                <CheckCircle2 className="mr-2 h-5 w-5" />
                                                <span className="font-bold">Missão Concluída com Sucesso</span>
                                            </div>
                                            <div className="text-sm text-muted-foreground pl-7 border-l-2 border-green-500/20 py-1 mb-4">
                                                {activeMission.result}
                                            </div>
                                            <div className="text-xs text-primary/70 pl-7 flex items-center">
                                                <ArrowRight className="h-3 w-3 mr-1" /> Agent process terminated. Ready for next prompt.
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Progress Bar Footer */}
                        {activeMission && (
                            <div className="h-1 w-full bg-white/5">
                                <div
                                    className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-75 ease-linear"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
