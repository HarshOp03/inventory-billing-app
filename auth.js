// =============================================================================
// StockPro - Authentication & Session Management Module (LocalStorage Powered)
// =============================================================================

(function () {
  // State
  let currentUser = null;
  let token = localStorage.getItem('stockpro_token') || null;

  // DOM Elements
  const authOverlay = document.getElementById('auth-overlay');
  const authAlert = document.getElementById('auth-alert');
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');
  const btnQuickDemo = document.getElementById('btn-quick-demo');
  const userProfileBadge = document.getElementById('user-profile-badge');
  const headerUserName = document.getElementById('header-user-name');
  const headerUserRole = document.getElementById('header-user-role');
  const headerUserAvatar = document.getElementById('header-user-avatar');
  const btnLogout = document.getElementById('btn-logout');

  // --- LOCALSTORAGE USER REPOSITORY ---
  /**
   * Retrieves registered users from localStorage.
   * Ensures default demo user is always seeded on first run.
   * @returns {Array}
   */
  function getUsersFromStorage() {
    try {
      const data = localStorage.getItem('stockpro_users');
      let users = data ? JSON.parse(data) : [];
      if (!Array.isArray(users) || users.length === 0) {
        users = [
          {
            id: 'u_admin_demo',
            name: 'Harsh Demo',
            email: 'admin@stockpro.com',
            password: 'admin123',
            role: 'Admin',
            createdAt: new Date().toISOString()
          }
        ];
        localStorage.setItem('stockpro_users', JSON.stringify(users));
      }
      return users;
    } catch (e) {
      console.warn('Error reading stockpro_users from localStorage:', e);
      return [];
    }
  }

  /**
   * Persists users list to localStorage.
   * @param {Array} users
   */
  function saveUsersToStorage(users) {
    try {
      localStorage.setItem('stockpro_users', JSON.stringify(users));
    } catch (e) {
      console.error('Error saving stockpro_users to localStorage:', e);
    }
  }

  /**
   * Displays an alert notification inside the auth modal.
   * @param {string} message - Message text.
   * @param {string} type - 'danger' | 'success'.
   */
  function showAlert(message, type = 'danger') {
    if (!authAlert) return;
    authAlert.className = `auth-alert ${type}`;
    authAlert.textContent = message;
    authAlert.style.display = 'block';
  }

  /**
   * Clears the alert banner.
   */
  function hideAlert() {
    if (!authAlert) return;
    authAlert.style.display = 'none';
    authAlert.textContent = '';
  }

  /**
   * Switches between Sign In and Registration forms.
   * @param {string} tab - 'login' | 'register'.
   */
  function switchAuthTab(tab) {
    hideAlert();
    if (tab === 'login') {
      if (tabLogin) tabLogin.classList.add('active');
      if (tabRegister) tabRegister.classList.remove('active');
      if (formLogin) formLogin.classList.add('active');
      if (formRegister) formRegister.classList.remove('active');
    } else {
      if (tabRegister) tabRegister.classList.add('active');
      if (tabLogin) tabLogin.classList.remove('active');
      if (formRegister) formRegister.classList.add('active');
      if (formLogin) formLogin.classList.remove('active');
    }
  }

  /**
   * Shows the full-screen authentication overlay.
   */
  function showAuth() {
    if (authOverlay) authOverlay.classList.add('active');
    if (userProfileBadge) userProfileBadge.style.display = 'none';
  }

  /**
   * Hides the full-screen authentication overlay.
   */
  function hideAuth() {
    if (authOverlay) authOverlay.classList.remove('active');
    updateHeaderUser();
  }

  /**
   * Updates the user profile widget in the header bar.
   */
  function updateHeaderUser() {
    if (!currentUser || !userProfileBadge) return;
    userProfileBadge.style.display = 'flex';
    if (headerUserName) headerUserName.textContent = currentUser.name || 'User';
    if (headerUserRole) headerUserRole.textContent = (currentUser.role || 'Admin').toUpperCase();
    if (headerUserAvatar) {
      const initial = (currentUser.name && currentUser.name[0]) ? currentUser.name[0].toUpperCase() : 'U';
      headerUserAvatar.textContent = initial;
    }
  }

  /**
   * Authenticates user via localStorage user records.
   * @param {string} email
   * @param {string} password
   */
  function login(email, password) {
    const users = getUsersFromStorage();
    const normalizedEmail = (email || '').trim().toLowerCase();
    const user = users.find(u => u.email.toLowerCase() === normalizedEmail && u.password === password);

    if (!user) {
      throw new Error('Invalid email or password. Please check your credentials.');
    }

    const sessionToken = 'token_' + Date.now();
    const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role || 'Admin' };
    setSession(sessionToken, safeUser);
    return { token: sessionToken, user: safeUser };
  }

  /**
   * Registers a new user directly in localStorage.
   * @param {string} name
   * @param {string} email
   * @param {string} password
   */
  function register(name, email, password) {
    const users = getUsersFromStorage();
    const normalizedEmail = (email || '').trim().toLowerCase();

    if (!name || !name.trim()) {
      throw new Error('Please enter your full name.');
    }

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }

    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    if (users.some(u => u.email.toLowerCase() === normalizedEmail)) {
      throw new Error('An account with this email address already exists. Please sign in instead.');
    }

    const newUser = {
      id: 'u_' + Date.now(),
      name: name.trim(),
      email: normalizedEmail,
      password: password,
      role: 'Admin',
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    saveUsersToStorage(users);

    const sessionToken = 'token_' + Date.now();
    const safeUser = { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role };
    setSession(sessionToken, safeUser);
    return { token: sessionToken, user: safeUser };
  }

  /**
   * Sets token and user in memory and localStorage.
   * @param {string} newToken
   * @param {Object} newUser
   */
  function setSession(newToken, newUser) {
    token = newToken;
    currentUser = newUser;
    localStorage.setItem('stockpro_token', newToken);
    localStorage.setItem('stockpro_user', JSON.stringify(newUser));
  }

  /**
   * Clears the user session and re-displays the login screen.
   */
  function logout() {
    token = null;
    currentUser = null;
    localStorage.removeItem('stockpro_token');
    localStorage.removeItem('stockpro_user');
    showAuth();
    switchAuthTab('login');
    showAlert('You have been signed out.', 'success');
    
    // Dispatch custom auth-change event
    window.dispatchEvent(new CustomEvent('auth:logout'));
  }

  /**
   * Validates active session on application startup.
   */
  function checkSession() {
    const savedToken = localStorage.getItem('stockpro_token');
    const savedUser = localStorage.getItem('stockpro_user');
    
    if (!savedToken || !savedUser) {
      showAuth();
      return false;
    }

    try {
      currentUser = JSON.parse(savedUser);
      token = savedToken;
      hideAuth();
      window.dispatchEvent(new CustomEvent('auth:login', { detail: { user: currentUser, token } }));
      return true;
    } catch (err) {
      logout();
      return false;
    }
  }

  /**
   * Sets up auth event listeners (forms, tabs, buttons).
   */
  function setupAuthEvents() {
    // 1. Tab switching
    if (tabLogin) tabLogin.addEventListener('click', () => switchAuthTab('login'));
    if (tabRegister) tabRegister.addEventListener('click', () => switchAuthTab('register'));

    // 2. Password visibility toggles
    document.querySelectorAll('.btn-toggle-password').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const input = document.getElementById(targetId);
        if (input) {
          input.type = input.type === 'password' ? 'text' : 'password';
        }
      });
    });

    // 3. Login Form Submit
    if (formLogin) {
      formLogin.addEventListener('submit', (e) => {
        e.preventDefault();
        hideAlert();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const submitBtn = document.getElementById('btn-submit-login');

        try {
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.querySelector('span').textContent = 'Signing in...';
          }
          login(email, password);
          hideAuth();
          window.dispatchEvent(new CustomEvent('auth:login', { detail: { user: currentUser, token } }));
        } catch (err) {
          showAlert(err.message, 'danger');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.querySelector('span').textContent = 'Sign In to Dashboard';
          }
        }
      });
    }

    // 4. Register Form Submit
    if (formRegister) {
      formRegister.addEventListener('submit', (e) => {
        e.preventDefault();
        hideAlert();
        const name = document.getElementById('reg-name').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;
        const confirmPassword = document.getElementById('reg-password-confirm').value;
        const submitBtn = document.getElementById('btn-submit-register');

        if (password !== confirmPassword) {
          showAlert('Passwords do not match. Please verify.', 'danger');
          return;
        }

        try {
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.querySelector('span').textContent = 'Creating Account...';
          }
          register(name, email, password);
          hideAuth();
          window.dispatchEvent(new CustomEvent('auth:login', { detail: { user: currentUser, token } }));
        } catch (err) {
          showAlert(err.message, 'danger');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.querySelector('span').textContent = 'Create My Account';
          }
        }
      });
    }

    // 5. Quick Demo Sign In
    if (btnQuickDemo) {
      btnQuickDemo.addEventListener('click', () => {
        hideAlert();
        const demoEmail = 'admin@stockpro.com';
        const demoPass = 'admin123';
        const emailInput = document.getElementById('login-email');
        const passInput = document.getElementById('login-password');
        if (emailInput) emailInput.value = demoEmail;
        if (passInput) passInput.value = demoPass;

        try {
          btnQuickDemo.disabled = true;
          btnQuickDemo.textContent = 'Authenticating...';
          
          // Ensure demo user exists in localStorage
          getUsersFromStorage();
          login(demoEmail, demoPass);
          hideAuth();
          window.dispatchEvent(new CustomEvent('auth:login', { detail: { user: currentUser, token } }));
        } catch (err) {
          showAlert('Demo sign in error: ' + err.message, 'danger');
        } finally {
          btnQuickDemo.disabled = false;
          btnQuickDemo.textContent = '⚡ Quick Demo Sign In';
        }
      });
    }

    // 6. Logout button in top bar
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        if (confirm('Are you sure you want to sign out?')) {
          logout();
        }
      });
    }
  }

  // Initialize Auth events and ensure seed user exists
  setupAuthEvents();
  getUsersFromStorage();

  // Expose global StockProAuth helper object
  window.StockProAuth = {
    getToken: () => token || localStorage.getItem('stockpro_token'),
    getUser: () => currentUser,
    checkSession,
    login,
    register,
    logout,
    showAuth,
    hideAuth
  };
})();