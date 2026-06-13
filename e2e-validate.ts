import crypto from 'crypto';

const WHATSAPP_WEBHOOK_URL = 'http://localhost:3000/api/webhooks/meta';
const META_APP_SECRET = '890761234567890abcdef1234567890a'; // Must match .env

function calculateSignature(payload: string) {
    return 'sha256=' + crypto.createHmac('sha256', META_APP_SECRET).update(payload).digest('hex');
}

async function sendWebhook(payload: any) {
    const body = JSON.stringify(payload);
    const signature = calculateSignature(body);

    console.log(`Sending webhook to ${WHATSAPP_WEBHOOK_URL}...`);
    
    let attempt = 0;
    const maxAttempts = 3;
    
    while (attempt < maxAttempts) {
        try {
            const response = await fetch(WHATSAPP_WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Hub-Signature-256': signature,
                },
                body,
            });

            console.log(`Status: ${response.status} ${response.statusText}`);
            const data = await response.text();
            if (response.ok) return data;
            
            console.error(`Error response: ${data}`);
        } catch (error) {
            console.error(`Fetch error: ${error}`);
        }
        
        attempt++;
        if (attempt < maxAttempts) {
            console.log(`Retrying in 2 seconds... (attempt ${attempt + 1}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    throw new Error('Failed to send webhook after multiple attempts');
}

async function main() {
    console.log('--- Phase 1: New Contact/Conversation/Message ---');
    const payload1 = {
        object: 'whatsapp_business_account',
        entry: [{
            id: 'WABA_ID',
            changes: [{
                value: {
                    messaging_product: 'whatsapp',
                    metadata: { display_phone_number: '5511999999999', phone_number_id: 'PHONE_ID' },
                    contacts: [{ profile: { name: 'E2E Test User' }, wa_id: '5511888888888' }],
                    messages: [{
                        from: '5511888888888',
                        id: 'msg_' + Date.now(),
                        timestamp: Math.floor(Date.now() / 1000),
                        text: { body: 'Hello from E2E validation!' },
                        type: 'text'
                    }]
                },
                field: 'messages'
            }]
        }]
    };
    await sendWebhook(payload1);

    console.log('\n--- Phase 2: Reactivate Archived Conversation ---');
    // We send another message for the same contact
    const payload2 = {
        object: 'whatsapp_business_account',
        entry: [{
            id: 'WABA_ID',
            changes: [{
                value: {
                    messaging_product: 'whatsapp',
                    metadata: { display_phone_number: '5511999999999', phone_number_id: 'PHONE_ID' },
                    contacts: [{ profile: { name: 'E2E Test User' }, wa_id: '5511888888888' }],
                    messages: [{
                        from: '5511888888888',
                        id: 'msg_reactivate_' + Date.now(),
                        timestamp: Math.floor(Date.now() / 1000),
                        text: { body: 'This should reuse/reopen conversation if archived' },
                        type: 'text'
                    }]
                },
                field: 'messages'
            }]
        }]
    };
    await sendWebhook(payload2);

    console.log('\nE2E Validation simulation triggered. Check logs and DB/UI for results.');
}

main().catch(console.error);
