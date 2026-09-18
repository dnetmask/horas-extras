async function renderAyuda(contenedor) {
  const rol = usuarioSesion.rol;

  contenedor.innerHTML = `
    <div class="card">
      <h2>Ayuda</h2>
      <p style="font-size:0.85rem;color:#556">Reemplaza el Excel "Horas Compensatorias". Reporta tus horas extra, se aprueban por tu líder y por gerencia, y se acreditan a tu banco de tiempo compensatorio ya con el recargo de ley aplicado.</p>
    </div>

    <div class="card">
      <h3>Registrar una hora extra</h3>
      <p>En "Mis horas extra": indica fecha, horario, el líder al que se le envía la pre-aprobación, #Caso, #OT y obra/proyecto (los dos primeros son obligatorios). No hace falta marcar si el día fue festivo — se calcula solo a partir de la fecha, incluso si el turno cruza la medianoche.</p>
      <p>Mientras el estado sea <span class="badge badge-pendiente">Pendiente líder</span> puedes editarla o eliminarla. Una vez pasa a <span class="badge badge-pendiente">Pendiente gerencia</span> ya no se puede tocar — si algo estaba mal, pide que la rechacen primero.</p>
    </div>

    <div class="card">
      <h3>Mi banco de horas</h3>
      <p>"Compensable" ya incluye el recargo de cada categoría (diurna/nocturna, ordinaria/dominical-festiva) convertido en más tiempo — Netmask compensa con tiempo, no con dinero, así que 1 hora nocturna dominical/festiva puede acreditar más de 1 hora de descanso. Ver la pestaña <a href="#/recargos">Cómo se calculan las horas</a> para el detalle de los porcentajes vigentes.</p>
      <p>Puedes solicitar usar horas disponibles indicando fecha y horario — si pides más de lo que tienes, la app te deja igual con el saldo en negativo ("en contra"), y se paga solo con tus próximas horas extra aprobadas.</p>
      <p>Si un saldo lleva más de 45 días aprobado sin compensar, llega una alerta automática por correo a ti, tu líder y gerencia.</p>
    </div>

    ${
      ['lider', 'gerencia', 'admin'].includes(rol)
        ? `<div class="card">
      <h3>Aprobaciones</h3>
      <p>Como líder ves solo las solicitudes donde a ti te eligieron para la pre-aprobación. Como gerencia ves todo lo que ya tiene el visto bueno de un líder, sin importar quién sea. Al rechazar, el motivo se le envía por correo a quien la creó.</p>
    </div>`
        : ''
    }

    ${
      ['lider', 'gerencia', 'admin'].includes(rol)
        ? `<div class="card">
      <h3>Horas del equipo</h3>
      <p>${rol === 'lider' ? 'Ves el saldo de las personas que te tienen asignado como líder en Administración (tu equipo).' : 'Gerencia y Admin ven el saldo de todos.'} ${
            rol !== 'gerencia'
              ? 'Desde ahí puedes entrar al detalle registro por registro de cualquiera de tu lista.'
              : ''
          }</p>
    </div>`
        : ''
    }

    ${
      rol === 'admin'
        ? `<div class="card">
      <h3>Administración</h3>
      <p>Precarga usuarios por correo antes de que inicien sesión (el rol y el líder asignado se pueden ajustar en cualquier momento). El "líder asignado" es el que se precarga por defecto al registrar horas extra — la persona igual puede elegir otro en el momento.</p>
      <p>En <a href="#/recargos">Cómo se calculan las horas</a> puedes agregar una nueva vigencia de recargo cuando la ley cambie — nunca se edita el historial, solo se agregan filas nuevas hacia adelante.</p>
    </div>`
        : ''
    }

    <div class="card">
      <h3>Preguntas frecuentes</h3>
      <dl>
        <dt><strong>No aparece nadie en la lista de líderes.</strong></dt>
        <dd style="margin:0 0 0.8rem;color:#556">Pide a un admin que le asigne el rol Líder (o Gerencia/Admin, también cuentan) a la persona correspondiente.</dd>
        <dt><strong>Me equivoqué en un registro que ya está en "Pendiente gerencia".</strong></dt>
        <dd style="margin:0 0 0.8rem;color:#556">No se puede editar ni eliminar en ese estado. Pide a tu líder o a gerencia que la rechacen — vuelve a quedar editable.</dd>
        <dt><strong>¿Tengo que avisar si un día fue festivo?</strong></dt>
        <dd style="margin:0 0 0.8rem;color:#556">No, se calcula solo con el calendario colombiano completo (festivos móviles incluidos).</dd>
        <dt><strong>El navegador dice que el sitio no es seguro.</strong></dt>
        <dd style="margin:0;color:#556">Es esperado (certificado autofirmado, sin dominio propio todavía). Verifica que la dirección sea la correcta y continúa.</dd>
      </dl>
    </div>

    <div class="card">
      <p style="font-size:0.85rem;color:#556">¿Algo no funciona como se describe aquí? Escríbele a tu administrador de la app.</p>
    </div>
  `;
}
