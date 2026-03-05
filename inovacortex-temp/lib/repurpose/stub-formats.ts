/**
 * lib/repurpose/stub-formats.ts
 * V21: Pure, zero-dependency stub format generator.
 *
 * Extracted from repurpose-engine.ts so unit tests can import
 * without needing @/lib/agentops or prisma.
 */

// ─── Types (duplicated for zero-dep isolation) ─────────────────────────────────

export interface LinkedInV2 { hook: string; text: string; cta: string; }
export interface CarouselSlides { title: string; slides: string[]; cta: string; }
export interface TwitterThread { tweets: string[]; }
export interface VideoScript { hook: string; scenes: Array<{ sec: number; fala: string; tela: string }>; cta: string; }
export interface EmailNewsletter { subject: string; body: string; }

export interface RepurposeFormats {
    linkedin_v2: LinkedInV2;
    carousel: CarouselSlides;
    thread: TwitterThread;
    video: VideoScript;
    email: EmailNewsletter;
}

// ─── STUB generator (deterministic, zero tokens) ──────────────────────────────

export function buildStubFormats(plan: {
    topic: string;
    hook: string;
    cta: string;
    postType: string;
    platform: string;
}): RepurposeFormats {
    const t = plan.topic;
    const h = plan.hook;
    const c = plan.cta;

    const linkedin_v2: LinkedInV2 = {
        hook: `🔑 ${h}`,
        text: `Já abordei isso antes, mas vale reforçar:\n\n${t}\n\nO que muda quando você aplica isso:\n→ Mais resultados com menos esforço\n→ Processos mais previsíveis\n→ Time focado no que importa\n\n${c}`,
        cta: c,
    };

    const carousel: CarouselSlides = {
        title: t,
        slides: [
            `Slide 1: ${t}`,
            `Slide 2: O problema que isso resolve`,
            `Slide 3: Por que acontece`,
            `Slide 4: A solução em 3 passos`,
            `Slide 5: Exemplo prático`,
            `Slide 6: Resultados esperados`,
            `Slide 7: ${c}`,
        ],
        cta: c,
    };

    const thread: TwitterThread = {
        tweets: [
            `1/ ${h}`,
            `2/ O contexto: ${t}`,
            `3/ Por que isso importa para o seu negócio:`,
            `4/ A maioria das empresas ignora isso. O custo? Alto.`,
            `5/ 3 sinais de que você precisa mudar agora:`,
            `6/ → Processos repetitivos tomando horas do seu time`,
            `7/ → Clientes esperando resposta por horas`,
            `8/ → Erros humanos custando dinheiro`,
            `9/ A solução começa com automação inteligente.`,
            `10/ Não precisa ser complexo. Começa simples.`,
            `11/ ${c}`,
            `12/ RT se isso fez sentido para você 🔁`,
        ],
    };

    const video: VideoScript = {
        hook: h,
        scenes: [
            { sec: 0, fala: h, tela: "Texto animado na tela: gancho principal" },
            { sec: 8, fala: `Vou te mostrar o que é possível com ${t.toLowerCase()}.`, tela: "B-roll: tela de computador ou equipe" },
            { sec: 20, fala: "Primeiro, o problema comum:", tela: "Texto: 'Processos manuais = tempo perdido'" },
            { sec: 30, fala: "E aqui está como resolver:", tela: "Screen capture ou animação" },
            { sec: 45, fala: "O resultado para nossos clientes:", tela: "Gráficos de resultado" },
            { sec: 60, fala: c, tela: "CTA com link" },
        ],
        cta: c,
    };

    const email: EmailNewsletter = {
        subject: `📌 ${t}`,
        body: `Olá,\n\n${h}\n\nEsta semana quero falar sobre ${t.toLowerCase()}.\n\n` +
            `Muitas empresas que acompanhamos enfrentam o mesmo desafio: processos que consomem tempo do time sem gerar valor proporcional.\n\n` +
            `A boa notícia é que existe uma forma mais inteligente de trabalhar.\n\n` +
            `Aqui está o que funciona:\n` +
            `→ Mapear o processo que mais toma tempo\n` +
            `→ Identificar o que pode ser automatizado\n` +
            `→ Implementar gradualmente, com métricas\n\n` +
            `${c}\n\n` +
            `Até a próxima,\n` +
            `[Equipe InovaCortex]`,
    };

    return { linkedin_v2, carousel, thread, video, email };
}
