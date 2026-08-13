let alumnosDataCache = [];
let currentPage = 1;
const pageSize = 10;

document.addEventListener('DOMContentLoaded', () => {
    const formAlta = document.getElementById('formAltaAlumno');
    if (formAlta) {
        formAlta.addEventListener('submit', registrarAlumno);
    }
    
    const filtroModalidad = document.getElementById('filtroModalidad');
    const filtroEstado = document.getElementById('filtroEstado');
    const filtroTexto = document.getElementById('filtroTexto');
    
    // Al filtrar, resetear a página 1
    if (filtroModalidad) filtroModalidad.addEventListener('change', () => { currentPage = 1; renderizarTabla(); });
    if (filtroEstado) filtroEstado.addEventListener('change', () => { currentPage = 1; renderizarTabla(); });
    if (filtroTexto) filtroTexto.addEventListener('input', () => { currentPage = 1; renderizarTabla(); });
    
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
    
    // 1. Filtrar los datos
    const filteredData = alumnosDataCache.filter(alumno => {
        const vigencia = calcularDiasRestantes(alumno.fecha_vigencia_hasta);
        
        // Determinar estado lógico
        let estadoLogico = 'sin-plan';
        if (vigencia.estado === 'Activo' || vigencia.estado === 'Vence hoy') estadoLogico = 'activo';
        if (vigencia.estado === 'Vencido') estadoLogico = 'vencido';

        // Evaluar condiciones
        if (textoSel !== '' && !alumno.nombre_completo.toLowerCase().includes(textoSel)) return false;
        if (modalidadSel !== 'todos' && alumno.modalidad !== modalidadSel) return false;
        if (estadoSel !== 'todos' && estadoLogico !== estadoSel) return false;
        
        // Guardar calculos para no repetirlos al pintar
        alumno._vigencia = vigencia;
        alumno._estadoLogico = estadoLogico;
        
        return true;
    });

    // 2. Paginar
    const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    
    const startIndex = (currentPage - 1) * pageSize;
    const paginatedData = filteredData.slice(startIndex, startIndex + pageSize);

    // 3. Renderizar tabla
    tbody.innerHTML = '';
    
    if (paginatedData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No se encontraron alumnos.</td></tr>';
        renderizarPaginacion(0, 1);
        return;
    }
    
    paginatedData.forEach(alumno => {
        const vigencia = alumno._vigencia;
        const estadoLogico = alumno._estadoLogico;
        const claseDisp = alumno.clase_disponible ? '<br><small class="text-accent" style="white-space: nowrap;">(+1 clase)</small>' : '';

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

    // 4. Renderizar controles de paginación
    renderizarPaginacion(filteredData.length, totalPages);
}

function renderizarPaginacion(totalItems, totalPages) {
    const container = document.getElementById('paginacionContainer');
    if (!container) return;
    
    if (totalItems === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <button class="btn-small" style="background-color: var(--border-color); color: var(--text-color); cursor: ${currentPage === 1 ? 'not-allowed' : 'pointer'}; opacity: ${currentPage === 1 ? '0.5' : '1'};" onclick="cambiarPagina(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>Anterior</button>
        <span style="font-weight: bold; color: var(--text-color); font-size: 0.9rem;">Página ${currentPage} de ${totalPages} <span class="text-muted" style="font-weight: normal; font-size: 0.8rem;">(${totalItems} registros)</span></span>
        <button class="btn-small" style="background-color: var(--border-color); color: var(--text-color); cursor: ${currentPage === totalPages ? 'not-allowed' : 'pointer'}; opacity: ${currentPage === totalPages ? '0.5' : '1'};" onclick="cambiarPagina(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Siguiente</button>
    `;
}

window.cambiarPagina = function(newPage) {
    currentPage = newPage;
    renderizarTabla();
}
