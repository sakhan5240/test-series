const API_URL = "https://script.google.com/macros/s/AKfycbw4BIqiVKJa505FYsX0ffk1XbwNVgPx4ZFZq3rqud9MapEp_kbpZSr3BhHSwjg6ExlvLQ/exec";

// --- APP UI ELEMENTS ---
const loaderOverlay = document.getElementById('wave-loader');
const loaderTextElement = document.getElementById('loader-text');
const popupOverlay = document.getElementById('custom-popup');

// Global State Variables
let loggedInUser = "";
let currentQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = {};
let activeTestName = "";
let testHistoryData = {}; 

// Premium Timer & Security Variables
let timerInterval;
let timeRemaining = 0;
let testEndTime = 0;
let isTestActive = false; // SECURE LOCK: Prevents back-press cheating/glitches

const optionPrefixes = ['(a) ', '(b) ', '(c) ', '(d) '];

// ==========================================
// 1. PREMIUM SPA ROUTING (BACK-PRESS LOGIC)
// ==========================================
function navigate(screenId, pushToHistory = true) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) targetScreen.classList.add('active');

    if (pushToHistory) {
        history.pushState({ screen: screenId }, "", `#${screenId}`);
    }
}

window.addEventListener('popstate', (e) => {
    const activeScreen = document.querySelector('.screen.active');
    
    // ANTI-CHEAT: Block back press during a live test
    if (activeScreen && activeScreen.id === 'test-screen' && isTestActive) {
        history.pushState({ screen: 'test-screen' }, "", `#test-screen`);
        showCustomPopup(
            "Action Blocked", 
            "You cannot go back during a <strong style='color: var(--danger);'>LIVE</strong> test. Please complete and submit it.", 
            "danger"
        );
        return;
    }

    // SECURITY FIX: If test is submitted, absolutely block going back to the test screen
    if (e.state && e.state.screen === 'test-screen' && !isTestActive) {
        history.replaceState({ screen: 'dashboard-screen' }, "", "#dashboard-screen");
        navigate('dashboard-screen', false);
        return;
    }

    if (e.state && e.state.screen) {
        navigate(e.state.screen, false);
    } else {
        if (loggedInUser) navigate('dashboard-screen', false);
        else navigate('login-screen', false);
    }
});


// ==========================================
// 2. CORE UTILITIES & POPUPS
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
// 3. INIT & AUTHENTICATION
// ==========================================
function checkAuthSession() {
    const cachedUser = localStorage.getItem('student_username');
    if (cachedUser) {
        loggedInUser = cachedUser;
        document.getElementById('welcome-text').innerText = `Hello Dear, ${loggedInUser}`;
        history.replaceState({ screen: 'dashboard-screen' }, "", "#dashboard-screen");
        loadDashboard(); 
    } else {
        history.replaceState({ screen: 'login-screen' }, "", "#login-screen");
        navigate('login-screen', false);
    }
}
document.addEventListener("DOMContentLoaded", checkAuthSession);

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorMsg = document.getElementById('error-message');
    const usernameInput = document.getElementById('username').value.trim();
    const passwordInput = document.getElementById('password').value.trim();
    
    showLoader("Authenticating Credentials...");

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
            document.getElementById('welcome-text').innerText = `Hello, ${loggedInUser}`;
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

document.getElementById('logout-btn').addEventListener('click', () => {
    showCustomPopup("Logout", "Are you sure you want to log out?", "warning", () => {
        loggedInUser = "";
        localStorage.removeItem('student_username');
        navigate('login-screen');
    }, true);
});

