import { db, storage, auth } from './firebase_config';
import { doc, getDoc, collection, query, where, orderBy, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export class MemberDashboard {
    
    /**
     * Render member dashboard with real data
     */
    static async renderDashboard(userId: string): Promise<string> {
        try {
            // Fetch user's application
            const appDoc = await getDoc(doc(db, 'applications', userId));
            const application = appDoc.exists() ? appDoc.data() : null;

            // Fetch user's contributions
            const contributionsQuery = query(
                collection(db, 'contributions'),
                where('userId', '==', userId),
                orderBy('month', 'desc')
            );
            const contributionsSnapshot = await getDocs(contributionsQuery);
            const contributions = contributionsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

            // Calculate eligibility
            const eligibility = this.calculateEligibility(contributions);

            return this.renderHTML(application, contributions, eligibility, userId);
        } catch (error) {
            console.error('Error fetching member data:', error);
            return this.renderError();
        }
    }

    /**
     * Calculate 6-month eligibility
     */
    private static calculateEligibility(contributions: any[]): any {
        const confirmedContributions = contributions
            .filter(c => c.status === 'confirmed')
            .sort((a, b) => a.month.localeCompare(b.month));

        let consecutiveMonths = 0;
        let lastMonth: Date | null = null;

        for (const contribution of confirmedContributions) {
            const currentMonth = new Date(contribution.month + '-01');
            
            if (lastMonth === null) {
                consecutiveMonths = 1;
            } else {
                const expectedNextMonth = new Date(lastMonth);
                expectedNextMonth.setMonth(expectedNextMonth.getMonth() + 1);
                
                if (currentMonth.getTime() === expectedNextMonth.getTime()) {
                    consecutiveMonths++;
                } else {
                    consecutiveMonths = 1;
                }
            }
            
            lastMonth = currentMonth;
        }

        return {
            consecutiveMonths,
            isEligible: consecutiveMonths >= 6,
            totalConfirmed: confirmedContributions.length
        };
    }

    /**
     * Render HTML
     */
    private static renderHTML(application: any, contributions: any[], eligibility: any, userId: string): string {
        const user = auth.currentUser;
        const userName = application?.personalInfo?.firstname 
            ? `${application.personalInfo.firstname} ${application.personalInfo.surname}`
            : user?.email || 'Member';

        return `
            <section class="container" style="max-width: 1200px;">
                <!-- Welcome Section -->
                <div class="glass-card" style="background: var(--royal-blue); color: white; display: flex; align-items: center; gap: 2rem; padding: 40px; margin-bottom: 30px;">
                    <div style="font-size: 3rem;">👋</div>
                    <div>
                        <h2>Welcome back, ${userName}!</h2>
                        <p>${application ? 'Your membership application is being processed.' : 'Start your PCHAP membership application today.'}</p>
                    </div>
                </div>

                ${application ? this.renderApplicationStatus(application) : this.renderNoApplication()}

                <!-- Eligibility Tracker -->
                ${this.renderEligibilityTracker(eligibility)}

                <!-- Contribution Upload Section -->
                ${this.renderContributionUpload()}

                <!-- Payment History -->
                ${this.renderPaymentHistory(contributions)}
            </section>
        `;
    }

    /**
     * Render application status
     */
    private static renderApplicationStatus(application: any): string {
        const adminNotes = application.adminNotes || [];
        
        return `
            <div class="card" style="margin-bottom: 30px;">
                <h3 style="color: var(--royal-blue); margin-bottom: 20px;">📋 Application Status</h3>
                
                <div class="status-timeline">
                    <div class="timeline-step ${application.status.includes('Pending Pastor') ? 'active' : application.pastorEndorsementStatus === 'approved' ? 'completed' : application.pastorEndorsementStatus === 'rejected' ? 'rejected' : ''}">
                        <div class="step-icon">${application.pastorEndorsementStatus === 'approved' ? '✓' : application.pastorEndorsementStatus === 'rejected' ? '✗' : '1'}</div>
                        <div class="step-content">
                            <h4>Pastor Endorsement</h4>
                            <p class="status-badge status-${application.pastorEndorsementStatus}">${application.pastorEndorsementStatus.toUpperCase()}</p>
                            ${application.pastorEndorsementNotes ? `<p class="note">${application.pastorEndorsementNotes}</p>` : ''}
                        </div>
                    </div>

                    <div class="timeline-step ${application.adminReviewStatus === 'pending' && application.pastorEndorsementStatus === 'approved' ? 'active' : application.adminReviewStatus === 'approved' ? 'completed' : application.adminReviewStatus === 'rejected' ? 'rejected' : ''}">
                        <div class="step-icon">${application.adminReviewStatus === 'approved' ? '✓' : application.adminReviewStatus === 'rejected' ? '✗' : '2'}</div>
                        <div class="step-content">
                            <h4>Admin Review</h4>
                            <p class="status-badge status-${application.adminReviewStatus}">${application.adminReviewStatus.toUpperCase()}</p>
                        </div>
                    </div>

                    <div class="timeline-step ${application.finalApprovalStatus === 'pending' && application.adminReviewStatus === 'approved' ? 'active' : application.finalApprovalStatus === 'approved' ? 'completed' : application.finalApprovalStatus === 'rejected' ? 'rejected' : ''}">
                        <div class="step-icon">${application.finalApprovalStatus === 'approved' ? '✓' : application.finalApprovalStatus === 'rejected' ? '✗' : '3'}</div>
                        <div class="step-content">
                            <h4>Final Approval</h4>
                            <p class="status-badge status-${application.finalApprovalStatus}">${application.finalApprovalStatus.toUpperCase()}</p>
                        </div>
                    </div>
                </div>

                ${adminNotes.length > 0 ? `
                    <div style="margin-top: 30px; padding: 20px; background: #fff3cd; border-left: 4px solid #856404; border-radius: 6px;">
                        <h4 style="margin-bottom: 15px; color: #856404;">📝 Admin Notes</h4>
                        ${adminNotes.map((note: any) => `
                            <div style="margin-bottom: 10px; padding: 10px; background: white; border-radius: 4px;">
                                <small style="color: #666;">${new Date(note.at).toLocaleString()} - ${note.by}</small>
                                <p style="margin: 5px 0 0 0;">${note.note}</p>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Render no application message
     */
    private static renderNoApplication(): string {
        return `
            <div class="card" style="margin-bottom: 30px; text-align: center; padding: 40px;">
                <h3 style="color: var(--royal-blue); margin-bottom: 15px;">No Application Found</h3>
                <p style="margin-bottom: 25px;">You haven't submitted a PCHAP membership application yet.</p>
                <button class="btn btn-primary nav-cta">Apply Now</button>
            </div>
        `;
    }

    /**
     * Render eligibility tracker
     */
    private static renderEligibilityTracker(eligibility: any): string {
        const percentage = Math.min((eligibility.consecutiveMonths / 6) * 100, 100);
        
        return `
            <div class="card" style="margin-bottom: 30px;">
                <h3 style="color: var(--royal-blue); margin-bottom: 20px;">📊 Eligibility Tracker</h3>
                <p style="margin-bottom: 15px;">You need <strong>6 consecutive months</strong> of confirmed contributions to be eligible for assistance.</p>
                
                <div style="margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span style="font-weight: 600;">${eligibility.consecutiveMonths} / 6 Months</span>
                        <span style="font-weight: 600; color: ${eligibility.isEligible ? '#28a745' : '#ffc107'};">${percentage.toFixed(0)}%</span>
                    </div>
                    <div style="height: 30px; background: #e9ecef; border-radius: 15px; overflow: hidden;">
                        <div style="height: 100%; background: ${eligibility.isEligible ? '#28a745' : 'linear-gradient(90deg, #D4AF37, #FFD700)'}; width: ${percentage}%; transition: width 0.3s ease;"></div>
                    </div>
                </div>

                ${eligibility.isEligible ? `
                    <div style="margin-top: 20px; padding: 15px; background: #d4edda; border-left: 4px solid #28a745; border-radius: 6px;">
                        <strong style="color: #155724;">🎉 Congratulations!</strong>
                        <p style="margin: 5px 0 0 0; color: #155724;">You are now eligible to apply for medical assistance.</p>
                    </div>
                ` : `
                    <p style="margin-top: 15px; color: #666;"><small>Total confirmed contributions: ${eligibility.totalConfirmed}</small></p>
                `}
            </div>
        `;
    }

    /**
     * Render contribution upload section
     */
    private static renderContributionUpload(): string {
        const currentDate = new Date();
        const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        
        return `
            <div class="card" style="margin-bottom: 30px;">
                <h3 style="color: var(--royal-blue); margin-bottom: 20px;">💳 Submit Monthly Contribution</h3>
                
                <form id="contribution-form">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                        <div>
                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Month</label>
                            <input type="month" id="contribution-month" value="${currentMonth}" required style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 8px;">
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Amount</label>
                            <select id="contribution-amount" required style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 8px;">
                                <option value="500">₱500 (Standard)</option>
                                <option value="250">₱250 (Retiree 70+)</option>
                            </select>
                        </div>
                    </div>

                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Upload Receipt</label>
                        <div style="position: relative;">
                            <label for="receipt-upload" class="btn btn-outline" style="display: inline-block; cursor: pointer;">
                                📎 Choose Receipt Image
                            </label>
                            <input type="file" id="receipt-upload" accept="image/*" required style="display: none;">
                            <span id="file-name" style="margin-left: 15px; color: #666;"></span>
                        </div>
                        <div id="receipt-preview" style="margin-top: 15px;"></div>
                    </div>

                    <button type="submit" id="submit-contribution-btn" class="btn btn-primary">Submit Contribution</button>
                    <div id="contribution-status" style="margin-top: 15px;"></div>
                </form>
            </div>
        `;
    }

    /**
     * Render payment history
     */
    private static renderPaymentHistory(contributions: any[]): string {
        return `
            <div class="card">
                <h3 style="color: var(--royal-blue); margin-bottom: 20px;">📜 Payment History</h3>
                
                ${contributions.length === 0 ? `
                    <p style="text-align: center; color: #666; padding: 40px;">No contributions submitted yet.</p>
                ` : `
                    <div class="table-container">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                                    <th style="padding: 15px; text-align: left;">Month</th>
                                    <th style="padding: 15px; text-align: left;">Amount</th>
                                    <th style="padding: 15px; text-align: left;">Status</th>
                                    <th style="padding: 15px; text-align: left;">Submitted</th>
                                    <th style="padding: 15px; text-align: left;">Receipt</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${contributions.map(c => `
                                    <tr style="border-bottom: 1px solid #dee2e6;">
                                        <td style="padding: 15px;">${this.formatMonth(c.month)}</td>
                                        <td style="padding: 15px; font-weight: 600;">₱${c.amount}</td>
                                        <td style="padding: 15px;">
                                            <span class="status-badge status-${c.status}">${c.status.toUpperCase()}</span>
                                            ${c.adminNotes ? `<br><small style="color: #666;">${c.adminNotes}</small>` : ''}
                                        </td>
                                        <td style="padding: 15px;"><small>${new Date(c.submittedAt).toLocaleDateString()}</small></td>
                                        <td style="padding: 15px;">
                                            <a href="${c.receiptUrl}" target="_blank" class="btn btn-outline" style="padding: 5px 15px; font-size: 0.85rem;">View</a>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>

            <style>
                .status-timeline {
                    display: flex;
                    gap: 20px;
                    margin: 30px 0;
                }

                .timeline-step {
                    flex: 1;
                    display: flex;
                    gap: 15px;
                    padding: 20px;
                    border-radius: 8px;
                    background: #f8f9fa;
                    opacity: 0.5;
                }

                .timeline-step.active {
                    opacity: 1;
                    background: #fff3cd;
                    border: 2px solid #ffc107;
                }

                .timeline-step.completed {
                    opacity: 1;
                    background: #d4edda;
                    border: 2px solid #28a745;
                }

                .timeline-step.rejected {
                    opacity: 1;
                    background: #f8d7da;
                    border: 2px solid #dc3545;
                }

                .step-icon {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    background: var(--royal-blue);
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    flex-shrink: 0;
                }

                .timeline-step.completed .step-icon {
                    background: #28a745;
                }

                .timeline-step.rejected .step-icon {
                    background: #dc3545;
                }

                .step-content h4 {
                    margin: 0 0 8px 0;
                    color: var(--royal-blue);
                }

                .step-content p {
                    margin: 0;
                }

                .note {
                    margin-top: 8px;
                    font-size: 0.9rem;
                    color: #666;
                    font-style: italic;
                }

                @media (max-width: 768px) {
                    .status-timeline {
                        flex-direction: column;
                    }
                }
            </style>
        `;
    }

    /**
     * Format month for display
     */
    private static formatMonth(monthStr: string): string {
        const date = new Date(monthStr + '-01');
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    }

    /**
     * Render error state
     */
    private static renderError(): string {
        return `
            <section class="container">
                <div class="card" style="text-align: center; padding: 40px;">
                    <h3 style="color: #dc3545; margin-bottom: 15px;">Error Loading Dashboard</h3>
                    <p>Unable to fetch your membership data. Please try refreshing the page.</p>
                </div>
            </section>
        `;
    }

    /**
     * Initialize contribution form handlers
     */
    static initializeContributionForm(): void {
        const form = document.getElementById('contribution-form') as HTMLFormElement;
        const fileInput = document.getElementById('receipt-upload') as HTMLInputElement;
        const fileName = document.getElementById('file-name');
        const preview = document.getElementById('receipt-preview');
        
        // File selection handler
        fileInput?.addEventListener('change', (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file && fileName && preview) {
                fileName.textContent = file.name;
                
                // Show preview
                const reader = new FileReader();
                reader.onload = (e) => {
                    preview.innerHTML = `<img src="${e.target?.result}" style="max-width: 300px; border-radius: 8px; border: 2px solid #ddd;">`;
                };
                reader.readAsDataURL(file);
            }
        });

        // Form submission handler
        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = document.getElementById('submit-contribution-btn') as HTMLButtonElement;
            const statusDiv = document.getElementById('contribution-status')!;
            const user = auth.currentUser;
            
            if (!user) {
                statusDiv.innerHTML = '<p style="color: #dc3545;">Please log in to submit contributions.</p>';
                return;
            }

            const month = (document.getElementById('contribution-month') as HTMLInputElement).value;
            const amount = parseInt((document.getElementById('contribution-amount') as HTMLSelectElement).value);
            const file = fileInput.files?.[0];

            if (!file) {
                statusDiv.innerHTML = '<p style="color: #dc3545;">Please select a receipt image.</p>';
                return;
            }

            submitBtn.disabled = true;
            submitBtn.innerText = 'Uploading...';
            statusDiv.innerHTML = '<p style="color: #0c5460;">Uploading receipt...</p>';

            try {
                // Upload receipt to Storage
                const storageRef = ref(storage, `contributions/${user.uid}/${month}_${Date.now()}_${file.name}`);
                await uploadBytes(storageRef, file);
                const receiptUrl = await getDownloadURL(storageRef);

                statusDiv.innerHTML = '<p style="color: #0c5460;">Saving contribution...</p>';

                // Get user info
                const appDoc = await getDoc(doc(db, 'applications', user.uid));
                const appData = appDoc.exists() ? appDoc.data() : null;
                const userName = appData?.personalInfo 
                    ? `${appData.personalInfo.firstname} ${appData.personalInfo.surname}`
                    : user.email;

                // Save contribution to Firestore
                await addDoc(collection(db, 'contributions'), {
                    userId: user.uid,
                    userEmail: user.email,
                    userName: userName,
                    amount: amount,
                    month: month,
                    receiptUrl: receiptUrl,
                    status: 'pending',
                    submittedAt: new Date().toISOString(),
                    reviewedBy: null,
                    reviewedAt: null,
                    adminNotes: '',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });

                statusDiv.innerHTML = '<p style="color: #28a745; font-weight: 600;">✓ Contribution submitted successfully! Pending admin confirmation.</p>';
                form.reset();
                if (preview) preview.innerHTML = '';
                if (fileName) fileName.textContent = '';

                // Reload page after 2 seconds
                setTimeout(() => {
                    window.location.reload();
                }, 2000);

            } catch (error: any) {
                console.error('Error submitting contribution:', error);
                statusDiv.innerHTML = `<p style="color: #dc3545;">Error: ${error.message}</p>`;
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerText = 'Submit Contribution';
            }
        });
    }
}
