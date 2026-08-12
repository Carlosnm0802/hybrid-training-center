document.addEventListener('DOMContentLoaded', () => {
    // Verificar sesión activa
    checkSession();

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Toggle Password
    const togglePasswordBtn = document.getElementById('togglePassword');
    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', () => {
            const passwordInput = document.getElementById('password');
            const eyeIcon = document.getElementById('eyeIcon');
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                eyeIcon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
            } else {
                passwordInput.type = 'password';
                eyeIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
            }
        });
    }

    // Logout Button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleLogout();
        });
    }
});

// Función para revisar si el usuario ya está logueado
async function checkSession() {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    
    const isLoginPage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/';
    
    if (session) {
        // Si hay sesión y estamos en el login, redirigir a alumnos
        if (isLoginPage) {
            window.location.href = 'alumnos.html';
        }
    } else {
        // Si no hay sesión y NO estamos en el login, obligar a loguearse
        if (!isLoginPage) {
            window.location.href = 'index.html';
        }
    }
}

// Función de inicio de sesión
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const loginError = document.getElementById('loginError');
    const loginBtn = document.getElementById('loginBtn');
    
    // UI state
    loginError.style.display = 'none';
    loginBtn.textContent = 'Verificando...';
    loginBtn.disabled = true;

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) throw error;
        
        // Login exitoso
        window.location.href = 'alumnos.html';
    } catch (error) {
        console.error('Error en login:', error);
        loginError.textContent = 'Credenciales inválidas. Intenta nuevamente.';
        loginError.style.display = 'block';
    } finally {
        loginBtn.textContent = 'Entrar';
        loginBtn.disabled = false;
    }
}

// Helper para hacer logout si lo ocupamos más adelante
async function handleLogout() {
    await supabaseClient.auth.signOut();
    window.location.href = 'index.html';
}
