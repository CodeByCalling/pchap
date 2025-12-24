# **Product Requirements Document (PRD): PCHAP Membership Portal**

## **1\. Executive Summary**

The **Pastor’s Care Health Assistance Program (PCHAP)** is a digital, mobile-first platform designed to streamline enrollment and administration for Jesus Reigns Ministries (JRM) workers. PCHAP is a community-based, voluntary mutual aid program operated by **J29 Foundation, Inc.** and is not an insurance product. This portal replaces manual paperwork with a secure, transparent online system.

---

## **2\. Design & User Experience (UX) Strategy**

* **Visual Identity:** Corporate-elegant and professional looking.  
* **Color Palette:** Deep Royal Blue (\#002366) and Gold (\#D4AF37).  
* **Mobile-First Design:** Prioritize a vertical-stack layout optimized for smartphones, as most users do not use desktops.  
* **Accessibility:** High-contrast typography and large call-to-action buttons (minimum 48px touch target).  
* **Responsiveness:** Fully functional on both mobile browsers and desktop computers.

---

## **3\. Functional Modules**

### **3.1 Public Information Website (The Brochure)**

* **Hero Section:** Features the mission: "Serving the health needs of our ministry workers with compassion and integrity."  
* **Legal Transparency:** Prominent disclaimer stating PCHAP is not an insurance product and is not regulated by the Insurance Commission.  
* **Eligibility Page:** Clearly lists eligible roles (JRM Pastors, FTWs, Staff, DG Heads).  
* **Rules & Procedures:** Detailed sections on the ₱500 monthly contribution (₱250 for retirees over 70\) and the **6-month consecutive payment rule** for eligibility.  
* **Projected Assistance Table:** A responsive, scrollable card-view showing assistance levels based on membership size.  
* **FAQ Page:** A searchable accordion with 24 grounded questions and answers.

### **3.2 Member Enrollment Portal (Online Forms)**

* **Secure Authentication:** Email-verified accounts for all members.  
* **Annex A (Membership Application):** Digital capture of personal data, church affiliation, government IDs (SSS/PhilHealth/TIN), and beneficiaries.  
* **Annex B (Acknowledgment):** Mandatory digital sign-off on the 7-point disclosure statement.  
* **Annex C (Health Questionnaire):** Truthful disclosure of medical history across Cardiovascular, Endocrine, and other categories.  
* **Document Upload Center:** Mobile-friendly interface for uploading Government IDs, 2x2 photos, and payment receipts.

### **3.3 Administrative Approval Workflow**

1. **Submission:** Applicant completes all digital forms and uploads the initial payment receipt.  
2. **Pastor Endorsement:** System generates a secure "Magic Link" for the Senior Pastor to verify the applicant's standing.  
3. **Review Queue:** Applications are reviewed by **Pastora Connie** and **Pastora Osher** for document accuracy.  
4. **Pending Notes:** Admins can post notes on a member’s dashboard if documents are missing or need correction.  
5. **Final Approval:** **COO Ligaya Javier** or the **Project Manager** provides final authorization to activate the membership.

---

## **4\. Core Business Rules**

* **Standard Contribution:** ₱500 per month.  
* **Retiree Category:** ₱250 per month for retirees over 70 (categorized manually by Admins).  
* **Eligibility Milestone:** System tracks **6 consecutive months** of contributions before enabling assistance requests.  
* **Suspension:** Automated flagging of accounts that miss **3 consecutive months** of payments.  
* **Non-Refundable:** All contributions are strictly non-refundable and non-transferable.

---

## **5\. Technical Specifications (The Trinity)**

* **Google AI Studio:** Grounding the **Smart-Counselor AI** chatbot using the PCHAP policy documents.  
* **Google Antigravity:** Building the front-end UI and the multi-stage backend approval logic.  
* **Firebase ('Bar Studio'):**  
  * **Authentication:** User sign-in/creation.  
  * **Firestore:** Real-time database for application status and member records.  
  * **Cloud Storage:** Encrypted storage for IDs and medical questionnaires.  
  * **Hosting:** Global deployment of the web application.

---

## **6\. Future Enhancements**

* **Localization:** Toggle for Tagalog and other local dialects (Cebuano/Ilocano).  
* **Automated Notifications:** Email/SMS alerts for payment reminders and status changes.  
* **Visual Dashboard:** Progress bars for members to see their "6-month eligibility" countdown.

---

### **Implementation Instruction for Antigravity**

**Note to Agent:** Use /Docs/policies/ and /Docs/forms/ as the single source of truth for all content. Maintain the Royal Blue and Gold corporate-elegant theme across all pages. Ensure the "Recommending Pastor" logic uses a secure link verification system.

