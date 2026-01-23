const { Storage } = require('@google-cloud/storage');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const keyPath = path.join(__dirname, '..', 'serviceAccountKey.json');
// let credential; // Not used anymore
// let storage; // Removed duplicate


console.log(`Using KeyFile: ${keyPath}`);
const serviceAccount = require(keyPath);
const projectId = serviceAccount.project_id;
console.log(`Project ID from JSON: ${projectId}`);

const storage = new Storage({
    projectId: projectId,
    keyFilename: keyPath
});

async function forceCors() {
  const bucketName = 'jrm-member-dng-portal.firebasestorage.app';
  console.log(`Forcing CORS on: ${bucketName}`);
  
  // Important: With GCS client, sometimes the bucket name requires 'gs://' stripped (which I did)
  // BUT for some new Firebase buckets, the underlying GCS name IS the same.
  const bucket = storage.bucket(bucketName);
  try {
    await bucket.setCorsConfiguration([
        {
            origin: ['*'],
            method: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD', 'OPTIONS'],
            responseHeader: ['Content-Type', 'x-goog-resumable'],
            maxAgeSeconds: 3600,
        },
    ]);
    console.log('SUCCESS: CORS updated.');
  } catch(e) {
      console.error('FINAL ERROR:', e);
  }
}

forceCors();
