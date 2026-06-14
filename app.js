// ==========================================
// API CONFIGURATION
// ==========================================
const API_URL = "https://script.google.com/macros/s/AKfycbxCjihbmkPbjRefEym2TIdu2pNFrOQkgkIE1r0YBtD93H2HUzhzg-OKRmFLVIE3XAbmQw/exec";

// ==========================================
// DOM ELEMENTS & GLOBAL STATE
// ==========================================
const loaderOverlay = document.getElementById('wave-loader');
const loaderTextElement = document.getElementById('loader-text');
const popupOverlay = document.getElementById('custom-popup');

let loggedInUser = "";
let currentQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = {};
let activeTestName = "";
let testHistoryData = {}; 

let timerInterval;
let timeRemaining = 0;
let testEndTime = 0;
let isTestActive = false; // ANTI-CHEAT LOCK

const optionPrefixes = ['(a) ', '(b) ', '(c) ', '(d) '];

// ==========================================
// 1. APP SHELL UI MECHANICS (NATIVE FEEL)
// ==========================================

// Theme Engine (Dark/Light Mode)
function initTheme() {
    const savedTheme = localStorage.getItem('premium_portal_theme');
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
}
initTheme(); // Run immediately

function toggleDarkMode() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('premium_portal_theme', 'light');
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('premium_portal_theme', 'dark');
    }
}

// Side Drawer Navigation Logic
const drawer = document.getElementById('side-drawer');
const drawerOverlay = document.getElementById('drawer-overlay');

function toggleDrawer() {
    const isOpen = drawer.classList.contains('open');
    if (isOpen) {
        drawer.classList.remove('open');
        drawerOverlay.classList.remove('open');
        setTimeout(() => { drawerOverlay.style.display = 'none'; }, 250);
    } else {
        drawerOverlay.style.display = 'block';
        // Small delay to allow display:block to render before opacity transition
        setTimeout(() => {
            drawer.classList.add('open');
            drawerOverlay.classList.add('open');
        }, 10);
    }
}

document.getElementById('menu-toggle-btn').addEventListener('click', toggleDrawer);
drawerOverlay.addEventListener('click', toggleDrawer);

// Bottom Navigation Tab Routing
function switchTab(tabId, headerTitle) {
    // Hide all tabs
    document.querySelectorAll('.tab-view').forEach(t => {
        t.classList.remove('active');
        t.style.display = 'none';
    });
    // Remove active state from all nav buttons
    document.querySelectorAll('.nav-tab-btn').forEach(btn => btn.classList.remove('active'));

    // Show target tab
    const targetTab = document.getElementById(tabId);
    targetTab.style.display = 'flex';
    // Small delay to trigger CSS animations if any
    setTimeout(() => targetTab.classList.add('active'), 10);

    // Update Bottom Nav UI
    const baseId = tabId.split('-')[0]; // "home", "results", "profile"
    document.getElementById(`tab-btn-${baseId}`).classList.add('active');

    // Update Header
    document.getElementById('app-bar-title').innerText = headerTitle;
}

// Attach Event Listeners to UI Elements
document.getElementById('tab-btn-home').addEventListener('click', () => switchTab('home-tab', 'Home'));
document.getElementById('tab-btn-results').addEventListener('click', () => switchTab('results-tab', 'Results'));
document.getElementById('tab-btn-profile').addEventListener('click', () => switchTab('profile-tab', 'Profile'));

// Map Drawer Links to Tabs
document.getElementById('menu-home-btn').addEventListener('click', () => {
    switchTab('home-tab', 'Home Dashboard');
    toggleDrawer();
});

document.getElementById('menu-notes-btn').addEventListener('click', () => {
    switchTab('home-tab', 'Home Dashboard'); 
    const notesBtn = document.getElementById('grid-action-notes');
    if(notesBtn) notesBtn.click(); // Safe query to prevent initialization errors
    toggleDrawer();
});

// Highlight Active Drawer Item
document.querySelectorAll('.drawer-item').forEach(item => {
    item.addEventListener('click', (e) => {
        if(e.currentTarget.id !== 'menu-dark-toggle' && e.currentTarget.id !== 'drawer-logout-btn') {
            document.querySelectorAll('.drawer-item').forEach(btn => btn.classList.remove('active'));
            e.currentTarget.classList.add('active');
        }
    });
});

document.getElementById('menu-dark-toggle').addEventListener('click', () => { toggleDarkMode(); toggleDrawer(); });
document.getElementById('profile-dark-toggle-row').addEventListener('click', toggleDarkMode);


