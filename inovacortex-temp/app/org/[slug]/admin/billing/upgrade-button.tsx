"use client";

import { useState } from "react";
import { Loader2, ExternalLink, MessageCircle } from "lucide-react";

interface Props {
    plan: string;
    label: string;
    stripeEnabled: boolean;
    orgSlug: string;
    isEnterprise?: boolean;
}

export function BillingUpgradeButton({ plan, label, stripeEnabled, orgSlug, isEnterprise }: Props) {
    const [isLoading, setIsLoading] = useState(false);

    if (isEnterprise || !stripeEnabled) {
        return (
            <a
                href={`mailto:contato@inovacortex.com?subject=Upgrade para ${plan.toUpperCase()}&body=Organização: ${orgSlug}`}
                className="btn-secondary flex items-center gap-2 text-sm"
            >
                <MessageCircle className="w-4 h-4" />
                {label}
            </a>
        );
    }

    const handleUpgrade = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/stripe/create-checkout-session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ plan }),
            });
            const data = await res.json();

            if (data.stubMode) {
                alert("Stripe não está configurado. Configure STRIPE_SECRET_KEY para ativar pagamentos.");
                return;
            }
            if (data.url) {
                window.location.href = data.url;
            }
        } catch {
            alert("Erro ao iniciar checkout. Tente novamente.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <button
            onClick={handleUpgrade}
            disabled={isLoading}
            className="btn-primary flex items-center gap-2 text-sm"
        >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
            {isLoading ? "Redirecionando..." : label}
        </button>
    );
}
