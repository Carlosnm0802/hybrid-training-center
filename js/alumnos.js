let alumnosDataCache = [];

document.addEventListener('DOMContentLoaded', () => {
    const formAlta = document.getElementById('formAltaAlumno');
    if (formAlta) {
        formAlta.addEventListener('submit', registrarAlumno);
    }
    
    const filtroModalidad = document.getElementById('filtroModalidad');
    const filtroEstado = document.getElementById('filtroEstado');
    const filtroTexto = document.getElementById('filtroTexto');
    
    if (filtroModalidad) filtroModalidad.addEventListener('change', renderizarTabla);
    if (filtroEstado) filtroEstado.addEventListener('change', renderizarTabla);
    if (filtroTexto) filtroTexto.addEventListener('input', renderizarTabla);
    
    // Cargar alumnos inicialmente
    cargarAlumnos();
});

async function registrarAlumno(e) {
    e.preventDefault();
    
    const btn = document.getElementById('btnAlta');
    const msg = document.getElementById('altaMsg');
    
    const nombre = document.getElementById('nombre').value.trim();
    const telefono = document.getElementById('telefono').value.trim();
    const email = document.getElementById('email').value.trim();
    const modalidad = document.getElementById('modalidad').value;
    const condicion = document.getElementById('condicion').value.trim() || "Ninguna";
    const contacto_nombre = document.getElementById('contacto_emergencia').value.trim() || null;
    const contacto_tel = document.getElementById('contacto_telefono').value.trim() || null;
    
    btn.disabled = true;
    btn.textContent = 'Guardando...';
    msg.style.display = 'none';
    
    try {
        // La fecha_vigencia_hasta y tipo_plan_actual quedarán en NULL automáticamente
        const { data, error } = await supabaseClient
            .from('alumnos')
            .insert([
                {
                    nombre_completo: nombre,
                    telefono: telefono,
                    email: email,
                    modalidad: modalidad,
                    condicion_medica: condicion,
                    contacto_emergencia_nombre: contacto_nombre,
                    contacto_emergencia_telefono: contacto_tel
                }
            ]);
            
        if (error) throw error;
        
        msg.style.display = 'block';
        msg.style.color = '#4CAF50'; // Verde de éxito
        msg.textContent = '✅ Alumno registrado exitosamente.';
        
        // Limpiar el formulario
        document.getElementById('formAltaAlumno').reset();
        
        // Redirigir al listado después de un segundo
        setTimeout(() => {
            window.location.href = 'alumnos.html';
        }, 1500);
        
    } catch (err) {
        console.error('Error al registrar alumno:', err);
        msg.style.display = 'block';
        msg.style.color = 'var(--accent-color)'; // Rojo de error
        msg.textContent = '❌ Error al guardar: ' + err.message;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Registrar Alumno';
    }
}

async function cargarAlumnos() {
    const tbody = document.getElementById('listaAlumnosBody');
    if (!tbody) return;

    try {
        const { data, error } = await supabaseClient
            .from('alumnos')
            .select('*')
            .order('fecha_alta', { ascending: false });

        if (error) throw error;
        alumnosDataCache = data || [];
        
        renderizarTabla();
    } catch (err) {
        console.error('Error al cargar alumnos:', err);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="color:var(--accent-color)">Error al cargar la lista.</td></tr>';
    }
}

function renderizarTabla() {
    const tbody = document.getElementById('listaAlumnosBody');
    if (!tbody) return;

    const modalidadSel = document.getElementById('filtroModalidad') ? document.getElementById('filtroModalidad').value : 'todos';
    const estadoSel = document.getElementById('filtroEstado') ? document.getElementById('filtroEstado').value : 'todos';
    const textoSel = document.getElementById('filtroTexto') ? document.getElementById('filtroTexto').value.toLowerCase().trim() : '';
    
    tbody.innerHTML = '';
    let count = 0;
    
    alumnosDataCache.forEach(alumno => {
        const vigencia = calcularDiasRestantes(alumno.fecha_vigencia_hasta);
        const claseDisp = alumno.clase_disponible ? '<br><small class="text-accent">(+1 clase)</small>' : '';
        
        // Determinar estado lógico para el filtro
        let estadoLogico = 'sin-plan';
        if (vigencia.estado === 'Activo' || vigencia.estado === 'Vence hoy') estadoLogico = 'activo';
        if (vigencia.estado === 'Vencido') estadoLogico = 'vencido';

        // Aplicar filtros
        if (textoSel !== '' && !alumno.nombre_completo.toLowerCase().includes(textoSel)) return;
        if (modalidadSel !== 'todos' && alumno.modalidad !== modalidadSel) return;
        if (estadoSel !== 'todos' && estadoLogico !== estadoSel) return;

        count++;
        
        let badgeClass = 'sin-plan';
        if (estadoLogico === 'activo') badgeClass = 'activo';
        if (estadoLogico === 'vencido') badgeClass = 'vencido';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${alumno.nombre_completo}</strong><br><small>${alumno.telefono}</small></td>
            <td style="text-transform: capitalize;">${alumno.modalidad}</td>
            <td style="text-transform: capitalize;">${alumno.tipo_plan_actual || 'Ninguno'} ${claseDisp}</td>
            <td><span class="badge ${badgeClass}">${vigencia.estado}</span></td>
            <td>${vigencia.dias > 0 ? vigencia.dias + ' días' : '-'}</td>
            <td>
                <button class="btn-small" onclick="abrirModalPago('${alumno.id}', '${alumno.nombre_completo}', '${alumno.fecha_vigencia_hasta || ''}')">Cobrar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (count === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No se encontraron alumnos con los filtros seleccionados.</td></tr>';
    }
}
