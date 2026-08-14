const API_URL = 'https://dj-grey.onrender.com/api/auth';
let isRegisterMode = false;

function toggleRegisterMode() {
    isRegisterMode = !isRegisterMode;
    
    document.getElementById('submit-btn').innerHTML = isRegisterMode ? '<i class="fa-solid fa-user-plus"></i> Create Account' : '<i class="fa-solid fa-right-to-bracket"></i> Initialize';
    document.getElementById('form-subtitle').innerText = isRegisterMode ? 'Register Fan Account ✨' : 'VIP Access 🔒';
    document.getElementById('mode-text').innerHTML = isRegisterMode ? 'Already a fan? <span>Login here</span>' : 'No access? <span>Request VIP Invite</span>';
    document.getElementById('error-msg').style.display = 'none';
    
    const emailGroup = document.getElementById('email-group');
    const emailInput = document.getElementById('email');
    
    if (isRegisterMode) {
        emailGroup.style.display = 'flex';
        setTimeout(() => emailGroup.style.opacity = '1', 10);
        emailInput.required = true;
    } else {
        emailGroup.style.opacity = '0';
        setTimeout(() => emailGroup.style.display = 'none', 300);
        emailInput.required = false;
    }
}

function closeModalAndLogin() {
    const modal = document.getElementById('success-modal');
    modal.classList.remove('show');
    setTimeout(() => {
        modal.style.display = 'none';
        toggleRegisterMode();
        document.getElementById('password').value = '';
    }, 400);
}

document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const email = document.getElementById('email').value;
    const errorMsg = document.getElementById('error-msg');

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