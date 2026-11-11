const API_URL = 'https://agendastyle.duckdns.org/api/auth';

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
const namePattern = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü ]{2,80}$/;
const colombianPhonePattern = /^3\d{9}$/;
const gmailPattern = /^[^\s@]+@gmail\.com$/i;
const addressPattern = /^(calle|cl|carrera|cra|cr|avenida|av|diagonal|diag|transversal|trans)\s+\d+[a-z]?\s*(#|no\.?|n°)\s*\d+[a-z]?\s*-\s*\d+/i;

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

function updatePasswordStrength(password) {
  const meter = document.querySelector('.password-meter');
  const bar = meter?.querySelector('i');
  const label = document.querySelector('#password-strength');
  if (!meter || !bar || !label) return;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-ZÁÉÍÓÚÑ]/.test(password)) score += 1;
  if (/[a-záéíóúñ]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-zÁÉÍÓÚáéíóúÑñ\d]/.test(password)) score += 1;
  const level = password.length === 0 ? 'empty' : score <= 2 ? 'weak' : score <= 4 ? 'medium' : 'strong';
  meter.dataset.level = level;
  label.textContent = level === 'empty' ? 'Escribe una clave segura' : level === 'weak' ? 'Clave débil' : level === 'medium' ? 'Clave media' : 'Clave fuerte';
}

function validateRegisterData(formData) {
  const nombres = String(formData.get('nombres') || '').trim();
  const apellidos = String(formData.get('apellidos') || '').trim();
  const telefono = String(formData.get('telefonoNegocio') || '').replace(/\D/g, '');
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const direccion = String(formData.get('direccionNegocio') || '').trim();

  if (!namePattern.test(nombres) || !namePattern.test(apellidos)) {
    return 'Nombres y apellidos solo pueden contener letras y espacios.';
  }
  if (!colombianPhonePattern.test(telefono)) {
    return 'El teléfono debe tener exactamente 10 dígitos y comenzar por 3.';
  }
  if (!gmailPattern.test(email)) {
    return 'El correo debe terminar en @gmail.com.';
  }
  const addressInput = document.querySelector('#business-address');
  if (!addressPattern.test(direccion) && addressInput?.dataset.located !== 'true') {
    return 'Ingresa una dirección válida, por ejemplo: Calle 10 # 20-30.';
  }
  return null;
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

  const validationError = validateRegisterData(formData);
  if (validationError) {
    showMessage(validationError);
    return;
  }

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
        telefono: String(formData.get('telefonoNegocio')).replace(/\D/g, ''),
        direccion: formData.get('direccionNegocio'),
        ubicadaPorMapa: document.querySelector('#business-address')?.dataset.located === 'true'
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

document.querySelector('#register-nombres')?.addEventListener('input', (event) => {
  event.target.value = event.target.value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñÜü ]/g, '');
});

document.querySelector('#register-apellidos')?.addEventListener('input', (event) => {
  event.target.value = event.target.value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñÜü ]/g, '');
});

document.querySelector('#business-phone')?.addEventListener('input', (event) => {
  event.target.value = event.target.value.replace(/\D/g, '').slice(0, 10);
});

document.querySelector('#register-email')?.addEventListener('input', (event) => {
  event.target.value = event.target.value.toLowerCase().replace(/\s/g, '');
});

document.querySelector('#register-password')?.addEventListener('input', (event) => updatePasswordStrength(event.target.value));

document.querySelector('#locate-address')?.addEventListener('click', () => {
  const button = document.querySelector('#locate-address');
  const address = document.querySelector('#business-address');
  if (!navigator.geolocation) {
    showMessage('Tu navegador no permite obtener la ubicación automáticamente.');
    return;
  }
  button.disabled = true;
  button.textContent = 'Ubicando...';
  navigator.geolocation.getCurrentPosition(async ({ coords }) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.latitude}&lon=${coords.longitude}&accept-language=es`);
      const data = await response.json();
      address.value = data.display_name || `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
      address.dataset.located = 'true';
      address.setCustomValidity('');
      showToast('Dirección ubicada correctamente.');
    } catch (_error) {
      showMessage('No fue posible convertir tu ubicación en una dirección.');
    } finally {
      button.disabled = false;
      button.textContent = 'Ubicarme';
    }
  }, () => {
    showMessage('No se pudo obtener tu ubicación. Revisa los permisos del navegador.');
    button.disabled = false;
    button.textContent = 'Ubicarme';
  }, { enableHighAccuracy: true, timeout: 10000 });
});

document.querySelector('#business-address')?.addEventListener('input', (event) => {
  delete event.target.dataset.located;
});

document.querySelector('#forgot-link').addEventListener('click', (event) => {
  event.preventDefault();
  showMessage('La recuperación de clave estará disponible en una próxima versión.');
});
