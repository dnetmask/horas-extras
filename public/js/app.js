let usuarioSesion = null;

const VISTAS = {
  'mis-horas': { titulo: 'Mis horas extra', render: renderMisHoras, roles: ['ingeniero', 'lider', 'gerencia', 'admin'] },
  aprobaciones: { titulo: 'Aprobaciones', render: renderAprobaciones, roles: ['lider', 'gerencia', 'admin'] },
  banco: { titulo: 'Mi banco de horas', render: renderBanco, roles: ['ingeniero', 'lider', 'gerencia', 'admin'] },
  equipo: { titulo: 'Horas del equipo', render: renderEquipo, roles: ['gerencia', 'admin'] },
  admin: { titulo: 'Administración', render: renderAdmin, roles: ['admin'] },
};

function vistasVisiblesParaRol(rol) {
  return Object.entries(VISTAS).filter(([, v]) => v.roles.includes(rol));
}

function renderNav() {
  const nav = document.getElementById('nav');
  if (!usuarioSesion) {
    nav.innerHTML = '';
    return;
  }
  const hashActual = location.hash.slice(2) || 'mis-horas';
  nav.innerHTML = vistasVisiblesParaRol(usuarioSesion.rol)
    .map(([clave, v]) => `<a href="#/${clave}" class="${clave === hashActual ? 'activo' : ''}">${v.titulo}</a>`)
    .join('');
}

function renderUsuarioActual() {
  const box = document.getElementById('usuarioActual');
  if (!usuarioSesion) {
    box.textContent = '';
    return;
  }
  box.innerHTML = `${usuarioSesion.nombre} (${usuarioSesion.rol}) <button class="btn" onclick="cerrarSesion()">Salir</button>`;
}

async function cerrarSesion() {
  await api.logout();
  location.reload();
}

async function loginDev() {
  const email = document.getElementById('devLoginEmail').value.trim();
  if (!email) return;
  location.href = `/auth/dev-login?email=${encodeURIComponent(email)}`;
}

function renderVistaLogin(devAuthBypass) {
  const app = document.getElementById('app');
  app.innerHTML = '';
  app.appendChild(document.getElementById('tpl-login').content.cloneNode(true));
  if (devAuthBypass) {
    document.getElementById('devLoginBox').hidden = false;
  }
}

async function enrutar() {
  const app = document.getElementById('app');
  if (!usuarioSesion) return; // el login ya se renderizo en init()

  const clave = (location.hash.slice(2) || 'mis-horas').split('?')[0];
  const vista = VISTAS[clave];
  renderNav();

  if (!vista || !vista.roles.includes(usuarioSesion.rol)) {
    app.innerHTML = '<div class="card"><p>No tienes acceso a esta sección.</p></div>';
    return;
  }
  try {
    await vista.render(app);
  } catch (err) {
    app.innerHTML = `<div class="card"><p class="error">${err.message}</p></div>`;
  }
}

async function init() {
  const { usuario, devAuthBypass } = await api.yo();
  usuarioSesion = usuario;
  renderUsuarioActual();

  if (!usuarioSesion) {
    renderVistaLogin(devAuthBypass);
    return;
  }

  if (!location.hash) location.hash = '#/mis-horas';
  window.addEventListener('hashchange', enrutar);
  enrutar();
}

init();
