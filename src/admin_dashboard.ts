import { db } from './firebase_config';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, Timestamp } from 'firebase/firestore';

export class AdminDashboard {
    private unsubscribe: (() => void) | null = null;

    /**
     * Render the admin dashboard with application queue
     */
    static renderDashboard(): string {
        return `
            <section class="container">
                <h2 class="section-title">Admin Review Portal</h2>
                <p style="margin-bottom: 30px;">Review and manage membership applications and monthly contributions.</p>
                
                <!-- Tab Navigation -->
                <div class="tab-navigation" style="margin-bottom: 30px;">
                    <button class="tab-btn active" data-tab="applications">Applications</button>
                    <button class="tab-btn" data-tab="contributions">Contributions</button>
                </div>

                <!-- Applications Tab -->
                <div id="applications-tab" class="tab-content active">
                    <!-- Filter Tabs -->
                    <div class="filter-tabs" style="margin-bottom: 30px;">
                        <button class="filter-btn active" data-filter="all">All Applications</button>
                        <button class="filter-btn" data-filter="pending">Pending Pastor Endorsement</button>
                        <button class="filter-btn" data-filter="endorsed">Endorsed</button>
                        <button class="filter-btn" data-filter="approved">Approved</button>
                        <button class="filter-btn" data-filter="rejected">Rejected</button>
                    </div>

                    <div class="table-container" style="background: white; border-radius: 15px; box-shadow: var(--soft-shadow);">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background: var(--royal-blue); color: white;">
                                    <th style="padding: 15px;">App ID</th>
                                    <th style="padding: 15px;">Full Name</th>
                                    <th style="padding: 15px;">Submission Date</th>
                                    <th style="padding: 15px;">Pastor Status</th>
                                    <th style="padding: 15px;">Admin Status</th>
                                    <th style="padding: 15px;">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="admin-applications-table">
                                <tr><td colspan="6" style="padding: 20px; text-align: center;">Loading applications...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Contributions Tab -->
                <div id="contributions-tab" class="tab-content">
                    <div class="filter-tabs" style="margin-bottom: 30px;">
                        <button class="contrib-filter-btn active" data-filter="all">All Contributions</button>
                        <button class="contrib-filter-btn" data-filter="pending">Pending</button>
                        <button class="contrib-filter-btn" data-filter="confirmed">Confirmed</button>
                        <button class="contrib-filter-btn" data-filter="rejected">Rejected</button>
                    </div>

                    <div class="table-container" style="background: white; border-radius: 15px; box-shadow: var(--soft-shadow);">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background: var(--royal-blue); color: white;">
                                    <th style="padding: 15px;">Member</th>
                                    <th style="padding: 15px;">Month</th>
                                    <th style="padding: 15px;">Amount</th>
                                    <th style="padding: 15px;">Submitted</th>
                                    <th style="padding: 15px;">Status</th>
                                    <th style="padding: 15px;">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="admin-contributions-table">
                                <tr><td colspan="6" style="padding: 20px; text-align: center;">Loading contributions...</td></tr>
                            </tbody>
                        </table>  
                    </div>
                </div>
            </section>

            <!-- Contribution Detail Modal -->
            <div id="contribution-detail-modal" class="modal-overlay">
                <div class="modal-content" style="max-width: 700px;">
                    <div class="modal-header">
                        <h2>Contribution Details</h2>
                        <button class="modal-close" id="close-contrib-modal">&times;</button>
                    </div>
                    <div id="contribution-detail-body"></div>
                </div>
            </div>

            <!-- Application Detail Modal -->
            <div id="app-detail-modal" class="modal-overlay">
                <div class="modal-content" style="max-width: 900px; max-height: 90vh; overflow-y: auto;">
                    <div class="modal-header">
                        <h2>Application Details</h2>
                        <button class="modal-close" id="close-detail-modal">&times;</button>
                    </div>
                    <div id="app-detail-body"></div>
                </div>
            </div>

            <style>
                .tab-navigation {
                    display: flex;
                    gap: 1rem;
                    border-bottom: 2px solid #dee2e6;
                    margin-bottom: 30px;
                }

                .tab-btn {
                    padding: 1rem 2rem;
                    border: none;
                    background: transparent;
                    cursor: pointer;
                    font-weight: 600;
                    color: #666;
                    border-bottom: 3px solid transparent;
                    transition: all 0.3s ease;
                }

                .tab-btn.active {
                    color: var(--royal-blue);
                    border-bottom-color: var(--royal-blue);
                }

                .tab-btn:hover {
                    color: var(--royal-blue);
                }

                .tab-content {
                    display: none;
                }

                .tab-content.active {
                    display: block;
                }

                .filter-tabs {
                    display: flex;
                    gap: 1rem;
                    flex-wrap: wrap;
                }

                .filter-btn {
                    padding: 0.75rem 1.5rem;
                    border: 2px solid #ddd;
                    background: white;
                    border-radius: 25px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    font-weight: 600;
                }

                .filter-btn.active {
                    background: var(--royal-blue);
                    color: white;
                    border-color: var(--royal-blue);
                }

                .filter-btn:hover:not(.active) {
                    border-color: var(--royal-blue);
                    color: var(--royal-blue);
                }

                .status-badge {
                    padding: 0.4rem 0.8rem;
                    border-radius: 15px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    display: inline-block;
                }

                .status-pending {
                    background: #fff3cd;
                    color: #856404;
                }

                .status-endorsed {
                    background: #d1ecf1;
                    color: #0c5460;
                }

                .status-approved {
                    background: #d4edda;
                    color: #155724;
                }

                .status-rejected {
                    background: #f8d7da;
                    color: #721c24;
                }

                .modal-overlay {
                    display: none;
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.7);
                    z-index: 10000;
                    align-items: center;
                    justify-content: center;
                }

                .modal-overlay.active {
                    display: flex;
                }

                .modal-content {
                    background: white;
                    border-radius: 15px;
                    width: 100%;
                    margin: 2rem;
                }

                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 2rem;
                    border-bottom: 2px solid #eee;
                }

                .modal-close {
                    background: none;
                    border: none;
                    font-size: 2rem;
                    cursor: pointer;
                    color: #666;
                }

                .modal-close:hover {
                    color: #000;
                }
            </style>
        `;
    }

