import { AddressService } from './philippine_address_data';
import { auth, db, storage } from './firebase_config';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

export class PCHAPApplication {
    private currentStep: number = 1;
    private totalSteps: number = 4;
    private overlay: HTMLElement | null;
    private form: HTMLFormElement | null;
    private beneficiaryTableBody: HTMLElement | null;

    constructor() {
        this.overlay = document.getElementById('application-overlay');
        this.form = document.getElementById('membership-form') as HTMLFormElement;
        this.beneficiaryTableBody = document.querySelector('#beneficiary-table tbody');
        
        this.init();
    }

    private init() {
        // Disable native browser validation to allow custom handling
        if (this.form) this.form.noValidate = true;

        // Event Listeners
        document.querySelectorAll('.nav-cta, #apply .btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.open();
            });
        });

        document.getElementById('close-app')?.addEventListener('click', () => this.close());
        document.getElementById('save-exit')?.addEventListener('click', () => this.saveAndExit());
        document.getElementById('next-btn')?.addEventListener('click', () => this.nextStep());
        document.getElementById('prev-btn')?.addEventListener('click', () => this.prevStep());
        document.getElementById('add-beneficiary')?.addEventListener('click', () => this.addBeneficiaryRow());

        this.form?.addEventListener('submit', (e) => this.handleSubmit(e));

        // File Upload Previews
        this.form?.querySelectorAll('input[type="file"]').forEach(input => {
            input.addEventListener('change', (e) => this.handleFileSelect(e));
        });

        // Address Dropdown Logic
        this.setupAddressDropdowns();

        // Applicant Birthday Validation
        const birthdayInput = document.getElementById('birthday') as HTMLInputElement;
        if (birthdayInput) {
            // Set max date for applicant (must be approx 18 years old)
            // Current Year 2025. 18 years ago = 2007.
            birthdayInput.max = "2007-12-31"; 
            birthdayInput.addEventListener('change', () => this.validateApplicantAge(birthdayInput));
        }

        // Initial setup
        this.updateStepper();
    }

    private async setupAddressDropdowns() {
        const regionSelect = document.getElementById('region') as HTMLSelectElement;
        const provinceSelect = document.getElementById('province') as HTMLSelectElement;
        const citySelect = document.getElementById('city') as HTMLSelectElement;
        const barangaySelect = document.getElementById('barangay') as HTMLSelectElement;

        // Populate Regions
        if (regionSelect) {
            this.setLoading(regionSelect, true);
            const regions = await AddressService.getRegions();
            this.populateDropdown(regionSelect, regions.map(r => ({ value: r.region_code, text: r.region_name })));
            this.setLoading(regionSelect, false);

            regionSelect.addEventListener('change', async () => {
                const regionCode = regionSelect.value;
                
                // Reset child dropdowns
                this.resetDropdown(provinceSelect);
                this.resetDropdown(citySelect);
                this.resetDropdown(barangaySelect);

                if (regionCode && provinceSelect) {
                    this.setLoading(provinceSelect, true);
                    const provinces = await AddressService.getProvinces(regionCode);
                    this.populateDropdown(provinceSelect, provinces.map(p => ({ value: p.province_code, text: p.province_name })));
                    this.setLoading(provinceSelect, false);
                }
            });
        }

        if (provinceSelect) {
            provinceSelect.addEventListener('change', async () => {
                const provinceCode = provinceSelect.value;
                
                this.resetDropdown(citySelect);
                this.resetDropdown(barangaySelect);

                if (provinceCode && citySelect) {
                    this.setLoading(citySelect, true);
                    const cities = await AddressService.getCities(provinceCode);
                    this.populateDropdown(citySelect, cities.map(c => ({ value: c.city_code, text: c.city_name })));
                    this.setLoading(citySelect, false);
                }
            });
        }

        if (citySelect) {
            citySelect.addEventListener('change', async () => {
                const cityCode = citySelect.value;
                
                this.resetDropdown(barangaySelect);

                if (cityCode && barangaySelect) {
                    this.setLoading(barangaySelect, true);
                    const barangays = await AddressService.getBarangays(cityCode);
                    this.populateDropdown(barangaySelect, barangays.map(b => ({ value: b.brgy_code, text: b.brgy_name })));
                    this.setLoading(barangaySelect, false);
                }
            });
        }
    }

    private setLoading(select: HTMLSelectElement, isLoading: boolean) {
        if (!select) return;
        select.disabled = isLoading;
        if (isLoading) {
            select.innerHTML = '<option>Loading...</option>';
        } else if (select.options.length === 0 || select.options[0].text === 'Loading...') {
             select.innerHTML = '<option value="">Select Option</option>';
        }
    }

    private resetDropdown(select: HTMLSelectElement) {
        if (!select) return;
        select.innerHTML = '<option value="">Select Option</option>';
        select.disabled = true;
    }

    private populateDropdown(select: HTMLSelectElement, items: { value: string, text: string }[]) {
        select.innerHTML = '<option value="">Select Option</option>';
        if (items.length > 0) {
            select.disabled = false;
            items.forEach(item => {
                const opt = document.createElement('option');
                opt.value = item.value;
                opt.textContent = item.text;
                select.appendChild(opt);
            });
        } else {
            select.disabled = true;
        }
    }

    private validateApplicantAge(input: HTMLInputElement) {
        const birthDate = new Date(input.value);
        const cutoffDate = new Date('2007-12-31');
        // Simple check: if birthdate is after cutoff, it's invalid
        if (birthDate > cutoffDate) {
            // alert('Applicants must be at least 18 years old (born in 2007 or earlier).');
            input.value = '';
        }
    }

    public open() {
        if (this.overlay) {
            this.overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
            this.currentStep = 1;
            this.showStep(1);
            // Clear previous beneficiary rows to prevent accumulation
            if (this.beneficiaryTableBody) this.beneficiaryTableBody.innerHTML = '';
            // Add one empty row by default
            this.addBeneficiaryRow();
        }
    }

    public close() {
        if (this.overlay) {
            this.overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    private async saveAndExit() {
        console.log("Save and Exit clicked"); // Debug
        const user = auth.currentUser;
        
        if (user) {
            await this.performSave(user.uid);
        } else {
            // Pass a callback to save after login
            this.showAuthPrompt(async (uid) => {
                await this.performSave(uid);
            });
        }
    }

    private showAuthPrompt(onSuccess?: (uid: string) => Promise<void>) {
        const modal = document.createElement('div');
        modal.className = 'custom-auth-modal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center;
            z-index: 10000; backdrop-filter: blur(5px);
        `;
        
        // Improved Modal UI with "Create Account" emphasis
        modal.innerHTML = `
            <div class="glass-card" style="background: white; max-width: 400px; padding: 30px; margin: 20px; text-align: center; border-radius: 16px; border-top: 5px solid #002366;">
                <h3 style="margin-top:0; color: #002366;">Account Required</h3>
                <p style="margin-bottom: 20px; color: #555;">To save your progress or submit, you must have an account.</p>
                
                <div style="display: flex; flex-direction: column; gap: 12px; text-align: left;">
                    <label style="font-size: 0.85rem; font-weight: 600; color: #002366;">Email Address</label>
                    <input type="email" id="auth-email" placeholder="example@email.com" style="padding: 12px; border-radius: 8px; border: 1px solid #ddd; width: 100%; box-sizing: border-box;">
                    
                    <label style="font-size: 0.85rem; font-weight: 600; color: #002366;">Password</label>
                    <input type="password" id="auth-password" placeholder="Min. 6 characters" style="padding: 12px; border-radius: 8px; border: 1px solid #ddd; width: 100%; box-sizing: border-box;">
                    
                    <div style="margin-top: 20px; display: flex; flex-direction: column; gap: 10px;">
                        <button id="auth-btn-login" class="btn btn-primary" style="width: 100%; background: linear-gradient(135deg, #002366 0%, #001a4d 100%); color: white;">Log In</button>
                        <div style="text-align: center; font-size: 0.9rem; color: #666;">- OR -</div>
                        <button id="auth-btn-signup" class="btn btn-outline" style="width: 100%;">Create Account</button>
                    </div>
                    
                    <button id="auth-btn-cancel" style="background: none; border: none; color: #999; margin-top: 15px; cursor: pointer; text-decoration: underline; width: 100%;">Cancel</button>
                </div>
                <div id="auth-status-msg" style="margin-top: 15px; font-size: 0.9em; min-height: 20px;"></div>
            </div>
        `;
        document.body.appendChild(modal);

        const emailInput = modal.querySelector('#auth-email') as HTMLInputElement;
        const passInput = modal.querySelector('#auth-password') as HTMLInputElement;
        const statusMsg = modal.querySelector('#auth-status-msg') as HTMLElement;

        const cleanup = () => {
            if (modal.parentNode) modal.parentNode.removeChild(modal);
        };

        modal.querySelector('#auth-btn-cancel')?.addEventListener('click', cleanup);

        const handleAuth = async (action: 'login' | 'signup') => {
            const email = emailInput.value;
            const password = passInput.value;
            
            if (!email || !password) {
                statusMsg.textContent = "Please enter both email and password.";
                statusMsg.style.color = "red";
                return;
            }

            statusMsg.textContent = action === 'signup' ? "Creating account..." : "Logging in...";
            statusMsg.style.color = "#002366";

            try {
                let userCred;
                if (action === 'login') {
                    userCred = await signInWithEmailAndPassword(auth, email, password);
                } else {
                    userCred = await createUserWithEmailAndPassword(auth, email, password);
                }
                
                statusMsg.textContent = "Success! Resuming...";
                statusMsg.style.color = "green";
                
                // Execute callback if provided
                if (onSuccess) {
                    await onSuccess(userCred.user.uid);
                }
                
                cleanup();

            } catch (error: any) {
                console.error("Auth Error:", error);
                let msg = error.code ? error.code.replace('auth/', '').replace(/-/g, ' ') : error.message;
                // Friendly errors
                if (msg.includes('email already in use')) msg = "Email already registered. Please Log In.";
                if (msg.includes('weak password')) msg = "Password must be at least 6 characters.";
                
                statusMsg.textContent = msg.charAt(0).toUpperCase() + msg.slice(1);
                statusMsg.style.color = "red";
            }
        };

        modal.querySelector('#auth-btn-login')?.addEventListener('click', () => handleAuth('login'));
        modal.querySelector('#auth-btn-signup')?.addEventListener('click', () => handleAuth('signup'));
    }

    private async performSave(uid: string) {
        if (!this.form) return;
        
        try {
            const formData = new FormData(this.form);
            const appData: any = {};
            
            // Extract core data simply
            formData.forEach((value, key) => {
                 if (key.includes('[]')) {
                     const keyName = key.replace('[]', '');
                     if (!appData[keyName]) appData[keyName] = [];
                     appData[keyName].push(value);
                 } else {
                     appData[key] = value;
                 }
            });

            // Set basic structure for Firestore
            const finalDoc = {
                draftData: appData, 
                status: 'draft',
                lastSaved: new Date(),
                email: auth.currentUser?.email || appData['email'],
                userId: uid
            };

            await setDoc(doc(db, "applications", uid), finalDoc, { merge: true });
            
            alert('Draft saved! You can resume later.');
            this.close();

        } catch (e) {
            console.error("Save error:", e);
            alert("Failed to save draft. Please try again.");
        }
    }

    private showStep(step: number) {
        document.querySelectorAll('.form-step').forEach(el => el.classList.remove('active'));
        document.getElementById(`step-${step}`)?.classList.add('active');

        const nextBtn = document.getElementById('next-btn');
        const prevBtn = document.getElementById('prev-btn');
        const submitBtn = document.getElementById('submit-btn');

        if (prevBtn) prevBtn.style.display = step === 1 ? 'none' : 'block';
        if (nextBtn) nextBtn.style.display = step === this.totalSteps ? 'none' : 'block';
        if (submitBtn) submitBtn.style.display = step === this.totalSteps ? 'block' : 'none';

        this.updateStepper();
    }

    private nextStep() {
        if (this.validateCurrentStep()) {
            if (this.currentStep < this.totalSteps) {
                this.currentStep++;
                this.showStep(this.currentStep);
                this.overlay?.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
    }

    private prevStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.showStep(this.currentStep);
            this.overlay?.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    private updateStepper() {
        document.querySelectorAll('.step').forEach(el => {
            const stepNum = parseInt(el.getAttribute('data-step') || '0');
            el.classList.remove('active', 'completed');
            if (stepNum === this.currentStep) el.classList.add('active');
            if (stepNum < this.currentStep) el.classList.add('completed');
        });
    }

    private validateCurrentStep(): boolean {
        const currentStepEl = document.getElementById(`step-${this.currentStep}`);
        if (!currentStepEl) return true;

        const inputs = currentStepEl.querySelectorAll('input[required], select[required]');
        let isValid = true;

        inputs.forEach(input => {
            const el = input as HTMLInputElement | HTMLSelectElement;
            if (!el.value || (el.type === 'checkbox' && !(el as HTMLInputElement).checked)) {
                el.style.borderColor = '#ff4757';
                isValid = false;
            } else if (el.type === 'email' && el.value) {
                // Email format validation
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(el.value)) {
                    el.style.borderColor = '#ff4757';
                    isValid = false;
                    alert('Please enter a valid email address.');
                } else {
                    el.style.borderColor = '';
                }
            } else {
                el.style.borderColor = '';
            }
        });

        if (!isValid) {
            alert('Please fill out all required fields and disclosures.');
        }

        return isValid;
    }

    private addBeneficiaryRow() {
        if (!this.beneficiaryTableBody) return;

        const row = document.createElement('tr');
        // Mobile-friendly labels added as data-label attribute
        row.innerHTML = `
            <td data-label="First Name"><input type="text" name="b_f_name[]" placeholder="First Name" required></td>
            <td data-label="Last Name"><input type="text" name="b_l_name[]" placeholder="Last Name" required></td>
            <td data-label="Date of Birth"><input type="date" name="b_dob[]" max="2028-12-31" required></td>
            <td data-label="Relationship">
                <select name="b_rel[]" required>
                    <option value="">Select...</option>
                    <option value="Spouse">Spouse</option>
                    <option value="Son">Son</option>
                    <option value="Daughter">Daughter</option>
                    <option value="Father">Father</option>
                    <option value="Mother">Mother</option>
                    <option value="Brother">Brother</option>
                    <option value="Sister">Sister</option>
                    <option value="Legal Guardian">Legal Guardian</option>
                </select>
            </td>
            <td><button type="button" class="btn-remove" style="color: red; font-weight: bold; border: 1px solid red; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer;">&times;</button></td>
        `;

        // Beneficiary Birthday Validation (Must be < 18 years old)
        const dobInput = row.querySelector('input[name="b_dob[]"]') as HTMLInputElement;
        // Approx max date (today) - though users might be born today
        dobInput.max = new Date().toISOString().split('T')[0]; 
        
        dobInput.addEventListener('change', () => {
             if (!dobInput.value) return; // Ignore empty/invalid

             const birthDate = new Date(dobInput.value);
             const today = new Date();
             
             // Check if valid date
             if (isNaN(birthDate.getTime())) return;

             let age = today.getFullYear() - birthDate.getFullYear();
             const m = today.getMonth() - birthDate.getMonth();
             if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                 age--;
             }

             // Remove existing error if any
             const existingError = row.querySelector('.age-error');
             if (existingError) existingError.remove();
             dobInput.style.borderColor = '';

             // Only warn if strictly 18 or older
             if (age >= 18) {
                 // Creating non-blocking UI error
                 dobInput.style.borderColor = 'red';
                 const errorMsg = document.createElement('span');
                 errorMsg.className = 'age-error';
                 errorMsg.style.color = 'red';
                 errorMsg.style.fontSize = '0.75rem';
                 errorMsg.style.display = 'block';
                 errorMsg.style.marginTop = '4px';
                 errorMsg.textContent = "Beneficiaries 18+ should apply for their own membership.";
                 dobInput.parentNode?.appendChild(errorMsg);
                 
                 dobInput.value = ''; // Clear input
                 
                 // Remove error after 3 seconds to clean up UI
                 setTimeout(() => {
                    if (errorMsg.parentNode) errorMsg.remove();
                    dobInput.style.borderColor = '';
                 }, 4000);
             }
        });

        const removeBtn = row.querySelector('.btn-remove');
        if (removeBtn) {
            removeBtn.addEventListener('click', (e) => {
                e.preventDefault(); // Stop any form submission
                row.remove();
            });
        }
        
        this.beneficiaryTableBody.appendChild(row);
    }

    private handleFileSelect(e: Event) {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const previewUrl = e.target?.result as string;
                // Remove existing preview if any
                const parent = input.parentElement; // label
                const existingImg = parent?.querySelector('.file-preview-img');
                if (existingImg) existingImg.remove();

                const img = document.createElement('img');
                img.src = previewUrl;
                img.classList.add('file-preview-img');
                parent?.appendChild(img);
            };
            reader.readAsDataURL(file);
        }
    }

    private async handleSubmit(e: Event) {
        e.preventDefault();
        
        if (!this.validateCurrentStep()) {
            return;
        }

        const user = auth.currentUser;
        if (!user) {
            // New: Show Auth Modal for Submit too
            // Note: We don't auto-submit here to avoid complexity (upload files etc). 
            // Better to let them click submit again after login, or try to resume.
            // For now, let's just auth them.
            this.showAuthPrompt(async (uid) => {
                alert("Account created/logged in! Please click 'Submit Application' again to finalize.");
            });
            return;
        }

        // Show mock loading state
        const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;
        const originalText = submitBtn.innerText;
        submitBtn.disabled = true;
        submitBtn.innerText = 'Uploading Documents...';

        try {
            // 1. Upload Files
            const fileInputs = this.form?.querySelectorAll('input[type="file"]');
            const fileUrls: Record<string, string> = {};

            if (fileInputs) {
                for (const input of Array.from(fileInputs) as HTMLInputElement[]) {
                    const file = input.files?.[0];
                    if (file) {
                        const fileType = input.name; // idCard, photo, receipt
                        const storageRef = ref(storage, `uploads/${user.uid}/applicants/${fileType}_${Date.now()}_${file.name}`);
                        await uploadBytes(storageRef, file);
                        const url = await getDownloadURL(storageRef);
                        fileUrls[fileType] = url;
                    }
                }
            }

            submitBtn.innerText = 'Saving Application...';

            // 2. Gather Form Data
            const formData = new FormData(this.form!);
            const data: any = {};
            formData.forEach((value, key) => {
                // Handle multiple values (beneficiaries)
                if (key.endsWith('[]')) {
                    const realKey = key.slice(0, -2);
                    if (!data[realKey]) data[realKey] = [];
                    data[realKey].push(value);
                } else {
                    data[key] = value;
                }
            });

            // Structuring Beneficiaries
            const beneficiaries = [];
            if (data.b_f_name) {
                for(let i=0; i<data.b_f_name.length; i++) {
                    beneficiaries.push({
                        firstName: data.b_f_name[i],
                        lastName: data.b_l_name[i],
                        dob: data.b_dob[i],
                        relationship: data.b_rel[i]
                    });
                }
            }

            // Cleanup raw arrays
            delete data.b_f_name; delete data.b_l_name; delete data.b_dob; delete data.b_rel;

            // Generate secure pastor endorsement token
            const endorsementToken = crypto.randomUUID();
            const endorsementUrl = `${window.location.origin}${window.location.pathname}#endorse?token=${endorsementToken}`;

            const finalDoc = {
                userId: user.uid,
                email: user.email,
                personalInfo: {
                    surname: data.surname,
                    firstname: data.firstname,
                    civilStatus: data.civilStatus,
                    birthday: data.birthday,
                    // nationality removed
                    address: {
                        houseStreet: data.houseStreet,
                        region: data.region,
                        province: data.province,
                        city: data.city,
                        barangay: data.barangay,
                        zipCode: data.zipCode
                    },
                    jobTitle: data.jobTitle,
                    sourceOfFunds: data.sourceOfFunds,
                    outreach: data.outreach,
                    govIdNo: data.govId,
                    philhealthNo: data.philhealth,
                    // Supervisor Info
                    supervisor: {
                        name: data.supervisorName,
                        role: data.supervisorRole,
                        phone: data.supervisorPhone,
                        email: data.supervisorEmail
                    }
                },
                healthHistory: {
                    height: data.height,
                    weight: data.weight,
                    weightChange: data.weightChange,
                    weightChangeDetails: data.weightChangeDetails,
                    conditions: formData.getAll('health'),
                    pregnant: data.pregnant,
                    pregnancyMonths: data.pregnancyMonths
                },
                beneficiaries: beneficiaries,
                documents: fileUrls,
                // Workflow Status Fields
                status: 'Pending Pastor Endorsement',
                pastorEndorsementToken: endorsementToken,
                pastorEndorsementStatus: 'pending',
                pastorEndorsementBy: null,
                pastorEndorsementAt: null,
                pastorEndorsementNotes: '',
                adminReviewStatus: 'pending',
                adminReviewBy: null,
                adminReviewAt: null,
                finalApprovalStatus: 'pending',
                finalApprovalBy: null,
                finalApprovalAt: null,
                adminNotes: [],
                submittedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // 3. Save to Firestore
            await setDoc(doc(db, "applications", user.uid), finalDoc);

            // Show success with pastor endorsement instructions
            alert(`✅ Application Submitted Successfully!\n\n📧 IMPORTANT: Please send the following endorsement link to your Senior Pastor:\n\n${endorsementUrl}\n\nYour application will be reviewed after pastor endorsement.`);
            this.close();
            
            // Reset form
            this.form?.reset();
            // Remove previews
            this.form?.querySelectorAll('.file-preview-img').forEach(img => img.remove());
            if (this.beneficiaryTableBody) this.beneficiaryTableBody.innerHTML = '';

        } catch (error: any) {
            console.error("Submission Error", error);
            alert("Error submitting application: " + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerText = originalText;
        }
    }
}
