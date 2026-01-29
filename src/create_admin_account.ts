
import * as admin from 'firebase-admin';

// Initialize Admin SDK
// Run with: npx ts-node src/create_admin_account.ts
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const auth = admin.auth();
const db = admin.firestore();

const ADMIN_EMAIL = 'jrmpchap@gmail.com';
const ADMIN_PASSWORD = 'jrmfruitful@40';
const ADMIN_NAME = 'PCHAP Admin';

async function createAdmin() {
    try {
        let user;
        try {
            user = await auth.getUserByEmail(ADMIN_EMAIL);
            console.log(`User ${ADMIN_EMAIL} already exists. Updating password/claims...`);
            
            await auth.updateUser(user.uid, {
                password: ADMIN_PASSWORD,
                displayName: ADMIN_NAME,
                emailVerified: true
            });
        } catch (error: any) {
            if (error.code === 'auth/user-not-found') {
                console.log(`Creating new admin user ${ADMIN_EMAIL}...`);
                user = await auth.createUser({
                  email: ADMIN_EMAIL,
                  password: ADMIN_PASSWORD,
                  displayName: ADMIN_NAME,
                  emailVerified: true
                });
            } else {
                throw error;
            }
        }

        // Set Custom Claims (if used in rules - though main.ts uses email check currently)
        // It's good practice to set it anyway.
        await auth.setCustomUserClaims(user!.uid, { admin: true });
        console.log(`Set admin custom claim for ${user!.uid}`);
        
        // Ensure an application document exists (optional, but good for dashboard consistency if admins can also be members)
        // Admin usually doesn't need an application doc unless they are also applying.
        // But the dashboard code might expect a user doc for name resolution in some places?
        // Let's create a minimal user doc in 'applications' just in case code relies on it.
        await db.collection('applications').doc(user!.uid).set({
            email: ADMIN_EMAIL,
            personalInfo: {
                firstname: 'PCHAP',
                surname: 'Admin',
                jobTitle: 'Administrator'
            },
            status: 'admin',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        console.log('✅ Admin account configured successfully.');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error creating admin:', error);
        process.exit(1);
    }
}

createAdmin();
