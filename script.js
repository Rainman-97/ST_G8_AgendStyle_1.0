const modal = document.querySelector('#modal');
const openModal = document.querySelector('#open-modal');
const closeModal = document.querySelector('#close-modal');
const form = document.querySelector('#appointment-form');
const API_BASE = 'https://agendastyle.duckdns.org/api';
const authToken = localStorage.getItem('agendaStyleToken');

const storedUser = localStorage.getItem('agendaStyleUser');
const currentUser = storedUser ? JSON.parse(storedUser) : null;
let upcomingPeriod = 'dia';
let selectedAgendaDate = null;
let calendarSelectionActive = false;

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
      loadDashboardData();
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

function formatMoney(value) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDateLabel(dateValue) {
  return new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(`${dateValue}T12:00:00`));
}

function initials(name) {
  return String(name || '?').split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function renderEmpty(container, message) {
  container.innerHTML = `<p class="empty-state">${message}</p>`;
}

function appointmentActions(cita) {
  const state = String(cita.Estado || 'Pendiente');
  const isClosed = ['Cancelada', 'Atendida', 'No asistió'].includes(state);
  return `<div class="appointment-actions" data-appointment-id="${cita.CitaId}">
    <select class="appointment-state" aria-label="Cambiar estado de la cita" ${state === 'Cancelada' ? 'disabled' : ''}>
      <option value="Pendiente" ${state === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
      <option value="Confirmada" ${state === 'Confirmada' ? 'selected' : ''}>Confirmada</option>
      <option value="Atendida" ${state === 'Atendida' ? 'selected' : ''}>Finalizada</option>
      <option value="No asistió" ${state === 'No asistió' ? 'selected' : ''}>No asistió</option>
    </select>
    ${!isClosed ? '<button type="button" class="cancel-appointment">Cancelar</button>' : ''}
  </div>`;
}

async function changeAppointmentState(citaId, estado) {
  await apiRequest(`/citas/${citaId}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ estado })
  });
  showToast('Estado de la cita actualizado.');
  const historyModal = document.querySelector('#agenda-full-modal');
  if (historyModal) historyModal.hidden = true;
  await loadDashboardData();
}

async function cancelAppointment(citaId) {
  if (!window.confirm('¿Deseas cancelar esta cita?')) return;
  await apiRequest(`/citas/${citaId}/cancelar`, { method: 'PATCH' });
  showToast('Cita cancelada correctamente.');
  const historyModal = document.querySelector('#agenda-full-modal');
  if (historyModal) historyModal.hidden = true;
  await loadDashboardData();
}

function bindAppointmentActions(container) {
  container.querySelectorAll('.appointment-state').forEach((select) => {
    select.addEventListener('change', async () => {
      try {
        select.disabled = true;
        await changeAppointmentState(select.closest('[data-appointment-id]').dataset.appointmentId, select.value);
      } catch (error) {
        showToast(error.message);
        select.disabled = false;
      }
    });
  });
  container.querySelectorAll('.cancel-appointment').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        button.disabled = true;
        await cancelAppointment(button.closest('[data-appointment-id]').dataset.appointmentId);
      } catch (error) {
        showToast(error.message);
        button.disabled = false;
      }
    });
  });
}

function renderAppointments(citas, emptyMessage = 'No hay próximas citas registradas.') {
  const container = document.querySelector('#appointment-list') || document.querySelector('.appointment-list');
  if (!container) return;
  container.innerHTML = '';
  if (!citas.length) {
    renderEmpty(container, emptyMessage);
    return;
  }

  citas.forEach((cita, index) => {
    const start = new Date(cita.FechaHoraInicio);
    const time = start.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
    const item = document.createElement('div');
    item.className = 'appointment';
    item.innerHTML = `
      <div class="time"><strong>${time}</strong></div>
      <div class="appointment-line ${['blue-line', 'green-line', 'orange-line', 'pink-line'][index % 4]}"></div>
      <div class="client-avatar blue-avatar">${initials(cita.Cliente)}</div>
      <div class="appointment-info"><strong>${cita.Cliente}</strong><span>${cita.Servicio} · ${cita.Estilista}</span></div>
      <span class="status ${String(cita.Estado).toLowerCase() === 'confirmada' ? 'confirmed' : 'pending'}">${cita.Estado}</span>
      ${appointmentActions(cita)}`;
    container.appendChild(item);
  });
  bindAppointmentActions(container);
}

function renderTeam(team) {
  const container = document.querySelector('.team-list');
  const summary = document.querySelector('#team-summary');
  if (!container) return;
  container.innerHTML = '';
  if (!team.length) {
    renderEmpty(container, 'Aún no hay miembros del equipo registrados.');
    if (summary) summary.textContent = 'El administrador puede agregar el equipo.';
    return;
  }
  if (summary) summary.textContent = `${team.length} miembro${team.length === 1 ? '' : 's'} registrado${team.length === 1 ? '' : 's'}.`;
  team.forEach((member) => {
    const row = document.createElement('div');
    row.className = 'team-member';
    row.innerHTML = `<div class="team-avatar blue-avatar">${initials(`${member.Nombres} ${member.Apellidos}`)}<span></span></div><div><strong>${member.Nombres} ${member.Apellidos}</strong><small>${member.Especialidad}</small></div><em>Disponible</em>`;
    container.appendChild(row);
  });
}

function renderCalendar(dateValue, datesWithAppointments) {
  const calendar = document.querySelector('.calendar-grid');
  const monthLabel = document.querySelector('.calendar-panel .panel-header p');
  if (!calendar || !monthLabel) return;
  const date = new Date(`${dateValue}T12:00:00`);
  const year = date.getFullYear();
  const month = date.getMonth();
  const today = dateValue;
  const firstDay = new Date(year, month, 1).getDay();
  const mondayOffset = (firstDay + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const appointmentDates = new Set((datesWithAppointments || []).map((value) => String(value).slice(0, 10)));
  monthLabel.textContent = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(date);
  calendar.innerHTML = '';
  for (let index = 0; index < mondayOffset; index += 1) {
    const previousDay = new Date(year, month, index - mondayOffset + 1).getDate();
    const cell = document.createElement('span');
    cell.className = 'muted';
    cell.textContent = previousDay;
    calendar.appendChild(cell);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const cell = document.createElement('span');
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cell.textContent = day;
    cell.dataset.date = key;
    cell.title = 'Ver agenda de este día';
    cell.addEventListener('click', () => {
      calendarSelectionActive = true;
      loadDashboardData(key);
    });
    if (key === today) cell.classList.add('selected');
    if (appointmentDates.has(key)) cell.innerHTML += '<i></i>';
    calendar.appendChild(cell);
  }
}

async function loadUpcomingAppointments() {
  const referenceDate = selectedAgendaDate || new Date().toISOString().slice(0, 10);
  const data = await apiRequest(`/citas/proximas?periodo=${upcomingPeriod}&fecha=${referenceDate}&limite=20`);
  renderAppointments(data.citas || []);
}

function setupUpcomingFilter() {
  const original = document.querySelector('.filter-button');
  if (!original || original.dataset.ready) return;
  const select = document.createElement('select');
  select.className = 'filter-select';
  select.innerHTML = '<option value="dia">Hoy</option><option value="semana">Esta semana</option><option value="mes">Este mes</option>';
  select.value = upcomingPeriod;
  select.setAttribute('aria-label', 'Filtrar próximas citas');
  original.replaceWith(select);
  select.addEventListener('change', async () => {
    upcomingPeriod = select.value;
    calendarSelectionActive = false;
    const list = document.querySelector('#appointment-list') || document.querySelector('.appointment-list');
    if (list) renderEmpty(list, 'Cargando próximas citas...');
    try {
      await loadUpcomingAppointments();
    } catch (_error) {
      if (list) renderEmpty(list, 'No fue posible cargar las próximas citas.');
    }
  });
}

function createAgendaModal() {
  if (document.querySelector('#agenda-full-modal')) return;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = 'agenda-full-modal';
  backdrop.hidden = true;
  backdrop.innerHTML = `<div class="modal agenda-full-modal" role="dialog" aria-modal="true"><button class="close-modal" type="button" aria-label="Cerrar">×</button><p class="eyebrow">AGENDA COMPLETA</p><h2>Historial de citas</h2><p class="modal-subtitle">Todas las citas registradas en este negocio.</p><div class="full-agenda-list"></div></div>`;
  document.body.appendChild(backdrop);
  backdrop.querySelector('.close-modal').addEventListener('click', () => { backdrop.hidden = true; });
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) backdrop.hidden = true; });
}

async function openFullAgenda(event) {
  event.preventDefault();
  createAgendaModal();
  const backdrop = document.querySelector('#agenda-full-modal');
  const list = backdrop.querySelector('.full-agenda-list');
  backdrop.hidden = false;
  renderEmpty(list, 'Cargando agenda...');
  try {
    const data = await apiRequest('/citas/historial?limite=100');
    if (!data.citas.length) {
      renderEmpty(list, 'Aún no hay citas registradas.');
      return;
    }
    list.innerHTML = data.citas.map((cita) => {
      const start = new Date(cita.FechaHoraInicio);
      return `<div class="agenda-full-row" data-appointment-id="${cita.CitaId}"><div><strong>${start.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}</strong><span>${start.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })}</span></div><section><strong>${cita.Cliente}</strong><small>${cita.Servicio} · ${cita.Estilista}</small></section><em>${cita.Estado}</em>${appointmentActions(cita)}</div>`;
    }).join('');
    bindAppointmentActions(list);
  } catch (_error) {
    renderEmpty(list, 'No fue posible cargar la agenda completa.');
  }
}

function showToast(message) {
  let toast = document.querySelector('#dashboard-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'dashboard-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('visible'), 2600);
}

function setupDashboardInteractions() {
  setupUpcomingFilter();
  createAgendaModal();
  createTeamDirectoryModal();
  const viewAll = document.querySelector('.view-all');
  if (viewAll && !viewAll.dataset.ready) {
    viewAll.dataset.ready = 'true';
    viewAll.addEventListener('click', openFullAgenda);
  }
  const teamLink = document.querySelector('#equipo .text-link');
  if (teamLink && !teamLink.dataset.ready) {
    teamLink.dataset.ready = 'true';
    teamLink.addEventListener('click', openTeamDirectory);
  }
  document.querySelectorAll('.nav-item').forEach((item) => {
    if (item.dataset.ready) return;
    item.dataset.ready = 'true';
    item.addEventListener('click', (event) => {
      const target = item.getAttribute('href');
      if (target === '#clientes') {
        event.preventDefault();
        createManagementModal('cliente').hidden = false;
      } else if (target === '#servicios') {
        event.preventDefault();
        createManagementModal('servicio').hidden = false;
      } else if (target === '#equipo') {
        event.preventDefault();
        document.querySelector('#equipo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (currentUser?.rol === 'Administrador') {
          setTimeout(() => { document.querySelector('#team-modal').hidden = false; }, 250);
        }
      } else if (target === '#reportes' || target === '#configuracion') {
        event.preventDefault();
        showToast('Este módulo estará disponible en la siguiente etapa.');
      }
    });
  });
}

function clearFakeReminderSummary() {
  const count = document.querySelector('.reminder-count');
  const progress = document.querySelector('.progress-track > div');
  const percentage = document.querySelector('.reminder-foot strong');
  if (count) count.textContent = 'Sin envíos registrados';
  if (progress) progress.style.width = '0%';
  if (percentage) percentage.textContent = '0%';
}

function createTeamModal() {
  if (document.querySelector('#team-modal')) return;
  const modalElement = document.createElement('div');
  modalElement.className = 'modal-backdrop';
  modalElement.id = 'team-modal';
  modalElement.hidden = true;
  modalElement.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><button class="close-modal" type="button" aria-label="Cerrar">×</button><p class="eyebrow">GESTIÓN DEL NEGOCIO</p><h2>Agregar miembro del equipo</h2><p class="modal-subtitle">Estos datos se guardarán en el negocio actual.</p><form id="team-form"><label>Nombres<input name="nombres" required></label><label>Apellidos<input name="apellidos" required></label><label>Especialidad<input name="especialidad" required placeholder="Ej. Estilista o Barbero"></label><label>Teléfono<input name="telefono"></label><label>Correo electrónico<input name="email" type="email"></label><button class="primary-button full" type="submit">Guardar miembro</button><p class="form-message" id="team-form-message"></p></form></div>`;
  document.body.appendChild(modalElement);
  const formElement = modalElement.querySelector('#team-form');
  modalElement.querySelector('.close-modal').addEventListener('click', () => { modalElement.hidden = true; });
  formElement.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(formElement));
    const message = formElement.querySelector('#team-form-message');
    try {
      await apiRequest('/dashboard/equipo', { method: 'POST', body: JSON.stringify(data) });
      formElement.reset();
      modalElement.hidden = true;
      loadDashboardData();
    } catch (error) {
      message.textContent = error.message;
      message.className = 'form-message error';
    }
  });
}

