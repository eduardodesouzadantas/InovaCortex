"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { assessmentSchema, AssessmentFormData } from "@/lib/validations/assessment";
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronRight, Loader2, FileText, Download } from "lucide-react";
import Link from "next/link";
import { FadeIn } from "@/components/fade-in";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { PdfDownloadButton } from "@/components/pdf-download-button";

const STEPS = ["Dados Pessoais", "Perfil e Aquisição", "Operações e Stack", "Dores e Metas", "Finalizar"];

// Componente principal do Wizard
export default function AvaliacaoWizard() {
    const searchParams = useSearchParams();
    const [currentStep, setCurrentStep] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<any>(null); // Guardará o retorno da API

    const form = useForm<AssessmentFormData>({
        resolver: zodResolver(assessmentSchema) as any,
        defaultValues: {
            name: "", email: "", phone: "", company: "", role: "",
            segment: "", city: "", monthlyRevenue: "", teamSize: "", customerVolume: "",
            channels: [], monthlyLeads: "", conversionRate: "", responseTime: "",
            manualTasks: "", hoursLost: "", crmUsage: "", automationLevel: "",
            stack: [], pains: [], urgency: "", goal: "", honeypot: "",
            whatsappConsent: false
        },
        mode: "onTouched"
    });

    const { register, control, handleSubmit, trigger, watch, formState: { errors } } = form;
    const orgSlug = (searchParams.get("org") || "").trim();

    // Persistir estado localmente
    useEffect(() => {
        const saved = localStorage.getItem("assessment_draft");
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                form.reset(parsed);
            } catch (e) { }
        }
    }, [form]);

    useEffect(() => {
        const subscription = watch((value) => {
            localStorage.setItem("assessment_draft", JSON.stringify(value));
        });
        return () => subscription.unsubscribe();
    }, [watch]);

    // Avançar passo com validação parcial
    const handleNext = async () => {
        let fieldsToValidate: any[] = [];
        if (currentStep === 0) fieldsToValidate = ["name", "email", "phone", "company", "role", "city"];
        if (currentStep === 1) fieldsToValidate = ["segment", "monthlyRevenue", "teamSize", "customerVolume", "channels", "monthlyLeads", "conversionRate", "responseTime"];
        if (currentStep === 2) fieldsToValidate = ["manualTasks", "hoursLost", "crmUsage", "automationLevel", "stack"];
        if (currentStep === 3) fieldsToValidate = ["pains", "urgency", "goal"];

        const isStepValid = await trigger(fieldsToValidate as any);
        if (isStepValid) {
            setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    const handlePrev = () => {
        setCurrentStep(prev => Math.max(prev - 1, 0));
    };

    const onSubmit = async (data: AssessmentFormData) => {
        setIsSubmitting(true);
        const payload = {
            ...data,
            name: data.name.trim(),
            email: data.email.trim().toLowerCase(),
            phone: data.phone.trim(),
            company: data.company.trim(),
            role: data.role.trim()
        };
        try {
            const endpoint = orgSlug
                ? `/api/assessment?org=${encodeURIComponent(orgSlug)}`
                : "/api/assessment";

            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!response.ok) throw new Error("Erro ao submeter avaliação");

            const _result = await response.json();
            setResult(_result);
            localStorage.removeItem("assessment_draft");
        } catch (error) {
            console.error(error);
            alert("Houve um erro no envio. Tente novamente.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // ---------------------------------------------------------------------------
    // RENDERIZAÇÃO DE TELA DE SUCESSO
    // ---------------------------------------------------------------------------
    if (result) {
        const msgWhatsApp = encodeURIComponent(`Olá, realizei o Diagnóstico InovaCortex e minha pontuação de automação foi ${result.scoreTotal}/100 [${result.classification}]. Gostaria de agendar o diagnóstico técnico sobre a missão de ${result.recommendedMissions[0] || 'Automação'}.`);

        return (
            <FadeIn>
                <div className="min-h-screen pt-32 pb-24 bg-muted/10 flex flex-col items-center justify-center p-4">
                    <div className="max-w-3xl w-full glass-panel p-8 md:p-12 rounded-2xl border border-primary/20 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-accent"></div>
                        <CheckCircle2 className="w-16 h-16 text-primary mx-auto mb-6" />
                        <h2 className="text-3xl font-extrabold mb-2">Diagnóstico Concluído</h2>
                        <p className="text-muted-foreground text-lg mb-8">Baseado em sua infraestrutura, desenhamos o roadmap inicial.</p>

                        <div className="grid md:grid-cols-2 gap-6 mb-8 text-left">
                            <div className="bg-background/50 p-6 rounded-xl border border-border/50">
                                <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Score de Automação</p>
                                <p className="text-4xl font-black text-gradient">{result.scoreTotal}<span className="text-2xl text-muted-foreground font-medium">/100</span></p>
                                <div className="mt-4 pt-4 border-t border-border/50">
                                    <p className="text-sm font-medium">Classificação:</p>
                                    <p className="text-lg font-bold text-foreground">{result.classification}</p>
                                </div>
                            </div>
                            <div className="bg-background/50 p-6 rounded-xl border border-border/50">
                                <p className="text-sm font-medium mb-3">Missões Recomendadas (O que focar agora):</p>
                                <ul className="space-y-2">
                                    {result.recommendedMissions.map((q: string, i: number) => (
                                        <li key={i} className="flex items-center text-sm">
                                            <ChevronRight className="w-4 h-4 text-primary mr-2" />
                                            {q}
                                        </li>
                                    ))}
                                </ul>
                                <div className="mt-4 pt-4 border-t border-border/50">
                                    <p className="text-xs text-muted-foreground">Isso indica a prioridade arquitetural que nossos agentes resolverão primeiro.</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 mb-8 text-left">
                            <h4 className="font-bold mb-2">Artifacts Iniciais Disponíveis no Diagnóstico:</h4>
                            <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                                <li>Blueprint de Integrações Possíveis</li>
                                <li>Mapeamento de Agentes Especializados (Roadmap 30 dias)</li>
                                <li>Tabela de Riscos Analisados</li>
                            </ul>
                        </div>

                        <div className="flex flex-col md:flex-row gap-4 w-full justify-center">
                            <a
                                href={`/diagnostico/${result.dossierSlug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-14 items-center justify-center rounded-md border border-input bg-background px-6 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                            >
                                <FileText className="w-4 h-4 mr-2" />
                                Abrir Dossiê
                            </a>
                            <PdfDownloadButton
                                slug={result.dossierSlug}
                                className="inline-flex h-14 items-center justify-center rounded-md border border-primary/50 bg-primary/10 text-primary px-6 text-sm font-medium shadow-sm transition-colors hover:bg-primary/20 disabled:opacity-60"
                                label="Baixar PDF"
                                title="Gerar e baixar PDF sem sair da pagina"
                            />
                            <a
                                href={`https://wa.me/5511967011133?text=${msgWhatsApp}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-14 items-center justify-center rounded-md bg-primary px-8 text-base font-bold text-primary-foreground shadow transition-colors hover:bg-primary/90"
                            >
                                Agendar Diagnóstico
                            </a>
                        </div>
                    </div>
                </div>
            </FadeIn>
        );
    }

    // ---------------------------------------------------------------------------
    // WIZARD RENDER
    // ---------------------------------------------------------------------------
    return (
        <div className="min-h-screen pt-28 pb-24 bg-background px-4">
            <div className="max-w-3xl mx-auto">

                <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors mb-8">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar
                </Link>

                <h1 className="text-3xl font-extrabold mb-2">Avaliação de Infraestrutura</h1>
                <p className="text-muted-foreground mb-8">Mapeie o estado da sua operação em 2 minutos antes da nossa call técnica.</p>

                {/* Progress Bar */}
                <div className="mb-8">
                    <div className="flex justify-between text-xs font-medium text-muted-foreground mb-2">
                        <span>Passo {currentStep + 1} de {STEPS.length}</span>
                        <span>{Math.round(((currentStep + 1) / STEPS.length) * 100)}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                        <div className="bg-primary h-2 rounded-full transition-all duration-300" style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}></div>
                    </div>
                    <p className="mt-2 text-sm font-semibold">{STEPS[currentStep]}</p>
                </div>

                {/* Form Container */}
                <div className="glass-panel p-6 md:p-8 rounded-2xl border border-border/50">
                    <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-8">
                        <input type="text" {...register("honeypot")} className="hidden" tabIndex={-1} autoComplete="off" />

                        <div className={currentStep === 0 ? "block" : "hidden"}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Nome completo</Label>
                                    <Input id="name" {...register("name")} placeholder="João Silva" className="bg-background" />
                                    {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">E-mail corporativo</Label>
                                    <Input id="email" type="email" {...register("email")} placeholder="joao@empresa.com.br" className="bg-background" />
                                    {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone">WhatsApp</Label>
                                    <Input id="phone" {...register("phone")} placeholder="(11) 99999-9999" className="bg-background" />
                                    {errors.phone && <p className="text-sm text-red-500">{errors.phone.message}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="company">Nome da Empresa</Label>
                                    <Input id="company" {...register("company")} placeholder="Inova Corp" className="bg-background" />
                                    {errors.company && <p className="text-sm text-red-500">{errors.company.message}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="city">Cidade / Estado</Label>
                                    <Input id="city" {...register("city")} placeholder="São Paulo - SP" className="bg-background" />
                                    {errors.city && <p className="text-sm text-red-500">{errors.city.message}</p>}
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="role">Cargo</Label>
                                    <Input id="role" {...register("role")} placeholder="CTO, Diretor, Gerente..." className="bg-background" />
                                    {errors.role && <p className="text-sm text-red-500">{errors.role.message}</p>}
                                </div>
                            </div>
                        </div>

                        <div className={currentStep === 1 ? "block" : "hidden"}>
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="segment">Segmento de Atuação</Label>
                                        <Input id="segment" {...register("segment")} placeholder="Tecnologia, Varejo, Saúde..." className="bg-background" />
                                        {errors.segment && <p className="text-sm text-red-500">{errors.segment.message}</p>}
                                    </div>

                                    <div className="space-y-3">
                                        <Label>Faturamento Mensal Estimado</Label>
                                        <Controller
                                            name="monthlyRevenue"
                                            control={control}
                                            render={({ field }) => (
                                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Até 50k" id="mr1" /><Label htmlFor="mr1">Até R$ 50 mil</Label></div>
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="50k a 200k" id="mr2" /><Label htmlFor="mr2">R$ 50k a R$ 200k</Label></div>
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="200k a 500k" id="mr3" /><Label htmlFor="mr3">R$ 200k a R$ 500k</Label></div>
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Acima de 500k" id="mr4" /><Label htmlFor="mr4">Acima de R$ 500k</Label></div>
                                                </RadioGroup>
                                            )}
                                        />
                                        {errors.monthlyRevenue && <p className="text-sm text-red-500">{errors.monthlyRevenue.message}</p>}
                                    </div>

                                    <div className="space-y-3">
                                        <Label>Tamanho da Equipe</Label>
                                        <Controller
                                            name="teamSize"
                                            control={control}
                                            render={({ field }) => (
                                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="1-10" id="t1" /><Label htmlFor="t1">1 a 10 colaboradores</Label></div>
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="11-50" id="t2" /><Label htmlFor="t2">11 a 50 colaboradores</Label></div>
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="51-200" id="t3" /><Label htmlFor="t3">51 a 200 colaboradores</Label></div>
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="200+" id="t4" /><Label htmlFor="t4">Mais de 200</Label></div>
                                                </RadioGroup>
                                            )}
                                        />
                                        {errors.teamSize && <p className="text-sm text-red-500">{errors.teamSize.message}</p>}
                                    </div>

                                    <div className="space-y-3">
                                        <Label>Volume Mensal de Clientes</Label>
                                        <Controller
                                            name="customerVolume"
                                            control={control}
                                            render={({ field }) => (
                                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Menos de 50" id="cv1" /><Label htmlFor="cv1">Menos de 50</Label></div>
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="50 a 200" id="cv2" /><Label htmlFor="cv2">50 a 200</Label></div>
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="200 a 1000" id="cv3" /><Label htmlFor="cv3">200 a 1000</Label></div>
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Mais de 1000" id="cv4" /><Label htmlFor="cv4">Mais de 1000 (Massivo)</Label></div>
                                                </RadioGroup>
                                            )}
                                        />
                                        {errors.customerVolume && <p className="text-sm text-red-500">{errors.customerVolume.message}</p>}
                                    </div>
                                    
                                    <div className="space-y-3 md:col-span-2">
                                        <Label>Canais Principais de Aquisição (Todos que aplicam)</Label>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                            {["WhatsApp", "Instagram", "Google Ads", "LinkedIn", "Prospecção Ativa", "Indicações", "Site/SEO", "Eventos"].map((ch) => (
                                                <div key={ch} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`ch-${ch}`}
                                                        checked={watch("channels")?.includes(ch)}
                                                        onCheckedChange={(checked) => {
                                                            const val = watch("channels") || [];
                                                            form.setValue("channels", checked ? [...val, ch] : val.filter((v: any) => v !== ch), { shouldValidate: true });
                                                        }}
                                                    />
                                                    <Label htmlFor={`ch-${ch}`}>{ch}</Label>
                                                </div>
                                            ))}
                                        </div>
                                        {errors.channels && <p className="text-sm text-red-500">{errors.channels.message}</p>}
                                    </div>

                                    <div className="space-y-3">
                                        <Label>Leads (Oportunidades) por Mês</Label>
                                        <Controller
                                            name="monthlyLeads"
                                            control={control}
                                            render={({ field }) => (
                                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Menos de 100" id="ml1" /><Label htmlFor="ml1">Menos de 100</Label></div>
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="100 a 500" id="ml2" /><Label htmlFor="ml2">100 a 500</Label></div>
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="500 a 2000" id="ml3" /><Label htmlFor="ml3">500 a 2000</Label></div>
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Mais de 2000" id="ml4" /><Label htmlFor="ml4">Mais de 2000</Label></div>
                                                </RadioGroup>
                                            )}
                                        />
                                        {errors.monthlyLeads && <p className="text-sm text-red-500">{errors.monthlyLeads.message}</p>}
                                    </div>
                                    
                                    <div className="space-y-3">
                                        <Label>Taxa de Conversão Média</Label>
                                        <Controller
                                            name="conversionRate"
                                            control={control}
                                            render={({ field }) => (
                                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Desconhecida" id="cr1" /><Label htmlFor="cr1">Desconhecida</Label></div>
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Abaixo de 2%" id="cr2" /><Label htmlFor="cr2">Abaixo de 2%</Label></div>
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="2% a 10%" id="cr3" /><Label htmlFor="cr3">2% a 10%</Label></div>
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Acima de 10%" id="cr4" /><Label htmlFor="cr4">Acima de 10%</Label></div>
                                                </RadioGroup>
                                            )}
                                        />
                                        {errors.conversionRate && <p className="text-sm text-red-500">{errors.conversionRate.message}</p>}
                                    </div>

                                    <div className="space-y-3 md:col-span-2">
                                        <Label>Tempo Médio de Resposta a Leads</Label>
                                        <Controller
                                            name="responseTime"
                                            control={control}
                                            render={({ field }) => (
                                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Imediato" id="rt1" /><Label htmlFor="rt1">Imediato (em minutos)</Label></div>
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Algumas horas" id="rt2" /><Label htmlFor="rt2">Em algumas horas</Label></div>
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Até 24h" id="rt3" /><Label htmlFor="rt3">Em até 24 horas</Label></div>
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Mais de 24h" id="rt4" /><Label htmlFor="rt4">Mais de 24 horas</Label></div>
                                                </RadioGroup>
                                            )}
                                        />
                                        {errors.responseTime && <p className="text-sm text-red-500">{errors.responseTime.message}</p>}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={currentStep === 2 ? "block" : "hidden"}>
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="manualTasks">Principais Tarefas Manuais Hoje</Label>
                                    <Input id="manualTasks" {...register("manualTasks")} placeholder="Ex: Digitar dados no ERP, responder dúvidas padrão, criar planilhas..." className="bg-background" />
                                    {errors.manualTasks && <p className="text-sm text-red-500">{errors.manualTasks.message}</p>}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <Label>Tempo Gasto em Trabalho Manual / Repetitivo</Label>
                                        <Controller
                                            name="hoursLost"
                                            control={control}
                                            render={({ field }) => (
                                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Até 2h/dia" id="hl1" /><Label htmlFor="hl1">Até 2h/dia por pessoa</Label></div>
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="3 a 5h/dia" id="hl2" /><Label htmlFor="hl2">3 a 5h/dia por pessoa</Label></div>
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Mais de 5h/dia" id="hl3" /><Label htmlFor="hl3">Mais de 5h/dia por pessoa</Label></div>
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Não sei medir" id="hl4" /><Label htmlFor="hl4">Não sei medir, mas é muito</Label></div>
                                                </RadioGroup>
                                            )}
                                        />
                                        {errors.hoursLost && <p className="text-sm text-red-500">{errors.hoursLost.message}</p>}
                                    </div>

                                    <div className="space-y-3">
                                        <Label>Nível de Uso de CRM</Label>
                                        <Controller
                                            name="crmUsage"
                                            control={control}
                                            render={({ field }) => (
                                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Não usamos" id="cu1" /><Label htmlFor="cu1">Não usamos CRM</Label></div>
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Básico as vezes" id="cu2" /><Label htmlFor="cu2">Uso básico/desorganizado</Label></div>
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Processo estruturado" id="cu3" /><Label htmlFor="cu3">Uso contínuo e estruturado</Label></div>
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Avançado com automações" id="cu4" /><Label htmlFor="cu4">Avançado (Automação Base)</Label></div>
                                                </RadioGroup>
                                            )}
                                        />
                                        {errors.crmUsage && <p className="text-sm text-red-500">{errors.crmUsage.message}</p>}
                                    </div>

                                    <div className="space-y-3">
                                        <Label>Nível Atual de Automação</Label>
                                        <Controller
                                            name="automationLevel"
                                            control={control}
                                            render={({ field }) => (
                                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Nenhuma" id="al1" /><Label htmlFor="al1">Nenhuma (Tudo manual)</Label></div>
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Básica" id="al2" /><Label htmlFor="al2">Básica (Make/Zapier simples)</Label></div>
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Moderada" id="al3" /><Label htmlFor="al3">Moderada</Label></div>
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Avançada" id="al4" /><Label htmlFor="al4">Avançada (RPA e IA)</Label></div>
                                                </RadioGroup>
                                            )}
                                        />
                                        {errors.automationLevel && <p className="text-sm text-red-500">{errors.automationLevel.message}</p>}
                                    </div>
                                </div>

                                <div className="space-y-3 mt-6">
                                    <Label>Tecnologias que já utilizam na operação</Label>
                                    <p className="text-sm text-muted-foreground pb-2">Isso define a viabilidade de integração.</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {["Hubspot", "RD Station CRM", "PipeDrive", "Salesforce", "ERP (SAP, Totvs, Omie, Bling)", "Zendesk / Intercom", "Automação (Zapier / Make)", "Modelos IA (OpenAI, Claude)", "APIs Próprias expostas"].map((st) => (
                                            <div key={st} className="flex items-start space-x-2">
                                                <Checkbox
                                                    id={`st-${st}`}
                                                    className="mt-1"
                                                    checked={watch("stack")?.includes(st)}
                                                    onCheckedChange={(checked) => {
                                                        const val = watch("stack") || [];
                                                        form.setValue("stack", checked ? [...val, st] : val.filter((v: any) => v !== st));
                                                    }}
                                                />
                                                <Label htmlFor={`st-${st}`} className="leading-snug cursor-pointer">{st}</Label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={currentStep === 3 ? "block" : "hidden"}>
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <Label>Principais Gargalos ou Dores (Max 3)</Label>
                                    <div className="grid gap-2">
                                        {["Tempo de resposta lento", "Equipe presa em trabalho manual/repetitivo", "Dados dispersos em sistemas não integrados", "Baixa conversão de leads", "Alto custo operacional (faturamento/equipe)", "Alto índice de retrabalho ou falhas humanas"].map((pain) => (
                                            <div key={pain} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`pain-${pain}`}
                                                    checked={watch("pains")?.includes(pain)}
                                                    onCheckedChange={(checked) => {
                                                        const val = watch("pains") || [];
                                                        form.setValue("pains", checked ? [...val, pain] : val.filter((v: any) => v !== pain), { shouldValidate: true });
                                                    }}
                                                />
                                                <Label htmlFor={`pain-${pain}`} className="cursor-pointer">{pain}</Label>
                                            </div>
                                        ))}
                                    </div>
                                    {errors.pains && <p className="text-sm text-red-500">{errors.pains.message}</p>}
                                </div>

                                <div className="space-y-3">
                                    <Label>Objetivo Principal</Label>
                                    <Input id="goal" {...register("goal")} placeholder="Ex: Reduzir tempo, aumentar conversão, padronizar dados..." className="bg-background" />
                                    {errors.goal && <p className="text-sm text-red-500">{errors.goal.message}</p>}
                                </div>

                                <div className="space-y-3">
                                    <Label>Urgência do Projeto</Label>
                                    <Controller
                                        name="urgency"
                                        control={control}
                                        render={({ field }) => (
                                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                                                <div className="flex items-center space-x-2"><RadioGroupItem value="Baixa - Exploratória" id="u1" /><Label htmlFor="u1">Baixa - Exploratória (6 meses+)</Label></div>
                                                <div className="flex items-center space-x-2"><RadioGroupItem value="Média - Próximo trimestre" id="u2" /><Label htmlFor="u2">Média - Próximo Trimestre</Label></div>
                                                <div className="flex items-center space-x-2"><RadioGroupItem value="Alta - Imediato/Para Ontem" id="u3" /><Label htmlFor="u3">Alta - Imediato / Necessidade Crítica</Label></div>
                                            </RadioGroup>
                                        )}
                                    />
                                    {errors.urgency && <p className="text-sm text-red-500">{errors.urgency.message}</p>}
                                </div>
                            </div>
                        </div>

                        <div className={currentStep === 4 ? "block" : "hidden"}>
                            <div className="space-y-4 text-center py-6">
                                <h3 className="text-2xl font-bold">Quase lá, {watch("name")?.split(" ")[0] || ""}</h3>
                                <p className="text-muted-foreground mb-6">Seus dados operacionais estão registrados. Nossos algoritmos vão calcular o Score de Automação e propor a arquitetura adequada (Missão).</p>
                                <div className="bg-muted/30 p-4 rounded-lg text-left text-sm max-w-sm mx-auto space-y-2 border border-border/50">
                                    <p><strong>Empresa:</strong> {watch("company")} ({watch("city")})</p>
                                    <p><strong>Volume Mensal:</strong> {watch("customerVolume")} clientes</p>
                                    <p><strong>Dores Reportadas:</strong> {watch("pains")?.length || 0}</p>
                                </div>
                                <div className="mt-8 flex items-start space-x-3 text-left max-w-sm mx-auto bg-primary/5 p-4 rounded-lg border border-primary/20">
                                    <Checkbox
                                        id="whatsappConsent"
                                        checked={watch("whatsappConsent")}
                                        onCheckedChange={(checked) => form.setValue("whatsappConsent", checked as boolean)}
                                        className="mt-1"
                                    />
                                    <div className="grid gap-1.5 leading-none">
                                        <Label htmlFor="whatsappConsent" className="text-sm font-medium leading-tight">
                                            Aceito receber meu dossiê técnico e avisos de agendamento via WhatsApp.
                                        </Label>
                                        <p className="text-xs text-muted-foreground">
                                            Prometemos não enviar spam. O envio é feito via integração oficial da Meta (InovaCortex Agent).
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Navigation Buttons */}
                        <div className="flex justify-between mt-10 pt-6 border-t border-border/50">
                            <Button type="button" variant="outline" onClick={handlePrev} disabled={currentStep === 0 || isSubmitting}>
                                Anterior
                            </Button>

                            {currentStep < STEPS.length - 1 ? (
                                <Button type="button" onClick={handleNext}>
                                    Próxima Etapa <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            ) : (
                                <Button type="button" onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Processar Diagnóstico
                                </Button>
                            )}
                        </div>

                    </form>
                </div>
            </div>
        </div>
    );
}