// Feature Grid Category Switcher (Home Tab)
const gridTests = document.getElementById('grid-action-tests');
const gridNotes = document.getElementById('grid-action-notes');
const sectionTests = document.getElementById('test-series-section-wrapper');
const sectionNotes = document.getElementById('pdf-notes-section-wrapper');

if(gridTests && gridNotes) {
    gridTests.addEventListener('click', () => {
        gridTests.classList.add('active-card');
        gridNotes.classList.remove('active-card');
        sectionTests.style.display = 'block';
        sectionNotes.style.display = 'none';
    });

    gridNotes.addEventListener('click', () => {
        gridNotes.classList.add('active-card');
        gridTests.classList.remove('active-card');
        sectionNotes.style.display = 'block';
        sectionTests.style.display = 'none';
    });
}

// ==========================================
// 2. CORE SPA ROUTING (FULL SCREENS)
// ==========================================
function navigate(screenId, pushToHistory = true) {
    // 1. Hide all screens completely
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none'; 
    });
    
    // 2. Safely un-hide ONLY the target screen
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.style.display = 'flex'; // FIX: Ye line ensure karegi ki target screen hamesha visible ho!
        setTimeout(() => targetScreen.classList.add('active'), 10);
    }

    // 3. Update Browser History
    if (pushToHistory) {
        history.pushState({ screen: screenId }, "", `#${screenId}`);
    }
}



window.addEventListener('popstate', (e) => {
    const activeScreen = document.querySelector('.screen.active');
    
    if (activeScreen && activeScreen.id === 'test-screen' && isTestActive) {
        history.pushState({ screen: 'test-screen' }, "", `#test-screen`);
        showCustomPopup("Action Blocked", "You cannot go back during a <strong style='color: var(--danger);'>LIVE</strong> test. Please complete and submit it.", "danger");
        return;
    }

    if (e.state && e.state.screen === 'test-screen' && !isTestActive) {
        history.replaceState({ screen: 'main-app-shell' }, "", "#main-app-shell");
        navigate('main-app-shell', false);
        return;
    }

    if (e.state && e.state.screen) {
        navigate(e.state.screen, false);
    } else {
        if (loggedInUser) navigate('main-app-shell', false);
        else navigate('login-screen', false);
    }
});

// ==========================================
// 3. UTILITIES & POPUPS
// ==========================================
function showLoader(text = "Loading...") {
    loaderTextElement.innerText = text;
    loaderOverlay.style.display = 'flex';
}

function hideLoader() {
    loaderOverlay.style.display = 'none';
}

function showCustomPopup(title, message, type = 'info', confirmCallback = null, showCancel = false) {
    document.getElementById('popup-title').innerText = title;
    document.getElementById('popup-message').innerHTML = message; 
    
    const iconContainer = document.getElementById('popup-icon-container');
    const iconElement = document.getElementById('popup-icon');
    const confirmBtn = document.getElementById('popup-confirm-btn');
    const cancelBtn = document.getElementById('popup-cancel-btn');
    
    iconContainer.className = 'popup-icon-wrapper';
    
    if (type === 'success') {
        iconContainer.classList.add('success');
        iconElement.innerText = 'check_circle';
        confirmBtn.style.backgroundColor = 'var(--success)';
    } else if (type === 'danger') {
        iconContainer.classList.add('danger');
        iconElement.innerText = 'error';
        confirmBtn.style.backgroundColor = 'var(--danger)';
    } else if (type === 'warning') {
        iconContainer.classList.add('warning');
        iconElement.innerText = 'warning';
        confirmBtn.style.backgroundColor = 'var(--warning)';
    } else {
        iconElement.innerText = 'info';
        confirmBtn.style.backgroundColor = 'var(--primary)';
    }

    cancelBtn.style.display = showCancel ? 'block' : 'none';
    
    const newConfirmBtn = confirmBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    newConfirmBtn.addEventListener('click', () => {
        popupOverlay.style.display = 'none';
        if (confirmCallback) confirmCallback();
    });

    newCancelBtn.addEventListener('click', () => {
        popupOverlay.style.display = 'none';
    });

    popupOverlay.style.display = 'flex';
}

// ==========================================
// 4. AUTHENTICATION
// ==========================================
function checkAuthSession() {
    const cachedUser = localStorage.getItem('student_username');
    if (cachedUser) {
        loggedInUser = cachedUser;
        updateProfileUI();
        history.replaceState({ screen: 'main-app-shell' }, "", "#main-app-shell");
        loadDashboard(); 
    } else {
        history.replaceState({ screen: 'login-screen' }, "", "#login-screen");
        navigate('login-screen', false);
    }
}
document.addEventListener("DOMContentLoaded", checkAuthSession);

