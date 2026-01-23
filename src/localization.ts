
export type Language = 'en' | 'tl';

export const translations = {
    en: {
        // Navbar
        nav_home: "Home",
        nav_about: "About",
        nav_rules: "Rules",
        nav_faq: "FAQ",
        nav_payment: "How to Pay",
        nav_policy: "Policy Manual",
        nav_dashboard: "Dashboard",
        nav_login: "Login",
        nav_logout: "Logout",

        // Member Dashboard
        welcome_back: "Welcome back",
        app_status_pending_msg: "Your membership application is being processed.",
        app_status_start_msg: "Start your PCHAP membership application today.",
        app_status_title: "📋 Application Status",
        
        no_app_title: "No Application Found",
        no_app_text: "You haven't submitted a PCHAP membership application yet.",
        apply_now: "Apply Now",

        // Eligibility
        eligibility_tracker: "📊 Eligibility Tracker",
        eligibility_desc: "You need <strong>6 consecutive months</strong> of confirmed contributions to be eligible for assistance.",
        eligibility_congrats: "🎉 Congratulations!",
        eligibility_eligible_msg: "You are now eligible to apply for medical assistance.",
        total_confirmed_contributions: "Total confirmed contributions",

        // Contributions
        submit_contribution_title: "💳 Submit Monthly Contribution",
        label_month: "Month",
        label_amount: "Amount",
        label_upload_receipt: "Upload Receipt",
        btn_choose_receipt: "📎 Choose Receipt Image",
        btn_submit_contribution: "Submit Contribution",
        btn_submitting: "Submitting...",
        
        // Payment History
        payment_history_title: "📜 Payment History",
        th_month: "Month",
        th_amount: "Amount",
        th_status: "Status",
        th_submitted: "Submitted",
        th_receipt: "Receipt",
        btn_view: "View",
        no_contributions_msg: "No contributions submitted yet.",

        // Status Badges
        status_pending: "PENDING",
        status_confirmed: "CONFIRMED",
        status_rejected: "REJECTED",
        status_approved: "APPROVED",

        // Annex C
        health_title: "🔒 Private Health Questionnaire (Annex C)",
        health_submitted: "✓ Submitted",
        health_submitted_desc: "Your confidential health data has been securely recorded.",
        health_action_required: "Action Required",
        health_desc: "Please complete this strictly confidential health history form. <br><strong>Security Note:</strong> This data is encrypted and accessible strictly to the Board and Medical Reviewers only.",
        btn_submit_health: "Submit Confidential Record",

        // Health Toggles
        health_cardio: "Cardiovascular History",
        health_cardio_desc: "Heart disease, hypertension, etc.",
        health_endocrine: "Endocrine History",
        health_endocrine_desc: "Diabetes, thyroid disorders, etc.",
        health_respiratory: "Respiratory History",
        health_respiratory_desc: "Asthma, tuberculosis, COPD, etc.",
        health_renal: "Renal History",
        health_renal_desc: "Kidney stones, infection, failure, etc.",
        health_label_details: "Please provide details:",
        health_placeholder_details: "Diagnosis date, medication, current status..."
    },
    tl: {
        // Navbar
        nav_home: "Tahanan",
        nav_about: "Tungkol",
        nav_rules: "Mga Tuntunin",
        nav_faq: "Mga Tanong",
        nav_payment: "Paano Magbayad",
        nav_policy: "Punto ng Polisiya",
        nav_dashboard: "Dashboard",
        nav_login: "Mag-login",
        nav_logout: "Mag-logout",

        // Member Dashboard
        welcome_back: "Maligayang pagbabalik",
        app_status_pending_msg: "Ang iyong aplikasyon sa pagiging miyembro ay pinoproseso na.",
        app_status_start_msg: "Simulan ang iyong aplikasyon sa PCHAP ngayon.",
        app_status_title: "📋 Katayuan ng Aplikasyon",
        
        no_app_title: "Walang Aplikasyon",
        no_app_text: "Wala ka pang naisusumiteng aplikasyon para sa PCHAP.",
        apply_now: "Mag-apply Ngayon",

        // Eligibility
        eligibility_tracker: "📊 Subaybay ng Kwalipikasyon",
        eligibility_desc: "Kailangan mo ng <strong>6 na magkakasunod na buwan</strong> ng kumpirmadong kontribusyon para maging kwalipikado.",
        eligibility_congrats: "🎉 Maligayang Bati!",
        eligibility_eligible_msg: "Ikaw ay kwalipikado na para humiling ng tulong medikal.",
        total_confirmed_contributions: "Kabuuang kumpirmadong kontribusyon",

        // Contributions
        submit_contribution_title: "💳 Magsumite ng Kontribusyon",
        label_month: "Buwan",
        label_amount: "Halaga",
        label_upload_receipt: "I-upload ang Resibo",
        btn_choose_receipt: "📎 Pumili ng Resibo",
        btn_submit_contribution: "Mag-submit ng Kontribusyon", // user requested specific
        btn_submitting: "Ipinapasa...",
        
        // Payment History
        payment_history_title: "📜 Kasaysayan ng Bayad", // user requested specific
        th_month: "Buwan",
        th_amount: "Halaga",
        th_status: "Katayuan",
        th_submitted: "Naipasa",
        th_receipt: "Resibo",
        btn_view: "Tingnan",
        no_contributions_msg: "Wala pang naisumiteng kontribusyon.",

        // Status Badges
        status_pending: "PENDING",
        status_confirmed: "KUMPIRMADO",
        status_rejected: "TINANGGIHAN",
        status_approved: "APRUBADO",

        // Annex C
        health_title: "🔒 Pribadong Talatanungan (Annex C)",
        health_submitted: "✓ Naipasa Na",
        health_submitted_desc: "Ang iyong kumpidensyal na datos ay ligtas na naitala.",
        health_action_required: "Kailangan ng Aksyon",
        health_desc: "Sagutan ang kumpidensyal na form na ito. <br><strong>Paalala:</strong> Ang data na ito ay naka-encrypt at para lamang sa Lupon.",
        btn_submit_health: "Ipasa ang Kumpidensyal na Rekord",

        // Health Toggles
        health_cardio: "Kasaysayan sa Puso",
        health_cardio_desc: "Sakit sa puso, hypertension, atbp.",
        health_endocrine: "Kasaysayan sa Endocrine",
        health_endocrine_desc: "Diabetes, thyroid, atbp.",
        health_respiratory: "Kasaysayan sa Baga",
        health_respiratory_desc: "Hika, tuberculosis, COPD, atbp.",
        health_renal: "Kasaysayan sa Bato",
        health_renal_desc: "Bato sa kidney, impeksyon, atbp.",
        health_label_details: "Magbigay ng detalye:",
        health_placeholder_details: "Petsa ng diagnosis, gamot, kasalukuyang lagay..."
    }
};

export class Localization {
    static get currentLang(): Language {
        return (localStorage.getItem('pchap_lang') as Language) || 'en';
    }

    static set currentLang(lang: Language) {
        localStorage.setItem('pchap_lang', lang);
    }

    static t(key: keyof typeof translations['en']): string {
        const lang = this.currentLang;
        // Fallback to English if translation missing
        return translations[lang][key] || translations['en'][key] || key;
    }
    
    static toggle(): void {
        const newLang = this.currentLang === 'en' ? 'tl' : 'en';
        this.currentLang = newLang;
        window.location.reload(); 
    }
}
