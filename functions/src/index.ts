import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { BASE_SYSTEM_INSTRUCTION, TAGLISH_STYLE_GUIDE, ENGLISH_STYLE_GUIDE } from "./knowledge_base";
import { sendEmail } from './emailService';
admin.initializeApp();
const db = admin.firestore();

// -------------------------------------------------------------
// NEW: Automated Email Triggers (on Create)
// -------------------------------------------------------------

export const onApplicationCreate = functions.firestore
    .document('applications/{userId}')
    .onCreate(async (snap, context) => {
        const data = snap.data();
        const userId = context.params.userId;

        console.log(`New application created for ${userId}. Processing automated emails...`);

        try {
            // 1. Send Supervisor Endorsement Request
            const supervisor = data.personalInfo?.supervisor;
            const applicantName = `${data.personalInfo?.firstname} ${data.personalInfo?.surname}`;
            const token = data.pastorEndorsementToken;

            if (supervisor?.email && token) {
                // Construct Link
                // Note: Using hardcoded domain as cloud functions don't know the client host.
                // Ideally this should be an environment config, but for this specific request:
                const origin = "https://pchap.site"; 
                const endorsementLink = `${origin}/#endorse?token=${token}`;

                const { sendSupervisorRequest } = await import('./emailService');
                await sendSupervisorRequest(
                    supervisor.email,
                    supervisor.name || 'Pastor',
                    applicantName,
                    endorsementLink
                );
                console.log(`✅ Sent endorsement request to supervisor ${supervisor.email}`);
            } else {
                console.log('⚠️ Missing supervisor email or endorsement token. Skipping supervisor email.');
            }

            // 2. Send Applicant Confirmation & Admin Notification
            const applicantEmail = data.email || data.personalInfo?.email;
            if (applicantEmail) {
                const { sendApplicationSummary } = await import('./emailService');
                
                // Email 1: To Applicant
                await sendApplicationSummary(applicantEmail, data, false);
                console.log(`✅ Sent summary to applicant ${applicantEmail}`);

                // Email 2: To Admin
                const adminEmail = 'jrmpchap@gmail.com';
                await sendApplicationSummary(adminEmail, data, true);
                console.log(`✅ Sent summary to admin ${adminEmail}`);
            }

        } catch (error) {
            console.error('❌ Error in onApplicationCreate:', error);
        }
    });



export const chatWithCounselor = functions.runWith({
    timeoutSeconds: 60,
    memory: "512MB"
}).https.onCall(async (data, context) => {
    // 1. Validation
    const userMessage = data.message;
    if (!userMessage || typeof userMessage !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a "message" argument.');
    }

    const language = data.language || 'english'; // Default to English
    const history = data.history || [];

    // 2. Select Style Guide
    const styleGuide = language === 'taglish' ? TAGLISH_STYLE_GUIDE : ENGLISH_STYLE_GUIDE;
    const finalSystemPrompt = `${styleGuide}\n\n${BASE_SYSTEM_INSTRUCTION}`;

    // 3. Construct Proxy Logic
    try {
        functions.logger.info("Function triggered. Checking config...");
        
        // Support both process.env (Gen 2) and functions.config (Gen 1)
        const apiKey = process.env.GEMINI_API_KEY || (functions as any).config().gemini?.key;
        
        functions.logger.info(`API Key present: ${!!apiKey}`);

        if (!apiKey || apiKey === "YOUR_API_KEY_HERE") {
             functions.logger.error("CRITICAL: GEMINI_API_KEY is missing.");
             throw new functions.https.HttpsError('failed-precondition', 'Server configuration error: API Key missing.');
        }

        const genAI = new GoogleGenerativeAI(apiKey);
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

    } catch (error: any) {
        functions.logger.error("Error calling Gemini:", error);
        
        // Differentiate errors
        if (error.message?.includes('API Key')) {
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
export const sendPaymentReminder = functions.pubsub.schedule('0 9 * * *')
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
                const userData = doc.data();
                const userId = doc.id;
                // personalInfo structure contains email
                const email = userData.personalInfo?.email || userData.email; 
                const firstName = userData.personalInfo?.firstname || 'Member';

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
                    await sendEmail(
                        email, 
                        'PCHAP Contribution Reminder', 
                        `Dear ${firstName},\n\n` +
                        `This is a gentle reminder that we haven't received your contribution for ${currentMonthStr} yet.\n` +
                        `Please log in to your dashboard to upload your receipt before the end of the month to maintain your eligibility streaks.\n\n` +
                        `Login here: https://pchap.com/ \n\n` +
                        `Thank you,\nPCHAP Team`
                    );
                }
            });

            await Promise.all(reminderPromises);
            console.log('Payment reminder check completed.');

        } catch (error) {
            console.error('Error in sendPaymentReminder:', error);
        }
        return null;
    });


