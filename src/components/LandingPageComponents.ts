
export const faqs = [
  { q: "Is PCHAP an insurance product?", a: "No. PCHAP is *not* an insurance plan and is *not regulated* by the Insurance Commission of the Philippines. It is a faith-based, mutual aid program under a non-stock, non-profit corporation (J29 Corporation), designed to provide voluntary assistance based on the availability of funds and board approval." },
  { q: "Are the benefits guaranteed?", a: "No. All assistance is subject to fund availability and the approval of the Board of Trustees. While PCHAP provides estimated or projected amounts based on membership size, no benefit is promised or guaranteed." },
  { q: "Why do I need to sign a waiver and disclosure statement?", a: "The waiver ensures that members understand the non-insurance nature of the program. By signing, you confirm that you acknowledge: (1) Assistance is not guaranteed, (2) PCHAP is not legally liable for any unfulfilled requests, (3) Contributions are non-refundable, and (4) The program is subject to board discretion and available funds." },
  { q: "What is the Pastor’s Care Health Assistance Program (PCHAP)?", a: "PCHAP is a voluntary, community-based financial assistance program for pastors, full-time workers, and lay leaders within Jesus Reigns Ministries. It is designed to support qualified members during medical emergencies or in cases of bereavement—funded solely by member contributions and managed by J29 Corporation." },
  { q: "How much do I need to contribute monthly?", a: "Each active member is expected to contribute ₱500 per month. This contribution must be consistent and up-to-date for members to remain eligible for assistance." },
  { q: "What types of assistance are available under PCHAP?", a: "Eligible members may apply for: (1) Medical or hospitalization aid (e.g., surgery, confinement, outpatient treatment), (2) Annual physical exam reimbursement (up to ₱2,000 after one year), and (3) Bereavement/funeral assistance (voluntary-based aid upon board discretion)." },
  { q: "What is the waiting period before I can request assistance?", a: "You must complete six (6) continuous months of contributions before you become eligible to apply for any form of assistance. This ensures that the program has sufficient funds and fairness for all members." },
  { q: "What happens if I miss my monthly contributions?", a: "If you fail to contribute for three (3) consecutive months, your membership may be suspended, and you will not be eligible for any assistance until your contributions are updated. Your membership may also be re-evaluated or terminated if non-payment continues." },
  { q: "Are contributions refundable if I withdraw or do not receive assistance?", a: "No. All contributions made to PCHAP are non-refundable and non-transferable, regardless of whether you eventually request or receive aid." },
  { q: "Are spouses and children also covered?", a: "Yes. Spouses are eligible to join for the same ₱500 monthly contribution. Children under 18 years old may be listed under a parent’s membership. Children 18 years and older must apply separately if they meet eligibility criteria." },
  { q: "Are retirees eligible to join PCHAP?", a: "Yes. Retired pastors, full-time workers (FTWs), and lay leaders of Jesus Reigns Ministries are eligible to join PCHAP. They must meet the same membership and contribution requirements as active members, including the ₱500 monthly contribution and the six (6) continuous monthly contributions before becoming eligible to request assistance." },
  { q: "How do I apply for assistance and what documents are needed?", a: "You must fill out the official Assistance Request Form and submit it with complete supporting documents, such as: Medical certificate/hospital bill, Death certificate (for funeral assistance), Proof of payment, and PhilHealth/insurance documents. All requests are reviewed by the admin team and must be approved by the Board of Trustees." }
];

export const renderAssistanceTable = () => `
  <section class="section-container" style="padding: 60px 20px; background: #f8f9fa;">
    <div class="container">
        <h2 class="section-title" style="text-align: center; color: var(--royal-blue); margin-bottom: 40px;">Projected Assistance</h2>
        <p style="margin-bottom: 30px; text-align: center; max-width: 800px; margin-left: auto; margin-right: auto;">
          Non-guaranteed assistance coverage based on active membership size. All aid is subject to fund availability and Board approval.
        </p>
        
        <div class="table-container desktop-table">
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
              ${[100, 200, 300, 400, 500, 600, 700, 800, 900, 1000].map(m => `
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

        <div class="mobile-cards">
          ${[100, 200, 300, 400, 500, 600, 700, 800, 900, 1000].map(m => `
            <div class="assistance-card">
              <h4>${m} Active Members</h4>
              <div class="assistance-row">
                <span>Monthly Fund:</span>
                <span>₱${(m * 500).toLocaleString()}</span>
              </div>
              <div class="assistance-row">
                <span>Annual Fund:</span>
                <span>₱${(m * 500 * 12).toLocaleString()}</span>
              </div>
              <div class="assistance-row" style="color: var(--royal-blue-light); border-bottom: none;">
                <span>Max Assistance:</span>
                <span>Up to ₱${(m * 100).toLocaleString()}</span>
              </div>
            </div>
          `).join('')}
        </div>
    </div>
  </section>
`;

export const renderFAQAccordion = (questions: typeof faqs) => `
  <section class="section-container" style="padding: 60px 20px;">
    <div class="container">
      <h2 class="section-title" style="text-align: center; color: var(--royal-blue); margin-bottom: 40px;">Frequently Asked Questions</h2>
      <div class="accordion-list" style="max-width: 800px; margin: 0 auto;">
        ${questions.map((f, i) => `
          <div class="accordion-item" id="faq-item-${i}">
            <button class="accordion-header" onclick="this.parentElement.classList.toggle('active')">
              ${f.q}
              <span>+</span>
            </button>
            <div class="accordion-content">
              <p>${f.a}</p>
            </div>
          </div>
        `).join('')}
      </div>
      <div style="text-align: center; margin-top: 30px;">
        <a href="#faq" class="btn btn-outline" style="color: var(--royal-blue); border-color: var(--royal-blue);">View All FAQs</a>
      </div>
    </div>
  </section>
`;