// ==========================================
// 4. DYNAMIC DASHBOARD ENGINE
// ==========================================
async function loadDashboard() {
    navigate('dashboard-screen');
    const listContainer = document.getElementById('dynamic-test-list');
    
    showLoader("Syncing Live Dashboard...");

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            redirect: "follow",
            body: JSON.stringify({ action: "getDashboard", username: loggedInUser })
        });
        const result = JSON.parse(await response.text());

        if (result.success) {
            listContainer.innerHTML = "";
            testHistoryData = result.history || {}; 

            if (result.dashboard.length === 0) {
                listContainer.innerHTML = `
                    <div style="text-align: center; color: var(--text-muted); padding: 40px 20px;">
                        <span class="material-icons" style="font-size: 48px; color: var(--border); margin-bottom: 10px;">assignment</span>
                        <p>No active tests available right now.</p>
                    </div>`;
                return;
            }

            result.dashboard.forEach(test => {
                const isCompleted = test.status === "completed";
                const btnText = isCompleted ? "View Results" : "Start Test";
                const btnClass = isCompleted ? "btn-secondary" : "btn-primary";
                const testMeta = isCompleted ? `Scored: ${test.score}/${test.total}` : `Duration: ${test.duration} Mins`;
                
                let badgeHTML = '';
                if (!isCompleted && test.publishedDate) {
                    const pubDate = new Date(test.publishedDate);
                    if (!isNaN(pubDate.getTime())) { 
                        const diffTime = new Date() - pubDate;
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        
                        if (diffDays >= 0 && diffDays <= 5) {
                            badgeHTML = `<span class="new-badge">NEW</span>`; 
                        }
                    }
                }

                const cardHTML = `
                    <div class="test-card" data-test="${test.testId}" data-duration="${test.duration}" data-completed="${isCompleted}">
                        <div class="test-info">
                            <h4>${test.title} ${badgeHTML}</h4>
                            <p><span class="material-icons" style="font-size: 14px; vertical-align: middle;">schedule</span> ${testMeta}</p>
                        </div>
                        <button class="${btnClass} test-action-btn">${btnText}</button>
                    </div>
                `;
                listContainer.insertAdjacentHTML('beforeend', cardHTML);
            });

            attachTestCardListeners();
        } else {
            listContainer.innerHTML = `<p class='error' style='text-align:center;'>${result.message}</p>`;
        }
    } catch (e) {
        listContainer.innerHTML = "<p class='error' style='text-align:center;'>Failed to load tests. Please check your internet connection.</p>";
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
                    showCustomPopup("Unavailable", "Analysis data is currently unavailable for this test.", "danger");
                }
            } else {
                const duration = parseInt(testCard.getAttribute('data-duration'));
                
                showCustomPopup("Start Live Test", `This test is strictly timed for ${duration} minutes. You can only attempt it once. Are you ready?`, "info", () => {
                    startLiveTest(activeTestName, duration);
                }, true);
            }
        });
    });
}

// ==========================================
// 5. LIVE TEST LOGIC & TIMER
// ==========================================
async function startLiveTest(testId, durationMins) {
    showLoader("Preparing the test...");
    
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
            
            isTestActive = true; // LOCK ACTIVE
            renderQuestion();
            startTimer(durationMins * 60); 
            navigate('test-screen'); 
        } else {
            showCustomPopup("Coming Soon", "Questions are not uploaded yet.", "danger");
        }
    } catch (error) {
        showCustomPopup("Connection Error", "Failed to initialize test engine. Check connection.", "danger");
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
            showCustomPopup("Time's Up!", "Your time is over. Submitting your test automatically.", "warning", () => {
                processSubmission();
            }, false);
        }
    }
    
    checkTime(); 
    timerInterval = setInterval(checkTime, 1000);
}

function updateTimerDisplay() {
    const mins = Math.floor(timeRemaining / 60);
    const secs = timeRemaining % 60;
    document.getElementById('timer').innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    
    const timerElement = document.getElementById('timer').parentElement;
    if (timeRemaining <= 300 && timeRemaining > 0) { 
        timerElement.style.background = "#FEF2F2";
        timerElement.style.color = "var(--danger)";
    } else {
        timerElement.style.background = "#F3F4F6";
        timerElement.style.color = "var(--text-main)";
    }
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
        currentQuestionIndex++;
        renderQuestion();
    } else {
        const answeredCount = Object.keys(userAnswers).length;
        const totalQ = currentQuestions.length;
        
        if (answeredCount < totalQ) {
            showCustomPopup(
                "Incomplete Submission", 
                `You have only answered ${answeredCount} out of ${totalQ} questions.<br>Are you sure you want to submit?`, 
                "warning", 
                () => { processSubmission(); }, 
                true
            );
        } else {
            showCustomPopup(
                "Submit Test", 
                "This is a <strong style='color: var(--danger); font-weight: 800;'>LIVE</strong> test. No changes allowed after submission. Proceed?", 
                "info", 
                () => { processSubmission(); }, 
                true
            );
        }
    }
});


