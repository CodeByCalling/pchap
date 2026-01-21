import './style.css'
import './application.css'
import { PCHAPApplication } from './application'
import { EndorsementSystem } from './endorsement'
import { AdminDashboard } from './admin_dashboard'
import { MemberDashboard } from './member_dashboard'
import { auth, db } from './firebase_config'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from 'firebase/auth'
import { doc, getDoc, collection, onSnapshot, query, orderBy } from 'firebase/firestore'

const app = document.querySelector<HTMLDivElement>('#app')!

// --- State ---
let currentUser: User | null = null;
let isAdmin = false; // We'll fetch this from a custom claim or Firestore

// Local unsubscribe function to clean up listeners when navigating away
let unsubscribeAdmin: (() => void) | null = null;


const faqs = [
  { q: "Is PCHAP an insurance product?", a: "No. PCHAP is not an insurance plan and is not regulated by the Insurance Commission of the Philippines. It is a faith-based, mutual aid program under J29 Corporation, designed to provide voluntary assistance based on fund availability." },
  { q: "Are the benefits guaranteed?", a: "No. All assistance is subject to fund availability and the approval of the Board of Trustees. While PCHAP provides projected amounts, no benefit is promised or guaranteed." },
  { q: "Why sign a waiver?", a: "The waiver ensures members understand the non-insurance nature of the program. It confirms that assistance is not guaranteed and contributions are non-refundable." },
  { q: "What is PCHAP?", a: "PCHAP is a voluntary, community-based financial assistance program for pastors, full-time workers, and lay leaders within Jesus Reigns Ministries, funded by members and managed by J29 Corporation." },
  { q: "Monthly contribution amount?", a: "Each active member is expected to contribute ₱500 per month. This must be consistent to remain eligible for assistance." },
  { q: "Types of assistance available?", a: "Members may apply for medical/hospitalization aid, annual physical exam reimbursement (up to ₱2,000), and bereavement/funeral assistance." },
  { q: "Waiting period for assistance?", a: "You must complete six (6) continuous months of contributions before becoming eligible to apply for any form of assistance." },
  { q: "Effect of missed contributions?", a: "Failing to contribute for three (3) consecutive months may lead to suspension of eligibility until contributions are updated." },
  { q: "Are contributions refundable?", a: "No. All contributions are non-refundable and non-transferable, regardless of membership duration or whether aid was received." },
  { q: "Spouse and children coverage?", a: "Spouses join for the same ₱500/month. Children under 18 can be listed. Children 18+ must apply separately if eligible." },
  { q: "Are retirees eligible?", a: "Yes. Retired JRM pastors and FTWs are eligible under the same requirements (₱500/month and 6-month waiting period)." },
  { q: "How to apply for assistance?", a: "Submit an Assistance Request Form with supporting medical or official documents. All requests require Board approval." }
];

// --- Components ---

const renderNavbar = (active: string) => {
  const isAuth = !!currentUser;
  return `
  <header>
    <nav class="container">
      <a href="#home" class="logo">
        <span class="logo-main"><span class="text-gold">PCHAP</span> <span style="color: white;">DIGITAL</span></span>
        <span class="logo-tagline">Pastor's Care Health Assistance Program</span>
      </a>
      <div class="nav-links">
        <a href="#home" class="${active === 'home' ? 'active' : ''}">Home</a>
        <a href="#about" class="${active === 'about' ? 'active' : ''}">About</a>
        <a href="#rules" class="${active === 'rules' ? 'active' : ''}">Rules</a>
        <a href="#faq" class="${active === 'faq' ? 'active' : ''}">FAQ</a>
        <a href="#payment" class="${active === 'payment' ? 'active' : ''}">How to Pay</a>
        <a href="#policy" class="${active === 'policy' ? 'active' : ''}">Policy Manual</a>
        ${!isAuth ? '<a href="#login" class="btn btn-primary" style="padding: 8px 20px;">Login</a>' : 
          `<a href="#dashboard" class="${active === 'dashboard' ? 'active' : ''}">Dashboard</a>
           <a href="#" id="logout-btn" style="color: var(--gold); font-weight: 700;">Logout</a>`}
      </div>
      <button class="mobile-menu-btn" aria-label="Toggle Menu">
        <span></span>
        <span></span>
        <span></span>
      </button>
    </nav>
  </header>
`};