    /**
     * Initialize admin dashboard with real-time listeners
     */
   static initializeDashboard(): void {
        const tbody = document.getElementById('admin-applications-table');
        if (!tbody) return;

        let currentFilter = 'all';

        // Filter button listeners
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilter = btn.getAttribute('data-filter') || 'all';
                // Re-render with filter (handled by onSnapshot)
            });
        });

        // Real-time listener for applications
        const q = query(collection(db, 'applications'), orderBy('submittedAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            tbody.innerHTML = '';
            if (snapshot.empty) {
                tbody.innerHTML = '<tr><td colspan="6" style="padding: 20px; text-align: center;">No applications found.</td></tr>';
                return;
            }

            let filteredCount = 0;
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const appId = docSnap.id;

                // Apply filter
                if (currentFilter !== 'all') {
                    if (currentFilter === 'pending' && data.pastorEndorsementStatus !== 'pending') return;
                    if (currentFilter === 'endorsed' && data.pastorEndorsementStatus !== 'approved') return;
                    if (currentFilter === 'approved' && data.finalApprovalStatus !== 'approved') return;
                    if (currentFilter === 'rejected' && (!data.status.toLowerCase().includes('reject'))) return;
                }

                filteredCount++;

                const row = `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 15px; font-family: monospace;">#${appId.slice(0, 8)}</td>
                        <td style="padding: 15px;">${data.personalInfo?.firstname || ''} ${data.personalInfo?.surname || ''}</td>
                        <td style="padding: 15px;">${new Date(data.submittedAt).toLocaleDateString()}</td>
                        <td style="padding: 15px;">
                            <span class="status-badge status-${data.pastorEndorsementStatus}">${data.pastorEndorsementStatus.toUpperCase()}</span>
                        </td>
                        <td style="padding: 15px;">
                            <span class="status-badge status-${data.adminReviewStatus}">${data.adminReviewStatus.toUpperCase()}</span>
                        </td>
                        <td style="padding: 15px;">
                            <button class="btn btn-outline view-app-btn" data-app-id="${appId}" style="padding: 5px 15px; font-size: 0.8rem;">View Details</button>
                        </td>
                    </tr>
                `;
                tbody.innerHTML += row;
            });

            if (filteredCount === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="padding: 20px; text-align: center;">No applications match this filter.</td></tr>';
            }

            // Attach view detail listeners
            document.querySelectorAll('.view-app-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const appId = btn.getAttribute('data-app-id');
                    if (appId) {
                        const appDoc = snapshot.docs.find(d => d.id === appId);
                        if (appDoc) {
                            AdminDashboard.showApplicationDetail(appDoc.id, appDoc.data());
                        }
                    }
                });
            });
        }, (error) => {
            console.error('Error fetching applications:', error);
            tbody.innerHTML = '<tr><td colspan="6" style="padding: 20px; text-align: center; color: red;">Error loading data. Check console.</td></tr>';
        });
    }

    /**
     * Show application detail modal
     */
    static showApplicationDetail(appId: string, data: any): void {
        const modal = document.getElementById('app-detail-modal')!;
        const body = document.getElementById('app-detail-body')!;

        const canApproveForReview = data.pastorEndorsementStatus === 'approved' && data.adminReviewStatus === 'pending';
        const canFinalApprove = data.adminReviewStatus === 'approved' && data.finalApprovalStatus === 'pending';

        body.innerHTML = `
            <div style="padding: 2rem;">
                <div class="info-section">
                    <h3>Personal Information</h3>
                    <div class="info-grid">
                        <div><strong>Name:</strong> ${data.personalInfo?.firstname} ${data.personalInfo?.surname}</div>
                        <div><strong>Birthday:</strong> ${data.personalInfo?.birthday}</div>
                        <div><strong>Civil Status:</strong> ${data.personalInfo?.civilStatus}</div>
                        <div><strong>Nationality:</strong> ${data.personalInfo?.nationality}</div>
                        <div><strong>Outreach/Church:</strong> ${data.personalInfo?.outreach}</div>
                        <div><strong>Position:</strong> ${data.personalInfo?.jobTitle}</div>
                        <div><strong>Email:</strong> ${data.email}</div>
                    </div>
                </div>

                <div class="info-section">
                    <h3>Application Status</h3>
                    <div class="info-grid">
                        <div><strong>Overall Status:</strong> <span class="status-badge">${data.status}</span></div>
                        <div><strong>Pastor Endorsement:</strong> <span class="status-badge status-${data.pastorEndorsementStatus}">${data.pastorEndorsementStatus}</span></div>
                        <div><strong>Admin Review:</strong> <span class="status-badge status-${data.adminReviewStatus}">${data.adminReviewStatus}</span></div>
                        <div><strong>Final Approval:</strong> <span class="status-badge status-${data.finalApprovalStatus}">${data.finalApprovalStatus}</span></div>
                    </div>
                    ${data.pastorEndorsementNotes ? `<p style="margin-top: 1rem;"><strong>Pastor Notes:</strong> ${data.pastorEndorsementNotes}</p>` : ''}
                </div>

                <div class="info-section">
                    <h3>Documents</h3>
                    <div style="display: grid; gap: 1rem;">
                        ${data.documents?.idCard ? `<a href="${data.documents.idCard}" target="_blank" class="btn btn-outline">View ID Card</a>` : ''}
                        ${data.documents?.photo ? `<a href="${data.documents.photo}" target="_blank" class="btn btn-outline">View Photo</a>` : ''}
                        ${data.documents?.receipt ? `<a href="${data.documents.receipt}" target="_blank" class="btn btn-outline">View Receipt</a>` : ''}
                    </div>
                </div>

                <div class="info-section">
                    <h3>Admin Actions</h3>
                    <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                        ${canApproveForReview ? '<button id="approve-review-btn" class="btn btn-primary">✓ Approve for Review</button>' : ''}
                        ${canFinalApprove ? '<button id="final-approve-btn" class="btn btn-primary">✓ Final Approval</button>' : ''}
                        ${data.status !== 'Rejected' ? '<button id="reject-app-btn" class="btn" style="background: #dc3545; color: white;">✗ Reject Application</button>' : ''}
                        <button id="add-note-btn" class="btn btn-outline">Add Admin Note</button>
                    </div>
                </div>

                <div id="note-form" style="display: none; margin-top: 2rem;">
                    <textarea id="admin-note-text" rows="3" style="width: 100%; padding: 1rem; border: 2px solid #ddd; border-radius: 8px;" placeholder="Enter admin note..."></textarea>
                    <div style="margin-top: 1rem; display: flex; gap: 1rem;">
                        <button id="save-note-btn" class="btn btn-primary">Save Note</button>
                        <button id="cancel-note-btn" class="btn btn-outline">Cancel</button>
                    </div>
                </div>

                ${data.adminNotes && data.adminNotes.length > 0 ? `
                    <div class="info-section">
                        <h3>Admin Notes History</h3>
                        ${data.adminNotes.map((note: any) => `
                            <div style="padding: 1rem; background: #f8f9fa; border-radius: 8px; margin-bottom: 1rem;">
                                <p><strong>${note.by || 'Admin'}</strong> - ${new Date(note.at).toLocaleString()}</p>
                                <p>${note.note}</p>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;

        modal.classList.add('active');

        // Attach action listeners
        document.getElementById('close-detail-modal')?.addEventListener('click', () => {
            modal.classList.remove('active');
        });

        document.getElementById('approve-review-btn')?.addEventListener('click', async () => {
            await AdminDashboard.updateApplicationStatus(appId, { adminReviewStatus: 'approved', status: 'Pending Final Approval' });
            modal.classList.remove('active');
        });

        document.getElementById('final-approve-btn')?.addEventListener('click', async () => {
            await AdminDashboard.updateApplicationStatus(appId, { finalApprovalStatus: 'approved', status: 'APPROVED - Active Member' });
            modal.classList.remove('active');
        });

        document.getElementById('reject-app-btn')?.addEventListener('click', async () => {
            if (confirm('Are you sure you want to reject this application?')) {
                await AdminDashboard.updateApplicationStatus(appId, {
                    adminReviewStatus: 'rejected',
                    finalApprovalStatus: 'rejected',
                    status: 'Rejected by Admin'
                });
                modal.classList.remove('active');
            }
        });

        document.getElementById('add-note-btn')?.addEventListener('click', () => {
            document.getElementById('note-form')!.style.display = 'block';
        });

        document.getElementById('cancel-note-btn')?.addEventListener('click', () => {
            document.getElementById('note-form')!.style.display = 'none';
        });

        document.getElementById('save-note-btn')?.addEventListener('click', async () => {
            const noteText = (document.getElementById('admin-note-text') as HTMLTextAreaElement).value;
            if (noteText.trim()) {
                await AdminDashboard.addAdminNote(appId, noteText, 'Admin');
                modal.classList.remove('active');
            }
        });
    }

    /**
     * Update application status
     */
    static async updateApplicationStatus(appId: string, updates: any): Promise<void> {
        try {
            const appRef = doc(db, 'applications', appId);
            await updateDoc(appRef, {
                ...updates,
                updatedAt: new Date().toISOString()
            });
            alert('Application status updated successfully!');
        } catch (error: any) {
            alert('Error updating status: ' + error.message);
        }
    }

    /**
     * Add admin note to application
     */
    static async addAdminNote(appId: string, note: string, adminName: string): Promise<void> {
        try {
            const appRef = doc(db, 'applications', appId);
            const docSnap = await import('firebase/firestore').then(m => m.getDoc(appRef));
            const currentNotes = docSnap.data()?.adminNotes || [];
            
            await updateDoc(appRef, {
                adminNotes: [
                    ...currentNotes,
                    {
                        note,
                        by: adminName,
                        at: new Date().toISOString()
                    }
                ],
                updatedAt: new Date().toISOString()
            });
            alert('Note added successfully!');
        } catch (error: any) {
            alert('Error adding note: ' + error.message);
        }
    }
}
