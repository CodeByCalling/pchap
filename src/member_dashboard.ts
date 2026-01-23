import { db, storage, auth } from './firebase_config';
import { doc, getDoc, collection, query, where, orderBy, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Localization } from './localization';

export class MemberDashboard {
    
    /**
     * Render member dashboard with real data
     */
    static async renderDashboard(userId: string): Promise<string> {
        try {
            // Fetch user's application
            const appDoc = await getDoc(doc(db, 'applications', userId));
            const application = appDoc.exists() ? appDoc.data() : null;

            // Check for existing Health Questionnaire (Annex C)
            const healthRef = collection(db, `applications/${userId}/health_private`);
            const healthSnap = await getDocs(healthRef);
            const hasHealthInfo = !healthSnap.empty;

            // Fetch user's contributions
            const contributionsQuery = query(
                collection(db, 'contributions'),
                where('userId', '==', userId)
            );
            const contributionsSnapshot = await getDocs(contributionsQuery);
            const contributions = contributionsSnapshot.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .sort((a: any, b: any) => b.month.localeCompare(a.month));

            // Calculate eligibility
            const this_eligibility = this.calculateEligibility(contributions);

            return this.renderHTML(application, contributions, this_eligibility, userId, hasHealthInfo);
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
    // ... (rest of the file is handled by previous parts of the class, we are editing renderHTML and initializeContributionForm)
    
    /**
     * Render HTML
     */
    private static renderHTML(application: any, contributions: any[], eligibility: any, userId: string, hasHealthInfo: boolean): string {
        const user = auth.currentUser;
        const userName = application?.personalInfo?.firstname 
            ? `${application.personalInfo.firstname} ${application.personalInfo.surname}`
            : user?.email || 'Member';
        const t = (k: any) => Localization.t(k);

        return `
            <section class="container" style="max-width: 1200px;">
                <!-- Welcome Section -->
                <div class="glass-card" style="background: var(--royal-blue); color: white; display: flex; align-items: center; gap: 2rem; padding: 40px; margin-bottom: 30px;">
                    <div style="font-size: 3rem;">👋</div>
                    <div>
                        <h2>Welcome back, ${userName}!</h2>
                        <p>${application ? "Your membership application is being processed." : "Start your PCHAP membership application today."}</p>
                    </div>
                </div>

                ${application ? this.renderApplicationStatus(application) : this.renderNoApplication()}

                <!-- Health Questionnaire (Annex C) -->
                ${application ? this.renderHealthQuestionnaire(hasHealthInfo) : ''}

                <!-- Eligibility Tracker -->
                ${this.renderEligibilityTracker(eligibility)}

                <!-- Contribution Upload Section -->
                ${this.renderContributionUpload()}

                <!-- Payment History -->
                ${this.renderPaymentHistory(contributions)}

                <!-- Image Modal -->
                <div id="image-modal" style="display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.9); backdrop-filter: blur(5px);">
                    <div style="position: relative; margin: 10vh auto; padding: 0; width: 90%; max-width: 700px;">
                        <span id="close-modal" style="color: white; position: absolute; top: -50px; right: 0; font-size: 36px; font-weight: bold; cursor: pointer; padding: 10px; min-width: 44px; min-height: 44px; display: flex; align-items: center; justify-content: center;">&times;</span>
                        <img id="modal-image" style="width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);" />
                    </div>
                </div>
            </section>
        `;
    }

    // ... (renderApplicationStatus, renderNoApplication, renderEligibilityTracker REMAIN UNCHANGED - omitting for brevity if possible, but replace_file_content needs context. 
    // Wait, replace_file_content replaces the BLOCK. I need to be careful not to delete methods I'm not pasting back.
    // I will target SPECIFIC BLOCKS instead of the whole file to be safe.)


    /**
     * Render application status
     */
    private static renderApplicationStatus(application: any): string {
        const adminNotes = application.adminNotes || [];
        const t = (k: any) => Localization.t(k);

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
        const t = (k: any) => Localization.t(k);
        return `
            <div class="card" style="margin-bottom: 30px; text-align: center; padding: 40px;">
                <h3 style="color: var(--royal-blue); margin-bottom: 15px;">No Application Found</h3>
                <p style="margin-bottom: 25px;">You haven't submitted a PCHAP membership application yet.</p>
                <button class="btn btn-primary nav-cta">Apply Now</button>
            </div>
        `;
    }

    private static renderHealthQuestionnaire(isCompleted: boolean): string {
        const t = (k: any) => Localization.t(k);
        if (isCompleted) {
            return `
                <div class="card" style="margin-bottom: 30px;">
                    <h3 style="color: var(--royal-blue); margin-bottom: 15px;">🔒 Private Health Questionnaire (Annex C)</h3>
                    <div style="padding: 15px; background: #d4edda; border-left: 4px solid #28a745; border-radius: 6px;">
                        <strong style="color: #155724;">✓ Submitted</strong>
                        <p style="margin: 5px 0 0 0; color: #155724;">Your confidential health data has been securely recorded.</p>
                    </div>
                </div>
            `;
        }

        return `
            <div class="card" style="margin-bottom: 30px; border-left: 5px solid var(--gold);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <h3 style="color: var(--royal-blue); margin-bottom: 10px;">🔒 Private Health Questionnaire (Annex C)</h3>
                        <p style="margin-bottom: 20px; color: #666;">
                            Please complete this strictly confidential health history form. <br><strong>Security Note:</strong> This data is encrypted and accessible strictly to the Board and Medical Reviewers only.
                        </p>
                    </div>
                    <span style="background: #fff3cd; color: #856404; padding: 5px 10px; border-radius: 4px; font-size: 0.8em; font-weight: 600;">Action Required</span>
                </div>

                <form id="health-questionnaire-form">
                    ${this.renderHealthToggle("Cardiovascular History", "cardio", "Heart disease, hypertension, etc.")}
                    ${this.renderHealthToggle("Endocrine History", "endocrine", "Diabetes, thyroid disorders, etc.")}
                    ${this.renderHealthToggle("Respiratory History", "respiratory", "Asthma, tuberculosis, COPD, etc.")}
                    ${this.renderHealthToggle("Renal History", "renal", "Kidney stones, infection, failure, etc.")}

                    <div id="health-submit-error" style="color: #dc3545; margin-bottom: 15px; display: none;"></div>
                    
                    <button type="submit" id="submit-health-btn" class="btn btn-primary">
                        Submit Confidential Record
                    </button>
                </form>
            </div>
        `;
    }

    private static renderHealthToggle(label: string, id: string, desc: string): string {
        return `
            <div style="margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #eee;">
                <div style="display: flex; align-items: flex-start; justify-content: space-between;">
                    <div>
                        <h4 style="margin-bottom: 5px;">${label}</h4>
                        <p style="font-size: 0.9em; color: #666;">${desc}</p>
                    </div>
                    <div style="display: flex; gap: 15px;">
                        <label style="cursor: pointer; display: flex; align-items: center; gap: 5px;">
                            <input type="radio" name="${id}_toggle" value="no" checked onchange="document.getElementById('${id}-details-container').style.display = 'none'">
                            No
                        </label>
                        <label style="cursor: pointer; display: flex; align-items: center; gap: 5px;">
                            <input type="radio" name="${id}_toggle" value="yes" onchange="document.getElementById('${id}-details-container').style.display = 'block'">
                            Yes
                        </label>
                    </div>
                </div>
                <div id="${id}-details-container" style="display: none; margin-top: 15px;">
                    <label style="display: block; margin-bottom: 8px; font-size: 0.9em; font-weight: 600;">Please provide details:</label>
                    <textarea name="${id}_details" style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 6px; min-height: 80px;" placeholder="Diagnosis date, medication, current status..."></textarea>
                </div>
            </div>
        `;
    }

    /**
     * Render eligibility tracker
     */
    private static renderEligibilityTracker(eligibility: any): string {
        const percentage = Math.min((eligibility.consecutiveMonths / 6) * 100, 100);
        const t = (k: any) => Localization.t(k);
        
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
        const t = (k: any) => Localization.t(k);
        
        return `
            <div class="card" style="margin-bottom: 30px;">
                <h3 style="color: var(--royal-blue); margin-bottom: 20px;">💳 Submit Monthly Contribution</h3>
                
                <form id="contribution-form">
                    <div class="contribution-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                        <div>
                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Month</label>
                            <input type="month" id="contribution-month" value="${currentMonth}" required style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 8px; min-height: 48px;">
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Amount</label>
                            <select id="contribution-amount" required style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 8px; min-height: 48px; background-color: white;">
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
        const t = (k: any) => Localization.t(k);
        return `
            <div class="card">
                <h3 style="color: var(--royal-blue); margin-bottom: 20px;">📜 Payment History</h3>
                
                <div class="table-container">
                    <table id="contributions-table" style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                                <th style="padding: 15px; text-align: left;">Month</th>
                                <th style="padding: 15px; text-align: left;">Amount</th>
                                <th style="padding: 15px; text-align: left;">Status</th>
                                <th style="padding: 15px; text-align: left;">Submitted</th>
                                <th style="padding: 15px; text-align: left;">Receipt</th>
                            </tr>
                        </thead>
                        <tbody id="contributions-list">
                            ${contributions.length === 0 ? `
                                <tr id="no-contributions-row"><td colspan="5" style="text-align: center; color: #666; padding: 40px;">No contributions submitted yet.</td></tr>
                            ` : contributions.map(c => this.renderContributionRow(c)).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

        `;
    }

    private static renderContributionRow(c: any): string {
        const t = (k: any) => Localization.t(k);
        const statusKey = 'status_' + c.status;
        const statusLabel = Localization.t(statusKey as any) || c.status.toUpperCase();
        
        return `
            <tr style="border-bottom: 1px solid #dee2e6;">
                <td style="padding: 15px;" data-label="Month">${this.formatMonth(c.month)}</td>
                <td style="padding: 15px; font-weight: 600;" data-label="Amount">₱${c.amount}</td>
                <td style="padding: 15px;" data-label="Status">
                    <span class="status-badge status-${c.status}">${statusLabel}</span>
                    ${c.adminNotes ? `<br><small style="color: #666;">${c.adminNotes}</small>` : ''}
                </td>
                <td style="padding: 15px;" data-label="Submitted"><small>${new Date(c.submittedAt).toLocaleDateString()}</small></td>
                <td style="padding: 15px;" data-label="Receipt">
                    <button class="btn btn-outline view-receipt-btn" data-url="${c.receiptUrl}" style="padding: 5px 15px; font-size: 0.85rem;">View</button>
                </td>
            </tr>
        `;
    }

    /**
     * Format month for display
     */
    public static formatMonth(monthStr: string): string {
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

        // Modal Handlers
        const modal = document.getElementById('image-modal');
        const modalImg = document.getElementById('modal-image') as HTMLImageElement;
        const span = document.getElementById('close-modal');

        if (modal && span) {
            // Close on 'x'
            span.onclick = function() { modal.style.display = "none"; }
            // Close on click outside
            window.onclick = function(event) {
                if (event.target == modal) { modal.style.display = "none"; }
            }
        }
        
        // Use event delegation for dynamic "View" buttons
        document.body.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (target && target.classList.contains('view-receipt-btn')) {
                const url = target.getAttribute('data-url');
                if (url && modal && modalImg) {
                    modal.style.display = "block";
                    modalImg.src = url;
                }
            }
        });

        
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
                const storageRef = ref(storage, `uploads/${user.uid}/contributions/${month}_${Date.now()}_${file.name}`);
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
                const newContribution = {
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
                };
                
                await addDoc(collection(db, 'contributions'), newContribution);

                statusDiv.innerHTML = '<p style="color: #28a745; font-weight: 600;">✓ Contribution submitted successfully!</p>';
                
                // RESET FORM
                form.reset();
                if (preview) preview.innerHTML = '';
                if (fileName) fileName.textContent = '';
                
                // DYNAMIC UPDATE of List
                const list = document.getElementById('contributions-list');
                const noData = document.getElementById('no-contributions-row');
                if (noData) noData.remove();
                
                if (list) {
                    const newRowHTML = this.renderContributionRow(newContribution);
                    list.insertAdjacentHTML('afterbegin', newRowHTML);
                }
                
                // Reset status after 3 seconds
                setTimeout(() => {
                    statusDiv.innerHTML = '';
                }, 3000);

            } catch (error: any) {
                console.error('Error submitting contribution:', error);
                statusDiv.innerHTML = `<p style="color: #dc3545;">Error: ${error.message}</p>`;
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerText = 'Submit Contribution';
            }
        });
    }
    /**
     * Initialize Health Questionnaire Handlers
     */
    static initializeHealthQuestionnaire(): void {
        const form = document.getElementById('health-questionnaire-form') as HTMLFormElement;
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = document.getElementById('submit-health-btn') as HTMLButtonElement;
            const errorDiv = document.getElementById('health-submit-error')!;
            const user = auth.currentUser;
            
            if (!user) return;

            submitBtn.disabled = true;
            submitBtn.innerText = 'Encrypting & Saving...';
            errorDiv.style.display = 'none';

            try {
                const formData = new FormData(form);
                const data: any = {
                    createdAt: new Date().toISOString(),
                    userId: user.uid,
                    categories: {}
                };

                // Helper to process categories
                const categories = ['cardio', 'endocrine', 'respiratory', 'renal'];
                categories.forEach(cat => {
                    const hasCondition = formData.get(`${cat}_toggle`) === 'yes';
                    data.categories[cat] = {
                        hasCondition: hasCondition,
                        details: hasCondition ? formData.get(`${cat}_details`) : null
                    };
                });

                // STRICT PRIVACY WRITE: Sub-collection
                await addDoc(collection(db, `applications/${user.uid}/health_private`), data);

                alert('✅ Confidential health record saved successfully.');
                window.location.reload();

            } catch (error: any) {
                console.error('Error saving health record:', error);
                errorDiv.innerText = `Error: ${error.message}`;
                errorDiv.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.innerText = 'Submit Confidential Record';
            }
        });
    }
}