function createTeamDirectoryModal() {
  if (document.querySelector('#team-directory-modal')) return;
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.id = 'team-directory-modal';
  modal.hidden = true;
  modal.innerHTML = `<div class="modal team-directory-modal" role="dialog" aria-modal="true"><button class="close-modal" type="button" aria-label="Cerrar">×</button><p class="eyebrow">EQUIPO DEL NEGOCIO</p><h2>Ver equipo</h2><p class="modal-subtitle">Miembros registrados actualmente en tu negocio.</p><div class="team-directory-list"></div><button class="primary-button full add-team-from-directory" type="button">Agregar miembro</button></div>`;
  document.body.appendChild(modal);
  modal.querySelector('.close-modal').addEventListener('click', () => { modal.hidden = true; });
  modal.addEventListener('click', (event) => { if (event.target === modal) modal.hidden = true; });
  modal.querySelector('.add-team-from-directory').addEventListener('click', () => {
    modal.hidden = true;
    if (currentUser?.rol === 'Administrador') document.querySelector('#team-modal').hidden = false;
  });
}

async function openTeamDirectory(event) {
  event.preventDefault();
  createTeamDirectoryModal();
  const modal = document.querySelector('#team-directory-modal');
  const list = modal.querySelector('.team-directory-list');
  modal.hidden = false;
  renderEmpty(list, 'Cargando equipo...');
  try {
    const data = await apiRequest('/dashboard/equipo');
    if (!data.equipo.length) {
      renderEmpty(list, 'Aún no hay miembros del equipo registrados.');
      return;
    }
    list.innerHTML = data.equipo.map((member) => `<article class="team-directory-row"><div class="team-avatar blue-avatar">${initials(`${member.Nombres} ${member.Apellidos}`)}</div><div><strong>${member.Nombres} ${member.Apellidos}</strong><small>${member.Especialidad}</small><small>${member.Email || 'Sin correo registrado'} · ${member.Telefono || 'Sin teléfono registrado'}</small></div><em>${member.Activo ? 'Activo' : 'Inactivo'}</em></article>`).join('');
  } catch (error) {
    renderEmpty(list, error.message || 'No fue posible cargar el equipo.');
  }
}

