"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = void 0;
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
            from: `"PCHAP Notifications" <${process.env.SMTP_EMAIL || ((_c = functions.config().smtp) === null || _c === void 0 ? void 0 : _c.email)}>`,
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
//# sourceMappingURL=emailService.js.map