// 2. On Application Status Change
export const onApplicationStatusChange = functions.firestore
    .document('applications/{userId}')
    .onUpdate(async (change: any, context: any) => {
        const before = change.before.data();
        const after = change.after.data();
        const userId = context.params.userId;

        // Check for transition to APPROVED
        if (before.finalApprovalStatus !== 'approved' && after.finalApprovalStatus === 'approved') {
            // Idempotency Check
            if (after.emailSentFlags?.welcomeEmail) {
                console.log(`Welcome email already sent to ${userId}. Skipping.`);
                return null;
            }

            const email = after.personalInfo?.email || after.email;
            const firstName = after.personalInfo?.firstname || 'Member';

            if (email) {
                await sendEmail(
                    email,
                    'Welcome to PCHAP! - Application Approved',
                     `Dear ${firstName},\n\n` +
                     `Congratulations! Your application for the Pastor's Care Health Assistance Program (PCHAP) has been officially APPROVED.\n\n` +
                     `You are now a verified member. You can access your Member Dashboard to begin tracking your contribution history and eligibility status.\n\n` +
                     `Login here: https://pchap.com/ \n\n` +
                     `Welcome to the family!\n` +
                     `PCHAP Admin Team`
                );
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
             
             const email = after.personalInfo?.email || after.email;
             const firstName = after.personalInfo?.firstname || 'Applicant';
             
             if (email) {
                 await sendEmail(
                     email,
                     'PCHAP Application Update - Action Required',
                     `Dear ${firstName},\n\n` +
                     `Your application requires some changes. An administrator has reviewed your documents and requested corrections.\n\n` +
                     `Please log in to your dashboard to view the Admin Notes and update your application accordingly.\n\n` +
                     `Login here: https://pchap.com/ \n\n` +
                     `Thank you,\nPCHAP Admin Team`
                 );
             }
        }

        // Supervisor Confirmation Trigger
        if (before.pastorEndorsementStatus !== 'approved' && after.pastorEndorsementStatus === 'approved') {
            const supervisor = after.personalInfo?.supervisor;
            const applicantName = `${after.personalInfo?.firstname} ${after.personalInfo?.surname}`;
            
            if (supervisor?.email) {
                const { sendSupervisorConfirmation } = await import('./emailService');
                await sendSupervisorConfirmation(
                    supervisor.email, 
                    supervisor.name || 'Pastor', 
                    applicantName, 
                    'approved'
                );
                console.log(`Sent supervisor confirmation to ${supervisor.email}`);
            }
        }
        
        return null;
    });

// 3. On Payment Confirmed (Receipt Acknowledgment)
export const onContributionStatusChange = functions.firestore
    .document('contributions/{contributionId}')
    .onUpdate(async (change: any, context: any) => {
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
                const email = userData?.personalInfo?.email || userData?.email;
                const firstName = userData?.personalInfo?.firstname || 'Member';

                if (email) {
                    await sendEmail(
                        email,
                        'Payment Confirmed - PCHAP Contribution',
                        `Dear ${firstName},\n\n` +
                        `We have received and confirmed your contribution for the month of ${month}.\n` +
                        `Amount: PHP ${amount}\n\n` +
                        `Thank you for your faithfulness. Your eligibility streak has been updated.\n\n` +
                        `PCHAP Admin Team`
                    );
                    
                    // Mark as sent
                    await change.after.ref.update({
                        receiptSent: true,
                        receiptSentAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    console.log(`Sent receipt email to ${email} for contribution ${contributionId}`);
                }
            } catch (error) {
                console.error(`Error processing contribution ${contributionId}:`, error);
            }
        }
        return null;
    });
// 4. Manual Trigger: Resend Supervisor Email
export const resendSupervisorEmail = functions.https.onCall(async (data, context) => {
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

        let supervisor = appData?.personalInfo?.supervisor;
        
        // Update Email if provided
        if (newEmail) {
            await docRef.update({
                'personalInfo.supervisor.email': newEmail
            });
            // Update local object for sending
            if (!supervisor) supervisor = {};
            supervisor.email = newEmail;
        }

        if (!supervisor || !supervisor.email) {
            throw new functions.https.HttpsError('failed-precondition', 'No supervisor email found in application.');
        }

        // Generate the endorsement link again
        // Note: The token should already exist in the doc.
        const token = appData?.pastorEndorsementToken;
        if (!token) {
             throw new functions.https.HttpsError('failed-precondition', 'Endorsement token missing. Please contact support.');
        }
        
        // Construct Link (Assuming hardcoded for now or based on request origin if possible, but cloud functions don't know client origin easily. Using production URL or config.)
        // Ideally pass origin from client, but for security, we use known domain.
        const origin = "https://pchap.site"; // Hardcoded for production safety
        const endorsementLink = `${origin}/#endorse?token=${token}`;

        const { sendSupervisorRequest } = await import('./emailService');
        await sendSupervisorRequest(
            supervisor.email,
            supervisor.name || 'Pastor',
            `${appData?.personalInfo?.firstname} ${appData?.personalInfo?.surname}`,
            endorsementLink
        );

        return { success: true, message: `Email sent to ${supervisor.email}` };

    } catch (error: any) {
        console.error('Error resending supervisor email:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
