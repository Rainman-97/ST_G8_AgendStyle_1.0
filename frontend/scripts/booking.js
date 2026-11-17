const API_URL = 'https://agendastyle.duckdns.org/api/citas';
const selector = document.querySelector('#business-selector');
const businessSelect = document.querySelector('#booking-business');
const selectBusinessButton = document.querySelector('#select-business');
const businessMessage = document.querySelector('#business-message');
const form = document.querySelector('#booking-form');
const message = document.querySelector('#booking-message');
const serviceSelect = document.querySelector('#booking-service');
const stylistSelect = document.querySelector('#booking-stylist');
const dateInput = document.querySelector('#booking-date');
const personNamePattern = /^[\p{L}\p{M} ]{2,80}$/u;
const colombianPhonePattern = /^3\d{9}$/;
const gmailPattern = /^[^\s@]+@gmail\.com$/i;
let selectedBusinessId = null;

dateInput.min = new Date().toISOString().slice(0, 10);

function setMessage(text, type = '') {
  message.textContent = text;
  message.className = `booking-message ${type}`;
}

function setBusinessMessage(text, type = '') {
  businessMessage.textContent = text;
  businessMessage.className = `booking-message ${type}`;
}

function validateCustomer(formData) {
  const nombres = String(formData.get('nombres') || '').trim();
  const apellidos = String(formData.get('apellidos') || '').trim();
  const telefono = String(formData.get('telefono') || '').replace(/\D/g, '');
    const email = String(formData.get('email') || '').trim().toLowerCase();
    const fecha = String(formData.get('fecha') || '');
  if (!personNamePattern.test(nombres) || !personNamePattern.test(apellidos)) return 'Nombres y apellidos solo pueden contener letras y espacios.';
  if (!colombianPhonePattern.test(telefono)) return 'El teléfono debe tener exactamente 10 dígitos y comenzar por 3.';
    if (!gmailPattern.test(email)) return 'El correo debe terminar en @gmail.com.';
    if (!fecha || fecha < new Date().toISOString().slice(0, 10)) return 'Selecciona una fecha válida desde hoy.';
  return null;
}

function addInputValidation() {
    document.querySelectorAll('input[name="nombres"], input[name="apellidos"]').forEach((input) => input.addEventListener('input', () => { input.value = input.value.replace(/[^\p{L}\p{M} ]/gu, ''); }));
  document.querySelector('input[name="telefono"]')?.addEventListener('input', (event) => { event.target.value = event.target.value.replace(/\D/g, '').slice(0, 10); });
  document.querySelector('input[name="email"]')?.addEventListener('input', (event) => { event.target.value = event.target.value.toLowerCase().replace(/\s/g, ''); });
}

async function loadBusinesses() {
  try {
    const response = await fetch(`${API_URL}/negocios-publicos`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'No fue posible cargar los negocios.');
    businessSelect.innerHTML = '<option value="">Selecciona una peluquería o barbería</option>';
    data.negocios.forEach((business) => businessSelect.insertAdjacentHTML('beforeend', `<option value="${business.NegocioId}">${business.NombreComercial} · ${business.TipoNegocio}</option>`));
  } catch (error) {
    businessSelect.innerHTML = '<option value="">No hay negocios disponibles</option>';
    setBusinessMessage(error.message, 'error');
  }
}

async function loadCatalogs() {
  const response = await fetch(`${API_URL}/catalogos-publicos?negocioId=${selectedBusinessId}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'No fue posible cargar los servicios.');
  document.querySelector('#booking-title').textContent = `Reserva en ${data.negocio.NombreComercial}`;
  document.querySelector('#booking-description').textContent = 'Completa tus datos y elige el horario que prefieras.';
  serviceSelect.innerHTML = '<option value="">Selecciona un servicio</option>';
  data.servicios.forEach((service) => serviceSelect.insertAdjacentHTML('beforeend', `<option value="${service.ServicioId}">${service.Nombre} · ${service.DuracionMinutos} min</option>`));
  stylistSelect.innerHTML = '<option value="">Selecciona un estilista</option>';
  data.estilistas.forEach((stylist) => stylistSelect.insertAdjacentHTML('beforeend', `<option value="${stylist.EstilistaId}">${stylist.Nombres} ${stylist.Apellidos} · ${stylist.Especialidad}</option>`));
}

selectBusinessButton.addEventListener('click', async () => {
  selectedBusinessId = Number(businessSelect.value);
  if (!selectedBusinessId) return setBusinessMessage('Selecciona una peluquería o barbería para continuar.', 'error');
  selectBusinessButton.disabled = true;
  selectBusinessButton.textContent = 'Cargando...';
  try {
    await loadCatalogs();
    selector.hidden = true;
    form.hidden = false;
    addInputValidation();
  } catch (error) {
    setBusinessMessage(error.message, 'error');
  } finally {
    selectBusinessButton.disabled = false;
    selectBusinessButton.innerHTML = 'Continuar <b>→</b>';
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const validationError = validateCustomer(formData);
  if (validationError) return setMessage(validationError, 'error');
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = 'Enviando solicitud...';
  setMessage('');
  try {
    const response = await fetch(`${API_URL}/reservar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      negocioId: selectedBusinessId,
      nombres: formData.get('nombres'),
      apellidos: formData.get('apellidos'),
      telefono: String(formData.get('telefono')).replace(/\D/g, ''),
      email: String(formData.get('email')).trim().toLowerCase(),
      servicioId: Number(formData.get('servicioId')),
      estilistaId: Number(formData.get('estilistaId')),
      fechaHoraInicio: `${formData.get('fecha')}T${formData.get('hora')}`,
      observaciones: formData.get('observaciones')
    }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'No fue posible crear la reserva.');
    setMessage(`${data.message} El negocio confirmará tu horario.`, 'success');
    form.reset();
  } catch (error) {
    setMessage(error.message, 'error');
  } finally {
    button.disabled = false;
    button.innerHTML = 'Solicitar cita <b>→</b>';
  }
});

loadBusinesses();
