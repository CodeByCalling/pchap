import { db } from './firebase_config';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, Timestamp, getDocs, getDoc, sum, where } from 'firebase/firestore';
import { MemberDashboard } from './member_dashboard';
import { generateCSV, downloadCSV } from './csv_utils';

export class AdminDashboard {
    private static unsubscribeContributions: (() => void) | null = null;
    private static unsubscribeApplications: (() => void) | null = null;


    /**
     * Action: Export Approved Members
     */
    static async exportMembers(): Promise<void> {
        try {
            const q = query(collection(db, 'applications'), where('finalApprovalStatus', '==', 'approved'));
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) {
                alert('No approved members found to export.');
                return;
            }

            const exportData = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    'Name': `${data.personalInfo?.firstname || ''} ${data.personalInfo?.surname || ''}`.trim(),
                    'Email': data.email || '',
                    'Phone': data.personalInfo?.mobileNumber || '',
                    'Start Date': data.approvedAt ? new Date(data.approvedAt).toLocaleDateString() : (data.submittedAt ? new Date(data.submittedAt).toLocaleDateString() : '')
                };
            });

            const csv = generateCSV(exportData, ['Name', 'Email', 'Phone', 'Start Date']);
            downloadCSV(csv, `PCHAP_Members_${new Date().toISOString().split('T')[0]}.csv`);

        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to export members. Check console for details.');
        }
    }

    /**
     * Action: Export Contributions
     */
    static async exportContributions(): Promise<void> {
        try {
            // Fetch ALL confirmed contributions for official records
            const q = query(collection(db, 'contributions'), orderBy('month', 'desc'));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                alert('No contributions found to export.');
                return;
            }

            // Need to map userIds to names efficiently
            const userIds = new Set(snapshot.docs.map(d => d.data().userId).filter(id => !!id));
            const userMap = new Map<string, string>();

            // Fetch users in batches is better, but for simplicity/robustness here we'll do individual fetches if not cached,
            // OR simpler: just fetch all approved applications again or rely on what we can. 
            // Better: Fetch all needed users in one go? No, Firestore "IN" limit is 10.
            // Client-side join approach:
            // Since we likely have < 1000 members, fetching all applications for the map is actually cheaper/easier than many lookups.
            const usersSnap = await getDocs(collection(db, 'applications'));
            usersSnap.forEach(d => {
                const ud = d.data();
                userMap.set(d.id, `${ud.personalInfo?.firstname || ''} ${ud.personalInfo?.surname || ''}`.trim());
            });

            const exportData = snapshot.docs.map(doc => {
                const data = doc.data();
                const memberName = data.userName || userMap.get(data.userId) || data.userEmail || 'Unknown';
                return {
                    'Month': data.month || '',
                    'Member Name': memberName,
                    'Amount': data.amount || 0,
                    'Ref Number': data.referenceNumber || '', // Assuming this field exists or we leave it blank
                    'Status': data.status,
                    'Date Submitted': data.submittedAt ? new Date(data.submittedAt).toLocaleDateString() : ''
                };
            });

            const csv = generateCSV(exportData, ['Month', 'Member Name', 'Amount', 'Ref Number', 'Status', 'Date Submitted']);
            downloadCSV(csv, `PCHAP_Financials_${new Date().toISOString().split('T')[0]}.csv`);

        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to export contributions. Check console for details.');
        }
    }

    /**
     * Render the admin dashboard with application queue
     */
    static renderDashboard(): string {
        return `
            <section class="container">
                <h2 class="section-title">Admin Review Portal</h2>
                <p style="margin-bottom: 30px;">Review and manage membership applications and monthly contributions.</p>
                
                <!-- Analytics Overview -->
                <div id="analytics-overview" style="margin-bottom: 40px;"></div>

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

                    <!-- Export Button added here -->
                    <div style="margin-bottom: 20px;">
                        <button id="export-members-btn" class="btn btn-outline" style="font-size: 0.9rem;">
                            ⬇ Export Approved Members CSV
                        </button>
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
                        <button class="filter-btn active" data-filter="all">All Contributions</button>
                        <button class="filter-btn" data-filter="pending">Pending</button>
                        <button class="filter-btn" data-filter="confirmed">Confirmed</button>
                        <button class="filter-btn" data-filter="rejected">Rejected</button>
                    </div>

                    <!-- Export Button added here -->
                    <div style="margin-bottom: 20px;">
                        <button id="export-contributions-btn" class="btn btn-outline" style="font-size: 0.9rem;">
                            ⬇ Export Financial CSV
                        </button>
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

                .status-returned {
                    background: #ffdfba;
                    color: #d35400;
                    border: 1px solid #ffb3b3;
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

                .analytics-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 20px;
                    margin-bottom: 30px;
                }
                
                .stat-card {
                    background: white;
                    padding: 25px;
                    border-radius: 15px;
                    box-shadow: var(--soft-shadow);
                    display: flex;
                    flex-direction: column;
                }
                
                .stat-title {
                    color: #666;
                    font-size: 0.9rem;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    margin-bottom: 10px;
                    font-weight: 600;
                }
                
                .stat-value {
                    font-size: 2.5rem;
                    font-weight: 700;
                    color: var(--royal-blue);
                }
                
                .stat-subtitle {
                    color: #888;
                    font-size: 0.9rem;
                    margin-top: 5px;
                }

                .chart-container {
                    background: white;
                    padding: 25px;
                    border-radius: 15px;
                    box-shadow: var(--soft-shadow);
                }
                
                .bar-chart {
                    display: flex;
                    align-items: flex-end;
                    justify-content: space-between;
                    height: 200px;
                    padding-top: 20px;
                    gap: 10px;
                }
                
                .bar-group {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                }
                
                .bar {
                    width: 100%;
                    background: var(--royal-blue);
                    border-radius: 6px 6px 0 0;
                    transition: height 1s ease-out;
                    min-height: 4px;
                    opacity: 0.8;
                }
                
                .bar:hover {
                    opacity: 1;
                }
                
                .bar-label {
                    font-size: 0.8rem;
                    color: #666;
                    font-weight: 600;
                }
                
                .bar-value {
                    font-size: 0.8rem;
                    font-weight: 700;
                    color: #333;
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
        // Setup tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // Switch active button
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                // Show corresponding tab content
                const tab = btn.getAttribute('data-tab');
                document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
                const target = document.getElementById(`${tab}-tab`);
                if (target) target.classList.add('active');
                // Initialize listeners for the selected tab
                if (tab === 'applications') {
                    AdminDashboard.initApplications();
                } else if (tab === 'contributions') {
                    AdminDashboard.initContributions();
                }
            });
        });

        // Initialize Applications tab by default
        AdminDashboard.initApplications();
        
        // Initialize Analytics
        AdminDashboard.renderAnalytics();

        // Export Buttons
        const exportMembersBtn = document.getElementById('export-members-btn');
        if (exportMembersBtn) {
            exportMembersBtn.addEventListener('click', () => {
                const originalText = exportMembersBtn.innerText;
                exportMembersBtn.innerText = 'Generating...';
                AdminDashboard.exportMembers().finally(() => {
                    exportMembersBtn.innerText = originalText;
                });
            });
        }

        const exportContribBtn = document.getElementById('export-contributions-btn');
        if (exportContribBtn) {
            exportContribBtn.addEventListener('click', () => {
                const originalText = exportContribBtn.innerText;
                exportContribBtn.innerText = 'Generating...';
                AdminDashboard.exportContributions().finally(() => {
                    exportContribBtn.innerText = originalText;
                });
            });
        }
    }

    /**
     * Render Analytics with Real-Time Stats
     */
    static async renderAnalytics(): Promise<void> {
        const container = document.getElementById('analytics-overview');
        if (!container) return;

        // Skeleton Loading State
        container.innerHTML = `
            <div class="analytics-grid">
                <div class="stat-card">
                    <div class="stat-title">Total Funds Raised</div>
                    <div class="skeleton" style="height: 40px; width: 150px; background: #f0f0f0; border-radius: 8px;">Loading...</div>
                </div>
                <div class="stat-card">
                    <div class="stat-title">Approval Rate</div>
                    <div class="skeleton" style="height: 40px; width: 100px; background: #f0f0f0; border-radius: 8px;">Loading...</div>
                </div>
            </div>
            <div class="chart-container">
                <div class="stat-title">Contributions (Last 6 Months)</div>
                <div class="skeleton" style="height: 200px; width: 100%; background: #f0f0f0; border-radius: 8px;">Loading...</div>
            </div>
        `;

        try {
            // ROBUST (Client-Side) Calculation Strategy
            // Since dataset is small (<10k), we can fetch all relevant docs once to ensure stability.
            
            // 1. Applications Stats
            const appsSnap = await getDocs(collection(db, 'applications'));
            const totalApps = appsSnap.size;
            const approvedApps = appsSnap.docs.filter(d => d.data().finalApprovalStatus === 'approved').length;
            const conversionRate = totalApps > 0 ? ((approvedApps / totalApps) * 100).toFixed(1) : '0.0';

            // 2. Contributions Stats (Funds & Chart)
            const contribSnap = await getDocs(query(collection(db, 'contributions'), orderBy('month', 'asc'))); // Order by month for chart
            let totalFunds = 0;
            const chartMap = new Map<string, number>();
            
            // Initialize last 6 months in map
            const last6Months = [];
            const today = new Date();
            for (let i = 5; i >= 0; i--) {
                const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                const label = d.toLocaleString('default', { month: 'short' });
                last6Months.push({ key, label });
                chartMap.set(key, 0);
            }

            contribSnap.forEach(doc => {
                const data = doc.data();
                if (data.status === 'confirmed') {
                    totalFunds += (Number(data.amount) || 0);
                    
                    // Add to chart if within range
                    if (chartMap.has(data.month)) {
                        chartMap.set(data.month, chartMap.get(data.month)! + (Number(data.amount) || 0));
                    }
                }
            });

            const chartData = last6Months.map(m => ({
                label: m.label,
                value: chartMap.get(m.key) || 0
            }));

            const maxValue = Math.max(...chartData.map(d => d.value), 1);

            // Render Final HTML
            container.innerHTML = `
                <div class="analytics-grid">
                    <div class="stat-card">
                        <div class="stat-title">Total Funds Raised</div>
                        <div class="stat-value">₱${totalFunds.toLocaleString()}</div>
                        <div class="stat-subtitle">Confirmed Contributions</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-title">Approval Rate</div>
                        <div class="stat-value">${conversionRate}%</div>
                        <div class="stat-subtitle">${approvedApps} of ${totalApps} Applications</div>
                    </div>
                </div>

                <div class="chart-container">
                    <div class="stat-title">Contributions Overview</div>
                    <div class="bar-chart">
                        ${chartData.map(data => `
                            <div class="bar-group">
                                <span class="bar-value">₱${data.value > 0 ? (data.value / 1000).toFixed(1) + 'k' : '0'}</span>
                                <div class="bar" style="height: ${(data.value / maxValue) * 100}%;"></div>
                                <span class="bar-label">${data.label}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;

        } catch (error: any) {
            console.error('Error loading analytics:', error);
            container.innerHTML = `
                <div style="background: #fff3cd; color: #856404; padding: 20px; border-radius: 8px;">
                    <strong>Failed to load analytics:</strong> ${error.message}. <br><small>Please check rights/console.</small>
                </div>
            `;
        }
    }

    /**
     * Initialize Applications listener
     */
    static initApplications(): void {
        // Unsubscribe from previous listener if it exists
        if (AdminDashboard.unsubscribeApplications) {
            AdminDashboard.unsubscribeApplications();
            AdminDashboard.unsubscribeApplications = null;
        }

        const tbody = document.getElementById('admin-applications-table');
        if (!tbody) return;
        let currentFilter = 'all';
        // Filter button listeners (reuse existing logic)
        // Filter button listeners (Applications)
        const tabContainer = document.getElementById('applications-tab');
        if (tabContainer) {
            tabContainer.querySelectorAll('.filter-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    tabContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    currentFilter = btn.getAttribute('data-filter') || 'all';
                    // Re-render will happen in onSnapshot callback using currentFilter variable
                    // We need to manually trigger a refresh or just let the next snapshot update it.
                    // However, since onSnapshot is already running, we can just let it be if we store currentFilter in a scope accessible to the callback
                    // BUT: The callback captures the variable 'currentFilter' from the outer scope of initApplications.
                    // So changing it here works! But we need to re-run the render logic.
                    // Since snapshot listener is active, we can't easily force it to re-run without a new snapshot.
                    // Hack: We will just call the render function if we extract it, OR simpler:
                    // We just re-issue the query or rely on the fact that we might need to store the snapshot to re-render.
                    // Let's refactor slightly to store snapshot
                });
            });
        }
        
        let lastSnapshot: any = null;

        const renderTable = () => {
             if (!lastSnapshot) return;
             tbody.innerHTML = '';
             if (lastSnapshot.empty) {
                tbody.innerHTML = '<tr><td colspan="6" style="padding: 20px; text-align: center;">No applications found.</td></tr>';
                return;
            }
            let filteredCount = 0;
            lastSnapshot.forEach((docSnap: any) => {
                const data = docSnap.data();
                const appId = docSnap.id;
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
            document.querySelectorAll('.view-app-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const appId = btn.getAttribute('data-app-id');
                    if (appId) {
                        const appDoc = lastSnapshot.docs.find((d: any) => d.id === appId);
                        if (appDoc) {
                            AdminDashboard.showApplicationDetail(appDoc.id, appDoc.data());
                        }
                    }
                });
            });
        };

        // Update listener to call renderTable
        if(tabContainer) {
             tabContainer.querySelectorAll('.filter-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    // Update active class
                    tabContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    currentFilter = btn.getAttribute('data-filter') || 'all';
                    renderTable();
                });
            });
        }
        
        const q = query(collection(db, 'applications'), orderBy('submittedAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            lastSnapshot = snapshot;
            renderTable();
        }, (error) => {
            console.error('Error fetching applications:', error);
            tbody.innerHTML = '<tr><td colspan="6" style="padding: 20px; text-align: center; color: red;">Error loading data. Check console.</td></tr>';
        });
        AdminDashboard.unsubscribeApplications = unsubscribe;
    }

    /**
     * Initialize Contributions listener
     */
    /**
     * Initialize Contributions listener
     */
    static initContributions(): void {
        const tbody = document.getElementById('admin-contributions-table');
        if (!tbody) return;
        let currentFilter = 'all';
        let lastSnapshot: any = null;
        
        // Cache for member names: userId -> "Firstname Surname"
        const nameCache = new Map<string, string>();

        const renderTable = async () => {
            if (!lastSnapshot) return;
            tbody.innerHTML = '';
            
            if (lastSnapshot.empty) {
                tbody.innerHTML = '<tr><td colspan="6" style="padding: 20px; text-align: center;">No contributions found.</td></tr>';
                return;
            }

            // Identify users who need name resolution (missing userName in contribution AND not in cache)
            const userIdsToFetch = new Set<string>();
            lastSnapshot.docs.forEach((d: any) => {
                const data = d.data();
                if (!data.userName && data.userId && !nameCache.has(data.userId)) {
                    userIdsToFetch.add(data.userId);
                }
            });

            // Batch fetch missing names (concurrently)
            if (userIdsToFetch.size > 0) {
                 tbody.innerHTML = '<tr><td colspan="6" style="padding: 20px; text-align: center;">Loading member details...</td></tr>';
                 await Promise.all(Array.from(userIdsToFetch).map(async (uid) => {
                     try {
                         const userDoc = await getDoc(doc(db, 'applications', uid));
                         if (userDoc.exists()) {
                             const uData = userDoc.data();
                             if (uData.personalInfo?.firstname) {
                                 nameCache.set(uid, `${uData.personalInfo.firstname} ${uData.personalInfo.surname}`);
                             } else {
                                 nameCache.set(uid, uData.email || 'Unknown');
                             }
                         }
                     } catch (e) {
                         console.error("Failed to fetch user name for", uid, e);
                     }
                 }));
                 // clear loading message
                 tbody.innerHTML = '';
            }

            let filteredCount = 0;
            // Filter logic
            lastSnapshot.forEach((docSnap: any) => {
                const data = docSnap.data();
                const contribId = docSnap.id;

                if (currentFilter !== 'all') {
                    if (currentFilter === 'pending' && data.status !== 'pending') return;
                    if (currentFilter === 'confirmed' && data.status !== 'confirmed') return;
                    if (currentFilter === 'rejected' && data.status !== 'rejected') return;
                }
                filteredCount++;
                
                const isPending = data.status === 'pending';
                // RESOLVE NAME: stored userName > cached name > userEmail
                const displayName = data.userName || nameCache.get(data.userId) || data.userEmail || 'Unknown';

                const row = `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 15px;">
                            <strong>${displayName}</strong><br>
                            <span style="font-size: 0.8em; color: #888;">${data.userEmail || ''}</span>
                        </td>
                        <td style="padding: 15px;">${MemberDashboard.formatMonth(data.month)}</td>
                        <td style="padding: 15px; font-weight: 600;">₱${data.amount}</td>
                        <td style="padding: 15px;">
                            <small>${new Date(data.submittedAt).toLocaleDateString()}</small>
                        </td>
                        <td style="padding: 15px;">
                            <span class="status-badge status-${data.status}">${data.status.toUpperCase()}</span>
                        </td>
                        <td style="padding: 15px;">
                            <div style="display: flex; gap: 5px;">
                                ${data.receiptUrl ? `<a href="${data.receiptUrl}" target="_blank" class="btn btn-outline" style="padding: 5px 10px; font-size: 0.8rem;">View</a>` : ''}
                                ${isPending ? `
                                    <button class="btn btn-primary confirm-contrib-btn" data-id="${contribId}" style="padding: 5px 10px; font-size: 0.8rem; background: #28a745; border-color: #28a745;">✓</button>
                                    <button class="btn btn-outline reject-contrib-btn" data-id="${contribId}" style="padding: 5px 10px; font-size: 0.8rem; color: #dc3545; border-color: #dc3545;">✗</button>
                                ` : ''}
                            </div>
                        </td>
                    </tr>
                `;
                tbody.innerHTML += row;
            });
             if (filteredCount === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="padding: 20px; text-align: center;">No contributions match this filter.</td></tr>';
            }

            // Attach listeners
             document.querySelectorAll('.confirm-contrib-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
                    if (id) await AdminDashboard.updateContributionStatus(id, 'confirmed');
                });
            });

            document.querySelectorAll('.reject-contrib-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
                    if (id && confirm('Reject this contribution?')) {
                        await AdminDashboard.updateContributionStatus(id, 'rejected');
                    }
                });
            });
        };

        const tabContainer = document.getElementById('contributions-tab');
        if (tabContainer) {
            tabContainer.querySelectorAll('.filter-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    tabContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    currentFilter = btn.getAttribute('data-filter') || 'all';
                    renderTable();
                });
            });
        }

        const q = query(collection(db, 'contributions'), orderBy('submittedAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            lastSnapshot = snapshot;
            renderTable();
        }, (error) => {
            console.error('Error fetching contributions:', error);
            tbody.innerHTML = '<tr><td colspan="6" style="padding: 20px; text-align: center; color: red;">Error loading contributions.</td></tr>';
        });
        AdminDashboard.unsubscribeContributions = unsubscribe;
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
                    <div class="docs-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px;">
                        ${data.documents?.idCard ? `
                            <div class="doc-card">
                                <p style="font-weight:600; font-size: 0.9em; margin-bottom: 5px;">ID Card</p>
                                <img src="${data.documents.idCard}" class="doc-preview" onclick="window.open('${data.documents.idCard}', '_blank')" style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px; cursor: pointer; border: 1px solid #ddd; transition: transform 0.2s;">
                            </div>
                        ` : ''}
                        ${data.documents?.photo ? `
                            <div class="doc-card">
                                <p style="font-weight:600; font-size: 0.9em; margin-bottom: 5px;">Photo</p>
                                <img src="${data.documents.photo}" class="doc-preview" onclick="window.open('${data.documents.photo}', '_blank')" style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px; cursor: pointer; border: 1px solid #ddd; transition: transform 0.2s;">
                            </div>
                        ` : ''}
                        ${data.documents?.receipt ? `
                            <div class="doc-card">
                                <p style="font-weight:600; font-size: 0.9em; margin-bottom: 5px;">Receipt</p>
                                <img src="${data.documents.receipt}" class="doc-preview" onclick="window.open('${data.documents.receipt}', '_blank')" style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px; cursor: pointer; border: 1px solid #ddd; transition: transform 0.2s;">
                            </div>
                        ` : ''}
                        ${data.documents?.annexA ? `
                            <div class="doc-card">
                                <p style="font-weight:600; font-size: 0.9em; margin-bottom: 5px;">Annex A (Form)</p>
                                <img src="${data.documents.annexA}" class="doc-preview" onclick="window.open('${data.documents.annexA}', '_blank')" style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px; cursor: pointer; border: 1px solid #ddd; transition: transform 0.2s;">
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div class="info-section">
                    <h3>Admin Actions</h3>
                    <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                        ${canApproveForReview ? '<button id="approve-review-btn" class="btn btn-primary">✓ Approve for Review</button>' : ''}
                        ${canFinalApprove ? '<button id="final-approve-btn" class="btn btn-primary">✓ Final Approval</button>' : ''}
                        ${data.status !== 'Rejected' ? '<button id="reject-app-btn" class="btn" style="background: #dc3545; color: white;">✗ Reject Application</button>' : ''}
                        <button id="request-changes-btn" class="btn btn-outline" style="background: #fff3cd; color: #856404; border-color: #ffeeba;">Request Changes</button>
                        <button id="add-note-btn" class="btn btn-outline">Add Admin Note</button>
                    </div>
                </div>

                <div id="note-form" style="display: none; margin-top: 2rem;">
                    <h4 style="margin-bottom: 10px;">Add Internal Note</h4>
                    <textarea id="admin-note-text" rows="3" style="width: 100%; padding: 1rem; border: 2px solid #ddd; border-radius: 8px;" placeholder="Enter internal admin note..."></textarea>
                    <div style="margin-top: 1rem; display: flex; gap: 1rem;">
                        <button id="save-note-btn" class="btn btn-primary">Save Note</button>
                        <button id="cancel-note-btn" class="btn btn-outline">Cancel</button>
                    </div>
                </div>

                <div id="request-changes-form" style="display: none; margin-top: 2rem; background: #fff3cd; padding: 20px; border-radius: 8px;">
                    <h4 style="margin-bottom: 10px; color: #856404;">Request Changes from Applicant</h4>
                    <p style="margin-bottom: 10px; font-size: 0.9rem; color: #666;">This note will be visible to the applicant and their status will be set to 'Returned'.</p>
                    <textarea id="return-note-text" rows="3" style="width: 100%; padding: 1rem; border: 2px solid #ffeeba; border-radius: 8px;" placeholder="Explain what needs to be changed..."></textarea>
                    <div style="margin-top: 1rem; display: flex; gap: 1rem;">
                        <button id="submit-return-btn" class="btn btn-primary" style="background: #856404; border-color: #856404;">Submit & Return Application</button>
                        <button id="cancel-return-btn" class="btn btn-outline" style="background: white;">Cancel</button>
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
            document.getElementById('request-changes-form')!.style.display = 'none';
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

        // Request Changes Handlers
        document.getElementById('request-changes-btn')?.addEventListener('click', () => {
            document.getElementById('request-changes-form')!.style.display = 'block';
            document.getElementById('note-form')!.style.display = 'none';
        });

        document.getElementById('cancel-return-btn')?.addEventListener('click', () => {
            document.getElementById('request-changes-form')!.style.display = 'none';
        });

        document.getElementById('submit-return-btn')?.addEventListener('click', async () => {
            const noteText = (document.getElementById('return-note-text') as HTMLTextAreaElement).value;
            if (noteText.trim()) {
                if (confirm('Return application to member for changes?')) {
                    try {
                        const appRef = doc(db, 'applications', appId);
                        const docSnap = await getDoc(appRef);
                        const currentNotes = docSnap.exists() ? (docSnap.data().adminNotes || []) : [];
                        
                        await updateDoc(appRef, {
                            adminReviewStatus: 'returned',
                            status: 'Returned for Changes',
                            adminNotes: [
                                ...currentNotes,
                                {
                                    note: `[RETURNED] ${noteText}`,
                                    by: 'Admin (Request Changes)',
                                    at: new Date().toISOString()
                                }
                            ],
                            updatedAt: new Date().toISOString()
                        });
                        
                        alert('Application returned to member.');
                        modal.classList.remove('active');
                    } catch (error: any) {
                        alert('Error returning application: ' + error.message);
                    }
                }
            } else {
                alert('Please enter a reason for returning the application.');
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
            const docSnap = await getDoc(appRef);
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

    /**
     * Update contribution status
     */
    static async updateContributionStatus(contribId: string, status: string): Promise<void> {
        try {
            const docRef = doc(db, 'contributions', contribId);
            await updateDoc(docRef, {
                status: status,
                reviewedAt: new Date().toISOString(),
                // updatedBy: 'Admin' // basic audit
            });
            // The real-time listener will refresh the UI automatically
        } catch (error: any) {
            console.error('Error updating contribution:', error);
            alert('Failed to update status: ' + error.message);
        }
    }
}
