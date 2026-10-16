const modal = document.querySelector('#modal');
const openModal = document.querySelector('#open-modal');
const closeModal = document.querySelector('#close-modal');
const form = document.querySelector('#appointment-form');

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

openModal.addEventListener('click', () => {
  modal.hidden = false;
  document.querySelector('.modal input').focus();
});

function hideModal() { modal.hidden = true; }
closeModal.addEventListener('click', hideModal);
modal.addEventListener('click', (event) => { if (event.target === modal) hideModal(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') hideModal(); });

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const button = form.querySelector('button');
  button.textContent = '✓ Cita guardada';
  button.style.background = '#263f6b';
  setTimeout(() => { hideModal(); button.innerHTML = 'Guardar cita'; button.style.background = ''; form.reset(); }, 900);
});

document.querySelectorAll('.nav-item').forEach((item) => item.addEventListener('click', () => {
  document.querySelectorAll('.nav-item').forEach((nav) => nav.classList.remove('active'));
  item.classList.add('active');
}));
