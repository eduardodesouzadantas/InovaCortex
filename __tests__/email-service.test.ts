import { sendEmail } from "../app/services/communication/email.service";

describe("email.service", () => {
    it("should simulate sending email when locally or missing key", async () => {
        // Ensure dummy condition
        const oldKey = process.env.RESEND_API_KEY;
        delete process.env.RESEND_API_KEY;

        const result = await sendEmail({
            to: "test@example.com",
            subject: "Welcome",
            html: "<b>Hello</b>",
        });

        expect(result.success).toBe(true);
        expect((result as any).simulated).toBe(true);
        
        // Cleanup
        if (oldKey) {
            process.env.RESEND_API_KEY = oldKey;
        }
    });
});
