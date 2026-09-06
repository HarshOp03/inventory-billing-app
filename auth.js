// =============================================================================
// StockPro - Authentication & Session Management Module
// [COMMENTED OUT: Login page and authentication are currently disabled]
// =============================================================================

// // StockPro - Authentication & Session Management Module
// (function () {
//   const API_BASE = 'https://inventory-billing-app-5met.onrender.com/api/auth';
//   
//   // State
//   let currentUser = null;
//   let token = localStorage.getItem('stockpro_token') || null;
// 
//   // DOM Elements
//   const authOverlay = document.getElementById('auth-overlay');
//   const authAlert = document.getElementById('auth-alert');
//   const tabLogin = document.getElementById('tab-login');
//   const tabRegister = document.getElementById('tab-register');
//   const formLogin = document.getElementById('form-login');
//   const formRegister = document.getElementById('form-register');
//   const btnQuickDemo = document.getElementById('btn-quick-demo');
//   const userProfileBadge = document.getElementById('user-profile-badge');
//   const headerUserName = document.getElementById('header-user-name');
//   const headerUserRole = document.getElementById('header-user-role');
//   const headerUserAvatar = document.getElementById('header-user-avatar');
//   const btnLogout = document.getElementById('btn-logout');
// 
//   /**
//    * Displays an alert notification inside the auth modal.
//    * @param {string} message - Message text.
//    * @param {string} type - 'danger' | 'success'.
//    */
//   function showAlert(message, type = 'danger') {
//     if (!authAlert) return;
//     authAlert.className = `auth-alert ${type}`;
//     authAlert.textContent = message;
//     authAlert.style.display = 'block';
//   }
// 
//   /**
//    * Clears the alert banner.
//    */
//   function hideAlert() {
//     if (!authAlert) return;
//     authAlert.style.display = 'none';
//     authAlert.textContent = '';
//   }
// 
//   /**
//    * Switches between Sign In and Registration forms.
//    * @param {string} tab - 'login' | 'register'.
//    */
//   function switchAuthTab(tab) {
//     hideAlert();
//     if (tab === 'login') {
//       tabLogin.classList.add('active');
//       tabRegister.classList.remove('active');
//       formLogin.classList.add('active');
//       formRegister.classList.remove('active');
//     } else {
//       tabRegister.classList.add('active');
//       tabLogin.classList.remove('active');
//       formRegister.classList.add('active');
//       formLogin.classList.remove('active');
//     }
//   }
// 
//   /**
//    * Shows the full-screen authentication overlay.
//    */
//   function showAuth() {
//     if (authOverlay) authOverlay.classList.add('active');
//     if (userProfileBadge) userProfileBadge.style.display = 'none';
//   }
// 
//   /**
//    * Hides the full-screen authentication overlay.
//    */
//   function hideAuth() {
//     if (authOverlay) authOverlay.classList.remove('active');
//     updateHeaderUser();
//   }
// 
//   /**
//    * Updates the user profile widget in the header bar.
//    */
//   function updateHeaderUser() {
//     if (!currentUser || !userProfileBadge) return;
//     userProfileBadge.style.display = 'flex';
//     if (headerUserName) headerUserName.textContent = currentUser.name || 'User';
//     if (headerUserRole) headerUserRole.textContent = (currentUser.role || 'Admin').toUpperCase();
//     if (headerUserAvatar) {
//       const initial = (currentUser.name && currentUser.name[0]) ? currentUser.name[0].toUpperCase() : 'U';
//       headerUserAvatar.textContent = initial;
//     }
//   }
// 
//   /**
//    * Authenticates user via POST /api/auth/login.
//    */
//   async function login(email, password) {
//     try {
//       const res = await fetch(`${API_BASE}/login`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ email, password })
//       });
// 
//       const data = await res.json();
//       if (!res.ok) {
//         throw new Error(data.error || 'Failed to sign in.');
//       }
// 
//       setSession(data.token, data.user);
//       return data;
//     } catch (err) {
//       throw err;
//     }
//   }
// 
//   /**
//    * Registers a new user via POST /api/auth/register.
//    */
//   async function register(name, email, password) {
//     try {
//       const res = await fetch(`${API_BASE}/register`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ name, email, password })
//       });
// 
//       const data = await res.json();
//       if (!res.ok) {
//         throw new Error(data.error || 'Registration failed.');
//       }
// 
//       setSession(data.token, data.user);
//       return data;
//     } catch (err) {
//       throw err;
//     }
//   }
// 
//   /**
//    * Sets token and user in memory and localStorage.
//    */
//   function setSession(newToken, newUser) {
//     token = newToken;
//     currentUser = newUser;
//     localStorage.setItem('stockpro_token', newToken);
//     localStorage.setItem('stockpro_user', JSON.stringify(newUser));
//   }
// 
//   /**
//    * Clears the user session and re-displays the login screen.
//    */
//   function logout() {
//     token = null;
//     currentUser = null;
//     localStorage.removeItem('stockpro_token');
//     localStorage.removeItem('stockpro_user');
//     showAuth();
//     switchAuthTab('login');
//     showAlert('You have been signed out.', 'success');
//     
//     // Dispatch custom auth-change event
//     window.dispatchEvent(new CustomEvent('auth:logout'));
//   }
// 
//   /**
//    * Validates active session on application startup.
//    */
//   async function checkSession() {
//     const savedToken = localStorage.getItem('stockpro_token');
//     if (!savedToken) {
//       showAuth();
//       return false;
//     }
// 
//     try {
//       const res = await fetch(`${API_BASE}/me`, {
//         headers: { 'Authorization': `Bearer ${savedToken}` }
//       });
// 
//       if (!res.ok) {
//         throw new Error('Session expired.');
//       }
// 
//       const data = await res.json();
//       token = savedToken;
//       currentUser = data.user;
//       hideAuth();
//       window.dispatchEvent(new CustomEvent('auth:login', { detail: { user: currentUser, token } }));
//       return true;
//     } catch (err) {
//       logout();
//       return false;
//     }
//   }
// 
//   /**
//    * Sets up auth event listeners (forms, tabs, buttons).
//    */
//   function setupAuthEvents() {
//     // Tab switching
//     if (tabLogin) tabLogin.addEventListener('click', () => switchAuthTab('login'));
//     if (tabRegister) tabRegister.addEventListener('click', () => switchAuthTab('register'));
// 
//     // Password visibility toggles
//     document.querySelectorAll('.btn-toggle-password').forEach(btn => {
//       btn.addEventListener('click', () => {
//         const targetId = btn.getAttribute('data-target');
//         const input = document.getElementById(targetId);
//         if (input) {
//           input.type = input.type === 'password' ? 'text' : 'password';
//         }
//       });
//     });
// 
//     // Login Form Submit
//     if (formLogin) {
//       formLogin.addEventListener('submit', async (e) => {
//         e.preventDefault();
//         hideAlert();
//         const email = document.getElementById('login-email').value.trim();
//         const password = document.getElementById('login-password').value;
//         const submitBtn = document.getElementById('btn-submit-login');
// 
//         try {
//           if (submitBtn) {
//             submitBtn.disabled = true;
//             submitBtn.querySelector('span').textContent = 'Signing in...';
//           }
//           await login(email, password);
//           hideAuth();
//           window.dispatchEvent(new CustomEvent('auth:login', { detail: { user: currentUser, token } }));
//         } catch (err) {
//           showAlert(err.message, 'danger');
//         } finally {
//           if (submitBtn) {
//             submitBtn.disabled = false;
//             submitBtn.querySelector('span').textContent = 'Sign In to Dashboard';
//           }
//         }
//       });
//     }
// 
//     // Register Form Submit
//     if (formRegister) {
//       formRegister.addEventListener('submit', async (e) => {
//         e.preventDefault();
//         hideAlert();
//         const name = document.getElementById('reg-name').value.trim();
//         const email = document.getElementById('reg-email').value.trim();
//         const password = document.getElementById('reg-password').value;
//         const confirmPassword = document.getElementById('reg-password-confirm').value;
//         const submitBtn = document.getElementById('btn-submit-register');
// 
//         if (password !== confirmPassword) {
//           showAlert('Passwords do not match. Please verify.', 'danger');
//           return;
//         }
// 
//         try {
//           if (submitBtn) {
//             submitBtn.disabled = true;
//             submitBtn.querySelector('span').textContent = 'Creating Account...';
//           }
//           await register(name, email, password);
//           hideAuth();
//           window.dispatchEvent(new CustomEvent('auth:login', { detail: { user: currentUser, token } }));
//         } catch (err) {
//           showAlert(err.message, 'danger');
//         } finally {
//           if (submitBtn) {
//             submitBtn.disabled = false;
//             submitBtn.querySelector('span').textContent = 'Create My Account';
//           }
//         }
//       });
//     }
// 
//     // Quick Demo Sign In
//     if (btnQuickDemo) {
//       btnQuickDemo.addEventListener('click', async () => {
//         hideAlert();
//         const demoEmail = 'admin@stockpro.com';
//         const demoPass = 'admin123';
//         document.getElementById('login-email').value = demoEmail;
//         document.getElementById('login-password').value = demoPass;
// 
//         try {
//           btnQuickDemo.disabled = true;
//           btnQuickDemo.textContent = 'Authenticating...';
//           // Try to login first
//           try {
//             await login(demoEmail, demoPass);
//           } catch (loginErr) {
//             // If demo account does not exist, auto-create it!
//             await register('Admin Demo', demoEmail, demoPass);
//           }
//           hideAuth();
//           window.dispatchEvent(new CustomEvent('auth:login', { detail: { user: currentUser, token } }));
//         } catch (err) {
//           showAlert('Demo sign in error: ' + err.message, 'danger');
//         } finally {
//           btnQuickDemo.disabled = false;
//           btnQuickDemo.textContent = '⚡ Quick Demo Sign In';
//         }
//       });
//     }
// 
//     // Logout button in top bar
//     if (btnLogout) {
//       btnLogout.addEventListener('click', () => {
//         if (confirm('Are you sure you want to log out?')) {
//           logout();
//         }
//       });
//     }
//   }
// 
//   // Initialize Auth module immediately
//   setupAuthEvents();
// 
//   // Expose global StockProAuth helper object
//   window.StockProAuth = {
//     getToken: () => token || localStorage.getItem('stockpro_token'),
//     getUser: () => currentUser,
//     checkSession,
//     logout,
//     showAuth,
//     hideAuth
//   };
// })();
// 