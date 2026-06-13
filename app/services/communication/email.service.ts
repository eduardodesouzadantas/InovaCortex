import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_fallback');

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail({ to, subject, html, from }: SendEmailOptions) {
  try {
    const fromAddress = from || process.env.EMAIL_FROM_ADDRESS || 'noreply@inovacortex.com';
    
    // When no API key is present or we are in 'test' environment, just log for safety and tracking
    if (!process.env.RESEND_API_KEY || process.env.NODE_ENV === 'test') {
      console.log(`[EmailService] Simulated email to ${to} | Subject: "${subject}"`);
      return { success: true, simulated: true };
    }

    const { data, error } = await resend.emails.send({
        from: fromAddress,
        to: [to],
        subject,
        html,
    });

    if (error) {
      console.error("[EmailService] Resend API error:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err) {
    console.error("[EmailService] Unexpected error sending email:", err);
    return { success: false, error: err };
  }
}
