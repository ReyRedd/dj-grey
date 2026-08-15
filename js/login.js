const API_URL = 'https://dj-grey.onrender.com/api/auth';
let isRegisterMode = false;

function toggleRegisterMode() {
    isRegisterMode = !isRegisterMode;

    document.getElementById('submit-btn').innerHTML = isRegisterMode ? '<i class="fa-solid fa-user-plus"></i> Create Account' : '<i class="fa-solid fa-right-to-bracket"></i> Initialize 🔒';
    document.getElementById('form-subtitle').innerText = isRegisterMode ? 'Register Fan Account ✨' : 'Welcome to Madness 🤪';
    document.getElementById('mode-text').innerHTML = isRegisterMode ? 'Already a fan? <span>Login here</span>' : 'No access? <span>Request Invite</span>';
    document.getElementById('error-msg').style.display = 'none';

    const emailGroup = document.getElementById('email-group');
    const emailInput = document.getElementById('email');
    const confirmGroup = document.getElementById('confirm-password-group');
    const confirmInput = document.getElementById('confirm-password');

    if (isRegisterMode) {
        // Show Email and Confirm Password fields
        emailGroup.style.display = 'flex';
        confirmGroup.style.display = 'flex';
        setTimeout(() => {
            emailGroup.style.opacity = '1';
            confirmGroup.style.opacity = '1';
        }, 10);
        emailInput.required = true;
        confirmInput.required = true;
    } else {
        // Hide Email and Confirm Password fields
        emailGroup.style.opacity = '0';
        confirmGroup.style.opacity = '0';
        setTimeout(() => {
            emailGroup.style.display = 'none';
            confirmGroup.style.display = 'none';
        }, 300);
        emailInput.required = false;
        confirmInput.required = false;
    }
}

function closeModalAndLogin() {
    const modal = document.getElementById('success-modal');
    modal.classList.remove('show');
    setTimeout(() => {
        modal.style.display = 'none';
        toggleRegisterMode();
        document.getElementById('password').value = '';
        document.getElementById('confirm-password').value = '';
    }, 400);
}

document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const email = document.getElementById('email').value;
    const confirmPass = document.getElementById('confirm-password').value;
    const errorMsg = document.getElementById('error-msg');

    // 🛡️ Validate matching passwords on registration
    if (isRegisterMode && password !== confirmPass) {
        errorMsg.innerText = "Passwords do not match!";
        errorMsg.style.display = 'block';
        return;
    }

    const endpoint = isRegisterMode ? '/register' : '/login';
    const payload = { username, password };
    if (isRegisterMode) payload.email = email;

    try {
        document.getElementById('submit-btn').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';

        const res = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (!res.ok) {
            errorMsg.innerText = data.error || 'Authentication failed.';
            errorMsg.style.display = 'block';
            document.getElementById('submit-btn').innerHTML = isRegisterMode ? '<i class="fa-solid fa-user-plus"></i> Create Account' : '<i class="fa-solid fa-right-to-bracket"></i> Initialize 🔒';
            return;
        }

        if (isRegisterMode) {
            const modal = document.getElementById('success-modal');
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('show'), 10);
        } else {
            localStorage.setItem('dj_grey_token', data.token);
            localStorage.setItem('dj_grey_user', data.username);
            localStorage.setItem('dj_grey_role', data.role);

            if (data.role === 'admin') {
                window.location.href = '/admin.html';
            } else {
                window.location.href = '/'; 
            }
        }
    } catch (err) {
        errorMsg.innerText = 'Server communication error.';
        errorMsg.style.display = 'block';
        document.getElementById('submit-btn').innerHTML = isRegisterMode ? '<i class="fa-solid fa-user-plus"></i> Create Account' : '<i class="fa-solid fa-right-to-bracket"></i> Initialize 🔒';
    }
});

// ---------------------------------------------------------
// 🌐 SOCIAL LOGIN HANDLERS (BULLETPROOF)
// ---------------------------------------------------------
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.social-btn');
    if (btn) {
        e.preventDefault(); 
        
        let provider = 'Social';
        let iconHtml = '';
        
        if (btn.classList.contains('google')) {
            provider = 'Google';
            iconHtml = '<i class="fa-brands fa-google" style="color: #ea4335; font-size: 3rem;"></i>';
        } else if (btn.classList.contains('apple')) {
            provider = 'Apple';
            iconHtml = '<i class="fa-brands fa-apple" style="color: #ffffff; font-size: 3rem;"></i>';
        } else if (btn.classList.contains('facebook')) {
            provider = 'Facebook';
            iconHtml = '<i class="fa-brands fa-facebook-f" style="color: #1877f2; font-size: 3rem;"></i>';
        }

        Swal.fire({
            html: `
                <div style="margin-bottom: 20px;">${iconHtml}</div>
                <h3 style="color: #fff; margin-bottom: 10px;">Connect with ${provider}</h3>
                <p style="color: var(--text-muted); font-size: 0.9rem;">
                    OAuth Integration is currently being configured for <strong>djgrey.wezer.me</strong>. 
                    Please use standard Email/Password authentication for now.
                </p>
            `,
            background: 'rgba(30, 41, 59, 0.95)',
            confirmButtonColor: 'var(--primary)',
            confirmButtonText: 'Understood'
        });
    }
});