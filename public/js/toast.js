// Notificaciones in-page, en vez de alert() nativo del navegador. Scripts
// clasicos (sin modulos ES), igual que el resto de la app.

function mostrarToast(mensaje, tipo) {
  let cont = document.getElementById('toastContainer');
  if (!cont) {
    cont = document.createElement('div');
    cont.id = 'toastContainer';
    cont.className = 'toast-container';
    document.body.appendChild(cont);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${tipo || 'info'}`;
  toast.textContent = mensaje;
  cont.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('toast-visible'));

  setTimeout(() => {
    toast.classList.remove('toast-visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 5000);
}
