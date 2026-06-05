/**
 * تطبيق محاسب - منطق العمل والتحكم بالواجهة (دعم الدفعات الجزئية)
 * Muhasib Application Logic (Partial Settlement Support)
 */

document.addEventListener('DOMContentLoaded', () => {
    // -------------------------------------------------------------------------
    // 1. STATE & STORAGE
    // -------------------------------------------------------------------------
    let transactions = JSON.parse(localStorage.getItem('muhasib_transactions')) || [];
    let primaryCurrency = localStorage.getItem('muhasib_primary_currency') || 'ر.س';
    
    // Store States
    let stores = JSON.parse(localStorage.getItem('muhasib_stores')) || ['المتجر الرئيسي'];
    let activeStore = localStorage.getItem('muhasib_active_store') || 'all';

    // Verify activeStore exists, if not default to 'all'
    if (activeStore !== 'all' && !stores.includes(activeStore)) {
        activeStore = 'all';
        localStorage.setItem('muhasib_active_store', 'all');
    }

    // Theme state initialization (Default to light theme)
    let currentTheme = localStorage.getItem('muhasib_theme') || 'light';
    if (document.body) {
        if (currentTheme === 'light') {
            document.body.classList.add('light-theme');
        } else {
            document.body.classList.remove('light-theme');
        }
    }

    let currentFilter = 'all'; // 'all' | 'for_me' | 'on_me'
    let searchQuery = '';
    let balanceChartInstance = null;

    // Static Exchange Rates (Relative to USD as base = 1.0)
    const EXCHANGE_RATES = {
        'ر.س': 3.75,
        'USD': 1.0,
        '$': 1.0,
        'د.إ': 3.67,
        'ج.م': 47.0,
        'EUR': 0.92,
        '€': 0.92
    };

    // -------------------------------------------------------------------------
    // 1b. DATABASE MIGRATION (Leke/Alek Legacy Data Schema Update)
    // -------------------------------------------------------------------------
    let legacyMigrated = false;
    transactions.forEach(t => {
        if (!t.store) {
            t.store = 'المتجر الرئيسي';
            legacyMigrated = true;
        }
        if (!t.payments) {
            t.payments = [];
            legacyMigrated = true;
        }
    });
    if (legacyMigrated) {
        localStorage.setItem('muhasib_transactions', JSON.stringify(transactions));
    }

    // -------------------------------------------------------------------------
    // 2. DOM ELEMENTS & STATE
    // -------------------------------------------------------------------------
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const transactionForm = document.getElementById('transaction-form');
    const amountInput = document.getElementById('amount');
    const transactionCurrencySelect = document.getElementById('transaction-currency');
    const typeRadios = document.getElementsByName('transaction-type');
    const personLabel = document.getElementById('person-label');
    const personInput = document.getElementById('person');
    const descriptionInput = document.getElementById('description');
    
    // Store elements
    const headerStoreSelect = document.getElementById('header-store-select');
    const transactionStoreSelect = document.getElementById('transaction-store');
    const newStoreNameInput = document.getElementById('new-store-name');
    const addStoreBtn = document.getElementById('add-store-btn');
    const storesManagementList = document.getElementById('stores-management-list');

    // Settings elements
    const settingsToggleBtn = document.getElementById('settings-toggle-btn');
    const settingsPanel = document.getElementById('settings-panel');
    const primaryCurrencySelect = document.getElementById('primary-currency');
    const backupExportBtn = document.getElementById('backup-export-btn');
    const backupImportBtn = document.getElementById('backup-import-btn');
    const backupFileInput = document.getElementById('backup-file-input');

    // Payment Modal Elements
    const paymentModal = document.getElementById('payment-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const paymentForm = document.getElementById('payment-form');
    const modalTransactionId = document.getElementById('modal-transaction-id');
    const modalDebtPerson = document.getElementById('modal-debt-person');
    const modalDebtRemaining = document.getElementById('modal-debt-remaining');
    const paymentAmountInput = document.getElementById('payment-amount');
    const modalCurrencyLabel = document.getElementById('modal-currency-label');
    const paymentDescriptionInput = document.getElementById('payment-description');
    const modalPaymentHistoryList = document.getElementById('modal-payment-history-list');

    // Tab Switcher Elements
    const viewTabDebts = document.getElementById('view-tab-debts');
    const viewTabCash = document.getElementById('view-tab-cash');
    let currentTab = 'debts'; // 'debts' | 'cash'

    // Form Wizard Steps
    const typeGroup = document.getElementById('type-group');
    const paymentStatusGroup = document.getElementById('payment-status-group');
    const paymentStatusLabel = document.getElementById('payment-status-label');
    const statusSettledText = document.getElementById('status-settled-text');
    const personGroup = document.getElementById('person-group');
    const submitGroup = document.getElementById('submit-group');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const submitBtn = document.getElementById('submit-btn');
    let editingTransactionId = null;

    // Dashboard Header Labels
    const netBalanceLabel = document.getElementById('net-balance-label');
    const labelForMe = document.getElementById('label-for-me');
    const labelOnMe = document.getElementById('label-on-me');
    const historySectionTitle = document.getElementById('history-section-title');

    // Metrics
    const netBalanceValue = document.getElementById('net-balance-value');
    const totalForMeVal = document.getElementById('total-for-me');
    const totalOnMeVal = document.getElementById('total-on-me');
    const transactionCountBadge = document.getElementById('transaction-count');

    // List and Filters
    const transactionsList = document.getElementById('transactions-list');
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    const filterChips = document.querySelectorAll('.chip');
    const exportCsvBtn = document.getElementById('export-csv-btn');

    // Firebase state variables
    const firebaseEnabled = typeof window.firebaseSDK !== 'undefined';
    let currentUser = null;
    let confirmationResult = null;
    let otpCountdownInterval = null;
    let isSyncing = false;
    let lastSyncTime = null;

    // Firebase elements
    const userToggleBtn = document.getElementById('user-toggle-btn');
    const userModal = document.getElementById('user-modal');
    const closeUserModalBtn = document.getElementById('close-user-modal-btn');
    const syncIndicatorDot = document.getElementById('sync-indicator-dot');
    const authFlowSection = document.getElementById('auth-flow-section');
    const profileSection = document.getElementById('profile-section');
    const phoneAuthFormStep1 = document.getElementById('phone-auth-form-step1');
    const phoneAuthFormStep2 = document.getElementById('phone-auth-form-step2');
    const phoneInput = document.getElementById('phone-input');
    const otpInput = document.getElementById('otp-input');
    const sendOtpBtn = document.getElementById('send-otp-btn');
    const verifyOtpBtn = document.getElementById('verify-otp-btn');
    const otpCountdown = document.getElementById('otp-countdown');
    const resendOtpBtn = document.getElementById('resend-otp-btn');
    const backToStep1Btn = document.getElementById('back-to-step1-btn');
    const userPhoneLabel = document.getElementById('user-phone-label');
    const syncStatusBadge = document.getElementById('sync-status-badge');
    const lastSyncTimeLabel = document.getElementById('last-sync-time');
    const localTxCountLabel = document.getElementById('local-tx-count');
    const forceSyncBtn = document.getElementById('force-sync-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const deleteAccountBtn = document.getElementById('delete-account-btn');

    // Email/Auth Tab elements
    const tabAuthPhone = document.getElementById('tab-auth-phone');
    const tabAuthEmail = document.getElementById('tab-auth-email');
    const phoneAuthContainer = document.getElementById('phone-auth-container');
    const emailAuthContainer = document.getElementById('email-auth-container');
    const emailAuthForm = document.getElementById('email-auth-form');
    const emailInput = document.getElementById('email-input');
    const passwordInput = document.getElementById('password-input');
    const registerFieldsGroup = document.getElementById('register-fields-group');
    const passwordConfirmInput = document.getElementById('password-confirm-input');
    const emailSubmitBtn = document.getElementById('email-submit-btn');
    const emailSubmitText = document.getElementById('email-submit-text');
    const emailTogglePrompt = document.getElementById('email-toggle-prompt');
    const toggleEmailModeBtn = document.getElementById('toggle-email-mode-btn');

    // Initialize Settings Form values
    primaryCurrencySelect.value = primaryCurrency;
    transactionCurrencySelect.value = primaryCurrency;

    // -------------------------------------------------------------------------
    // 2b. FIREBASE AUTH & CLOUD SYNC LOGIC
    // -------------------------------------------------------------------------
    function updateSyncIndicator(state) {
        if (!syncIndicatorDot) return;
        syncIndicatorDot.className = 'sync-indicator-dot ' + state;
        
        if (syncStatusBadge) {
            syncStatusBadge.className = 'sync-status-badge ' + (state === 'online' ? 'synced' : (state === 'pending' ? 'pending' : 'offline'));
            const badgeText = syncStatusBadge.querySelector('span');
            if (badgeText) {
                badgeText.textContent = state === 'online' ? 'متصل بالسحابة' : (state === 'pending' ? 'مزامنة معلقة' : 'الوضع المحلي');
            }
        }
    }

    function triggerCloudSave() {
        if (!firebaseEnabled || !currentUser) return;
        
        const { doc, setDoc } = window.firebaseSDK;
        const userDocRef = doc(window.firebaseDb, 'users', currentUser.uid);
        
        updateSyncIndicator('pending');
        
        // Add updatedAt timestamp to all transactions that don't have it
        transactions.forEach(t => {
            if (!t.updatedAt) t.updatedAt = Date.now();
        });
        
        setDoc(userDocRef, {
            transactions: transactions,
            stores: stores,
            primaryCurrency: primaryCurrency,
            activeStore: activeStore,
            theme: currentTheme,
            updatedAt: Date.now()
        }, { merge: true })
        .then(() => {
            updateSyncIndicator('online');
            lastSyncTime = new Date().toLocaleTimeString('ar-EG');
            if (lastSyncTimeLabel) lastSyncTimeLabel.textContent = lastSyncTime;
        })
        .catch(error => {
            console.error("Failed to upload changes to Firestore:", error);
            updateSyncIndicator('pending');
        });
    }

    async function syncDataWithCloud(force = false) {
        if (!firebaseEnabled || !currentUser || isSyncing) return;
        
        isSyncing = true;
        updateSyncIndicator('pending');
        
        const { doc, getDoc, setDoc } = window.firebaseSDK;
        const userDocRef = doc(window.firebaseDb, 'users', currentUser.uid);
        
        try {
            const docSnap = await getDoc(userDocRef);
            let cloudData = null;
            
            if (docSnap.exists()) {
                cloudData = docSnap.data();
            }
            
            let dataMerged = false;
            
            if (cloudData) {
                // 1. Merge transactions
                const cloudTx = cloudData.transactions || [];
                const localTx = [...transactions];
                let mergedTx = [...localTx];
                
                cloudTx.forEach(ctx => {
                    const localMatchIdx = mergedTx.findIndex(ltx => ltx.id == ctx.id);
                    if (localMatchIdx === -1) {
                        mergedTx.push(ctx);
                        dataMerged = true;
                    } else {
                        const ltx = mergedTx[localMatchIdx];
                        const ctxUpdated = ctx.updatedAt || 0;
                        const ltxUpdated = ltx.updatedAt || 0;
                        
                        if (ctxUpdated > ltxUpdated) {
                            mergedTx[localMatchIdx] = ctx;
                            dataMerged = true;
                        } else if (ltxUpdated > ctxUpdated) {
                            dataMerged = true;
                        }
                    }
                });
                
                // Add updatedAt if missing
                mergedTx.forEach(mtx => {
                    if (!mtx.updatedAt) mtx.updatedAt = Date.now();
                });
                
                transactions = mergedTx;
                localStorage.setItem('muhasib_transactions', JSON.stringify(transactions));
                
                // 2. Merge stores
                const cloudStores = cloudData.stores || [];
                const mergedStores = Array.from(new Set([...stores, ...cloudStores]));
                if (mergedStores.length !== stores.length) {
                    stores = mergedStores;
                    localStorage.setItem('muhasib_stores', JSON.stringify(stores));
                    dataMerged = true;
                }
                
                // 3. Settings
                if (cloudData.primaryCurrency && cloudData.primaryCurrency !== primaryCurrency) {
                    primaryCurrency = cloudData.primaryCurrency;
                    localStorage.setItem('muhasib_primary_currency', primaryCurrency);
                    if (primaryCurrencySelect) primaryCurrencySelect.value = primaryCurrency;
                    if (transactionCurrencySelect) transactionCurrencySelect.value = primaryCurrency;
                    dataMerged = true;
                }
                
                if (cloudData.theme && cloudData.theme !== currentTheme) {
                    currentTheme = cloudData.theme;
                    localStorage.setItem('muhasib_theme', currentTheme);
                    if (document.body) {
                        if (currentTheme === 'light') {
                            document.body.classList.add('light-theme');
                        } else {
                            document.body.classList.remove('light-theme');
                        }
                    }
                    updateThemeIcon();
                    dataMerged = true;
                }
            }
            
            // Upload merged/latest state to Firestore
            await setDoc(userDocRef, {
                transactions: transactions,
                stores: stores,
                primaryCurrency: primaryCurrency,
                activeStore: activeStore,
                theme: currentTheme,
                updatedAt: Date.now()
            }, { merge: true });
            
            lastSyncTime = new Date().toLocaleTimeString('ar-EG');
            if (lastSyncTimeLabel) lastSyncTimeLabel.textContent = lastSyncTime;
            updateSyncIndicator('online');
            
            if (dataMerged || force) {
                populateStoreDropdowns();
                renderStoresManagement();
                render();
            }
        } catch (error) {
            console.error("Error syncing data:", error);
            updateSyncIndicator('pending');
        } finally {
            isSyncing = false;
        }
    }

    function startOTPCountdown() {
        let seconds = 60;
        if (otpCountdown) otpCountdown.textContent = `المتبقي: ${seconds} ثانية`;
        if (resendOtpBtn) resendOtpBtn.style.display = 'none';
        
        clearInterval(otpCountdownInterval);
        otpCountdownInterval = setInterval(() => {
            seconds--;
            if (otpCountdown) otpCountdown.textContent = `المتبقي: ${seconds} ثانية`;
            if (seconds <= 0) {
                clearInterval(otpCountdownInterval);
                if (otpCountdown) otpCountdown.textContent = 'انتهى الوقت';
                if (resendOtpBtn) resendOtpBtn.style.display = 'inline-block';
            }
        }, 1000);
    }

    if (firebaseEnabled) {
        const { onAuthStateChanged, RecaptchaVerifier, signInWithPhoneNumber, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } = window.firebaseSDK;
        
        // Listen to Auth State Changes
        onAuthStateChanged(window.firebaseAuth, (user) => {
            currentUser = user;
            if (user) {
                const userIdentity = user.email || user.phoneNumber || 'مستخدم مسجل';
                console.log("Logged in user:", userIdentity);
                if (userPhoneLabel) userPhoneLabel.textContent = userIdentity;
                updateSyncIndicator('online');
                
                if (authFlowSection) authFlowSection.style.display = 'none';
                if (profileSection) profileSection.style.display = 'block';
                if (localTxCountLabel) localTxCountLabel.textContent = `${transactions.length} معاملة`;
                
                // Trigger merge and sync
                syncDataWithCloud(true);
            } else {
                console.log("No user logged in.");
                updateSyncIndicator('offline');
                
                if (authFlowSection) authFlowSection.style.display = 'block';
                if (profileSection) profileSection.style.display = 'none';
                if (phoneAuthFormStep1) phoneAuthFormStep1.style.display = 'block';
                if (phoneAuthFormStep2) phoneAuthFormStep2.style.display = 'none';
                if (emailAuthContainer) emailAuthContainer.style.display = 'none';
                if (phoneAuthContainer) phoneAuthContainer.style.display = 'block';
                
                // Reset active tab to phone
                if (tabAuthPhone && tabAuthEmail) {
                    tabAuthPhone.classList.add('active');
                    tabAuthEmail.classList.remove('active');
                }
                
                clearInterval(otpCountdownInterval);
            }
        });

        // Toggle tabs (Phone vs Email)
        if (tabAuthPhone && tabAuthEmail) {
            tabAuthPhone.addEventListener('click', () => {
                tabAuthPhone.classList.add('active');
                tabAuthEmail.classList.remove('active');
                if (phoneAuthContainer) phoneAuthContainer.style.display = 'block';
                if (emailAuthContainer) emailAuthContainer.style.display = 'none';
            });

            tabAuthEmail.addEventListener('click', () => {
                tabAuthEmail.classList.add('active');
                tabAuthPhone.classList.remove('active');
                if (phoneAuthContainer) phoneAuthContainer.style.display = 'none';
                if (emailAuthContainer) emailAuthContainer.style.display = 'block';
            });
        }

        // Email Registration/Login Mode Toggle
        let isEmailRegisterMode = false;
        if (toggleEmailModeBtn) {
            toggleEmailModeBtn.addEventListener('click', () => {
                isEmailRegisterMode = !isEmailRegisterMode;
                if (isEmailRegisterMode) {
                    if (registerFieldsGroup) registerFieldsGroup.style.display = 'block';
                    if (emailSubmitText) emailSubmitText.textContent = 'إنشاء حساب ومزامنة';
                    if (emailTogglePrompt) emailTogglePrompt.textContent = 'لديك حساب بالفعل؟';
                    if (toggleEmailModeBtn) toggleEmailModeBtn.textContent = 'تسجيل الدخول';
                } else {
                    if (registerFieldsGroup) registerFieldsGroup.style.display = 'none';
                    if (emailSubmitText) emailSubmitText.textContent = 'تسجيل الدخول';
                    if (emailTogglePrompt) emailTogglePrompt.textContent = 'ليس لديك حساب؟';
                    if (toggleEmailModeBtn) toggleEmailModeBtn.textContent = 'إنشاء حساب جديد';
                }
            });
        }

        // Email Form Submit Handler
        if (emailAuthForm) {
            emailAuthForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = emailInput.value.trim();
                const password = passwordInput.value;
                
                if (!email || !password) {
                    alert('يرجى ملء جميع الحقول المطلوبة.');
                    return;
                }
                
                if (isEmailRegisterMode) {
                    const confirmPass = passwordConfirmInput.value;
                    if (password !== confirmPass) {
                        alert('كلمات المرور غير متطابقة!');
                        return;
                    }
                    if (password.length < 6) {
                        alert('يجب أن تكون كلمة المرور مكونة من 6 أحرف أو أكثر.');
                        return;
                    }
                    
                    emailSubmitBtn.disabled = true;
                    const origText = emailSubmitText.textContent;
                    emailSubmitText.textContent = 'جاري إنشاء الحساب...';
                    
                    try {
                        await createUserWithEmailAndPassword(window.firebaseAuth, email, password);
                        if (userModal) userModal.style.display = 'none';
                        // Reset form
                        emailInput.value = '';
                        passwordInput.value = '';
                        passwordConfirmInput.value = '';
                    } catch (err) {
                        console.error("Register Error:", err);
                        let errMsg = 'فشل إنشاء الحساب.';
                        if (err.code === 'auth/email-already-in-use') {
                            errMsg = 'هذا البريد الإلكتروني مسجل بالفعل!';
                        } else if (err.code === 'auth/invalid-email') {
                            errMsg = 'البريد الإلكتروني غير صالح.';
                        } else if (err.code === 'auth/weak-password') {
                            errMsg = 'كلمة المرور ضعيفة جداً.';
                        } else {
                            errMsg += ` الخطأ: ${err.message}`;
                        }
                        alert(errMsg);
                    } finally {
                        emailSubmitBtn.disabled = false;
                        emailSubmitText.textContent = origText;
                    }
                } else {
                    emailSubmitBtn.disabled = true;
                    const origText = emailSubmitText.textContent;
                    emailSubmitText.textContent = 'جاري تسجيل الدخول...';
                    
                    try {
                        await signInWithEmailAndPassword(window.firebaseAuth, email, password);
                        if (userModal) userModal.style.display = 'none';
                        // Reset form
                        emailInput.value = '';
                        passwordInput.value = '';
                    } catch (err) {
                        console.error("Login Error:", err);
                        let errMsg = 'فشل تسجيل الدخول. يرجى التحقق من صحة البيانات.';
                        if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                            errMsg = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
                        } else {
                            errMsg += ` الخطأ: ${err.message}`;
                        }
                        alert(errMsg);
                    } finally {
                        emailSubmitBtn.disabled = false;
                        emailSubmitText.textContent = origText;
                    }
                }
            });
        }

        // Toggle Modal Click
        if (userToggleBtn) {
            userToggleBtn.addEventListener('click', () => {
                if (userModal) {
                    userModal.style.display = 'flex';
                    if (currentUser && localTxCountLabel) {
                        localTxCountLabel.textContent = `${transactions.length} معاملة`;
                    }
                }
            });
        }

        if (closeUserModalBtn) {
            closeUserModalBtn.addEventListener('click', () => {
                if (userModal) userModal.style.display = 'none';
            });
        }

        if (userModal) {
            userModal.addEventListener('click', (e) => {
                if (e.target === userModal) {
                    userModal.style.display = 'none';
                }
            });
        }

        // Step 1 Form Submit (Send Verification Code)
        if (phoneAuthFormStep1) {
            phoneAuthFormStep1.addEventListener('submit', async (e) => {
                e.preventDefault();
                const rawPhone = phoneInput.value.trim();
                
                if (!rawPhone.startsWith('+') || rawPhone.length < 9) {
                    alert('يرجى إدخال رقم الهاتف كاملاً مع رمز الدولة مبدوءاً بـ + (مثال: +966500000000)');
                    return;
                }
                
                sendOtpBtn.disabled = true;
                const originalBtnText = sendOtpBtn.querySelector('span').textContent;
                sendOtpBtn.querySelector('span').textContent = 'جاري الإرسال...';
                
                try {
                    if (!window.recaptchaVerifier) {
                        window.recaptchaVerifier = new RecaptchaVerifier(window.firebaseAuth, 'recaptcha-container', {
                            'size': 'invisible'
                        });
                    }
                    
                    confirmationResult = await signInWithPhoneNumber(window.firebaseAuth, rawPhone, window.recaptchaVerifier);
                    
                    phoneAuthFormStep1.style.display = 'none';
                    phoneAuthFormStep2.style.display = 'block';
                    startOTPCountdown();
                } catch (error) {
                    console.error("SMS Send Error:", error);
                    alert(`فشل إرسال رمز التحقق. يرجى التأكد من كتابة الرقم بشكل صحيح وتفعيل الخدمة في فاير بيز. الخطأ: ${error.message}`);
                    if (window.recaptchaVerifier) {
                        window.recaptchaVerifier.clear();
                        window.recaptchaVerifier = null;
                    }
                } finally {
                    sendOtpBtn.disabled = false;
                    sendOtpBtn.querySelector('span').textContent = originalBtnText;
                }
            });
        }

        // Step 2 Form Submit (Confirm Verification Code)
        if (phoneAuthFormStep2) {
            phoneAuthFormStep2.addEventListener('submit', async (e) => {
                e.preventDefault();
                const code = otpInput.value.trim();
                
                if (code.length !== 6 || isNaN(code)) {
                    alert('يرجى إدخال كود التحقق المكون من 6 أرقام.');
                    return;
                }
                
                verifyOtpBtn.disabled = true;
                const originalBtnText = verifyOtpBtn.querySelector('span').textContent;
                verifyOtpBtn.querySelector('span').textContent = 'جاري التأكيد...';
                
                try {
                    await confirmationResult.confirm(code);
                    if (userModal) userModal.style.display = 'none';
                    otpInput.value = '';
                } catch (error) {
                    console.error("Verification Error:", error);
                    alert('كود التحقق غير صحيح، يرجى المحاولة مرة أخرى.');
                } finally {
                    verifyOtpBtn.disabled = false;
                    verifyOtpBtn.querySelector('span').textContent = originalBtnText;
                }
            });
        }

        // Back to Step 1
        if (backToStep1Btn) {
            backToStep1Btn.addEventListener('click', () => {
                phoneAuthFormStep2.style.display = 'none';
                phoneAuthFormStep1.style.display = 'block';
                clearInterval(otpCountdownInterval);
            });
        }

        // Resend OTP
        if (resendOtpBtn) {
            resendOtpBtn.addEventListener('click', () => {
                if (phoneAuthFormStep1) {
                    phoneAuthFormStep1.requestSubmit();
                }
            });
        }

        // Force Sync click
        if (forceSyncBtn) {
            forceSyncBtn.addEventListener('click', async () => {
                forceSyncBtn.disabled = true;
                const origText = forceSyncBtn.querySelector('span').textContent;
                forceSyncBtn.querySelector('span').textContent = 'جاري المزامنة...';
                
                await syncDataWithCloud(true);
                
                forceSyncBtn.disabled = false;
                forceSyncBtn.querySelector('span').textContent = origText;
                alert('تمت المزامنة بنجاح مع قاعدة البيانات السحابية!');
            });
        }

        // Logout
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                if (confirm('هل أنت متأكد من تسجيل الخروج؟ ستبقى البيانات محفوظة محلياً على هذا الجهاز.')) {
                    try {
                        await signOut(window.firebaseAuth);
                        if (userModal) userModal.style.display = 'none';
                    } catch (error) {
                        console.error("Logout error:", error);
                    }
                }
            });
        }

        // Delete Account
        if (deleteAccountBtn) {
            deleteAccountBtn.addEventListener('click', async () => {
                const conf1 = confirm('⚠️ تحذير: هل أنت متأكد تماماً من حذف حسابك؟ سيؤدي ذلك إلى حذف جميع بياناتك السحابية نهائياً من السيرفر.');
                if (!conf1) return;
                
                const conf2 = confirm('هل تريد أيضاً مسح البيانات المحلية المخزنة على هذا المتصفح؟ اضغط (موافق) لمسحها، أو (إلغاء) للاحتفاظ بها محلياً فقط.');
                
                try {
                    deleteAccountBtn.disabled = true;
                    const userDocRef = doc(window.firebaseDb, 'users', currentUser.uid);
                    await window.firebaseSDK.deleteDoc(userDocRef);
                    await window.firebaseSDK.deleteUser(currentUser);
                    
                    if (conf2) {
                        localStorage.clear();
                        transactions = [];
                        stores = ['المتجر الرئيسي'];
                        primaryCurrency = 'ر.س';
                        activeStore = 'all';
                        currentTheme = 'light';
                        
                        populateStoreDropdowns();
                        renderStoresManagement();
                        render();
                    }
                    
                    alert('تم حذف الحساب بنجاح.');
                    if (userModal) userModal.style.display = 'none';
                } catch (error) {
                    console.error("Delete account error:", error);
                    alert(`فشل حذف الحساب. قد يتطلب هذا الإجراء تسجيل الدخول مجدداً حديثاً لأسباب أمنية. يرجى تسجيل الخروج ثم تسجيل الدخول مرة أخرى والمحاولة. الخطأ: ${error.message}`);
                } finally {
                    deleteAccountBtn.disabled = false;
                }
            });
        }
    } else {
        if (syncIndicatorDot) {
            syncIndicatorDot.className = 'sync-indicator-dot offline';
            syncIndicatorDot.title = 'الوضع المحلي (لم يتم تهيئة فاير بيز)';
        }
        if (userToggleBtn) {
            userToggleBtn.addEventListener('click', () => {
                alert('التطبيق يعمل حالياً بالوضع المحلي فقط. لتفعيل المزامنة السحابية، يرجى ملء بيانات مشروعك في ملف firebase-config.js');
            });
        }
    }

    // -------------------------------------------------------------------------
    // 3. EVENT LISTENERS
    // -------------------------------------------------------------------------
    
    // Theme Toggle Handler
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            if (document.body) {
                document.body.classList.toggle('light-theme');
                const theme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
                currentTheme = theme;
                localStorage.setItem('muhasib_theme', theme);
                triggerCloudSave();
            }
            updateThemeIcon();
            render();
        });
    }

    function updateThemeIcon() {
        if (!themeToggleBtn) return;
        const icon = themeToggleBtn.querySelector('i');
        if (icon) {
            if (document.body && document.body.classList.contains('light-theme')) {
                icon.setAttribute('data-lucide', 'moon');
                themeToggleBtn.title = "تفعيل المظهر الداكن";
            } else {
                icon.setAttribute('data-lucide', 'sun');
                themeToggleBtn.title = "تفعيل المظهر المضيء";
            }
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }
    updateThemeIcon();

    // Toggle Settings Panel Drawer
    settingsToggleBtn.addEventListener('click', () => {
        settingsPanel.classList.toggle('collapsed');
    });

    // Primary Currency Change Handler
    primaryCurrencySelect.addEventListener('change', (e) => {
        primaryCurrency = e.target.value;
        localStorage.setItem('muhasib_primary_currency', primaryCurrency);
        transactionCurrencySelect.value = primaryCurrency;
        triggerCloudSave();
        render();
    });

    // Active Store Switch in Header
    headerStoreSelect.addEventListener('change', (e) => {
        activeStore = e.target.value;
        localStorage.setItem('muhasib_active_store', activeStore);
        if (activeStore !== 'all') {
            transactionStoreSelect.value = activeStore;
        }
        triggerCloudSave();
        render();
    });

    // Store Creation Trigger
    addStoreBtn.addEventListener('click', createNewStore);
    newStoreNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            createNewStore();
        }
    });

    // Backup Export Trigger
    backupExportBtn.addEventListener('click', exportBackup);

    // Backup Import Trigger
    backupImportBtn.addEventListener('click', () => {
        backupFileInput.click();
    });

    // Backup File Upload Handler
    backupFileInput.addEventListener('change', handleBackupImport);

    // View Tab Switcher Listeners
    viewTabDebts.addEventListener('click', () => {
        viewTabDebts.classList.add('active');
        viewTabCash.classList.remove('active');
        currentTab = 'debts';
        render();
    });

    viewTabCash.addEventListener('click', () => {
        viewTabCash.classList.add('active');
        viewTabDebts.classList.remove('active');
        currentTab = 'cash';
        render();
    });

    // Form progressive wizard listeners
    amountInput.addEventListener('input', updateWizardVisibility);
    typeRadios.forEach(radio => {
        radio.addEventListener('change', updateWizardVisibility);
    });
    personInput.addEventListener('input', updateWizardVisibility);

    // Handle Form Submission
    transactionForm.addEventListener('submit', handleFormSubmit);

    // Live search typing
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim().toLowerCase();
        clearSearchBtn.style.display = searchQuery.length > 0 ? 'flex' : 'none';
        render();
    });

    // Clear search input
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.style.display = 'none';
        searchInput.focus();
        render();
    });

    // Filter Chips Click Handling
    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentFilter = chip.getAttribute('data-filter');
            render();
        });
    });

    // Export CSV Click Handler
    exportCsvBtn.addEventListener('click', exportToCSV);

    // Remove input error outline on type
    [amountInput, personInput, newStoreNameInput, paymentAmountInput].forEach(input => {
        input.addEventListener('input', () => {
            input.classList.remove('input-error');
        });
    });

    // Close payment modal listeners
    closeModalBtn.addEventListener('click', closePaymentModal);
    paymentModal.addEventListener('click', (e) => {
        if (e.target === paymentModal) {
            closePaymentModal();
        }
    });

    // Handle Payment Submission
    paymentForm.addEventListener('submit', handlePaymentSubmit);

    // Cancel Edit Trigger
    cancelEditBtn.addEventListener('click', () => {
        cancelEdit();
    });

    // Event Delegation for transaction list item clicks (dynamic buttons)
    if (transactionsList) {
        transactionsList.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            // Retrieve transaction element and IDs
            const item = btn.closest('.transaction-item');
            if (!item) return;

            const transId = item.getAttribute('data-id');
            const paymentId = item.getAttribute('data-payment-id');

            if (btn.classList.contains('edit-btn')) {
                e.preventDefault();
                editTransaction(transId);
            } else if (btn.classList.contains('delete-btn')) {
                e.preventDefault();
                if (paymentId) {
                    deletePayment(transId, paymentId);
                } else {
                    const confirmDelete = confirm('هل أنت متأكد من حذف هذه المعاملة نهائياً؟');
                    if (confirmDelete) {
                        deleteTransaction(transId);
                    }
                }
            } else if (btn.classList.contains('coins-btn')) {
                e.preventDefault();
                openPaymentModal(transId);
            }
        });
    }

    // Event Delegation for store list deletes (dynamic buttons)
    if (storesManagementList) {
        storesManagementList.addEventListener('click', (e) => {
            const btn = e.target.closest('.store-delete-btn');
            if (!btn) return;

            e.preventDefault();
            const storeName = btn.getAttribute('data-store');
            deleteStore(storeName);
        });
    }

    // -------------------------------------------------------------------------
    // 4. PARTIAL SETTLEMENT ACTIONS
    // -------------------------------------------------------------------------

    /**
     * Opens the payment modal drawer and loads transaction payment history
     */
    function openPaymentModal(id) {
        const transaction = transactions.find(t => t.id == id);
        if (!transaction) return;

        const transPayments = transaction.payments || [];
        const paidSum = transPayments.reduce((sum, p) => sum + p.amount, 0);
        const remaining = transaction.amount - paidSum;
        const transCurrency = transaction.currency || primaryCurrency;

        // Populate Modal Fields
        modalTransactionId.value = id;
        modalDebtPerson.textContent = (transaction.type === 'for_me' ? 'المدين: ' : 'الدائن: ') + transaction.person;
        modalDebtRemaining.textContent = `المبلغ المتبقي: ${remaining.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ${transCurrency}`;
        modalCurrencyLabel.textContent = transCurrency;

        // Reset Inputs
        paymentAmountInput.max = remaining;
        paymentAmountInput.value = '';
        paymentAmountInput.classList.remove('input-error');
        paymentDescriptionInput.value = '';

        // Render mini-payment list inside modal
        modalPaymentHistoryList.innerHTML = '';
        if (transPayments.length === 0) {
            modalPaymentHistoryList.innerHTML = '<p style="font-size:0.75rem; color:var(--text-muted); text-align:center; padding: 12px 0;">لا توجد دفعات سابقة مسجلة.</p>';
        } else {
            transPayments.forEach(p => {
                const item = document.createElement('div');
                item.className = 'payment-history-item';
                item.innerHTML = `
                    <div class="payment-item-details">
                        <span class="payment-item-desc">${p.description}</span>
                        <span class="payment-item-date">${formatDate(p.date)}</span>
                    </div>
                    <span class="payment-item-amount">${p.amount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ${transCurrency}</span>
                `;
                modalPaymentHistoryList.appendChild(item);
            });
        }

        // Show Overlay
        paymentModal.style.display = 'flex';
        paymentAmountInput.focus();
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    /**
     * Closes the active payment modal overlay
     */
    function closePaymentModal() {
        paymentModal.style.display = 'none';
    }

    /**
     * Commits a new partial payment record to the transaction state
     */
    function handlePaymentSubmit(e) {
        e.preventDefault();

        const id = modalTransactionId.value;
        const amount = parseFloat(paymentAmountInput.value);
        const description = paymentDescriptionInput.value.trim() || 'سداد جزء من الدين';

        const transaction = transactions.find(t => t.id == id);
        if (!transaction) return;

        const transPayments = transaction.payments || [];
        const paidSum = transPayments.reduce((sum, p) => sum + p.amount, 0);
        const remaining = transaction.amount - paidSum;

        // Validation against remaining limit
        if (isNaN(amount) || amount <= 0 || amount > remaining) {
            paymentAmountInput.classList.add('input-error');
            return;
        }

        if (!transaction.payments) {
            transaction.payments = [];
        }

        // Push new payment
        transaction.payments.push({
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            amount: amount,
            description: description,
            date: new Date().toISOString()
        });

        saveToStorage();
        closePaymentModal();
        render();
    }

    // -------------------------------------------------------------------------
    // 5. STORE MANAGEMENT ACTIONS
    // -------------------------------------------------------------------------

    /**
     * Re-populates the select elements for stores based on the state list
     */
    function populateStoreDropdowns() {
        headerStoreSelect.innerHTML = '';
        const allOption = document.createElement('option');
        allOption.value = 'all';
        allOption.textContent = 'كل المتاجر (تجميعي)';
        headerStoreSelect.appendChild(allOption);

        stores.forEach(store => {
            const opt = document.createElement('option');
            opt.value = store;
            opt.textContent = store;
            headerStoreSelect.appendChild(opt);
        });
        headerStoreSelect.value = activeStore;

        transactionStoreSelect.innerHTML = '';
        stores.forEach(store => {
            const opt = document.createElement('option');
            opt.value = store;
            opt.textContent = store;
            transactionStoreSelect.appendChild(opt);
        });
        
        if (activeStore !== 'all') {
            transactionStoreSelect.value = activeStore;
        } else {
            transactionStoreSelect.value = stores[0];
        }
    }

    /**
     * Renders stores management list inside settings drawer
     */
    function renderStoresManagement() {
        storesManagementList.innerHTML = '';

        stores.forEach(store => {
            const item = document.createElement('div');
            item.className = 'store-management-item';
            
            const isDeleteDisabledHtml = stores.length <= 1 ? 'style="display:none;"' : '';

            item.innerHTML = `
                <span>${store}</span>
                <button class="store-delete-btn" data-store="${store}" title="حذف المتجر" ${isDeleteDisabledHtml}>
                    <i data-lucide="trash-2"></i>
                </button>
            `;
            storesManagementList.appendChild(item);
        });
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    /**
     * Adds a new store to the system
     */
    function createNewStore() {
        const storeName = newStoreNameInput.value.trim();
        if (!storeName) {
            newStoreNameInput.classList.add('input-error');
            return;
        }

        if (stores.includes(storeName)) {
            alert('هذا المتجر موجود بالفعل!');
            return;
        }

        stores.push(storeName);
        localStorage.setItem('muhasib_stores', JSON.stringify(stores));
        triggerCloudSave();
        
        newStoreNameInput.value = '';
        newStoreNameInput.classList.remove('input-error');
        
        populateStoreDropdowns();
        renderStoresManagement();
        render();
    }

    /**
     * Deletes a store and asks for confirmation to cascade transaction deletes
     */
    function deleteStore(storeName) {
        if (stores.length <= 1) {
            alert('يجب أن يكون هناك متجر واحد على الأقل في الحساب.');
            return;
        }

        const confirmDelete = confirm(`هل أنت متأكد من حذف متجر "${storeName}"؟ سيتم حذف جميع الفواتير والمعاملات التابعة له نهائياً!`);
        if (!confirmDelete) return;

        transactions = transactions.filter(t => t.store !== storeName);
        saveToStorage();

        stores = stores.filter(s => s !== storeName);
        localStorage.setItem('muhasib_stores', JSON.stringify(stores));
        triggerCloudSave();

        if (activeStore === storeName) {
            activeStore = 'all';
            localStorage.setItem('muhasib_active_store', 'all');
        }

        populateStoreDropdowns();
        renderStoresManagement();
        render();
    }

    // -------------------------------------------------------------------------
    // 6. CORE CONVERSION & STORAGE FUNCTIONS
    // -------------------------------------------------------------------------

    /**
     * Converts a monetary value between registered currencies using static rates
     */
    function convertAmount(amount, fromCurr, toCurr) {
        const from = fromCurr === '$' ? 'USD' : (fromCurr === '€' ? 'EUR' : fromCurr);
        const to = toCurr === '$' ? 'USD' : (toCurr === '€' ? 'EUR' : toCurr);
        
        const rateFrom = EXCHANGE_RATES[from] || 1.0;
        const rateTo = EXCHANGE_RATES[to] || 1.0;
        
        const amountInUSD = amount / rateFrom;
        return amountInUSD * rateTo;
    }

    /**
     * Updates form field visibility and labels step-by-step (progressive wizard)
     */
    function updateWizardVisibility() {
        const amount = parseFloat(amountInput.value);
        
        if (isNaN(amount) || amount <= 0) {
            typeGroup.classList.remove('visible');
            paymentStatusGroup.classList.remove('visible');
            personGroup.classList.remove('visible');
            submitGroup.classList.remove('visible');
            return;
        }

        // Show type selection step
        typeGroup.classList.add('visible');

        // Show payment status and person steps
        paymentStatusGroup.classList.add('visible');
        personGroup.classList.add('visible');

        // Update wording based on type
        const selectedType = getSelectedType();
        if (selectedType === 'for_me') {
            paymentStatusLabel.textContent = 'هل تم استلام المبلغ بالفعل أم هو دين مؤجل؟';
            statusSettledText.textContent = 'تم الاستلام فوراً';
            personLabel.textContent = 'من الشخص المدين لك؟ (من من؟)';
            personInput.placeholder = 'اسم الشخص الذي يدين لك...';
        } else {
            paymentStatusLabel.textContent = 'هل تم دفع المبلغ بالفعل أم هو دين مؤجل؟';
            statusSettledText.textContent = 'تم الدفع فوراً';
            personLabel.textContent = 'من الشخص الدائن؟ (لمن؟)';
            personInput.placeholder = 'اسم الشخص الذي تدين له...';
        }

        // Show submit group only if person name is entered
        const personName = personInput.value.trim();
        if (personName.length > 0) {
            submitGroup.classList.add('visible');
        } else {
            submitGroup.classList.remove('visible');
        }
    }

    /**
     * Helper to get currently checked transaction type
     */
    function getSelectedType() {
        let selectedValue = 'for_me';
        typeRadios.forEach(radio => {
            if (radio.checked) {
                selectedValue = radio.value;
            }
        });
        return selectedValue;
    }

    /**
     * Saves transaction state to LocalStorage
     */
    function saveToStorage() {
        localStorage.setItem('muhasib_transactions', JSON.stringify(transactions));
        triggerCloudSave();
    }

    /**
     * Activates the edit mode for a specific transaction
     */
    function editTransaction(id) {
        const transaction = transactions.find(t => t.id == id);
        if (!transaction) return;

        // Set editing state
        editingTransactionId = id;

        // Populate form fields
        amountInput.value = transaction.amount;
        transactionCurrencySelect.value = transaction.currency || primaryCurrency;
        transactionStoreSelect.value = transaction.store || stores[0];
        
        // Select type radio
        typeRadios.forEach(radio => {
            radio.checked = radio.value === transaction.type;
        });

        // Calculate if it's already settled from its payments
        const paymentsList = transaction.payments || [];
        const totalPaid = paymentsList.reduce((sum, p) => sum + p.amount, 0);
        
        const isSettled = totalPaid >= transaction.amount && transaction.amount > 0;
        
        // Select status radio based on settled state or existing payments
        const statusRadios = document.getElementsByName('payment-status');
        statusRadios.forEach(radio => {
            if (isSettled) {
                radio.checked = radio.value === 'settled';
            } else {
                radio.checked = radio.value === 'deferred';
            }
        });

        personInput.value = transaction.person;
        descriptionInput.value = transaction.description || '';

        // Show all wizard steps
        typeGroup.classList.add('visible');
        paymentStatusGroup.classList.add('visible');
        personGroup.classList.add('visible');
        submitGroup.classList.add('visible');

        // Dynamically update labels based on type
        updateWizardVisibility();

        // Update form submission buttons UI
        submitBtn.querySelector('span').textContent = 'تحديث المعاملة';
        cancelEditBtn.style.display = 'block';

        // Smooth scroll to top form
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }

    /**
     * Cancels the active edit mode and resets the form
     */
    function cancelEdit() {
        editingTransactionId = null;
        transactionForm.reset();
        
        // Restore defaults
        transactionCurrencySelect.value = primaryCurrency;
        if (activeStore !== 'all') {
            transactionStoreSelect.value = activeStore;
        } else {
            transactionStoreSelect.value = stores[0];
        }

        // Collapse wizard steps
        updateWizardVisibility();

        // Restore button UI
        submitBtn.querySelector('span').textContent = 'حفظ المعاملة';
        cancelEditBtn.style.display = 'none';
    }

    /**
     * Handles new transaction creation or updates an existing transaction in edit mode
     */
    function handleFormSubmit(e) {
        e.preventDefault();

        // Retrieve values
        const amount = parseFloat(amountInput.value);
        const currency = transactionCurrencySelect.value;
        const store = transactionStoreSelect.value;
        const type = getSelectedType();
        const person = personInput.value.trim();
        const description = descriptionInput.value.trim();

        // Validation
        let isValid = true;

        if (isNaN(amount) || amount <= 0) {
            amountInput.classList.add('input-error');
            isValid = false;
        }

        if (!person) {
            personInput.classList.add('input-error');
            isValid = false;
        }

        if (!isValid) return;

        // Read payment status selection
        let paymentStatus = 'deferred';
        const statusRadios = document.getElementsByName('payment-status');
        statusRadios.forEach(radio => {
            if (radio.checked) {
                paymentStatus = radio.value;
            }
        });

        if (editingTransactionId) {
            // Edit Mode
            const transaction = transactions.find(t => t.id == editingTransactionId);
            if (!transaction) return;

            const existingPayments = transaction.payments || [];
            const totalPaid = existingPayments.reduce((sum, p) => sum + p.amount, 0);

            if (paymentStatus === 'settled') {
                // Set single full payment if marked settled immediately
                transaction.payments = [{
                    id: Date.now().toString(36) + 'editinit',
                    amount: amount,
                    description: 'سداد كامل فوري عند التعديل',
                    date: new Date().toISOString()
                }];
            } else {
                // Check if amount is less than total payments made
                if (amount < totalPaid) {
                    alert(`خطأ: لا يمكن تعديل المبلغ ليكون أقل من المبالغ المسددة بالفعل (${totalPaid.toLocaleString('ar-EG')} ${transaction.currency || primaryCurrency})!`);
                    amountInput.classList.add('input-error');
                    return;
                }
                transaction.payments = existingPayments;
            }

            // Update transaction properties
            transaction.amount = amount;
            transaction.currency = currency;
            transaction.store = store;
            transaction.type = type;
            transaction.person = person;
            transaction.description = description || '';

            saveToStorage();
            cancelEdit(); // Reset form, UI, and clear editing state
            render();
        } else {
            // Create mode
            const initialPayments = [];
            if (paymentStatus === 'settled') {
                initialPayments.push({
                    id: Date.now().toString(36) + 'init',
                    amount: amount,
                    description: 'سداد كامل فوري عند التسجيل',
                    date: new Date().toISOString()
                });
            }

            const newTransaction = {
                id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
                amount: amount,
                currency: currency,
                store: store,
                type: type,
                person: person,
                description: description || '',
                payments: initialPayments,
                date: new Date().toISOString()
            };

            // Add to state and save
            transactions.unshift(newTransaction);
            saveToStorage();

            // Reset form controls safely
            transactionForm.reset();
            
            // Restore active values
            transactionCurrencySelect.value = primaryCurrency;
            if (activeStore !== 'all') {
                transactionStoreSelect.value = activeStore;
            } else {
                transactionStoreSelect.value = stores[0];
            }
            updateWizardVisibility();

            // Refresh UI
            render();
        }
    }

    /**
     * Deletes a transaction with a nice sliding fade animation
     */
    function deleteTransaction(id) {
        const itemElement = document.querySelector(`[data-id="${id}"]`);
        if (!itemElement) return;

        itemElement.classList.add('item-removing');

        setTimeout(() => {
            transactions = transactions.filter(t => t.id != id);
            saveToStorage();
            render();
        }, 250);
    }

    /**
     * Formats numbers to a clean, regional representation
     */
    function formatCurrency(num, currSymbol) {
        const symbol = currSymbol || primaryCurrency;
        return num.toLocaleString('ar-EG', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }) + ' ' + symbol;
    }

    /**
     * Formats ISO dates into a readable Arabic format
     */
    function formatDate(isoString) {
        const date = new Date(isoString);
        return date.toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // -------------------------------------------------------------------------
    // 7. IMPORT, EXPORT, AND BACKUP ENGINE
    // -------------------------------------------------------------------------

    /**
     * Export active store transactions to CSV format (including partial payment summaries)
     */
    function exportToCSV() {
        const filtered = transactions.filter(t => {
            return activeStore === 'all' || t.store === activeStore;
        });

        if (filtered.length === 0) {
            alert('لا توجد أي معاملات لتصديرها لهذا التحديد!');
            return;
        }

        const headers = ['المتجر', 'المبلغ الأصلي', 'المبلغ المسدد', 'المبلغ المتبقي', 'العملة', 'نوع المعاملة', 'المعني (الاسم)', 'الملاحظات والوصف', 'التاريخ والوقت'];
        const csvRows = [];
        
        csvRows.push('\uFEFF' + headers.join(','));

        filtered.forEach(t => {
            const typeArabic = t.type === 'for_me' ? 'له (مستحقات)' : 'عليه (ديون)';
            
            const paid = (t.payments || []).reduce((sum, p) => sum + p.amount, 0);
            const remaining = t.amount - paid;
            
            const columns = [
                t.store,
                t.amount.toString(),
                paid.toString(),
                remaining.toString(),
                t.currency,
                typeArabic,
                t.person,
                t.description || '',
                formatDate(t.date)
            ];
            const escaped = columns.map(col => `"${col.replace(/"/g, '""')}"`);
            csvRows.push(escaped.join(','));
        });

        // Trigger Download
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        
        const fileLabel = activeStore === 'all' ? 'جميع_المتاجر' : activeStore.replace(/\s+/g, '_');
        link.setAttribute('download', `محاسب_كشف_حساب_${fileLabel}_${new Date().toISOString().split('T')[0]}.csv`);
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Backup state, stores, and payment arrays to local JSON file
     */
    function exportBackup() {
        const backupPayload = {
            appName: 'Muhasib',
            exportDate: new Date().toISOString(),
            primaryCurrency: primaryCurrency,
            stores: stores,
            transactions: transactions
        };

        const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `نسخة_احتياطية_محاسب_شامل_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Restore state from JSON backup
     */
    function handleBackupImport(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(evt) {
            try {
                const parsedData = JSON.parse(evt.target.result);
                
                if (parsedData && Array.isArray(parsedData.transactions)) {
                    transactions = parsedData.transactions;
                    
                    if (parsedData.primaryCurrency) {
                        primaryCurrency = parsedData.primaryCurrency;
                        primaryCurrencySelect.value = primaryCurrency;
                        localStorage.setItem('muhasib_primary_currency', primaryCurrency);
                    }
                    
                    if (parsedData.stores && Array.isArray(parsedData.stores)) {
                        stores = parsedData.stores;
                        localStorage.setItem('muhasib_stores', JSON.stringify(stores));
                    }
                    
                    activeStore = 'all';
                    localStorage.setItem('muhasib_active_store', 'all');

                    // Migrate missing fields for safety
                    transactions.forEach(t => {
                        if (!t.store) t.store = stores[0] || 'المتجر الرئيسي';
                        if (!t.payments) t.payments = [];
                    });

                    saveToStorage();
                    
                    populateStoreDropdowns();
                    renderStoresManagement();
                    render();
                    
                    settingsPanel.classList.add('collapsed');
                    alert('تم استعادة المتاجر والبيانات بنجاح!');
                } else {
                    alert('خطأ: الملف المرفوع لا يحتوي على معاملات محاسب صالحة.');
                }
            } catch (err) {
                alert('خطأ: فشل قراءة الملف، تأكد من كونه ملف JSON سليم وصالح.');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    }

    // -------------------------------------------------------------------------
    // 8. CHART DRAWING AND REBUILDING
    // -------------------------------------------------------------------------
    function updateChart(totalForMe, totalOnMe, chartLabels) {
        const chartWrapper = document.getElementById('chart-wrapper');
        const labels = chartLabels || ['لك (مستحقات)', 'عليك (التزامات)'];
        
        if (totalForMe === 0 && totalOnMe === 0) {
            chartWrapper.style.display = 'none';
            if (balanceChartInstance) {
                balanceChartInstance.destroy();
                balanceChartInstance = null;
            }
            return;
        }

        chartWrapper.style.display = 'block';

        const style = getComputedStyle(document.body);
        const successColor = style.getPropertyValue('--success').trim() || 'hsl(162, 70%, 42%)';
        const dangerColor = style.getPropertyValue('--danger').trim() || 'hsl(348, 80%, 54%)';

        if (balanceChartInstance) {
            balanceChartInstance.data.datasets[0].data = [totalForMe, totalOnMe];
            balanceChartInstance.data.datasets[0].backgroundColor = [successColor, dangerColor];
            balanceChartInstance.data.labels = labels;
            balanceChartInstance.update();
        } else {
            const ctx = document.getElementById('balance-chart').getContext('2d');
            if (typeof Chart !== 'undefined') {
                balanceChartInstance = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: labels,
                        datasets: [{
                            data: [totalForMe, totalOnMe],
                            backgroundColor: [
                                successColor,
                                dangerColor
                            ],
                            borderColor: 'rgba(255, 255, 255, 0.08)',
                            borderWidth: 1.5,
                            hoverOffset: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '70%',
                        plugins: {
                            legend: {
                                display: false
                            },
                            tooltip: {
                                rtl: true,
                                titleFont: { family: 'Tajawal', size: 11, weight: 'bold' },
                                bodyFont: { family: 'Tajawal', size: 11 },
                                callbacks: {
                                    label: function(context) {
                                        let label = context.label || '';
                                        if (label) label += ': ';
                                        if (context.parsed !== null) {
                                            label += context.parsed.toLocaleString('ar-EG', {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2
                                            }) + ' ' + primaryCurrency;
                                        }
                                        return label;
                                    }
                                }
                            }
                        }
                    }
                });
            } else {
                console.warn('Chart.js is not loaded. Skipping chart initialization.');
            }
        }
    }

    // -------------------------------------------------------------------------
    // 9. RENDER ENGINE
    // -------------------------------------------------------------------------
    function render() {
        const activeStoreTransactions = transactions.filter(t => {
            return activeStore === 'all' || t.store === activeStore;
        });

        // Set Tab UI state labels
        if (currentTab === 'debts') {
            netBalanceLabel.textContent = 'صافي الديون المعلقة';
            labelForMe.textContent = 'لك (تطالبهم)';
            labelOnMe.textContent = 'عليك (يطالبونك)';
            historySectionTitle.textContent = 'سجل الديون المعلقة';
        } else {
            netBalanceLabel.textContent = 'رصيد الصندوق الحالي';
            labelForMe.textContent = 'مقبوضات (دخل)';
            labelOnMe.textContent = 'مدفوعات (مصاريف)';
            historySectionTitle.textContent = 'حركات الصندوق النقدية';
        }

        if (currentTab === 'debts') {
            // Calculate unified values in primary currency (based on outstanding remaining amounts)
            let totalForMeUnified = 0;
            let totalOnMeUnified = 0;

            activeStoreTransactions.forEach(t => {
                const paymentsList = t.payments || [];
                const totalPaid = paymentsList.reduce((sum, p) => sum + p.amount, 0);
                const remainingAmount = Math.max(0, t.amount - totalPaid);

                const amountInPrimary = convertAmount(remainingAmount, t.currency || primaryCurrency, primaryCurrency);
                if (t.type === 'for_me') {
                    totalForMeUnified += amountInPrimary;
                } else {
                    totalOnMeUnified += amountInPrimary;
                }
            });

            const netBalanceUnified = totalForMeUnified - totalOnMeUnified;

            // Render Totals & Metrics in Primary Currency
            totalForMeVal.textContent = formatCurrency(totalForMeUnified);
            totalOnMeVal.textContent = formatCurrency(totalOnMeUnified);
            netBalanceValue.textContent = formatCurrency(Math.abs(netBalanceUnified));
            
            // Update Chart
            updateChart(totalForMeUnified, totalOnMeUnified, ['لك (مستحقات)', 'عليك (التزامات)']);

            // Dynamic Net Balance styling
            netBalanceValue.className = 'net-balance-value';
            if (netBalanceUnified > 0) {
                netBalanceValue.classList.add('positive');
                netBalanceValue.textContent = 'لك: ' + netBalanceValue.textContent;
            } else if (netBalanceUnified < 0) {
                netBalanceValue.classList.add('negative');
                netBalanceValue.textContent = 'عليك: ' + netBalanceValue.textContent;
            } else {
                netBalanceValue.classList.add('neutral');
                netBalanceValue.textContent = 'متوازن (0.00 ' + primaryCurrency + ')';
            }

            // Filter and Search list
            const filteredTransactions = activeStoreTransactions.filter(t => {
                if (currentFilter !== 'all' && t.type !== currentFilter) {
                    return false;
                }
                
                if (searchQuery) {
                    const matchPerson = t.person.toLowerCase().includes(searchQuery);
                    const matchDesc = t.description.toLowerCase().includes(searchQuery);
                    const matchAmount = t.amount.toString().includes(searchQuery);
                    const matchCurrency = t.currency && t.currency.toLowerCase().includes(searchQuery);
                    const matchStoreName = t.store.toLowerCase().includes(searchQuery);
                    return matchPerson || matchDesc || matchAmount || matchCurrency || matchStoreName;
                }
                
                return true;
            });

            // Update badge counter
            transactionCountBadge.textContent = `${filteredTransactions.length} معاملة`;

            // Rebuild list DOM
            transactionsList.innerHTML = '';

            if (filteredTransactions.length === 0) {
                const emptyDiv = document.createElement('div');
                emptyDiv.className = 'empty-state';
                
                let icon = 'piggy-bank';
                let title = 'سجلك فارغ تماماً';
                let desc = 'أضف معاملتك الأولى بالأعلى وسنقوم باحتساب المبالغ تلقائياً!';

                if (searchQuery) {
                    icon = 'search';
                    title = 'لا توجد نتائج بحث';
                    desc = 'لم نجد أي معاملات مطابقة لكلمة البحث الخاصة بك.';
                } else if (currentFilter === 'for_me') {
                    icon = 'trending-up';
                    title = 'لا توجد مستحقات لك';
                    desc = 'ليس لديك أي ديون تطالب بها الآخرين حالياً.';
                } else if (currentFilter === 'on_me') {
                    icon = 'trending-down';
                    title = 'لا توجد ديون عليك';
                    desc = 'أنت خالٍ من الديون! أحسنت صنعاً في إدارة التزاماتك.';
                }

                emptyDiv.innerHTML = `
                    <div class="empty-icon-wrapper">
                        <i data-lucide="${icon}"></i>
                    </div>
                    <p class="empty-title">${title}</p>
                    <p class="empty-desc">${desc}</p>
                `;
                transactionsList.appendChild(emptyDiv);
            } else {
                filteredTransactions.forEach(t => {
                    const item = document.createElement('div');
                    
                    // Calculate outstanding ratios
                    const paymentsList = t.payments || [];
                    const totalPaid = paymentsList.reduce((sum, p) => sum + p.amount, 0);
                    const remaining = Math.max(0, t.amount - totalPaid);
                    const isSettled = remaining <= 0;

                    const typeClass = t.type;
                    const settledClass = isSettled ? 'settled' : '';
                    item.className = `transaction-item ${typeClass} ${settledClass}`;
                    item.setAttribute('data-id', t.id);

                    const iconName = t.type === 'for_me' ? 'arrow-down-left' : 'arrow-up-right';
                    const descriptionHtml = t.description ? `<span class="item-desc">${t.description}</span>` : '';
                    const personPrefix = t.type === 'for_me' ? 'من: ' : 'إلى: ';
                    const transCurrency = t.currency || primaryCurrency;

                    // Render store badge tag only if viewing "All Stores" (تجميعي)
                    const storeTagHtml = activeStore === 'all' ? `<span class="store-tag" title="${t.store}">${t.store}</span>` : '';

                    // Render partial payments description label
                    let remainingSubtextHtml = '';
                    if (totalPaid > 0) {
                        remainingSubtextHtml = `<span class="debt-remaining-subtext">المسدد: ${totalPaid.toLocaleString('ar-EG')} | المتبقي: ${remaining.toLocaleString('ar-EG')} ${transCurrency}</span>`;
                    }

                    // Append cash drawer (payment) action key if not settled
                    const paymentBtnHtml = isSettled 
                        ? '' 
                        : `<button class="coins-btn" title="تسجيل دفعة سداد">
                               <i data-lucide="coins"></i>
                           </button>`;

                    item.innerHTML = `
                        <div class="item-left">
                            <div class="indicator-icon">
                                <i data-lucide="${iconName}"></i>
                            </div>
                            <div class="item-details">
                                <span class="item-title">${storeTagHtml}${personPrefix}${t.person}</span>
                                ${descriptionHtml}
                                ${remainingSubtextHtml}
                                <span class="item-date">${formatDate(t.date)}</span>
                            </div>
                        </div>
                        <div class="item-right">
                            <span class="item-amount">
                                ${t.type === 'for_me' ? '+' : '-'}${t.amount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ${transCurrency}
                            </span>
                            <div style="display:flex; gap: 4px;">
                                ${paymentBtnHtml}
                                <button class="edit-btn" title="تعديل المعاملة">
                                    <i data-lucide="pencil"></i>
                                </button>
                                <button class="delete-btn" title="حذف المعاملة">
                                    <i data-lucide="trash-2"></i>
                                </button>
                            </div>
                        </div>
                    `;
                    transactionsList.appendChild(item);
                });
            }
        } else {
            // Cash box tab calculations and rendering
            let totalReceivedUnified = 0;
            let totalPaidUnified = 0;
            const cashItems = [];

            activeStoreTransactions.forEach(t => {
                const paymentsList = t.payments || [];
                paymentsList.forEach(p => {
                    const paymentInPrimary = convertAmount(p.amount, t.currency || primaryCurrency, primaryCurrency);
                    if (t.type === 'for_me') {
                        totalReceivedUnified += paymentInPrimary;
                    } else {
                        totalPaidUnified += paymentInPrimary;
                    }

                    cashItems.push({
                        transactionId: t.id,
                        paymentId: p.id,
                        amount: p.amount,
                        currency: t.currency || primaryCurrency,
                        type: t.type,
                        person: t.person,
                        store: t.store,
                        description: p.description,
                        parentDescription: t.description,
                        date: p.date
                    });
                });
            });

            const netCashUnified = totalReceivedUnified - totalPaidUnified;

            // Render Metrics
            totalForMeVal.textContent = formatCurrency(totalReceivedUnified);
            totalOnMeVal.textContent = formatCurrency(totalPaidUnified);
            netBalanceValue.textContent = formatCurrency(Math.abs(netCashUnified));

            // Update Chart
            updateChart(totalReceivedUnified, totalPaidUnified, ['مقبوضات (دخل)', 'مدفوعات (مصاريف)']);

            // Dynamic Cash Balance styling
            netBalanceValue.className = 'net-balance-value';
            if (netCashUnified > 0) {
                netBalanceValue.classList.add('positive');
                netBalanceValue.textContent = 'فائض: ' + netBalanceValue.textContent;
            } else if (netCashUnified < 0) {
                netBalanceValue.classList.add('negative');
                netBalanceValue.textContent = 'عجز: ' + netBalanceValue.textContent;
            } else {
                netBalanceValue.classList.add('neutral');
                netBalanceValue.textContent = 'متوازن (0.00 ' + primaryCurrency + ')';
            }

            // Sort by date descending
            cashItems.sort((a, b) => new Date(b.date) - new Date(a.date));

            // Filter cash items
            const filteredCashItems = cashItems.filter(item => {
                if (currentFilter !== 'all' && item.type !== currentFilter) {
                    return false;
                }

                if (searchQuery) {
                    const matchPerson = item.person.toLowerCase().includes(searchQuery);
                    const matchDesc = item.description.toLowerCase().includes(searchQuery);
                    const matchParentDesc = item.parentDescription && item.parentDescription.toLowerCase().includes(searchQuery);
                    const matchAmount = item.amount.toString().includes(searchQuery);
                    const matchCurrency = item.currency.toLowerCase().includes(searchQuery);
                    const matchStoreName = item.store.toLowerCase().includes(searchQuery);
                    return matchPerson || matchDesc || matchParentDesc || matchAmount || matchCurrency || matchStoreName;
                }

                return true;
            });

            // Update badge counter
            transactionCountBadge.textContent = `${filteredCashItems.length} حركة نقدية`;

            // Rebuild list DOM
            transactionsList.innerHTML = '';

            if (filteredCashItems.length === 0) {
                const emptyDiv = document.createElement('div');
                emptyDiv.className = 'empty-state';
                
                let icon = 'wallet';
                let title = 'لا توجد حركات نقدية';
                let desc = 'لم يتم تسجيل أي عمليات قبض أو دفع فعلية بعد.';

                if (searchQuery) {
                    icon = 'search';
                    title = 'لا توجد نتائج بحث';
                    desc = 'لم نجد أي حركات نقدية مطابقة لكلمة البحث الخاصة بك.';
                } else if (currentFilter === 'for_me') {
                    icon = 'arrow-down-left';
                    title = 'لا توجد مقبوضات';
                    desc = 'لم تستلم أي مبالغ نقدية بعد.';
                } else if (currentFilter === 'on_me') {
                    icon = 'arrow-up-right';
                    title = 'لا توجد مدفوعات';
                    desc = 'لم تقم بدفع أي مبالغ نقدية بعد.';
                }

                emptyDiv.innerHTML = `
                    <div class="empty-icon-wrapper">
                        <i data-lucide="${icon}"></i>
                    </div>
                    <p class="empty-title">${title}</p>
                    <p class="empty-desc">${desc}</p>
                `;
                transactionsList.appendChild(emptyDiv);
            } else {
                filteredCashItems.forEach(item => {
                    const div = document.createElement('div');
                    div.className = `transaction-item ${item.type}`;
                    div.setAttribute('data-id', item.transactionId);
                    div.setAttribute('data-payment-id', item.paymentId);

                    const iconName = item.type === 'for_me' ? 'arrow-down-left' : 'arrow-up-right';
                    const personPrefix = item.type === 'for_me' ? 'استلام من: ' : 'دفع إلى: ';
                    
                    const storeTagHtml = activeStore === 'all' ? `<span class="store-tag" title="${item.store}">${item.store}</span>` : '';
                    const descText = item.description || (item.type === 'for_me' ? 'دفعة نقدية مستلمة' : 'دفعة نقدية مسددة');
                    const parentDescText = item.parentDescription ? ` <span style="color:var(--text-muted); font-size:0.7rem;">(أصل: ${item.parentDescription})</span>` : '';

                    div.innerHTML = `
                        <div class="item-left">
                            <div class="indicator-icon">
                                <i data-lucide="${iconName}"></i>
                            </div>
                            <div class="item-details">
                                <span class="item-title">${storeTagHtml}${personPrefix}${item.person}</span>
                                <span class="item-desc">${descText}${parentDescText}</span>
                                <span class="item-date">${formatDate(item.date)}</span>
                            </div>
                        </div>
                        <div class="item-right">
                            <span class="item-amount">
                                ${item.type === 'for_me' ? '+' : '-'}${item.amount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ${item.currency}
                            </span>
                            <button class="delete-btn" title="حذف دفعة السداد">
                                <i data-lucide="trash-2"></i>
                            </button>
                        </div>
                    `;
                    transactionsList.appendChild(div);
                });
            }
        }

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    /**
     * Deletes a specific cash payment record and updates the transaction / cash box state
     */
    function deletePayment(transId, paymentId) {
        const confirmDelete = confirm('هل أنت متأكد من حذف هذه الدفعة النقدية من الصندوق؟ سيؤدي ذلك إلى زيادة الدين المتبقي في الدفتر.');
        if (!confirmDelete) return;

        const transaction = transactions.find(t => t.id == transId);
        if (!transaction) return;

        transaction.payments = (transaction.payments || []).filter(p => p.id != paymentId);

        saveToStorage();
        render();
    }

    // -------------------------------------------------------------------------
    // 10. INITIAL RUN
    // -------------------------------------------------------------------------
    populateStoreDropdowns();
    renderStoresManagement();
    updateWizardVisibility();
    render();
});