// ==========================================
// 6. PREMIUM DIRECT RESULTS DISPLAY (NO RING)
// ==========================================
async function processSubmission() {
    clearInterval(timerInterval);
    timeRemaining = 0; 
    showLoader("Grading your test securely...");

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            redirect: "follow",
            body: JSON.stringify({ action: "submitTest", username: loggedInUser, testName: activeTestName, answers: userAnswers })
        });
        
        const result = JSON.parse(await response.text());

        if (result.success) {
            hideLoader();
            isTestActive = false; // REMOVE LOCK
            
            // HISTORY OVERWRITE: User can't go back to test
            history.replaceState({ screen: 'analysis-screen' }, "", "#analysis-screen");
            
            showCustomPopup("Test Submitted!", "Your results have been processed successfully.", "success", () => {
                displayDeepAnalysis(result.score, result.total, result.percentage, result.analysis, false);
            });
        } else {
            hideLoader();
            showCustomPopup("Submission Error", "Server failed to grade the test. Returning to dashboard.", "danger", () => { loadDashboard(); });
        }
    } catch (e) {
        hideLoader();
        showCustomPopup("Network Failure", "Submission failed due to network error. Try submitting again.", "danger");
        startTimer(timeRemaining); 
    }
}

function displayDeepAnalysis(score, total, percentage, detailsArray, pushToHistory = true) {
    // Premium Direct Text Injection (No Ring Variables)
    let cleanPercentage = parseFloat(percentage);
    if (isNaN(cleanPercentage) || cleanPercentage == null) {
        cleanPercentage = total > 0 ? ((score / total) * 100) : 0;
    }
    let displayPercentage = cleanPercentage % 1 === 0 ? cleanPercentage.toFixed(0) : cleanPercentage.toFixed(1);

    // Dynamic color coding based on performance
    const badgeColor = cleanPercentage >= 70 ? "var(--success)" : cleanPercentage >= 40 ? "var(--warning)" : "var(--danger)";

    document.getElementById('score-text').innerHTML = `Final Score<br><span class="highlight-score" style="color: ${badgeColor}">${score} <span style="font-size:24px; color:var(--text-muted)">/ ${total}</span></span>`;
    document.getElementById('percentage-text').innerText = `${displayPercentage}% Accuracy`;
    document.getElementById('percentage-text').style.backgroundColor = badgeColor;

    const breakdownList = document.getElementById('breakdown-list');
    breakdownList.innerHTML = "";

    (detailsArray || []).forEach((item, index) => {
        const div = document.createElement('div');
        div.className = `review-item ${item.isCorrect ? 'correct' : 'incorrect'}`;
        const userAnsColor = item.isCorrect ? "color: var(--success)" : "color: var(--danger)";
        const icon = item.isCorrect ? "check_circle" : "cancel";

        div.innerHTML = `
            <h5><span class="material-icons" style="font-size:16px; vertical-align:middle; ${userAnsColor}">${icon}</span> Q${index + 1}: ${item.questionText}</h5>
            <p style="${userAnsColor}">Your Answer: <span class="user-ans">${item.studentAnswer}</span></p>
            ${!item.isCorrect ? `<p class="correct-ans">Correct Answer: ${item.correctAnswer}</p>` : ''}
        `;
        breakdownList.appendChild(div);
    });

    // Clean SPA routing via core navigation engine
    navigate('analysis-screen', pushToHistory);
}

// Back to dashboard from Analysis
document.getElementById('close-analysis-btn').addEventListener('click', () => {
    loadDashboard(); 
});