const renderFooter = () => `
  <footer>
    <div class="container">
      <div class="footer-content">
        <div>
          <h3 style="color: var(--royal-blue); margin-bottom: 1rem;">PCHAP</h3>
          <p>Serving the health needs of our ministry workers with compassion and integrity.</p>
        </div>
        <div>
          <h4>Partner</h4>
          <p>Jesus Reigns Ministries</p>
          <p>J29 Foundation, Inc.</p>
        </div>
        <div>
          <h4>Legal</h4>
          <p><a href="#rules" style="text-decoration: none; color: inherit;">Eligibility</a></p>
          <p><a href="#faq" style="text-decoration: none; color: inherit;">FAQs</a></p>
          <p><a href="#policy" style="text-decoration: none; color: inherit; font-weight: 600; color: var(--gold);">Overview of Policy Manual</a></p>
          <p><a href="/policies/PCHAP_policy_Version.3.2.pdf" target="_blank" style="text-decoration: none; color: var(--gold); font-size: 0.85rem; display: flex; align-items: center; gap: 5px; margin-top: 10px;">
            <span>📄</span> Policy PDF (View/Download)
          </a></p>
        </div>
      </div>
      <div class="footer-bottom">
        &copy; 2025 PCHAP - Pastor's Care Health Assistance Program. Not an insurance product. Operated by J29 Foundation, Inc.
      </div>
    </div>
  </footer>
`;

// --- Routes ---

