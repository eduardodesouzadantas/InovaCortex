"use client";

import { useState } from "react";
import {
    Settings,
    ShieldCheck,
    Key,
    Webhook,
    Bell,
    Save,
    Copy,
    CheckCircle2,
    ExternalLink,
    Smartphone
} from "lucide-react";

export function SettingsTab() {
    const [activeSubtab, setActiveSubtab] = useState("api");
    const [saved, setSaved] = useState(false);

    const handleSave = () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    const sections = [
        { id: "api", label: "Conexão Meta", icon: Key },
        { id: "compliance", label: "Privacidade & LGPD", icon: ShieldCheck },
        { id: "notifications", label: "Notificações", icon: Bell },
    ];

    return (
        <div className="flex h-full overflow-hidden">
            {/* Settings Sub-nav */}
            <aside className="w-64 border-r border-white/5 bg-black/10 p-6 flex flex-col gap-2">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-4 px-2">Configurações</h3>
                {sections.map((s) => (
                    <button
                        key={s.id}
                        onClick={() => setActiveSubtab(s.id)}
                        className={`
              flex items-center gap-3 p-3 rounded-xl transition-all text-xs font-bold uppercase tracking-widest
              ${activeSubtab === s.id ? "bg-gold text-black shadow-lg shadow-gold/10" : "text-white/40 hover:text-white/60 hover:bg-white/5"}
            `}
                    >
                        <s.icon className="w-4 h-4" />
                        {s.label}
                    </button>
                ))}
            </aside>

            {/* Settings Form Content */}
            <main className="flex-1 p-10 overflow-y-auto custom-scrollbar">
                {activeSubtab === "api" && (
                    <div className="max-w-2xl flex flex-col gap-10 animate-in fade-in slide-in-from-right-4">
                        <section>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-2xl bg-gold/10 flex items-center justify-center text-gold">
                                    <Smartphone className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white/90">WhatsApp Cloud API</h2>
                                    <p className="text-sm text-white/40">Configure suas credenciais do Meta Business Manager.</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Phone Number ID</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            defaultValue="102938475610293"
                                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/80 focus:outline-none focus:border-gold/40 transition-all font-mono"
                                        />
                                        <button className="p-3 bg-white/5 border border-white/10 rounded-xl hover:text-gold transition-colors"><Copy className="w-4 h-4" /></button>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Access Token (Permanent)</label>
                                    <input
                                        type="password"
                                        defaultValue="EAAZA1234567890abcdefghijklmno"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/80 focus:outline-none focus:border-gold/40 transition-all font-mono"
                                    />
                                </div>

                                <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 flex items-start gap-4">
                                    <Webhook className="w-6 h-6 text-blue-500 shrink-0 mt-1" />
                                    <div className="flex-1">
                                        <h4 className="text-sm font-bold text-blue-500">Webhook Endpoint</h4>
                                        <p className="text-xs text-white/40 mt-1 leading-relaxed">
                                            Utilize esta URL no painel do Meta para receber eventos em tempo real.
                                        </p>
                                        <div className="mt-3 p-2 bg-black/40 rounded-lg border border-white/5 flex items-center justify-between">
                                            <code className="text-[10px] text-blue-400">https://inovacortex.com/api/webhooks/meta</code>
                                            <button className="text-[10px] text-white/30 hover:text-white/60">Copiar</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                )}

                {activeSubtab === "compliance" && (
                    <div className="max-w-2xl flex flex-col gap-10 animate-in fade-in slide-in-from-right-4">
                        <section>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                                    <ShieldCheck className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white/90">Regras de Compliance</h2>
                                    <p className="text-sm text-white/40">Gerencie o consentimento e a janela de 24 horas.</p>
                                </div>
                            </div>

                            <div className="space-y-8">
                                <div className="flex items-center justify-between p-6 rounded-3xl bg-white/[0.02] border border-white/5">
                                    <div>
                                        <h4 className="text-sm font-bold text-white/80">Janela de 24h Estrita</h4>
                                        <p className="text-xs text-white/30 mt-1">Bloqueia automaticamente o envio de mensagens livres fora da janela.</p>
                                    </div>
                                    <div className="w-12 h-6 rounded-full bg-gold/20 border border-gold/40 relative">
                                        <div className="absolute right-1 top-1 w-4 h-4 bg-gold rounded-full shadow-lg" />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-6 rounded-3xl bg-white/[0.02] border border-white/5 opacity-50">
                                    <div>
                                        <h4 className="text-sm font-bold text-white/80">Double Opt-in</h4>
                                        <p className="text-xs text-white/30 mt-1">Envia uma mensagem de confirmação antes de disparar campanhas.</p>
                                    </div>
                                    <div className="w-12 h-6 rounded-full bg-white/10 border border-white/10 relative">
                                        <div className="absolute left-1 top-1 w-4 h-4 bg-white/40 rounded-full" />
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                )}

                <div className="mt-12 flex items-center justify-between pt-10 border-t border-white/5">
                    <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white/60">
                        <ExternalLink className="w-4 h-4" />
                        Documentação Meta
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 px-8 py-3 bg-gold text-black rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gold/90 transition-all shadow-lg shadow-gold/20"
                    >
                        {saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                        {saved ? "Configurações Salvas" : "Salvar Alterações"}
                    </button>
                </div>
            </main>
        </div>
    );
}
