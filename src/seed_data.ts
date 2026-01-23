// seed_data.ts – create demo data for PCHAP
// -------------------------------------------------
// This script uses the Firebase Admin SDK to:
//   1. Create two auth users (admin & member) if they don't exist.
//   2. Create a sample application document for each user.
//   3. Create a few contribution documents for each user.
//
// Prerequisites:
//   - Install firebase-admin: npm install firebase-admin
//   - Place a service account JSON file at the project root named
//     `serviceAccountKey.json` (or set GOOGLE_APPLICATION_CREDENTIALS).
//   - Ensure Firestore security rules allow admin access (they do by default
//     for the Admin SDK).
//
// Run with: npx ts-node src/seed_data.ts

import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';

// Initialize Admin SDK
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const db = admin.firestore();
const auth = admin.auth();

// Demo users
const demoUsers = [
  {
    uid: 'admin-demo-uid',
    email: 'admin@pchap.org',
    password: 'password123',
    displayName: 'Admin Demo',
    isAdmin: true,
  },
  {
    uid: 'member-demo-uid',
    email: 'member@pchap.org',
    password: 'password123',
    displayName: 'Member Demo',
    isAdmin: false,
  },
  {
    uid: 'review-ready-uid',
    email: 'applicant@pchap.org',
    password: 'password123',
    displayName: 'Ready Applicant',
    isAdmin: false,
  },
];

async function createUserIfNotExists(user: any) {
  try {
    await auth.getUser(user.uid);
    console.log(`User ${user.email} already exists`);
  } catch (e) {
    // User not found – create it
    await auth.createUser({
      uid: user.uid,
      email: user.email,
      password: user.password,
      displayName: user.displayName,
    });
    console.log(`Created user ${user.email}`);
  }
}

async function createApplication(user: any) {
  const appRef = db.collection('applications').doc(user.uid);
  const appSnap = await appRef.get();
  if (appSnap.exists) {
    console.log(`Application for ${user.email} already exists`);
    // ALWAYS update the test user to ensure clean state
    if (user.uid === 'review-ready-uid') {
         await appRef.update({
            pastorEndorsementStatus: 'approved',
            adminReviewStatus: 'pending',
            status: 'Pending Admin Review',
            documents: {
                idCard: 'https://placehold.co/600x400/orange/white?text=ID+Card',
                photo: 'https://placehold.co/400x400/blue/white?text=Photo',
                annexA: 'https://placehold.co/600x800/green/white?text=Annex+A+(Form)',
                receipt: 'https://placehold.co/400x200/grey/white?text=Receipt'
            }
         });
         console.log('Forced update of review-ready applicant with documents');
    }
    return;
  }
  const now = admin.firestore.Timestamp.now();
  await appRef.set({
    personalInfo: {
      firstname: user.displayName.split(' ')[0],
      surname: user.displayName.split(' ')[1] || '',
      birthday: '1990-01-01',
      civilStatus: 'Single',
      nationality: 'Filipino',
      outreach: 'Local Church',
      jobTitle: 'Member',
    },
    email: user.email,
    status: 'Pending Pastor Endorsement',
    pastorEndorsementStatus: 'pending',
    adminReviewStatus: 'pending',
    finalApprovalStatus: 'pending',
    pastorEndorsementNotes: '',
    adminNotes: [],
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
    documents: {
      idCard: '',
      photo: '',
      receipt: '',
    },
  });
  
  // Special case for our review-ready applicant
  if (user.uid === 'review-ready-uid') {
     await appRef.update({
        pastorEndorsementStatus: 'approved',
        adminReviewStatus: 'pending',
        status: 'Pending Admin Review',
        documents: {
            idCard: 'https://placehold.co/600x400/orange/white?text=ID+Card',
            photo: 'https://placehold.co/400x400/blue/white?text=Photo',
            annexA: 'https://placehold.co/600x800/green/white?text=Annex+A+(Form)',
            receipt: 'https://placehold.co/400x200/grey/white?text=Receipt'
        }
     });
     console.log('Updated review-ready applicant with documents');
  }
  console.log(`Created application for ${user.email}`);
}

async function createContributions(user: any) {
  const contribCol = db.collection('contributions');
  const now = admin.firestore.Timestamp.now();
  const months = ['2025-10', '2025-11', '2025-12'];
  for (const month of months) {
    const contribId = uuidv4();
    await contribCol.doc(contribId).set({
      userId: user.uid,
      userEmail: user.email,
      userName: user.displayName,
      amount: user.isAdmin ? 250 : 500,
      month,
      receiptUrl: '', // empty – you can upload later
      status: 'pending',
      submittedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`Created contribution ${contribId} for ${user.email} (${month})`);
  }
}

async function main() {
  for (const user of demoUsers) {
    await createUserIfNotExists(user);
    await createApplication(user);
    await createContributions(user);
  }
  console.log('Demo data seeding complete');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error seeding data:', err);
  process.exit(1);
});