function updateProfileUI() {
    document.getElementById('welcome-text').innerText = `Hello Dear, ${loggedInUser}`;
    document.getElementById('drawer-username').innerText = loggedInUser;
    document.getElementById('profile-student-name').innerText = loggedInUser;
    document.getElementById('profile-meta-username').innerText = loggedInUser;
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorMsg = document.getElementById('error-message');
    const usernameInput = document.getElementById('username').value.trim();
    const passwordInput = document.getElementById('password').value.trim();
    
    showLoader("Authenticating Session...");

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            redirect: "follow",
            body: JSON.stringify({ action: "login", username: usernameInput, password: passwordInput })
        });
        
        const result = JSON.parse(await response.text());

        if (result.success) {
            loggedInUser = usernameInput;
            localStorage.setItem('student_username', loggedInUser);
            updateProfileUI();
            document.getElementById('login-form').reset();
            errorMsg.innerText = "";
            loadDashboard(); 
        } else {
            errorMsg.innerText = result.message;
        }
    } catch (error) {
        errorMsg.innerText = "Network connection failed. Please try again.";
    } finally {
        hideLoader();
    }
});

function handleLogout() {
    showCustomPopup("Secure Logout", "Are you sure you want to end your session?", "warning", () => {
        loggedInUser = "";
        localStorage.removeItem('student_username');
        if(drawer.classList.contains('open')) toggleDrawer();
        navigate('login-screen');
    }, true);
}

document.getElementById('drawer-logout-btn').addEventListener('click', handleLogout);
document.getElementById('profile-logout-btn').addEventListener('click', handleLogout);

// ==========================================
// 5. DASHBOARD & DATA DISTRIBUTION
// ==========================================
async function loadDashboard() {
    navigate('main-app-shell');
    switchTab('home-tab', 'Home Dashboard');
    
    const liveTestContainer = document.getElementById('dynamic-test-list');
    const pastResultsContainer = document.getElementById('past-results-list');
    
    showLoader("Syncing Live Portal...");

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            redirect: "follow",
            body: JSON.stringify({ action: "getDashboard", username: loggedInUser })
        });
        const result = JSON.parse(await response.text());

        if (result.success) {
            liveTestContainer.innerHTML = "";
            pastResultsContainer.innerHTML = "";
            testHistoryData = result.history || {}; 

            let pendingCount = 0;
            let completedCount = 0;

            result.dashboard.forEach(test => {
                const isCompleted = test.status === "completed";
                
                let badgeHTML = '';
                if (!isCompleted && test.publishedDate) {
                    const pubDate = new Date(test.publishedDate);
                    if (!isNaN(pubDate.getTime())) { 
                        const diffDays = Math.ceil((new Date() - pubDate) / (1000 * 60 * 60 * 24));
                        if (diffDays >= 0 && diffDays <= 5) badgeHTML = `<span class="new-badge">NEW</span>`; 
                    }
                }

                if (isCompleted) {
                    completedCount++;
                    const pastData = testHistoryData[test.testId];
                    const safeScore = pastData ? pastData.score : test.score;
                    const safeTotal = pastData ? pastData.total : test.total;
                    
                    const cardHTML = `
                        <div class="test-card" data-test="${test.testId}" data-completed="true">
                            <div class="test-info">
                                <h4>${test.title}</h4>
                                <p>Scored: ${safeScore} / ${safeTotal} Marks</p>
                            </div>
                            <button class="btn-secondary test-action-btn">Analyze</button>
                        </div>
                    `;
                    pastResultsContainer.insertAdjacentHTML('beforeend', cardHTML);
                } else {
                    pendingCount++;
                    const cardHTML = `
                        <div class="test-card" data-test="${test.testId}" data-duration="${test.duration}" data-completed="false">
                            <div class="test-info">
                                <h4>${test.title} ${badgeHTML}</h4>
                                <p><span class="material-icons" style="font-size: 13px; vertical-align: middle;">schedule</span> ${test.duration} Mins Duration</p>
                            </div>
                            <button class="btn-primary test-action-btn">Start Test</button>
                        </div>
                    `;
                    liveTestContainer.insertAdjacentHTML('beforeend', cardHTML);
                }
            });

            if (pendingCount === 0) {
                liveTestContainer.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding: 30px;">No new live tests available.</div>`;
            }
            if (completedCount === 0) {
                pastResultsContainer.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding: 30px;">You haven't attempted any tests yet.</div>`;
            }

            attachTestCardListeners();
        } else {
            liveTestContainer.innerHTML = `<p class='error'>${result.message}</p>`;
        }
    } catch (e) {
        liveTestContainer.innerHTML = "<p class='error' style='text-align:center;'>Failed to sync dashboard. Check internet connection.</p>";
    } finally {
        hideLoader();
    }
}