function createManagementModal(type) {
  const isClient = type === 'cliente';
  const id = `${type}-management-modal`;
  if (document.querySelector(`#${id}`)) return document.querySelector(`#${id}`);
  const modalElement = document.createElement('div');
  modalElement.className = 'modal-backdrop';
  modalElement.id = id;
  modalElement.hidden = true;
  modalElement.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><button class="close-modal" type="button" aria-label="Cerrar">×</button><p class="eyebrow">GESTIÓN DEL NEGOCIO</p><h2>${isClient ? 'Agregar cliente' : 'Agregar servicio'}</h2><p class="modal-subtitle">Los datos se guardarán en el negocio actual.</p><form><label>Nombre<input name="${isClient ? 'nombres' : 'nombre'}" required></label>${isClient ? '<label>Apellidos<input name="apellidos" required></label><label>Teléfono<input name="telefono" required></label><label>Correo electrónico<input name="email" type="email"></label>' : '<label>Descripción<input name="descripcion"></label><label>Duración en minutos<input name="duracionMinutos" type="number" min="1" required></label><label>Precio<input name="precio" type="number" min="0" step="0.01" required></label>'}<button class="primary-button full" type="submit">Guardar</button><p class="form-message"></p></form></div>`;
  document.body.appendChild(modalElement);
  modalElement.querySelector('.close-modal').addEventListener('click', () => { modalElement.hidden = true; });
  modalElement.querySelector('form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const message = formElement.querySelector('.form-message');
    try {
      await apiRequest(`/dashboard/${isClient ? 'clientes' : 'servicios'}`, { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(formElement))) });
      formElement.reset();
      modalElement.hidden = true;
      await loadAppointmentCatalogs();
      loadDashboardData();
    } catch (error) {
      message.textContent = error.message;
      message.className = 'form-message error';
    }
  });
  return modalElement;
}

function createManagementButtons() {
  // La gestión se realiza desde el menú lateral.
  document.querySelectorAll('.management-button').forEach((button) => button.remove());
}

async function loadDashboardData(requestedDate = null) {
  if (!authToken) return;
  const now = new Date();
  const date = requestedDate || selectedAgendaDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  selectedAgendaDate = date;
  const initialCards = document.querySelectorAll('.stat-card');
  const initialValues = ['0', '$ 0', '--', '0'];
  const initialDetails = ['Sin citas registradas', 'Sin citas facturables', 'No hay prÃ³ximas citas', 'Sin clientes registrados'];
  initialCards.forEach((card, index) => {
    const value = card.querySelector('strong');
    const detail = card.querySelector('small');
    const trend = card.querySelector('.trend');
    if (value) value.textContent = initialValues[index];
    if (detail) detail.textContent = initialDetails[index];
    if (trend) trend.textContent = 'Sin datos';
  });
  const initialAgendaLabel = document.querySelector('#today-agenda-label') || document.querySelector('.section-heading p');
  if (initialAgendaLabel) initialAgendaLabel.textContent = formatDateLabel(date);
  renderCalendar(date, []);
  clearFakeReminderSummary();
  const list = document.querySelector('#appointment-list') || document.querySelector('.appointment-list');
  if (list) renderEmpty(list, 'Cargando citas...');
  try {
    const [summary, agenda, team] = await Promise.all([
      apiRequest(`/dashboard/resumen?fecha=${date}`),
      apiRequest(`/citas/?fecha=${date}`),
      apiRequest('/dashboard/equipo')
    ]);
    const cards = document.querySelectorAll('.stat-card');
    const updateCard = (index, value, detail) => {
      if (!cards[index]) return;
      const valueElement = cards[index].querySelector('strong');
      const detailElement = cards[index].querySelector('small');
      if (valueElement) valueElement.textContent = value;
      if (detailElement) detailElement.textContent = detail;
    };
    updateCard(0, summary.citasHoy, summary.citasHoy ? 'Citas activas para hoy' : 'Sin citas registradas');
    updateCard(1, formatMoney(summary.ingresosEstimados), summary.ingresosEstimados ? 'Según los servicios agendados' : 'Sin citas facturables');
    updateCard(3, summary.clientesRegistrados, summary.clientesRegistrados ? 'Clientes activos del negocio' : 'Sin clientes registrados');
    const agendaLabel = document.querySelector('#today-agenda-label') || document.querySelector('.section-heading p');
    if (agendaLabel) agendaLabel.textContent = formatDateLabel(date);
    const appointmentsLabel = document.querySelector('.appointment-panel .panel-header p');
    if (appointmentsLabel) {
      appointmentsLabel.textContent = calendarSelectionActive
        ? `Citas del ${formatDateLabel(date)}`
        : 'Próximas citas del negocio';
    }
    const next = summary.proximaCita;
    updateCard(2, next ? new Date(next.FechaHoraInicio).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--', next ? `${next.Cliente} · ${next.Servicio}` : 'No hay próximas citas');
    renderCalendar(date, summary.fechasConCitas);
    clearFakeReminderSummary();
    if (calendarSelectionActive) {
      renderAppointments(agenda.citas || [], 'No hay citas registradas para esta fecha.');
    } else {
      await loadUpcomingAppointments();
    }
    renderTeam(team.equipo || []);
  } catch (error) {
    console.error('No se pudo cargar el dashboard:', error);
    if (list) renderEmpty(list, 'No fue posible cargar la agenda.');
    renderTeam([]);
  }
}

createTeamModal();
createManagementButtons();
setupDashboardInteractions();
const openTeamModal = document.querySelector('#open-team-modal');
if (openTeamModal) {
  openTeamModal.addEventListener('click', () => {
    if (currentUser?.rol !== 'Administrador') {
      alert('Solo el administrador puede agregar miembros al equipo.');
      return;
    }
    document.querySelector('#team-modal').hidden = false;
  });
}

loadDashboardData();
