"use client";

import { Copy, ExternalLink, Check, Download } from "lucide-react";
import { useState } from "react";

export function AdminActions({
    slug,
    score,
    name,
    assessmentId,
    whatsappConsent,
    lastMessageStatus
}: {
    slug: string;
    score: number;
    name: string;
    assessmentId: string;
    whatsappConsent: boolean;
    lastMessageStatus?: string;
}) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        const text = `Olá ${name}! Acabei de analisar seu Dossiê de Diagnóstico da InovaCortex.\n\nSeu Potencial de Automação foi: ${score}/100. \n\nPreparei um roadmap de 30 dias para estruturarmos sua operação. Acesse o dossiê completo aqui:\nhttps://inovacortex.com.br/diagnostico/${slug}\n\nConsegue um espaço na agenda essa semana para detalharmos?`;

        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex justify-end gap-2">
            <button
                onClick={handleCopy}
                className="inline-flex items-center text-xs font-medium bg-background/50 border border-border hover:bg-muted px-2.5 py-1.5 rounded transition-colors"
                title="Copiar mensagem p/ WhatsApp"
            >
                {copied ? <Check className="w-3.5 h-3.5 mr-1.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
                {copied ? "Copiado!" : "WhatsApp"}
            </button>
            <a
                href={`/api/pdf/${slug}`}
                download
                className="inline-flex items-center text-xs font-medium bg-background/50 border border-border hover:bg-muted px-2.5 py-1.5 rounded transition-colors"
                title="Transcrever para PDF"
            >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                PDF
            </a>
            <a
                href={`/diagnostico/${slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-xs font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 px-2.5 py-1.5 rounded transition-colors"
                title="Abrir Dossiê Público"
            >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                Dossiê Público
            </a>
            <button
                onClick={whatsappConsent ? () => {
                    fetch('/api/whatsapp/send', {
                        method: 'POST',
                        body: JSON.stringify({ assessmentId }),
                        headers: { 'Content-Type': 'application/json' }
                    }).then(() => alert("Comando enviado para a Meta API."));
                } : handleCopy}
                className={`inline-flex items-center text-xs font-medium border px-2.5 py-1.5 rounded transition-colors ${lastMessageStatus === 'delivered' || lastMessageStatus === 'read' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-background/50 border-border hover:bg-muted'}`}
                title={whatsappConsent ? "Reenviar WhatsApp" : "Sem consentimento - Copiar mensagem"}
            >
                {lastMessageStatus === 'delivered' || lastMessageStatus === 'read' ? <Check className="w-3.5 h-3.5 mr-1.5 text-green-500" /> : null}
                {whatsappConsent ? "Reenviar WPP" : "Copiar Mensagem"}
            </button>
        </div>
    );
}
