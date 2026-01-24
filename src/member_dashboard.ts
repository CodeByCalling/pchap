import { db, storage, auth, functions } from './firebase_config';
import { doc, getDoc, collection, query, where, orderBy, getDocs, addDoc, setDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { Localization } from './localization';
import { PsgcService } from './utils/psgc_service';

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
        } catch (error: any) {
            console.error('Error fetching member data:', error);
            // Check for index error specifically
            const msg = error.code === 'failed-precondition' && error.message.includes('index') 
                ? 'System is currently building necessary database indexes. Please try again in a few minutes.\n' + error.message
                : error.message;
            return this.renderError(msg);
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

                <!-- Address Revision Alert -->
                ${application?.personalInfo?.address?.revisionRequired ? this.renderAddressRevisionAlert() : ''}

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

    /**
     * Render application status
     */
    private static renderApplicationStatus(application: any): string {
        const adminNotes = application.adminNotes || [];
        const t = (k: any) => Localization.t(k);
        
        // Safety checks for status fields
        const pastorStatus = application.pastorEndorsementStatus || 'pending';
        const adminStatus = application.adminReviewStatus || 'pending';
        const finalStatus = application.finalApprovalStatus || 'pending';
        const globalStatus = application.status || 'draft';
        const isDraft = globalStatus === 'draft';

        return `
            <div class="card" style="margin-bottom: 30px;">
                <h3 style="color: var(--royal-blue); margin-bottom: 20px;">📋 Application Status</h3>
                
                <div style="margin-bottom: 20px;">
                    ${(isDraft || adminStatus === 'returned') 
                        ? `<button class="btn btn-primary nav-cta" style="width: 100%; margin-bottom: 15px;">Continue Application</button>` 
                        : `<button class="btn btn-outline nav-cta" style="width: 100%; margin-bottom: 15px;">View Application</button>`
                    }
                </div>
                
                <div class="status-timeline">
                    <div class="timeline-step ${globalStatus.includes('Pending Pastor') ? 'active' : pastorStatus === 'approved' ? 'completed' : pastorStatus === 'rejected' ? 'rejected' : ''}">
                        <div class="step-icon">${pastorStatus === 'approved' ? '✓' : pastorStatus === 'rejected' ? '✗' : '1'}</div>
                        <div class="step-content">
                            <h4>Pastor Endorsement</h4>
                            <p class="status-badge status-${pastorStatus}">${pastorStatus.toUpperCase()}</p>
                            ${(!isDraft && pastorStatus === 'pending') ? `<button id="resend-supervisor-btn" class="btn-text" style="font-size: 0.8rem; text-decoration: underline; margin-top: 5px; color: var(--royal-blue); cursor: pointer; background: none; border: none; padding: 0;">Resend Request</button>` : ''}
                            ${application.pastorEndorsementNotes ? `<p class="note">${application.pastorEndorsementNotes}</p>` : ''}
                        </div>
                    </div>

                    <div class="timeline-step ${adminStatus === 'pending' && pastorStatus === 'approved' ? 'active' : adminStatus === 'approved' ? 'completed' : adminStatus === 'rejected' ? 'rejected' : ''}">
                        <div class="step-icon">${adminStatus === 'approved' ? '✓' : adminStatus === 'rejected' ? '✗' : '2'}</div>
                        <div class="step-content">
                            <h4>Admin Review</h4>
                            <p class="status-badge status-${adminStatus}">${adminStatus.toUpperCase()}</p>
                        </div>
                    </div>

                    <div class="timeline-step ${finalStatus === 'pending' && adminStatus === 'approved' ? 'active' : finalStatus === 'approved' ? 'completed' : finalStatus === 'rejected' ? 'rejected' : ''}">
                        <div class="step-icon">${finalStatus === 'approved' ? '✓' : finalStatus === 'rejected' ? '✗' : '3'}</div>
                        <div class="step-content">
                            <h4>Final Approval</h4>
                            <p class="status-badge status-${finalStatus}">${finalStatus.toUpperCase()}</p>
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
         // Health Questionnaire is now integrated into the main application wizard.
         // We no longer render it separately here to comply with "submit all at once" requirement.
         return '';
    }

    private static renderAddressRevisionAlert(): string {
        return `
            <div class="card" style="margin-bottom: 30px; border-left: 5px solid #dc3545; background-color: #fff8f8;">
                <div style="display: flex; gap: 20px; align-items: start;">
                    <div style="font-size: 2rem;">⚠️</div>
                    <div style="flex: 1;">
                        <h3 style="color: #dc3545; margin-bottom: 10px;">Action Required: Update Address</h3>
                        <p style="margin-bottom: 15px;">
                            Your current address record requires an update to match the new DTI / PSGC standards. 
                            Please re-select your location to ensure accurate delivery of benefits.
                        </p>
                        
                        <form id="update-address-form" style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #eee;">
                            <div class="form-group-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                <div class="form-group" style="grid-column: span 2;">
                                    <label>House No. / Street / Block / Lot</label>
                                    <input type="text" id="update-houseStreet" required placeholder="Detailed street address" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
                                </div>
                                <div class="form-group">
                                    <label>Region</label>
                                    <select id="update-region" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;"></select>
                                </div>
                                <div class="form-group">
                                    <label>Province</label>
                                    <select id="update-province" required disabled style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;"></select>
                                </div>
                                <div class="form-group">
                                    <label>City / Municipality</label>
                                    <select id="update-city" required disabled style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;"></select>
                                </div>
                                <div class="form-group">
                                    <label>Barangay</label>
                                    <select id="update-barangay" required disabled style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;"></select>
                                </div>
                            </div>
                            <div style="margin-top: 15px; text-align: right;">
                                <button type="submit" id="btn-update-address" class="btn btn-primary">Update Address Record</button>
                            </div>
                        </form>
                    </div>
                </div>
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
    private static renderError(message: string = ''): string {
        return `
            <section class="container">
                <div class="card" style="text-align: center; padding: 40px;">
                    <h3 style="color: #dc3545; margin-bottom: 15px;">Error Loading Dashboard</h3>
                    <p>Unable to fetch your membership data.</p>
                    ${message ? `<div style="background:#f8d7da; color:#721c24; padding:10px; margin-top:20px; border-radius:4px; font-family:monospace; font-size:0.85rem; text-align:left; overflow:auto;">${message}</div>` : ''}
                    <button onclick="window.location.reload()" class="btn btn-outline" style="margin-top: 20px;">Try Refreshing</button>
                    ${message.includes('index') ? '<p style="margin-top:10px; font-size:0.8rem; color:#666;">Note: If this is a new deployment, indexes may still be building.</p>' : ''}
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

    public static initializeAddressUpdateForm() {
        const form = document.getElementById('update-address-form');
         // This form is only rendered if renderAddressRevisionAlert is called.
        if (!form) return;
        
        const regionSelect = document.getElementById('update-region') as HTMLSelectElement;
        const provinceSelect = document.getElementById('update-province') as HTMLSelectElement;
        const citySelect = document.getElementById('update-city') as HTMLSelectElement;
        const barangaySelect = document.getElementById('update-barangay') as HTMLSelectElement;

        // Reset helpers
        const reset = (el: HTMLSelectElement) => {
             el.innerHTML = '<option value="">Select Option</option>';
             el.disabled = true;
        }

        // 1. Load Regions
        const regions = PsgcService.getRegions();
        regionSelect.innerHTML = '<option value="">Select Region</option>';
        regions.forEach(r => {
             const opt = document.createElement('option');
             opt.value = r.code;
             opt.innerText = r.name;
             regionSelect.appendChild(opt);
        });

        // 2. Event Listeners
        regionSelect?.addEventListener('change', () => {
             reset(provinceSelect); reset(citySelect); reset(barangaySelect);
             const code = regionSelect.value;
             if (code) {
                 const provinces = PsgcService.getProvinces(code);
                 if (provinces.length > 0) {
                     provinceSelect.disabled = false;
                     provinces.forEach(p => {
                         const opt = document.createElement('option');
                         opt.value = p.code;
                         opt.innerText = p.name;
                         provinceSelect.appendChild(opt);
                     });
                     
                     // NCR optimization
                     if (provinces.length === 1) {
                         provinceSelect.value = provinces[0].code;
                         provinceSelect.dispatchEvent(new Event('change'));
                     }
                 }
             }
        });

        provinceSelect?.addEventListener('change', () => {
             reset(citySelect); reset(barangaySelect);
             const code = provinceSelect.value;
             const regionCode = regionSelect.value;
             if (code) {
                 const cities = PsgcService.getCities(code, regionCode);
                 if (cities.length > 0) {
                     citySelect.disabled = false;
                     cities.forEach(c => {
                         const opt = document.createElement('option');
                         opt.value = c.code;
                         opt.innerText = c.name;
                         citySelect.appendChild(opt);
                     });
                 }
             }
        });

        citySelect?.addEventListener('change', () => {
             reset(barangaySelect);
             const code = citySelect.value;
             const regionCode = regionSelect.value;
             const provinceCode = provinceSelect.value;
             
             if (code) {
                 const barangays = PsgcService.getBarangays(code, provinceCode, regionCode);
                 if (barangays.length > 0) {
                     barangaySelect.disabled = false;
                     barangays.forEach(b => {
                         const opt = document.createElement('option');
                         opt.value = b.code;
                         opt.innerText = b.name;
                         barangaySelect.appendChild(opt);
                     });
                 }
             }
        });

        // 3. Submit Handler
        form.addEventListener('submit', async (e) => {
             e.preventDefault();
             const btn = document.getElementById('btn-update-address') as HTMLButtonElement;
             btn.disabled = true;
             btn.innerText = "Updating Address...";

             try {
                 const houseStreet = (document.getElementById('update-houseStreet') as HTMLInputElement).value;
                 const region = regionSelect.options[regionSelect.selectedIndex].text;
                 const province = provinceSelect.options[provinceSelect.selectedIndex].text;
                 const city = citySelect.options[citySelect.selectedIndex].text;
                 const barangay = barangaySelect.options[barangaySelect.selectedIndex].text;

                 if (!houseStreet || !regionSelect.value || !provinceSelect.value || !citySelect.value || !barangaySelect.value) {
                     throw new Error("Please complete all address fields.");
                 }

                 if (auth.currentUser) {
                     await setDoc(doc(db, "applications", auth.currentUser.uid), {
                         personalInfo: {
                             address: {
                                 houseStreet, region, province, city, barangay,
                                 updatedAt: new Date().toISOString()
                             }
                         }
                     }, { merge: true });
                     
                     alert("Address updated successfully!");
                     window.location.reload();
                 }

             } catch (error: any) {
                 alert("Error updating address: " + error.message);
             } finally {
                 btn.disabled = false;
                 btn.innerText = "Update Address Record";
             }
        });
    }

    public static initializeSupervisorActions() {
        const btn = document.getElementById('resend-supervisor-btn');
        if (!btn) return;

        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const originalText = btn.innerText;
            btn.innerText = 'Sending...';
            (btn as HTMLButtonElement).disabled = true;

            try {
                const user = auth.currentUser;
                if (!user) throw new Error("Not logged in");

                // Option to edit email
                let options: any = { applicantId: user.uid };
                if (confirm("Would you like to correct the Supervisor's email address before resending?")) {
                    const newEmail = prompt("Enter the correct Supervisor Email:", "");
                    if (newEmail) {
                        if (newEmail.includes('@') && newEmail.includes('.')) {
                             options.newEmail = newEmail;
                        } else {
                            alert("Invalid email format. Cancelled.");
                            (btn as HTMLButtonElement).disabled = false;
                            btn.innerText = originalText;
                            return;
                        }
                    }
                }

                const resendFunc = httpsCallable(functions, 'resendSupervisorEmail');
                await resendFunc(options);
                
                alert('✅ Endorsement request re-sent successfully!');
            } catch (error: any) {
                console.error("Resend error:", error);
                alert('Failed to send: ' + error.message);
            } finally {
                btn.innerText = originalText;
                (btn as HTMLButtonElement).disabled = false;
            }
        });
    }
}