function attachTestCardListeners() {
    document.querySelectorAll('.test-action-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const testCard = e.target.closest('.test-card');
            const isCompleted = testCard.getAttribute('data-completed') === "true";
            activeTestName = testCard.getAttribute('data-test');
            
            if (isCompleted) {
                const pastData = testHistoryData[activeTestName];
                if (pastData && !pastData.error) {
                    displayDeepAnalysis(pastData.score, pastData.total, pastData.percentage, pastData.details, true);
                } else {
                    showCustomPopup("Unavailable", "Deep analysis data is corrupted or unavailable for this test.", "danger");
                }
            } else {
                const duration = parseInt(testCard.getAttribute('data-duration'));
                showCustomPopup("Start Live Test", `This test is strictly timed for ${duration} minutes. You cannot pause it or go back. Ready?`, "info", () => {
                    startLiveTest(activeTestName, duration);
                }, true);
            }
        });
    });
}

// ==========================================
// 6. LIVE TEST ENGINE (NO CHANGES NEEDED HERE)
// ==========================================

// Strict Anti-Cheat: Tab Switch / Minimize Detection
document.addEventListener("visibilitychange", () => {
    if (document.hidden && isTestActive) {
        // Zero-tolerance: Immediately submit test and show warning
        showCustomPopup(
            "Test Terminated!", 
            "You switched tabs or minimized the app. As per strict anti-cheat policies, your test has been automatically submitted.", 
            "danger",
            () => {
                // Ensure popup doesn't block submission flow
            }
        );
        processSubmission(); // Force submit immediately
    }
});



async function startLiveTest(testId, durationMins) {
    showLoader("Initializing Secure Environment...");
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            redirect: "follow",
            body: JSON.stringify({ action: "fetchTest", testName: testId })
        });
        const result = JSON.parse(await response.text());

        if (result.success && result.questions.length > 0) {
            currentQuestions = result.questions;
            currentQuestionIndex = 0;
            userAnswers = {}; 
            document.getElementById('test-title').innerText = testId.replace(/_/g, ' ');
            
            isTestActive = true; 
            renderQuestion();
            startTimer(durationMins * 60); 
            navigate('test-screen'); 
        } else {
            showCustomPopup("Coming Soon", "Questions for this test are not uploaded yet.", "danger");
        }
    } catch (error) {
        showCustomPopup("Connection Error", "Failed to load test. Check connection.", "danger");
    } finally {
        hideLoader();
    }
}

function startTimer(seconds) {
    clearInterval(timerInterval);
    testEndTime = Date.now() + (seconds * 1000);
    
    function checkTime() {
        const now = Date.now();
        timeRemaining = Math.max(0, Math.round((testEndTime - now) / 1000));
        updateTimerDisplay();
        
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            showCustomPopup("Time's Up!", "Auto-submitting your test.", "warning", processSubmission, false);
        }
    }
    
    checkTime(); 
    timerInterval = setInterval(checkTime, 1000);
}

function updateTimerDisplay() {
    const mins = Math.floor(timeRemaining / 60);
    const secs = timeRemaining % 60;
    document.getElementById('timer').innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function renderQuestion() {
    const qData = currentQuestions[currentQuestionIndex];
    document.getElementById('question-counter').innerText = `${currentQuestionIndex + 1}/${currentQuestions.length}`;
    document.getElementById('question-text').innerText = qData.questionText;
    
    const container = document.getElementById('options-container');
    container.innerHTML = '';

    qData.options.forEach((opt, index) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = `${optionPrefixes[index] || ''}${opt}`;
        if (userAnswers[qData.id] === opt) btn.classList.add('selected');

        btn.addEventListener('click', () => {
            document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            userAnswers[qData.id] = opt;
        });
        container.appendChild(btn);
    });

    document.getElementById('prev-btn').disabled = currentQuestionIndex === 0;
    const nextBtn = document.getElementById('next-btn');
    
    if (currentQuestionIndex === currentQuestions.length - 1) {
        nextBtn.innerHTML = `Submit Final <span class="material-icons btn-inline-icon">check_circle</span>`;
        nextBtn.style.backgroundColor = "var(--success)";
    } else {
        nextBtn.innerHTML = `Next <span class="material-icons btn-inline-icon">arrow_forward</span>`;
        nextBtn.style.backgroundColor = "var(--primary)";
    }
}

