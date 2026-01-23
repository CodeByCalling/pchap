# ASYNCHRONOUS AI AGENT WORKFLOWS (BATCH 5)

Here are 5 new tasks to continue development in parallel.

---

## TASK 6: Pastor Endorsement System
**Focus:** Backend / Public Access
**Context:** Need a secure way for pastors to endorse members without logging in (PRD Section 4.1).
**Prompt for Agent:**
> `Implement the Pastor Endorsement Flow.
> 1. **Utility:** Create 'functions/src/endorsement.ts'. Add a function 'generateEndorsementLink(applicationId)' that creates a secure token (store in 'endorsements' collection with expiration).
> 2. **Public Page:** Create 'src/pastor_endorsement.ts' (and HTML).
>    - It should verify the token from URL query param.
>    - Show Applicant Name and "Endorse" / "Decline" buttons.
> 3. **Action:** On click, call a Cloud Function 'submitEndorsement' that updates the 'applications/{id}' status to 'endorsed' (or 'rejected') and invalidates the token.`

---

## TASK 7: Admin Review Workflow (Request Changes)
**Focus:** Admin Dashboard / Application Data
**Context:** Admins need to return applications with notes, not just Approve/Reject (PRD Section 3.2).
**Prompt for Agent:**
> `Enhance 'src/admin_dashboard.ts' -> 'renderApplications()'.
> 1. **Review Modal:** When clicking an applicant, show a Modal with their details and uploaded images (Annex A, IDs).
> 2. **Request Changes:** Add a "Request Changes" button validation flow:
>    - Open a text area for "Admin Notes".
>    - On submit, update Firestore: set 'adminReviewStatus' to 'returned', append note to 'adminNotes' array.
> 3. **UI Feedback:** Ensure the table row highlights "Returned" status clearly (e.g., Orange badge).`

---

## TASK 8: Security Rules Hardening
**Focus:** Firestore & Storage Security
**Context:** Prepare for public launch (PRD Section 7).
**Prompt for Agent:**
> `Audit and harden 'firestore.rules' and 'storage.rules'.
> 1. **Firestore:**
>    - 'applications': Users can read/write ONLY their own doc. Admins can read/write all.
>    - 'contributions': Users can CREATE properties but NOT update 'status' (Admin only).
>    - 'health_private': STRICT access. Only Owner and specific Admin UIDs.
> 2. **Storage:**
>    - Allow uploads ONLY to 'uploads/{userId}/...'.
>    - Enforce file types (images/pdf) and max size (5MB).`

---

## TASK 9: Mobile Responsiveness Polish
**Focus:** CSS / Member Dashboard
**Context:** Most users are on mobile.
**Prompt for Agent:**
> `Optimize 'src/member_dashboard.ts' and 'src/style.css' for mobile (375px width).
> 1. **Tables:** Convert the "Contribution History" table to a Card View on mobile screens (@media max-width: 600px).
> 2. **Navigation:** Ensure the Navbar collapses into a Hamburger menu (or verify existing behavior works perfectly).
> 3. **Forms:** Verify inputs (Annex A, Health Form) have correct font-size (16px) to prevent iOS auto-zoom.`

---

## TASK 10: Admin Reports & Data Export
**Focus:** Admin Dashboard / Data Management
**Context:** Admins need offline records.
**Prompt for Agent:**
> `Add "Export Data" features to 'src/admin_dashboard.ts'.
> 1. **Members Export:** Button to download 'Approved Members' list as CSV (Name, Email, Phone, Start Date).
> 2. **Financial Export:** Button to download 'Monthly Contributions' as CSV (Month, Member Name, Amount, Ref Number).
> 3. **Implementation:** Do this client-side using a utility like 'generateCSV(data)' to save costs on cloud functions.`
