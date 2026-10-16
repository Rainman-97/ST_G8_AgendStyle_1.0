const API_URL = 'http://localhost:3000/api/auth';

const authSwitch = document.querySelector('.auth-switch');
const loginTab = document.querySelector('#login-tab');
const registerTab = document.querySelector('#register-tab');
const loginForm = document.querySelector('#login-form');
const registerForm = document.querySelector('#register-form');
const formTitle = document.querySelector('#form-title');
const formEyebrow = document.querySelector('#form-eyebrow');
const formDescription = document.querySelector('#form-description');
const formMessage = document.querySelector('#form-message');
const toast = document.querySelector('#toast');

function setMode(mode) {
  const registerMode = mode === 'register';
  authSwitch.classList.toggle('register-mode', registerMode);
  loginTab.setAttribute('aria-selected', String(!registerMode));
  registerTab.setAttribute('aria-selected', String(registerMode));
  loginTab.classList.toggle('active', !registerMode);
  registerTab.classList.toggle('active', registerMode);
  formEyebrow.textContent = registerMode ? 'CREA TU ACCESO' : 'BIENVENIDO DE NUEVO';
  formTitle.textContent = registerMode ? 'Crea tu cuenta' : 'Inicia sesión';
  formDescription.textContent = registerMode
    ? 'Registra tu cuenta y empieza a organizar tus citas.'
    : 'Accede a tu agenda y mantén todo bajo control.';
  formMessage.textContent = '';
  formMessage.className = 'form-message';
  loginForm.classList.toggle('active-form', !registerMode);
  registerForm.classList.toggle('active-form', registerMode);
}

loginTab.addEventListener('click', () => setMode('login'));
registerTab.addEventListener('click', () => setMode('register'));

document.querySelectorAll('.password-toggle').forEach((toggle) => {
  toggle.addEventListener('click', () => {
    const input = document.querySelector(`#${toggle.dataset.target}`);
    const visible = input.type === 'text';
    input.type = visible ? 'password' : 'text';
    toggle.textContent = visible ? '◉' : '○';
  });
});

function setLoading(form, loading) {
  form.querySelector('.submit-button').classList.toggle('loading', loading);
}

function showMessage(message, type = 'error') {
  formMessage.textContent = message;
  formMessage.className = `form-message ${type}`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

async function requestAuth(endpoint, payload) {
  const response = await fetch(`${API_URL}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'No fue posible completar la solicitud.');
  return data;
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  setLoading(loginForm, true);
  showMessage('');

  try {
    const data = await requestAuth('login', {
      email: formData.get('email'),
      password: formData.get('password')
    });
    localStorage.setItem('agendaStyleToken', data.token);
    localStorage.setItem('agendaStyleUser', JSON.stringify(data.user));
    loginForm.querySelector('.submit-button').classList.add('success');
    showMessage('Sesión iniciada. Cargando tu agenda…', 'success');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 700);
  } catch (error) {
    showMessage(error.message);
    showToast('No fue posible iniciar sesión.');
  } finally {
    setLoading(loginForm, false);
  }
});

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(registerForm);
  const password = formData.get('password');
  const confirmation = formData.get('confirmPassword');

  if (password !== confirmation) {
    showMessage('Las claves no coinciden.');
    return;
  }

  if (!formData.get('terms')) {
    showMessage('Debes aceptar los términos y condiciones.');
    return;
  }

  setLoading(registerForm, true);
  showMessage('');

  try {
    await requestAuth('register', {
      nombres: formData.get('nombres'),
      apellidos: formData.get('apellidos'),
      email: formData.get('email'),
      password,
      negocio: {
        nombreComercial: formData.get('nombreComercial'),
        tipoNegocio: formData.get('tipoNegocio'),
        telefono: formData.get('telefonoNegocio'),
        direccion: formData.get('direccionNegocio')
      }
    });
    registerForm.reset();
    setMode('login');
    document.querySelector('#login-email').value = formData.get('email');
    showMessage('Cuenta creada correctamente. Ahora puedes iniciar sesión.', 'success');
    showToast('Bienvenido a AgendaStyle.');
  } catch (error) {
    showMessage(error.message);
    showToast('No fue posible crear la cuenta.');
  } finally {
    setLoading(registerForm, false);
  }
});

document.querySelector('#forgot-link').addEventListener('click', (event) => {
  event.preventDefault();
  showMessage('La recuperación de clave estará disponible en una próxima versión.');
});