const routes: Record<string, () => string | Promise<string>> = {
  home: () => `
    <section id="hero">
      <div class="hero-content" style="text-align: center;">
        <h1>Official PCHAP <span class="text-gold">Online Application Portal</span></h1>
        <p style="margin: 0 auto 50px;">Serving the health needs of our ministry workers with compassion and integrity. Rooted in biblical principles of shared responsibility.</p>
        <div class="hero-btns" style="justify-content: center;">
          <button class="btn btn-primary nav-cta">Apply Now</button>
          <a href="#rules" class="btn btn-outline">Learn More</a>
        </div>
      </div>
    </section>
    
    <section class="container" style="padding-top: 50px;">
      <div class="alert alert-danger" style="text-align: center; border-left: 5px solid #721c24; background: #fce8e9;">
        <h4 style="margin-bottom: 8px;">MANDATORY DISCLAIMER</h4>
        <p>PCHAP is <strong>NOT</strong> an insurance product and is not regulated by the Insurance Commission of the Philippines. It is operated by <strong>J29 Foundation, Inc.</strong> as a mutual aid program.</p>
      </div>
      
      <div class="cards-grid">
        <div class="card">
          <h3 class="text-gold">Our Mission</h3>
          <p>The PCHAP was initiated as a compassionate response to the growing medical and financial needs of pastors, full-time workers, and lay leaders. We ensure ministry workers face emergencies with shared stewardship.</p>
        </div>
        <div class="card">
          <h3 class="text-gold">Mutual Aid</h3>
          <p>Rooted in biblical principles, PCHAP functions as a community-based, voluntary contribution system where members bear one another's burdens.</p>
        </div>
      </div>
    </section>
  `,
  about: () => `
    <div class="page-title-section">
      <div class="container">
        <h1 class="page-title">About PCHAP</h1>
      </div>
    </div>
    <section class="container">
      <h2 class="section-title">Background and Rationale</h2>
      <div class="card" style="margin-bottom: 2rem;">
        <p>The Pastor’s Care Health Assistance Program (PCHAP) was initiated as a compassionate response to the growing medical and financial needs of pastors, full-time workers, and lay leaders within the Jesus Reigns Ministries (JRM) network.</p>
        <p style="margin-top: 15px;">It provides a safety net for those dedicated to God's work, ensuring that ministry workers face emergencies with shared stewardship rather than alone.</p>
      </div>
      <div class="glass-card" style="margin-top: 3rem; background: var(--royal-blue); color: white;">
        <h3 style="color: var(--gold);">Legal Compliance</h3>
        <p>Operated under <strong>J29 Foundation, Inc.</strong>, the program is a non-stock, non-profit, faith-based mutual aid program. It is not an insurance product and does not fall under RA 10607 or RA 9829.</p>
        <a href="#policy" class="btn btn-outline" style="margin-top: 25px; border-color: var(--gold); color: var(--gold);">Read Full Legal Basis</a>
      </div>
    </section>
  `,
  rules: () => `
    <div class="page-title-section">
      <div class="container">
        <h1 class="page-title">Rules & Eligibility</h1>
      </div>
    </div>
    <section class="container">
      <div class="cards-grid">
        <div class="card">
          <h3 class="text-gold">Membership Guidelines</h3>
          <p style="margin-bottom: 15px; font-size: 0.95rem;">Eligible participants include JRM Pastors, FTWs, Pastoral Staff, Lay Pastors, and DG Heads. Applicants must be between 18 and 70 years old and endorsed by their senior pastor.</p>
          <ul style="padding-left: 20px;">
            <li>Standard Contribution: <strong>₱500 / month</strong></li>
            <li>Retirees (over 70): <strong>₱250 / month</strong></li>
          </ul>
        </div>
        <div class="card">
          <h3 class="text-gold">Eligibility Milestone</h3>
          <p><strong>6 continuous months</strong> of contributions are required before becoming eligible to request assistance.</p>
          <hr style="margin: 15px 0; opacity: 0.1;">
          <p style="font-size: 0.9rem; color: #cc0000; font-weight: 600;">Suspension Rule:</p>
          <p style="font-size: 0.85rem;">Missing <strong>3 consecutive months</strong> of payments leads to automated suspension of eligibility.</p>
        </div>
      </div>

      <div style="margin-top: 80px;">
        <h2 class="section-title">Projected Assistance Table</h2>
        <p style="margin-bottom: 30px; text-align: center; max-width: 800px; margin-left: auto; margin-right: auto;">
          Non-guaranteed assistance coverage based on active membership size. All aid is subject to fund availability and Board approval.
        </p>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Active Members</th>
                <th>Monthly Fund</th>
                <th>Annual Fund</th>
                <th style="color: var(--gold-light);">Max Assistance</th>
              </tr>
            </thead>
            <tbody>
              ${[100, 300, 500, 700, 1000].map(m => `
                <tr>
                  <td>${m} Members</td>
                  <td>₱${(m * 500).toLocaleString()}</td>
                  <td>₱${(m * 500 * 12).toLocaleString()}</td>
                  <td style="font-weight: 700; color: var(--royal-blue-light);">Up to ₱${(m * 100).toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div style="text-align: center; margin-top: 40px;">
        <a href="#policy" class="btn btn-primary">View Full Policy Guidelines</a>
      </div>
    </section>
  `,
  faq: () => `
    <div class="page-title-section">
      <div class="container">
        <h1 class="page-title">Frequently Asked Questions</h1>
      </div>
    </div>
    <section class="container">
      <div style="max-width: 800px; margin: 0 auto 3rem;">
        <input type="text" id="faq-search" placeholder="Search for answers..." style="width: 100%; padding: 1.2rem; border: 2px solid #eee; border-radius: 50px; outline: none; box-shadow: var(--soft-shadow);" />
      </div>
      <div id="faq-list" style="max-width: 800px; margin: 0 auto;"></div>
    </section>
  `,
  policy: () => `
    <div class="page-title-section">
      <div class="container">
        <h1 class="page-title">Overview of Policy Manual</h1>
      </div>
    </div>
    <section class="container policy-content">
      <div class="card" style="padding: 40px; margin-bottom: 40px; border-top: 5px solid var(--royal-blue);">
        <p style="font-style: italic; color: #666; margin-bottom: 2rem; border-bottom: 1px solid #eee; padding-bottom: 10px;">“Serving the health needs of our ministry workers with compassion and integrity.”</p>
        
        <div style="margin-bottom: 2rem; padding: 15px; background: rgba(184, 134, 11, 0.1); border-radius: 8px; border-left: 4px solid var(--gold);">
          <p style="margin: 0; font-weight: 600; color: var(--royal-blue);">
            You can see the full detailed policy manual <a href="/policies/PCHAP_policy_Version.3.2.pdf" target="_blank" style="color: var(--gold); text-decoration: underline;">here</a>. 
            You can download it to read.
          </p>
        </div>

        <div class="policy-section">
          <h3>1. Introduction</h3>
          <p>The PCHAP serves as the official policy manual for the Pastor’s Care Health Assistance Program. It outlines objectives, eligibility, contributions, and administrative processes.</p>
          <p><strong>Non-Insurance Nature:</strong> This program is not an insurance product. It is a community-based, voluntary mutual aid system.</p>
        </div>

        <div class="policy-section">
          <h3>2. Organizational Framework</h3>
          <p>PCHAP operates under <strong>J29 Corporation</strong>, a registered non-stock, non-profit organization. Governance is provided by a Board of Trustees.</p>
        </div>

        <div class="policy-section">
          <h3>3. Program Objectives</h3>
          <p>To provide medical and hospitalization support, extend bereavement aid, and encourage shared responsibility among ministry workers.</p>
        </div>

        <div class="policy-section">
          <h3>4. Membership Guidelines</h3>
          <p><strong>Eligible participants:</strong> JRM Pastors, FTWs, Pastoral Staff, Lay Pastors, DG Heads, and retirees. Endorsement by a senior pastor is mandatory.</p>
          <p><strong>Age:</strong> 18 to 70 years old at enrollment.</p>
        </div>

        <div class="policy-section">
          <h3>5. Contributions & Financial Rules</h3>
          <p>Monthly contribution is ₱500. Retirees over 70 contribute ₱250. Contributions are non-refundable and non-transferable.</p>
        </div>

        <div class="policy-section">
          <h3>6. Scope of Assistance</h3>
          <p>Covers hospital confinement, surgery, and emergency care. Annual physical exam reimbursement up to ₱2,000 after 12 months.</p>
        </div>

        <div class="policy-section">
          <h3>7. Disbursement Process</h3>
          <p>Requests require complete documentation (medical certificates, receipts). Priority is based on urgency and fund availability.</p>
        </div>

        <div class="policy-section">
          <h3>8. Rights and Responsibilities</h3>
          <p>Members have the right to quarterly reports and the responsibility to maintain active, consistent contributions.</p>
        </div>

        <div class="policy-section">
          <h3>9. Legal and Compliance</h3>
          <div class="alert alert-danger">
            <strong>MANDATORY DISCLAIMER:</strong> PCHAP is NOT an insurance product. All assistance is non-guaranteed and subject to fund availability.
          </div>
        </div>

        <div class="policy-section">
          <h3>10. Reporting & Transparency</h3>
          <p>Quarterly financial reports detailing total contributions and disbursements are submitted to the Board and shared with members.</p>
        </div>

        <div class="policy-section">
          <h3>11. Operational Structure</h3>
          <p>The partnership between JRM and J29 Foundation ensure both legal integrity and spiritual alignment.</p>
        </div>

        <div class="policy-section">
          <h3>12. Policy Supremacy</h3>
          <p>This v3.2 Manual is the official governing reference for all PCHAP matters. Revisions are subject to Board approval.</p>
        </div>
      </div>
      
      <div style="text-align: center; margin-bottom: 50px;">
        <button class="btn btn-primary nav-cta">Join PCHAP Today</button>
      </div>
    </section>
  `,
  payment: () => `
    <div class="page-title-section">
      <div class="container">
        <h1 class="page-title">How to Pay</h1>
      </div>
    </div>
    <section class="container">
      <div class="card" style="max-width: 600px; margin: 0 auto; text-align: center; padding: 40px;">
        <h2 style="color: var(--royal-blue); margin-bottom: 20px;">Contribution Remittance</h2>
        <p style="margin-bottom: 30px;">Please remit your monthly contributions or initial payment to our official bank account.</p>
        
        <div style="background: #f8f9fa; padding: 25px; border-radius: 15px; border: 2px solid #eee; text-align: left;">
            <div style="margin-bottom: 15px;">
                <label style="font-size: 0.8rem; color: #666; text-transform: uppercase; font-weight: 700;">Bank Name</label>
                <div style="font-size: 1.2rem; color: var(--royal-blue); font-weight: 600;">Development Bank of the Philippines (DBP)</div>
            </div>
            <div style="margin-bottom: 15px;">
                <label style="font-size: 0.8rem; color: #666; text-transform: uppercase; font-weight: 700;">Account Name</label>
                <div style="font-size: 1.2rem; color: var(--royal-blue); font-weight: 600;">Jesus Reigns Ministries, Inc.</div>
            </div>
            <div style="margin-bottom: 15px;">
                <label style="font-size: 0.8rem; color: #666; text-transform: uppercase; font-weight: 700;">Savings Account Number</label>
                <div style="font-size: 1.5rem; color: var(--royal-blue); font-weight: 700; font-family: monospace;">00-5-02917-411-6</div>
            </div>
            <div>
                <label style="font-size: 0.8rem; color: #666; text-transform: uppercase; font-weight: 700;">Branch</label>
                <div style="font-size: 1.1rem; color: var(--royal-blue); font-weight: 600;">DBP Manila-Nakpil</div>
            </div>
        </div>
        
        <div class="alert alert-info" style="margin-top: 30px;">
            <strong>Important:</strong> Keep your deposit slip or screenshot as proof of payment. You will need to upload this during your application or assistance request.
        </div>
      </div>
    </section>
  `,
  login: () => `
    <section class="container" style="display: flex; justify-content: center; align-items: center; min-height: 60vh;">
      <div class="card" style="width: 100%; max-width: 400px; padding: 40px;">
        <h2 style="text-align: center; margin-bottom: 30px;">Member Sign In</h2>
        
        <div class="alert alert-info" style="margin-bottom: 25px; padding: 15px; background: #d1ecf1; border-left: 4px solid #0c5460; border-radius: 6px;">
          <strong>Demo Accounts:</strong><br>
          <small>
            Admin: <code>admin@pchap.org</code><br>
            Member: <code>member@pchap.org</code><br>
            Password: <code>password123</code>
          </small>
        </div>
        
        <div id="login-form">
          <div class="form-group" style="margin-bottom: 20px;">
            <label>Email Address</label>
            <input type="email" id="username" placeholder="your.email@example.com" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #ddd;">
          </div>
          <div class="form-group" style="margin-bottom: 30px;">
            <label>Password</label>
            <input type="password" id="password" placeholder="Enter your password" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #ddd;">
          </div>
          <button id="do-login" class="btn btn-primary" style="width: 100%;">Sign In</button>
        </div>
      </div>
    </section>
  `,
  dashboard: async () => {
    if (!currentUser) return routes.login();
    
    // Admin Dashboard
    if (isAdmin) {
      return AdminDashboard.renderDashboard();
    }

    // Member Dashboard - fetch real data
    return await MemberDashboard.renderDashboard(currentUser.uid);
  },
  endorse: () => {
    // Handled specially in navigate function
    return '';
  }
}

// --- Logic ---

const renderFAQ = (filter = "") => {
  const faqList = document.getElementById('faq-list')
  if (!faqList) return

  const filtered = faqs.filter(f => 
    f.q.toLowerCase().includes(filter.toLowerCase()) || 
    f.a.toLowerCase().includes(filter.toLowerCase())
  )

  faqList.innerHTML = filtered.map((f, i) => `
    <div class="accordion-item" id="faq-${i}">
      <button class="accordion-header" onclick="this.parentElement.classList.toggle('active')">
        ${f.q}
        <span>+</span>
      </button>
      <div class="accordion-content">
        <p>${f.a}</p>
      </div>
    </div>
  `).join('')
}

const navigate = async () => {
  const hash = window.location.hash.slice(1) || 'home';
  const [routePath, queryString] = hash.split('?');
  
  // Special handling for endorsement page (no navbar/footer)
  if (routePath === 'endorse') {
    const params = new URLSearchParams(queryString);
    const token = params.get('token');
    
    if (!token) {
      app.innerHTML = EndorsementSystem.renderErrorPage('No endorsement token provided.');
      return;
    }

    app.innerHTML = '<div style="text-align: center; padding: 50px;">Validating endorsement link...</div>';
    
    try {
      const application = await EndorsementSystem.validateToken(token);
      app.innerHTML = EndorsementSystem.renderEndorsementPage(application, token);
      window.scrollTo({ top: 0, behavior: 'instant' });
      
      // Attach event listeners for approve/reject
      const approveBtn = document.getElementById('approve-btn') as HTMLButtonElement | null;
      const rejectBtn = document.getElementById('reject-btn') as HTMLButtonElement | null;
      const notesInput = document.getElementById('pastor-notes') as HTMLTextAreaElement;
      const statusDiv = document.getElementById('endorsement-status')!;

      approveBtn?.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to approve this application?')) return;
        
        approveBtn.disabled = true;
        rejectBtn!.disabled = true;
        approveBtn.innerText = 'Processing...';

        try {
          await EndorsementSystem.processEndorsement(
            application.id,
            'approve',
            notesInput.value,
            'Senior Pastor'
          );
          
          statusDiv.className = 'status-message success show';
          statusDiv.innerHTML = '✅ Application approved successfully! The applicant will be notified.';
          approveBtn.style.display = 'none';
          rejectBtn!.style.display = 'none';
        } catch (error: any) {
          statusDiv.className = 'status-message error show';
          statusDiv.innerHTML = '❌ Error: ' + error.message;
          approveBtn.disabled = false;
          rejectBtn!.disabled = false;
          approveBtn.innerText = '✓ Approve & Endorse';
        }
      });

      rejectBtn?.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to reject this application?')) return;
        
        rejectBtn.disabled = true;
        approveBtn!.disabled = true;
        rejectBtn.innerText = 'Processing...';

        try {
          await EndorsementSystem.processEndorsement(
            application.id,
            'reject',
            notesInput.value,
            'Senior Pastor'
          );
          
          statusDiv.className = 'status-message success show';
          statusDiv.innerHTML = '✅ Application rejected. The applicant will be notified.';
          approveBtn!.style.display = 'none';
          rejectBtn.style.display = 'none';
        } catch (error: any) {
          statusDiv.className = 'status-message error show';
          statusDiv.innerHTML = '❌ Error: ' + error.message;
          rejectBtn.disabled = false;
          approveBtn!.disabled = false;
          rejectBtn.innerText = '✗ Reject Application';
        }
      });
    } catch (error: any) {
      app.innerHTML = EndorsementSystem.renderErrorPage(error.message);
    }
    
    return;
  }
  
  const route = routes[routePath] || routes['home'];
  
  // Await route if it's async
  const content = await route();
  
  app.innerHTML = `
    ${renderNavbar(routePath)}
    <main>${content}</main>
    ${renderFooter()}
  `
  
  // Reset scroll to top on every navigation
  window.scrollTo({ top: 0, behavior: 'instant' })

  // Cleanup previous listeners
  if (unsubscribeAdmin) {
    unsubscribeAdmin();
    unsubscribeAdmin = null;
  }

  // Admin Dashboard Logic
  if (routePath === 'dashboard' && isAdmin) {
      AdminDashboard.initializeDashboard();
  }

  // Member Dashboard Logic
  if (routePath === 'dashboard' && !isAdmin) {
      MemberDashboard.initializeContributionForm();
  }

  if (hash === 'faq') {
    renderFAQ()
    const search = document.getElementById('faq-search') as HTMLInputElement
    search?.addEventListener('input', (e) => {
      renderFAQ((e.target as HTMLInputElement).value)
    })
  }

  if (hash === 'login') {
    const loginBtn = document.getElementById('do-login')
    loginBtn?.addEventListener('click', async () => {
      const email = (document.getElementById('username') as HTMLInputElement).value
      const password = (document.getElementById('password') as HTMLInputElement).value
      
      const btn = loginBtn as HTMLButtonElement;
      btn.disabled = true;
      btn.innerText = "Signing in...";

      try {
        await signInWithEmailAndPassword(auth, email, password);
        // Navigate handled by onAuthStateChanged
        window.location.hash = 'dashboard';
      } catch (error: any) {
        alert("Login Failed: " + error.message);
        btn.disabled = false;
        btn.innerText = "Sign In";
      }
    })
  }

  // Logout listener
  document.getElementById('logout-btn')?.addEventListener('click', (e) => {
    e.preventDefault()
    signOut(auth).then(() => {
        window.location.hash = 'home';
    });
  })

  // Mobile menu logic
  const setupMobileMenu = () => {
    document.querySelectorAll('.mobile-menu-btn').forEach(btn => {
      // Find the closest nav container to toggle its links
      const navLinks = btn.parentElement?.querySelector('.nav-links');
      
      btn.addEventListener('click', () => {
        navLinks?.classList.toggle('active');
        btn.classList.toggle('active');
      });

      // Auto-hide on link click
      navLinks?.querySelectorAll('a, button').forEach(link => {
        link.addEventListener('click', () => {
          navLinks.classList.remove('active');
          btn.classList.remove('active');
        });
      });
    });
  };

  setupMobileMenu();
  
  // Initialize Application Flow Toggle
  const appLogic = new PCHAPApplication();
  document.querySelectorAll('.nav-cta').forEach(btn => {
      btn.addEventListener('click', () => {
          appLogic.open();
      });
  });
}

window.addEventListener('hashchange', navigate)

// Initialize Auth Listener
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        // Check if admin (simple email check for now, later use Custom Claims)
        // const adminDoc = await getDoc(doc(db, "admins", user.uid));
        // isAdmin = adminDoc.exists(); 
        // For prototype Phase 2: mock admin check based on email
        isAdmin = user.email?.includes('admin') || false; 
    } else {
        isAdmin = false;
    }
    navigate();
});
