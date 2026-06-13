"use client";

import { useParams } from "next/navigation";
import { WhatsAppCRMClient } from "./whatsapp-crm-client";

export default function WhatsAppCRMPage() {
    const params = useParams();
    const slug = params.slug as string;
    return <WhatsAppCRMClient slug={slug} />;
}
