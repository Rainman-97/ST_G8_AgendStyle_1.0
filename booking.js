const API_URL = 'https://agendastyle.duckdns.org/api/citas';
const params = new URLSearchParams(window.location.search);
const negocioId = Number(params.get('negocioId'));
const form = document.querySelector('#booking-form');
const message = document.querySelector('#booking-message');
const serviceSelect = document.querySelector('#booking-service');
const stylistSelect = document.querySelector('#booking-stylist');
const dateInput = document.querySelector('#booking-date');

dateInput.min = new Date().toISOString().slice(0, 10);

function setMessage(text, type = '') {
  message.textContent = text;
  message.className = `booking-message ${type}`;
}

async function loadCatalogs() {
  if (!negocioId) {
    setMessage('Esta reserva no tiene un negocio definido.', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/catalogos-publicos?negocioId=${negocioId}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'No fue posible cargar los servicios.');

    document.querySelector('#booking-title').textContent = `Reserva en ${data.negocio.NombreComercial}`;
    serviceSelect.innerHTML = '<option value="">Selecciona un servicio</option>';
    data.servicios.forEach((service) => {
      serviceSelect.insertAdjacentHTML('beforeend', `<option value="${service.ServicioId}">${service.Nombre} · ${service.DuracionMinutos} min</option>`);
    });
    stylistSelect.innerHTML = '<option value="">Selecciona un estilista</option>';
    data.estilistas.forEach((stylist) => {
      stylistSelect.insertAdjacentHTML('beforeend', `<option value="${stylist.EstilistaId}">${stylist.Nombres} ${stylist.Apellidos} · ${stylist.Especialidad}</option>`);
    });
  } catch (error) {
    setMessage(error.message, 'error');
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const button = form.querySelector('button');
  button.disabled = true;
  button.textContent = 'Enviando solicitud...';
  setMessage('');

  try {
    const response = await fetch(`${API_URL}/reservar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        negocioId,
        nombres: formData.get('nombres'),
        apellidos: formData.get('apellidos'),
        telefono: formData.get('telefono'),
        email: formData.get('email'),
        servicioId: Number(formData.get('servicioId')),
        estilistaId: Number(formData.get('estilistaId')),
        fechaHoraInicio: `${formData.get('fecha')}T${formData.get('hora')}`,
        observaciones: formData.get('observaciones')
      })
    });
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

loadCatalogs();
