const modal = document.querySelector('#modal');
const openModal = document.querySelector('#open-modal');
const closeModal = document.querySelector('#close-modal');
const form = document.querySelector('#appointment-form');
const API_BASE = 'https://agendastyle.duckdns.org/api';
const authToken = localStorage.getItem('agendaStyleToken');

const storedUser = localStorage.getItem('agendaStyleUser');
const currentUser = storedUser ? JSON.parse(storedUser) : null;

if (currentUser) {
  const fullName = `${currentUser.nombres || ''} ${currentUser.apellidos || ''}`.trim();
  const firstName = (currentUser.nombres || 'Hemer').split(' ')[0];
  const initials = fullName.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  document.querySelector('#user-name').textContent = fullName || 'Usuario AgendaStyle';
  document.querySelector('#user-role').textContent = currentUser.rol || 'Cliente';
  document.querySelector('#user-avatar').textContent = initials || 'AS';
  document.querySelector('#welcome-name').textContent = firstName;
  if (currentUser.negocio?.nombreComercial) {
    document.querySelector('#business-summary').textContent = `Resumen de ${currentUser.negocio.nombreComercial} para hoy.`;
  }
}

document.querySelector('#logout-button').addEventListener('click', () => {
  localStorage.removeItem('agendaStyleToken');
  localStorage.removeItem('agendaStyleUser');
  window.location.href = 'auth.html';
});

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'No fue posible completar la operación.');
  return data;
}

async function loadAppointmentCatalogs() {
  if (!authToken) return;

  try {
    const data = await apiRequest('/citas/catalogos');
    const clientSelect = document.querySelector('#appointment-client');
    const serviceSelect = document.querySelector('#appointment-service');
    const stylistSelect = document.querySelector('#appointment-stylist');

    clientSelect.innerHTML = '<option value="">Selecciona un cliente</option>';
    data.clientes.forEach((client) => {
      const option = document.createElement('option');
      option.value = client.ClienteId;
      option.textContent = `${client.Nombres} ${client.Apellidos}`;
      clientSelect.appendChild(option);
    });

    serviceSelect.innerHTML = '<option value="">Selecciona un servicio</option>';
    data.servicios.forEach((service) => {
      const option = document.createElement('option');
      option.value = service.ServicioId;
      option.textContent = `${service.Nombre} · ${service.DuracionMinutos} min`;
      serviceSelect.appendChild(option);
    });

    stylistSelect.innerHTML = '<option value="">Selecciona un estilista</option>';
    data.estilistas.forEach((stylist) => {
      const option = document.createElement('option');
      option.value = stylist.EstilistaId;
      option.textContent = `${stylist.Nombres} ${stylist.Apellidos} · ${stylist.Especialidad}`;
      stylistSelect.appendChild(option);
    });
  } catch (error) {
    console.error('No se pudieron cargar los catálogos de citas:', error);
  }
}

openModal.addEventListener('click', () => {
  modal.hidden = false;
  document.querySelector('.modal input').focus();
  loadAppointmentCatalogs();
});

function hideModal() { modal.hidden = true; }
closeModal.addEventListener('click', hideModal);
modal.addEventListener('click', (event) => { if (event.target === modal) hideModal(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') hideModal(); });

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = form.querySelector('button');
  const formData = new FormData(form);
  const fecha = formData.get('fecha');
  const hora = formData.get('hora');
  const subtitle = document.querySelector('.modal-subtitle');
  const originalSubtitle = subtitle.textContent;

  if (!authToken) {
    subtitle.textContent = 'Tu sesión expiró. Inicia sesión nuevamente.';
    return;
  }

  button.disabled = true;
  button.textContent = 'Guardando cita...';

  try {
    const data = await apiRequest('/citas', {
      method: 'POST',
      body: JSON.stringify({
        clienteId: Number(formData.get('clienteId')),
        estilistaId: Number(formData.get('estilistaId')),
        servicioId: Number(formData.get('servicioId')),
        fechaHoraInicio: `${fecha}T${hora}`,
        observaciones: formData.get('observaciones')
      })
    });

    button.textContent = '✓ Cita guardada';
    button.style.background = '#2e8064';
    subtitle.textContent = data.message;
    setTimeout(() => {
      hideModal();
      button.innerHTML = 'Guardar cita';
      button.style.background = '';
      button.disabled = false;
      subtitle.textContent = originalSubtitle;
      form.reset();
    }, 1000);
  } catch (error) {
    subtitle.textContent = error.message;
    button.textContent = 'Guardar cita';
    button.disabled = false;
  }
});

loadAppointmentCatalogs();

document.querySelectorAll('.nav-item').forEach((item) => item.addEventListener('click', () => {
  document.querySelectorAll('.nav-item').forEach((nav) => nav.classList.remove('active'));
  item.classList.add('active');
}));
