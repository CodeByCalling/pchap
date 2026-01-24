"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resendSupervisorEmail = exports.onContributionStatusChange = exports.onApplicationStatusChange = exports.sendPaymentReminder = exports.chatWithCounselor = void 0;
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const generative_ai_1 = require("@google/generative-ai");
const knowledge_base_1 = require("./knowledge_base");
const emailService_1 = require("./emailService");
admin.initializeApp();
const db = admin.firestore();
exports.chatWithCounselor = functions.runWith({
    timeoutSeconds: 60,
    memory: "512MB"
}).https.onCall(async (data, context) => {
    var _a, _b;
    // 1. Validation
    const userMessage = data.message;
    if (!userMessage || typeof userMessage !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a "message" argument.');
    }
    const language = data.language || 'english'; // Default to English
    const history = data.history || [];
    // 2. Select Style Guide
    const styleGuide = language === 'taglish' ? knowledge_base_1.TAGLISH_STYLE_GUIDE : knowledge_base_1.ENGLISH_STYLE_GUIDE;
    const finalSystemPrompt = `${styleGuide}\n\n${knowledge_base_1.BASE_SYSTEM_INSTRUCTION}`;
    // 3. Construct Proxy Logic
    try {
        functions.logger.info("Function triggered. Checking config...");
        // Support both process.env (Gen 2) and functions.config (Gen 1)
        const apiKey = process.env.GEMINI_API_KEY || ((_a = functions.config().gemini) === null || _a === void 0 ? void 0 : _a.key);
        functions.logger.info(`API Key present: ${!!apiKey}`);
        if (!apiKey || apiKey === "YOUR_API_KEY_HERE") {
            functions.logger.error("CRITICAL: GEMINI_API_KEY is missing.");
            throw new functions.https.HttpsError('failed-precondition', 'Server configuration error: API Key missing.');
        }
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        // Using user-requested low-cost model
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
        functions.logger.info("Model initialized: gemini-2.0-flash-lite. Starting chat...");
        // Prepare the chat session
        const chat = model.startChat({
            history: [
                {
                    role: "user",
                    parts: [{ text: `System Instruction: ${finalSystemPrompt}` }]
                },
                {
                    role: "model",
                    parts: [{ text: "Understood. I am ready to assist as the PCHAP Smart-Counselor." }]
                },
                ...history
            ],
            generationConfig: {
                maxOutputTokens: 1000,
            }
        });
        functions.logger.info("Sending message to Gemini...");
        const result = await chat.sendMessage(userMessage);
        const response = result.response;
        const text = response.text ? response.text() : "I'm sorry, I couldn't generate a response.";
        functions.logger.info("Response received successfully.");
        return { answer: text };
    }
    catch (error) {
        functions.logger.error("Error calling Gemini:", error);
        // Differentiate errors
        if ((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes('API Key')) {
            throw new functions.https.HttpsError('failed-precondition', 'Server config missing API Key.');
        }
        // Pass through the actual Gemini error message for debugging
        throw new functions.https.HttpsError('internal', `Gemini Error: ${error.message}`);
    }
});
// -------------------------------------------------------------
// NOTIFICATION SYSTEM (PRD 6.2)
// -------------------------------------------------------------
// 1. Scheduled Payment Reminder
// Runs every day at 09:00 Manila time
exports.sendPaymentReminder = functions.pubsub.schedule('0 9 * * *')
    .timeZone('Asia/Manila')
    .onRun(async (context) => {
    const today = new Date();
    // Only run if it's after the 25th of the month
    if (today.getDate() <= 25) {
        console.log('It is not past the 25th yet. Skipping checks.');
        return null;
    }
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    console.log(`Running Payment Reminder for: ${currentMonthStr}`);
    try {
        // Get all approved applications
        const appsSnapshot = await db.collection('applications')
            .where('finalApprovalStatus', '==', 'approved')
            .get();
        if (appsSnapshot.empty) {
            console.log('No approved members found.');
            return null;
        }
        const reminderPromises = appsSnapshot.docs.map(async (doc) => {
            var _a, _b;
            const userData = doc.data();
            const userId = doc.id;
            // personalInfo structure contains email
            const email = ((_a = userData.personalInfo) === null || _a === void 0 ? void 0 : _a.email) || userData.email;
            const firstName = ((_b = userData.personalInfo) === null || _b === void 0 ? void 0 : _b.firstname) || 'Member';
            if (!email) {
                console.log(`User ${userId} has no email. Skipping.`);
                return;
            }
            // Check for contribution in current month
            const contribQuery = await db.collection('contributions')
                .where('userId', '==', userId)
                .where('month', '==', currentMonthStr)
                .where('status', 'in', ['confirmed', 'pending']) // Pending also counts as submitted
                .limit(1)
                .get();
            if (contribQuery.empty) {
                console.log(`Sending reminder to ${email} for ${currentMonthStr}`);
                await (0, emailService_1.sendEmail)(email, 'PCHAP Contribution Reminder', `Dear ${firstName},\n\n` +
                    `This is a gentle reminder that we haven't received your contribution for ${currentMonthStr} yet.\n` +
                    `Please log in to your dashboard to upload your receipt before the end of the month to maintain your eligibility streaks.\n\n` +
                    `Login here: https://pchap.com/ \n\n` +
                    `Thank you,\nPCHAP Team`);
            }
        });
        await Promise.all(reminderPromises);
        console.log('Payment reminder check completed.');
    }
    catch (error) {
        console.error('Error in sendPaymentReminder:', error);
    }
    return null;
});
// 2. On Application Status Change
exports.onApplicationStatusChange = functions.firestore
    .document('applications/{userId}')
    .onUpdate(async (change, context) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const before = change.before.data();
    const after = change.after.data();
    const userId = context.params.userId;
    // Check for transition to APPROVED
    if (before.finalApprovalStatus !== 'approved' && after.finalApprovalStatus === 'approved') {
        // Idempotency Check
        if ((_a = after.emailSentFlags) === null || _a === void 0 ? void 0 : _a.welcomeEmail) {
            console.log(`Welcome email already sent to ${userId}. Skipping.`);
            return null;
        }
        const email = ((_b = after.personalInfo) === null || _b === void 0 ? void 0 : _b.email) || after.email;
        const firstName = ((_c = after.personalInfo) === null || _c === void 0 ? void 0 : _c.firstname) || 'Member';
        if (email) {
            await (0, emailService_1.sendEmail)(email, 'Welcome to PCHAP! - Application Approved', `Dear ${firstName},\n\n` +
                `Congratulations! Your application for the Pastor's Care Health Assistance Program (PCHAP) has been officially APPROVED.\n\n` +
                `You are now a verified member. You can access your Member Dashboard to begin tracking your contribution history and eligibility status.\n\n` +
                `Login here: https://pchap.com/ \n\n` +
                `Welcome to the family!\n` +
                `PCHAP Admin Team`);
            console.log(`Sent approval email to ${email}`);
            // Mark as sent
            await change.after.ref.update({
                'emailSentFlags.welcomeEmail': admin.firestore.FieldValue.serverTimestamp()
            });
        }
    }
    // Check for Return/Rejected Trigger
    if ((before.adminReviewStatus !== 'rejected' && after.adminReviewStatus === 'rejected') ||
        (before.adminReviewStatus !== 'returned' && after.adminReviewStatus === 'returned')) {
        const email = ((_d = after.personalInfo) === null || _d === void 0 ? void 0 : _d.email) || after.email;
        const firstName = ((_e = after.personalInfo) === null || _e === void 0 ? void 0 : _e.firstname) || 'Applicant';
        if (email) {
            await (0, emailService_1.sendEmail)(email, 'PCHAP Application Update - Action Required', `Dear ${firstName},\n\n` +
                `Your application requires some changes. An administrator has reviewed your documents and requested corrections.\n\n` +
                `Please log in to your dashboard to view the Admin Notes and update your application accordingly.\n\n` +
                `Login here: https://pchap.com/ \n\n` +
                `Thank you,\nPCHAP Admin Team`);
        }
    }
    // Supervisor Confirmation Trigger
    if (before.pastorEndorsementStatus !== 'approved' && after.pastorEndorsementStatus === 'approved') {
        const supervisor = (_f = after.personalInfo) === null || _f === void 0 ? void 0 : _f.supervisor;
        const applicantName = `${(_g = after.personalInfo) === null || _g === void 0 ? void 0 : _g.firstname} ${(_h = after.personalInfo) === null || _h === void 0 ? void 0 : _h.surname}`;
        if (supervisor === null || supervisor === void 0 ? void 0 : supervisor.email) {
            const { sendSupervisorConfirmation } = await Promise.resolve().then(() => require('./emailService'));
            await sendSupervisorConfirmation(supervisor.email, supervisor.name || 'Pastor', applicantName, 'approved');
            console.log(`Sent supervisor confirmation to ${supervisor.email}`);
        }
    }
    return null;
});
// 3. On Payment Confirmed (Receipt Acknowledgment)
exports.onContributionStatusChange = functions.firestore
    .document('contributions/{contributionId}')
    .onUpdate(async (change, context) => {
    var _a, _b;
    const before = change.before.data();
    const after = change.after.data();
    const contributionId = context.params.contributionId;
    // Trigger on status change to 'confirmed'
    if (before.status !== 'confirmed' && after.status === 'confirmed') {
        // Idempotency Check
        if (after.receiptSent) {
            console.log(`Receipt email already sent for contribution ${contributionId}. Skipping.`);
            return null;
        }
        const userId = after.userId;
        const month = after.month; // e.g. "2023-10"
        const amount = after.amount;
        try {
            // Fetch User Details for Email
            const userDoc = await db.collection('applications').doc(userId).get();
            if (!userDoc.exists) {
                console.log(`User ${userId} not found for contribution ${contributionId}`);
                return null;
            }
            const userData = userDoc.data();
            const email = ((_a = userData === null || userData === void 0 ? void 0 : userData.personalInfo) === null || _a === void 0 ? void 0 : _a.email) || (userData === null || userData === void 0 ? void 0 : userData.email);
            const firstName = ((_b = userData === null || userData === void 0 ? void 0 : userData.personalInfo) === null || _b === void 0 ? void 0 : _b.firstname) || 'Member';
            if (email) {
                await (0, emailService_1.sendEmail)(email, 'Payment Confirmed - PCHAP Contribution', `Dear ${firstName},\n\n` +
                    `We have received and confirmed your contribution for the month of ${month}.\n` +
                    `Amount: PHP ${amount}\n\n` +
                    `Thank you for your faithfulness. Your eligibility streak has been updated.\n\n` +
                    `PCHAP Admin Team`);
                // Mark as sent
                await change.after.ref.update({
                    receiptSent: true,
                    receiptSentAt: admin.firestore.FieldValue.serverTimestamp()
                });
                console.log(`Sent receipt email to ${email} for contribution ${contributionId}`);
            }
        }
        catch (error) {
            console.error(`Error processing contribution ${contributionId}:`, error);
        }
    }
    return null;
});
// 4. Manual Trigger: Resend Supervisor Email
exports.resendSupervisorEmail = functions.https.onCall(async (data, context) => {
    var _a, _b, _c;
    // Authentication Check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
    const { applicantId, newEmail } = data;
    if (!applicantId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing applicantId.');
    }
    try {
        const docRef = db.collection('applications').doc(applicantId);
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Application not found.');
        }
        const appData = docSnap.data();
        // Authorization: Owner OR Admin
        const isOwner = context.auth.uid === applicantId;
        const isAdmin = context.auth.token.email && (context.auth.token.email.includes('admin') || context.auth.token.email === 'osher@pchap.org'); // Basic admin check
        if (!isOwner && !isAdmin) {
            throw new functions.https.HttpsError('permission-denied', 'Not authorized.');
        }
        let supervisor = (_a = appData === null || appData === void 0 ? void 0 : appData.personalInfo) === null || _a === void 0 ? void 0 : _a.supervisor;
        // Update Email if provided
        if (newEmail) {
            await docRef.update({
                'personalInfo.supervisor.email': newEmail
            });
            // Update local object for sending
            if (!supervisor)
                supervisor = {};
            supervisor.email = newEmail;
        }
        if (!supervisor || !supervisor.email) {
            throw new functions.https.HttpsError('failed-precondition', 'No supervisor email found in application.');
        }
        // Generate the endorsement link again
        // Note: The token should already exist in the doc.
        const token = appData === null || appData === void 0 ? void 0 : appData.pastorEndorsementToken;
        if (!token) {
            throw new functions.https.HttpsError('failed-precondition', 'Endorsement token missing. Please contact support.');
        }
        // Construct Link (Assuming hardcoded for now or based on request origin if possible, but cloud functions don't know client origin easily. Using production URL or config.)
        // Ideally pass origin from client, but for security, we use known domain.
        const origin = "https://pchap.site"; // Hardcoded for production safety
        const endorsementLink = `${origin}/#endorse?token=${token}`;
        const { sendSupervisorRequest } = await Promise.resolve().then(() => require('./emailService'));
        await sendSupervisorRequest(supervisor.email, supervisor.name || 'Pastor', `${(_b = appData === null || appData === void 0 ? void 0 : appData.personalInfo) === null || _b === void 0 ? void 0 : _b.firstname} ${(_c = appData === null || appData === void 0 ? void 0 : appData.personalInfo) === null || _c === void 0 ? void 0 : _c.surname}`, endorsementLink);
        return { success: true, message: `Email sent to ${supervisor.email}` };
    }
    catch (error) {
        console.error('Error resending supervisor email:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
//# sourceMappingURL=index.js.map