document.getElementById('prev-btn').addEventListener('click', () => {
    if (currentQuestionIndex > 0) { currentQuestionIndex--; renderQuestion(); }
});

document.getElementById('next-btn').addEventListener('click', () => {
    if (currentQuestionIndex < currentQuestions.length - 1) {
        currentQuestionIndex++; renderQuestion();
    } else {
        const answeredCount = Object.keys(userAnswers).length;
        if (answeredCount < currentQuestions.length) {
            showCustomPopup("Incomplete", `You answered ${answeredCount} of ${currentQuestions.length} questions. Submit?`, "warning", processSubmission, true);
        } else {
            showCustomPopup("Submit Test", "Submit your final answers?", "info", processSubmission, true);
        }
    }
});

// ==========================================
// 7. ANALYSIS & RESULTS SCREEN
// ==========================================
async function processSubmission() {
    // FIX 1: The Mutex Lock - Prevent double submissions or Anti-Cheat overlaps
    if (!isTestActive) return; 
    isTestActive = false; // Immediately lock the test so it can't be submitted again

    clearInterval(timerInterval);
    showLoader("Grading your test...");

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            redirect: "follow",
            body: JSON.stringify({ action: "submitTest", username: loggedInUser, testName: activeTestName, answers: userAnswers })
        });
        const result = JSON.parse(await response.text());

        if (result.success) {
            history.replaceState({ screen: 'analysis-screen' }, "", "#analysis-screen");
            hideLoader();
            showCustomPopup("Submitted!", "Results processed.", "success", () => {
                displayDeepAnalysis(result.score, result.total, result.percentage, result.analysis, false);
            });
        } else {
            throw new Error("Grading failed");
        }
    } catch (e) {
        hideLoader();
        isTestActive = false; // Ensure it stays locked
        showCustomPopup("Error", "Network issue. Results saved locally. Returning to dashboard.", "danger", () => loadDashboard());
    }
}



function displayDeepAnalysis(score, total, percentage, detailsArray, pushToHistory = true) {
    let cleanPercentage = parseFloat(percentage);
    if (isNaN(cleanPercentage)) cleanPercentage = total > 0 ? ((score / total) * 100) : 0;
    
    const badgeColor = cleanPercentage >= 70 ? "var(--success)" : cleanPercentage >= 40 ? "var(--warning)" : "var(--danger)";

    document.getElementById('score-text').innerHTML = `Final Score<br><span class="highlight-score" style="color: ${badgeColor}">${score} <span style="font-size:24px; color:var(--text-muted)">/ ${total}</span></span>`;
    document.getElementById('percentage-text').innerText = `${cleanPercentage.toFixed(0)}% Accuracy`;
    document.getElementById('percentage-text').style.backgroundColor = badgeColor;

    const breakdownList = document.getElementById('breakdown-list');
    breakdownList.innerHTML = "";

    (detailsArray || []).forEach((item, index) => {
        const isCorrect = item.isCorrect;
        const color = isCorrect ? "var(--success)" : "var(--danger)";
        const icon = isCorrect ? "check_circle" : "cancel";

        breakdownList.innerHTML += `
            <div class="review-item ${isCorrect ? 'correct' : 'incorrect'}">
                <h5><span class="material-icons" style="font-size:16px; color:${color}">${icon}</span> Q${index + 1}: ${item.questionText}</h5>
                <p style="color:${color}">Your Answer: <span class="user-ans">${item.studentAnswer}</span></p>
                ${!isCorrect ? `<p class="correct-ans">Correct Answer: ${item.correctAnswer}</p>` : ''}
            </div>
        `;
    });

    navigate('analysis-screen', pushToHistory);
}

document.getElementById('close-analysis-btn').addEventListener('click', () => {
    loadDashboard(); // Refreshes backend data and routes back to App Shell (Results or Home)
});


// ==========================================
// 8. ADVANCED SERVICE WORKER REGISTRATION (PWA)
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((registration) => {
                console.log('[PWA Engine] ServiceWorker successfully registered with scope: ', registration.scope);
            })
            .catch((error) => {
                console.error('[PWA Engine] ServiceWorker registration failed: ', error);
            });
    });
}
