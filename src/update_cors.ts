import * as admin from 'firebase-admin';

// Initialize Admin SDK
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: 'jrm-member-dng-portal'
});

const bucketName = 'jrm-member-dng-portal.firebasestorage.app';
const bucket = admin.storage().bucket(bucketName);

async function configureCors() {
  console.log(`Checking bucket: ${bucket.name}`);

  try {
    const [metadata] = await bucket.getMetadata();
    console.log('Current CORS:', JSON.stringify(metadata.cors, null, 2));

    console.log('Setting new CORS configuration...');
    await bucket.setCorsConfiguration([
      {
        origin: ['*'],
        method: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD', 'OPTIONS'], // Added OPTIONS
        responseHeader: ['Content-Type', 'x-goog-resumable'], // Added Authorization just in case? No, usually not needed for this.
        maxAgeSeconds: 3600,
      },
    ]);

    console.log('Fetching updated metadata...');
    const [newMetadata] = await bucket.getMetadata();
    console.log('New CORS:', JSON.stringify(newMetadata.cors, null, 2));

  } catch (error) {
    console.error('Error updating CORS configuration:', error);
  }
}

configureCors();
