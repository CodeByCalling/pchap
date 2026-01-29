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
            from: `"Pastoral Care Health Assistance Program (PCHAP)" <${process.env.SMTP_EMAIL || (functions as any).config().smtp?.email}>`,
            replyTo: 'jrmpchap@gmail.com', // Added Reply-To as requested
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

export async function sendSupervisorRequest(
    to: string, 
    supervisorName: string, 
    applicantName: string, 
    endorsementLink: string
) {
    const subject = `Endorsement Request: ${applicantName} - PCHAP Membership`;
    const text = `Dear ${supervisorName},\n\n` +
                 `Pastor's Care Health Assistance Program (PCHAP) received a membership application from ${applicantName}, who listed you as their supervisor/senior pastor.\n\n` +
                 `Your endorsement is required for their application to proceed.\n\n` +
                 `Please click the link below to review and endorse the application:\n` +
                 `${endorsementLink}\n\n` +
                 `If you did not authorize this, please ignore this email or contact us.\n\n` +
                 `Thank you,\nPCHAP Admin Team`;
    
    await sendEmail(to, subject, text);
}

export async function sendSupervisorConfirmation(
    to: string,
    supervisorName: string,
    applicantName: string,
    action: 'approved' | 'rejected'
) {
    const subject = `Endorsement Submitted: ${applicantName}`;
    const text = `Dear ${supervisorName},\n\n` +
                 `This email confirms that you have successfully ${action.toUpperCase()} the application for ${applicantName}.\n\n` +
                 `Thank you for your time.\n\n` +
                 `PCHAP Admin Team`;

    await sendEmail(to, subject, text);
}

// Helper to format application data into text
function formatApplicationBody(data: any): string {
    const p = data.personalInfo || {};
    const addr = p.address || {};
    const fullAddress = `${addr.houseStreet || ''}, ${addr.barangay || ''}, ${addr.city || ''}, ${addr.province || ''}, ${addr.zipCode || ''}`;
    
    // Arrays
    const health = Array.isArray(data.healthList) ? data.healthList : (Array.isArray(data.health) ? data.health : []);
    const disclosures = Array.isArray(data.disclosureList) ? data.disclosureList : (Array.isArray(data.disclosure) ? data.disclosure : []);
    const beneficiaries = Array.isArray(data.beneficiaries) ? data.beneficiaries : [];

    let text = `APPLICATION REFERENCE: ${data.userId || 'N/A'}\n`;
    text += `DATE SUBMITTED: ${new Date().toLocaleString()}\n\n`;

    text += `=== PERSONAL INFORMATION ===\n`;
    text += `Name: ${p.firstname} ${p.surname}\n`;
    text += `Birthday: ${p.birthday}\n`;
    text += `Civil Status: ${p.civilStatus}\n`;
    text += `Email: ${data.email}\n`;
    text += `Mobile: ${p.mobileNumber || 'N/A'}\n`;
    text += `Landline: ${p.landline || 'N/A'}\n`;
    text += `Address: ${fullAddress}\n\n`;

    text += `=== MINISTRY INFORMATION ===\n`;
    text += `Outreach/Church: ${p.outreach}\n`;
    text += `Position: ${p.jobTitle}\n`;
    text += `Supervisor: ${p.supervisor?.name || 'N/A'} (${p.supervisor?.email || 'N/A'})\n\n`;

    text += `=== BENEFICIARIES ===\n`;
    if (beneficiaries.length > 0) {
        beneficiaries.forEach((b: any, i: number) => {
            text += `${i+1}. ${b.firstName} ${b.lastName} (${b.relationship}) - DOB: ${b.dob}\n`;
        });
    } else {
        text += `None declared.\n`;
    }
    text += `\n`;

    text += `=== HEALTH DECLARATION ===\n`;
    if (health.length > 0) {
        health.forEach((h: string) => text += `- ${h}\n`);
    } else {
        text += `No medical conditions declared.\n`;
    }
    text += `\n`;

    text += `=== DISCLOSURES & AGREEMENTS ===\n`;
    if (disclosures.length > 0) {
        disclosures.forEach((d: string) => text += `- [x] ${d}\n`);
    }
    text += `- [x] I certify that all information provided is true and correct.\n\n`;

    text += `=== SUBMITTED DOCUMENTS ===\n`;
    if (data.documents) {
        if (data.documents.idCard) text += `ID Card: ${data.documents.idCard}\n`;
        if (data.documents.photo) text += `Photo: ${data.documents.photo}\n`;
        if (data.documents.receipt) text += `Receipt: ${data.documents.receipt}\n`;
        if (data.documents.annexA) text += `Annex A: ${data.documents.annexA}\n`;
    } else {
        text += `No documents attached.\n`;
    }

    return text;
}

export async function sendApplicationSummary(
    to: string,
    data: any,
    isAdminCopy: boolean = false
) {
    const applicantName = `${data.personalInfo?.firstname} ${data.personalInfo?.surname}`;
    const subject = isAdminCopy 
        ? `[ADMIN RECORD] New Application: ${applicantName}` 
        : `Application Received - PCHAP`;

    let intro = isAdminCopy 
        ? `ADMIN COPY ONLY - DO NOT REPLY\n\nA new application has been received. Please find the full details below for record retention.\n`
        : `Dear ${applicantName},\n\nThank you very much, your application has been submitted successfully.\n\nHere is a copy of the information you submitted for your records:\n`;

    const body = formatApplicationBody(data);

    let outro = isAdminCopy
        ? `\nEnd of Record.`
        : `\n\nPlease ensure you have forwarded the endorsement link to your Senior Pastor. Your application will be processed once we receive their endorsement.\n\nIf you have any questions, you can reply to this email (jrmpchap@gmail.com).\n\nThank you,\nPCHAP Admin Team`;

    await sendEmail(to, subject, intro + "\n" + body + "\n" + outro);
}

export async function sendPasswordResetLink(to: string, resetLink: string) {
    // Note: In Firebase Auth, we usually use sendPasswordResetEmail from Client SDK or Admin SDK generatePasswordResetLink.
    // This function assumes we generated a link via Admin SDK and are sending it manually if needed, 
    // OR this is a notification wrapper. 
    // For this task, we will stick to standard Firebase Auth flows but this is here if custom method is needed.
    // We will implementing Admin SDK link generation in the caller.
    
    const subject = `Set Your PCHAP Password`;
    const text = `Hello,\n\n` +
                 `A PCHAP account has been created for you. Please click the link below to set your password and access your dashboard:\n\n` +
                 `${resetLink}\n\n` +
                 `If you did not request this, please contact support.\n\n` +
                 `PCHAP Admin Team`;

    await sendEmail(to, subject, text);
}
