import { db } from './firebase_config';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';

export class EndorsementSystem {

    /**
     * Generate a secure endorsement link for an application
     * Creates a token, saves it to 'endorsements' collection, and updates the application.
     */
    static async generateEndorsementLink(applicationId: string): Promise<string> {
        // Generate a refined unique token (using crypto for better randomness)
        const token = crypto.randomUUID();
        
        try {
            // 1. Save to new 'endorsements' collection (Audit/Record)
            await addDoc(collection(db, 'endorsements'), {
                token: token,
                applicationId: applicationId,
                status: 'pending',
                createdAt: new Date().toISOString()
            });

            // 2. Update Application with the token (Critical for Public Query Rule)
            const applicationRef = doc(db, 'applications', applicationId);
            await updateDoc(applicationRef, {
                pastorEndorsementToken: token,
                pastorEndorsementStatus: 'pending'
            });

            // 3. Return the full URL
            const baseUrl = window.location.origin + window.location.pathname;
            return `${baseUrl}#endorse?token=${token}`;
        } catch (error) {
            console.error("Error generating link:", error);
            throw error;
        }
    }
    
    /**
     * Validate endorsement token and fetch associated application
     */
    static async validateToken(token: string): Promise<any> {
        try {
            // Query applications collection for the endorsement token
            // This works with the Firestore Rule: allow list if querying by pastorEndorsementToken
            const applicationsRef = collection(db, 'applications');
            const q = query(applicationsRef, where('pastorEndorsementToken', '==', token));
            const querySnapshot = await getDocs(q);
            
            if (querySnapshot.empty) {
                throw new Error('Invalid or expired endorsement link.');
            }

            const applicationDoc = querySnapshot.docs[0];
            const application = applicationDoc.data();
            
            // Check if already processed
            if (application.pastorEndorsementStatus !== 'pending') {
                throw new Error('This endorsement has already been processed.');
            }

            return {
                id: applicationDoc.id,
                ...application
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Process pastor endorsement (approve or reject)
     */
    static async processEndorsement(
        applicationId: string, 
        action: 'approve' | 'reject', 
        notes: string = '',
        pastorEmail: string = 'Pastor'
    ): Promise<void> {
        try {
            const applicationRef = doc(db, 'applications', applicationId);
            
            const updates: any = {
                pastorEndorsementStatus: action === 'approve' ? 'approved' : 'rejected',
                pastorEndorsementBy: pastorEmail,
                pastorEndorsementAt: new Date().toISOString(),
                pastorEndorsementNotes: notes,
                updatedAt: new Date().toISOString()
            };

            // Update overall status (Strictly following prompt)
            if (action === 'approve') {
                updates.status = 'pastor-approved';
                updates.pastorEndorsementStatus = 'approved';
            } else {
                updates.status = 'pastor-rejected';
                updates.pastorEndorsementStatus = 'rejected';
            }

            await updateDoc(applicationRef, updates);
        } catch (error) {
            throw error;
        }
    }

    /**
     * Generate the endorsement page HTML
     */
    static renderEndorsementPage(application: any, token: string): string {
        const applicantName = `${application.personalInfo?.firstname || ''} ${application.personalInfo?.surname || ''}`.trim();
        const outreach = application.personalInfo?.outreach || 'Not specified';
        const jobTitle = application.personalInfo?.jobTitle || 'Not specified';
        
        return `
            <div class="endorsement-container">
                <div class="endorsement-card">
                    <div class="endorsement-header">
                        <h1>🙏 Pastor Endorsement</h1>
                        <p class="subtext">Please review and verify this PCHAP membership application</p>
                    </div>

                    <div class="applicant-info">
                        <h2>Applicant Information</h2>
                        <div class="info-grid">
                            <div class="info-item">
                                <span class="label">Name:</span>
                                <span class="value">${applicantName}</span>
                            </div>
                            <div class="info-item">
                                <span class="label">Outreach/Church:</span>
                                <span class="value">${outreach}</span>
                            </div>
                            <div class="info-item">
                                <span class="label">Position/Role:</span>
                                <span class="value">${jobTitle}</span>
                            </div>
                            <div class="info-item">
                                <span class="label">Email:</span>
                                <span class="value">${application.email || 'Not provided'}</span>
                            </div>
                        </div>
                    </div>

                    <div class="verification-section">
                        <h3>Verification Required</h3>
                        <p>As the Senior Pastor, please confirm that:</p>
                        <ul class="verification-list">
                            <li>✓ The applicant is an active member of your church/outreach</li>
                            <li>✓ The applicant holds the stated position/role</li>
                            <li>✓ The applicant is eligible for PCHAP membership</li>
                        </ul>
                    </div>

                    <div class="notes-section">
                        <label for="pastor-notes">Additional Notes (Optional):</label>
                        <textarea id="pastor-notes" rows="3" placeholder="Enter any additional comments or observations..."></textarea>
                    </div>

                    <div class="action-buttons">
                        <button id="approve-btn" class="btn btn-approve">
                            Endorse
                        </button>
                        <button id="reject-btn" class="btn btn-reject">
                            Decline
                        </button>
                    </div>

                    <div id="endorsement-status" class="status-message"></div>
                </div>
            </div>

            <style>
                .endorsement-container {
                    min-height: 100vh;
                    background: linear-gradient(135deg, #002366 0%, #004080 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 2rem 1rem;
                }

                .endorsement-card {
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                    max-width: 600px;
                    width: 100%;
                    padding: 2.5rem;
                }

                .endorsement-header {
                    text-align: center;
                    margin-bottom: 2rem;
                    padding-bottom: 1.5rem;
                    border-bottom: 2px solid #D4AF37;
                }

                .endorsement-header h1 {
                    color: #002366;
                    font-size: 1.8rem;
                    margin-bottom: 0.5rem;
                }

                .subtext {
                    color: #666;
                    font-size: 0.95rem;
                }

                .applicant-info {
                    margin-bottom: 2rem;
                }

                .applicant-info h2 {
                    color: #002366;
                    font-size: 1.3rem;
                    margin-bottom: 1rem;
                }

                .info-grid {
                    display: grid;
                    gap: 1rem;
                }

                .info-item {
                    display: flex;
                    padding: 0.75rem;
                    background: #f8f9fa;
                    border-radius: 6px;
                }

                .info-item .label {
                    font-weight: 600;
                    color: #002366;
                    min-width: 140px;
                }

                .info-item .value {
                    color: #333;
                }

                .verification-section {
                    background: #fffbf0;
                    border-left: 4px solid #D4AF37;
                    padding: 1.5rem;
                    margin-bottom: 2rem;
                    border-radius: 6px;
                }

                .verification-section h3 {
                    color: #002366;
                    margin-bottom: 0.75rem;
                }

                .verification-list {
                    list-style: none;
                    padding-left: 0;
                }

                .verification-list li {
                    padding: 0.5rem 0;
                    color: #333;
                }

                .notes-section {
                    margin-bottom: 2rem;
                }

                .notes-section label {
                    display: block;
                    font-weight: 600;
                    color: #002366;
                    margin-bottom: 0.5rem;
                }

                .notes-section textarea {
                    width: 100%;
                    padding: 0.75rem;
                    border: 2px solid #ddd;
                    border-radius: 6px;
                    font-family: inherit;
                    font-size: 0.95rem;
                    resize: vertical;
                }

                .notes-section textarea:focus {
                    outline: none;
                    border-color: #002366;
                }

                .action-buttons {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                    margin-bottom: 1rem;
                }

                .btn {
                    padding: 1rem;
                    border: none;
                    border-radius: 6px;
                    font-size: 1rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .btn-approve {
                    background: #28a745;
                    color: white;
                }

                .btn-approve:hover {
                    background: #218838;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
                }

                .btn-reject {
                    background: #dc3545;
                    color: white;
                }

                .btn-reject:hover {
                    background: #c82333;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
                }

                .btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                    transform: none !important;
                }

                .status-message {
                    text-align: center;
                    padding: 1rem;
                    border-radius: 6px;
                    font-weight: 500;
                    display: none;
                }

                .status-message.show {
                    display: block;
                }

                .status-message.success {
                    background: #d4edda;
                    color: #155724;
                    border: 1px solid #c3e6cb;
                }

                .status-message.error {
                    background: #f8d7da;
                    color: #721c24;
                    border: 1px solid #f5c6cb;
                }

                @media (max-width: 768px) {
                    .endorsement-card {
                        padding: 1.5rem;
                    }

                    .action-buttons {
                        grid-template-columns: 1fr;
                    }

                    .info-item {
                        flex-direction: column;
                    }

                    .info-item .label {
                        min-width: auto;
                        margin-bottom: 0.25rem;
                    }
                }
            </style>
        `;
    }

    /**
     * Render error page for invalid tokens
     */
    static renderErrorPage(message: string): string {
        return `
            <div class="endorsement-container">
                <div class="endorsement-card">
                    <div class="error-content">
                        <div class="error-icon">⚠️</div>
                        <h1>Unable to Process Endorsement</h1>
                        <p class="error-message">${message}</p>
                        <a href="#home" class="btn btn-home">Return to Homepage</a>
                    </div>
                </div>
            </div>

            <style>
                .endorsement-container {
                    min-height: 100vh;
                    background: linear-gradient(135deg, #002366 0%, #004080 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 2rem 1rem;
                }

                .endorsement-card {
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                    max-width: 500px;
                    width: 100%;
                    padding: 3rem 2rem;
                }

                .error-content {
                    text-align: center;
                }

                .error-icon {
                    font-size: 4rem;
                    margin-bottom: 1rem;
                }

                .error-content h1 {
                    color: #002366;
                    margin-bottom: 1rem;
                }

                .error-message {
                    color: #666;
                    font-size: 1.1rem;
                    margin-bottom: 2rem;
                    line-height: 1.6;
                }

                .btn-home {
                    display: inline-block;
                    padding: 0.75rem 2rem;
                    background: #002366;
                    color: white;
                    text-decoration: none;
                    border-radius: 6px;
                    font-weight: 600;
                    transition: all 0.3s ease;
                }

                .btn-home:hover {
                    background: #D4AF37;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(212, 175, 55, 0.3);
                }
            </style>
        `;
    }
}
