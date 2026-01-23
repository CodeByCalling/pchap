import * as nodemailer from 'nodemailer';
import * as functions from 'firebase-functions/v1';

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            service: 'gmail', 
            auth: {
                user: process.env.SMTP_EMAIL || (functions as any).config().smtp?.email,
                pass: process.env.SMTP_PASSWORD || (functions as any).config().smtp?.password
            }
        });
    }
    return transporter;
}

export async function sendEmail(to: string, subject: string, text: string) {
    // Check credentials before trying to get transporter
    if ((!process.env.SMTP_EMAIL && !(functions as any).config().smtp?.email) || 
        (!process.env.SMTP_PASSWORD && !(functions as any).config().smtp?.password)) {
        console.warn('SMTP credentials not set. Email not sent:', { to, subject });
        return;
    }

    try {
        const mailTrigger = getTransporter();
        const mailOptions = {
            from: `"PCHAP Notifications" <${process.env.SMTP_EMAIL || (functions as any).config().smtp?.email}>`,
            to: to,
            subject: subject,
            text: text
        };

        await mailTrigger.sendMail(mailOptions);
        console.log(`Email sent to ${to}`);
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
}
