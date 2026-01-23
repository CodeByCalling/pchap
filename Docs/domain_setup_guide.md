# Connecting pchap.site to Firebase Hosting

This guide outlines the exact steps to connect your Namecheap domain (`pchap.site`) to your Firebase project.

## PHASE 1: Firebase Console (Start Here)

1.  **Log in** to the [Firebase Console](https://console.firebase.google.com/).
2.  Select your project: **jrm-member-dng-portal** (or similar PCHAP project name).
3.  In the left sidebar, click **Build** -> **Hosting**.
4.  Click the white button **"Add custom domain"**.
5.  Enter `pchap.site` and click **Continue**.
6.  Firebase will show you a **TXT Record** (looks like `google-site-verification=...`). **COPY THIS VALUE.**

---

## PHASE 2: Namecheap Dashboard (DNS Configuration)

1.  **Log in** to your [Namecheap Account](https://www.namecheap.com/).
2.  Go to **Domain List** and find `pchap.site`.
3.  Click the **Manage** button next to it.
4.  Click the **Advanced DNS** tab.
5.  **Clean Up:** If there are existing records (like a "Parking Page"), delete them (trash can icon).

### Step A: Verify Ownership (TXT Record)
6.  Click **Add New Record**.
    *   **Type:** `TXT Record`
    *   **Host:** `@`
    *   **Value:** *(Paste the firebase google-site-verification string here)*
    *   **TTL:** `Automatic`
7.  Click the green checkmark ✅ to save.

*Switch back to Firebase Console and click **"Verify"**. It might take a few minutes. Once valid, Firebase will give you **two "A" Records** (IP Addresses).*

### Step B: Point to Firebase (A Records)
8.  Back in Namecheap **Advanced DNS**, add the required A records shown by Firebase (usually `199.36.158.100`).
    *   **Record 1:**
        *   **Type:** `A Record`
        *   **Host:** `@`
        *   **Value:** `199.36.158.100` (Check Firebase for exact IP)
    *   **Record 2:**
        *   **Type:** `A Record`
        *   **Host:** `@`
        *   **Value:** `199.36.158.100` (Second IP if provided)

9.  **(Optional but Recommended)** Add `www` support:
    *   **Type:** `CNAME Record`
    *   **Host:** `www`
    *   **Value:** `pchap.site`

---

## PHASE 3: Deployment (Terminal)

Once the DNS propagates (can take 1-24 hours, but usually 30 mins), you need to deploy your latest code to the live site.

1.  Open your **VS Code Terminal** (where the bot is).
2.  Run the build command:
    ```bash
    npm run build
    ```
3.  Deploy to Firebase:
    ```bash
    firebase deploy --only hosting
    ```

**Status Check:**
Visit [https://pchap.site](https://pchap.site). If you see a privacy error initially, wait 30 minutes for the SSL certificate to auto-generate.
