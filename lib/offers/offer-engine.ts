import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export interface OfferDraft {
    name: string;
    niche?: string;
    priceCents: number;
    currency: string;
    promise: string;
    deliverables: string[];
    timeline: string;
    guarantees: string;
    exclusions: string[];
    roiVariables: {
        label: string;
        key: string;
        value: number;
        unit: string;
    }[];
}

/**
 * Builds a deterministic high-ticket offer draft.
 * LLM can be used later to refine copy, but the core structure is deterministic.
 */
export function buildOfferDraft(orgId: string, niche: string = "Consulting"): OfferDraft {
    return {
        name: `${niche} Transformation Program`,
        niche: niche,
        priceCents: 500000, // R$ 5.000,00 default
        currency: "BRL",
        promise: "Implementação completa de infraestrutura de IA para dobrar a eficiência operacional em 90 dias.",
        deliverables: [
            "Diagnóstico completo de fluxos de trabalho",
            "Draft de 3 Agentes de IA customizados",
            "Dashboard de Mission Control para o CEO",
            "Suporte premium 24/7 via WhatsApp"
        ],
        timeline: "12 semanas (3 meses)",
        guarantees: "Garantia de satisfação: se não entregarmos os agentes funcionando em 90 dias, devolvemos 100% do investimento.",
        exclusions: [
            "Custos de tokens de APIs externas (OpenAI, Anthropic)",
            "Desenvolvimento de hardware físico",
            "Gestão de tráfego pago"
        ],
        roiVariables: [
            { label: "LTV Médio", key: "avg_ltv", value: 1000, unit: "BRL" },
            { label: "Custo por Lead", key: "cpl", value: 50, unit: "BRL" },
            { label: "Taxa de Fechamento", key: "close_rate", value: 10, unit: "%" }
        ]
    };
}

/**
 * Renders a premium, anti-commodity One-Pager HTML.
 * Uses Tailwind-style inline styles for consistent presentation.
 */
export function renderOnePagerHtml(offer: any): string {
    const offerData = typeof offer.offerJson === 'string' ? JSON.parse(offer.offerJson) : offer.offerJson;

    return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${offer.name} | InovaCortex</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        body { font-family: 'Inter', sans-serif; background: #050505; color: #fff; }
        .glass { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.05); }
        .gold-text { background: linear-gradient(to right, #d4af37, #f1d592); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
      </style>
    </head>
    <body class="p-4 md:p-12 overflow-x-hidden">
      <div class="max-w-4xl mx-auto space-y-12">
        <!-- Header -->
        <header class="text-center space-y-4">
          <div class="inline-block px-3 py-1 glass rounded-full text-[10px] font-bold tracking-widest text-[#d4af37] uppercase">
            Oferta Exclusiva High-Ticket
          </div>
          <h1 class="text-5xl md:text-7xl font-black tracking-tighter">${offer.name}</h1>
          <p class="text-xl text-zinc-400 max-w-2xl mx-auto">${offerData.promise}</p>
        </header>

        <!-- ROI Snapshot -->
        <section class="glass p-8 rounded-3xl relative overflow-hidden">
           <div class="absolute top-0 right-0 w-32 h-32 bg-[#d4af37]/10 blur-3xl"></div>
           <h2 class="text-2xl font-bold mb-6 flex items-center gap-2 italic">
             <span class="gold-text">Efficiency ROI Model</span>
           </h2>
           <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
             <div class="space-y-1">
               <span class="text-xs text-zinc-500 uppercase font-bold tracking-widest">Investimento</span>
               <div class="text-2xl font-bold">R$ ${(offer.priceCents / 100).toLocaleString('pt-BR')}</div>
             </div>
             <div class="space-y-1">
               <span class="text-xs text-zinc-500 uppercase font-bold tracking-widest">Payback Est.</span>
               <div class="text-2xl font-bold">4.2 Meses</div>
             </div>
             <div class="space-y-1">
               <span class="text-xs text-zinc-500 uppercase font-bold tracking-widest">Confidence</span>
               <div class="text-2xl font-bold text-emerald-400">92%</div>
             </div>
           </div>
        </section>

        <!-- Deliverables -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <section class="space-y-6">
            <h3 class="text-xl font-bold border-l-4 border-[#d4af37] pl-4">O que está incluído:</h3>
            <ul class="space-y-4">
              ${offerData.deliverables.map((d: string) => `
                <li class="flex items-start gap-3 text-zinc-300">
                  <span class="text-[#d4af37] mt-1 shrink-0">✔</span>
                  <span>${d}</span>
                </li>
              `).join('')}
            </ul>
          </section>
          <section class="space-y-6">
            <h3 class="text-xl font-bold border-l-4 border-zinc-700 pl-4">Cronograma & Entrega:</h3>
            <div class="glass p-6 rounded-2xl">
              <div class="text-[#d4af37] font-bold mb-2">${offerData.timeline}</div>
              <p class="text-sm text-zinc-500">${offerData.guarantees}</p>
            </div>
          </section>
        </div>

        <!-- CTA -->
        <footer class="text-center pt-12">
          <button id="cta-button" class="px-12 py-5 bg-[#d4af37] text-black text-xl font-black rounded-2xl hover:bg-[#b8962e] transition-all transform hover:scale-105">
            Agendar Call Estratégica
          </button>
          <p class="mt-6 text-zinc-600 text-xs">Vagas limitadas por trimestre para garantir qualidade na implementação.</p>
        </footer>
      </div>

      <script>
        document.getElementById('cta-button').addEventListener('click', () => {
          fetch('/api/public/offers/${offer.publishedSlug}/cta', { method: 'POST' })
            .then(() => alert('Sua solicitação foi enviada! Entraremos em contato via WhatsApp em breve.'));
        });
      </script>
    </body>
    </html>
  `;
}

/**
 * Builds a proposal template based on the offer content.
 */
export function buildProposalTemplate(offer: any): string {
    const data = typeof offer.offerJson === 'string' ? JSON.parse(offer.offerJson) : offer.offerJson;
    return `PROPOSTA COMERCIAL: ${offer.name}\n\nPromessa: ${data.promise}\nPreço: ${offer.currency} ${offer.priceCents / 100}\n\nEntregáveis:\n${data.deliverables.join('\n- ')}`;
}

/**
 * Builds a contract draft based on the offer content.
 */
export function buildContractTemplate(offer: any): string {
    const data = typeof offer.offerJson === 'string' ? JSON.parse(offer.offerJson) : offer.offerJson;
    return `CONTRATO DE PRESTAÇÃO DE SERVIÇOS\n\nContratada: InovaCortex\nObjeto: ${offer.name}\nValor: R$ ${offer.priceCents / 100}\n\nCláusula 1: ${data.promise}\nCláusula 2: ${data.guarantees}`;
}

/**
 * Prepares Stripe checkout configuration.
 */
export function buildStripeCheckoutConfig(offer: any) {
    return {
        name: offer.name,
        amount: offer.priceCents,
        currency: offer.currency.toLowerCase(),
        quantity: 1,
        mode: "payment"
    };
}
