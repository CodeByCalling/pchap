"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPasswordResetLink = exports.sendSupervisorConfirmation = exports.sendSupervisorRequest = exports.sendEmail = void 0;
const nodemailer = require("nodemailer");
const functions = require("firebase-functions/v1");
let transporter = null;
function getTransporter() {
    var _a, _b;
    if (!transporter) {
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.SMTP_EMAIL || ((_a = functions.config().smtp) === null || _a === void 0 ? void 0 : _a.email),
                pass: process.env.SMTP_PASSWORD || ((_b = functions.config().smtp) === null || _b === void 0 ? void 0 : _b.password)
            }
        });
    }
    return transporter;
}
async function sendEmail(to, subject, text) {
    var _a, _b, _c;
    // Check credentials before trying to get transporter
    if ((!process.env.SMTP_EMAIL && !((_a = functions.config().smtp) === null || _a === void 0 ? void 0 : _a.email)) ||
        (!process.env.SMTP_PASSWORD && !((_b = functions.config().smtp) === null || _b === void 0 ? void 0 : _b.password))) {
        console.warn('SMTP credentials not set. Email not sent:', { to, subject });
        return;
    }
    try {
        const mailTrigger = getTransporter();
        const mailOptions = {
            from: `"Pastoral Care Health Assistance Program (PCHAP)" <${process.env.SMTP_EMAIL || ((_c = functions.config().smtp) === null || _c === void 0 ? void 0 : _c.email)}>`,
            to: to,
            subject: subject,
            text: text
        };
        await mailTrigger.sendMail(mailOptions);
        console.log(`Email sent to ${to}`);
    }
    catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
}
exports.sendEmail = sendEmail;
async function sendSupervisorRequest(to, supervisorName, applicantName, endorsementLink) {
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
exports.sendSupervisorRequest = sendSupervisorRequest;
async function sendSupervisorConfirmation(to, supervisorName, applicantName, action) {
    const subject = `Endorsement Submitted: ${applicantName}`;
    const text = `Dear ${supervisorName},\n\n` +
        `This email confirms that you have successfully ${action.toUpperCase()} the application for ${applicantName}.\n\n` +
        `Thank you for your time.\n\n` +
        `PCHAP Admin Team`;
    await sendEmail(to, subject, text);
}
exports.sendSupervisorConfirmation = sendSupervisorConfirmation;
async function sendPasswordResetLink(to, resetLink) {
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
exports.sendPasswordResetLink = sendPasswordResetLink;
//# sourceMappingURL=emailService.js.map