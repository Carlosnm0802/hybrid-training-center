let debounceTimer;

document.addEventListener('DOMContentLoaded', () => {
    const buscador = document.getElementById('buscadorCheckin');
    if (buscador) {
        buscador.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => buscarAlumnos(e.target.value), 300);
        });
        // Foco inicial
        buscador.focus();
    }
    
    // Cargar historial al iniciar
    cargarUltimosCheckins();
});

async function buscarAlumnos(texto) {
    const contenedor = document.getElementById('resultadosCheckin');
    if (!texto || texto.trim().length < 2) {
        contenedor.innerHTML = '';
        return;
    }
    
    try {
        // Buscar por nombre de forma insensible a mayúsculas
        const { data, error } = await supabaseClient
            .from('alumnos')
            .select('id, nombre_completo, modalidad, tipo_plan_actual, fecha_vigencia_hasta, clase_disponible')
            .ilike('nombre_completo', `%${texto.trim()}%`)
            .limit(5);
            
        if (error) throw error;
        
        if (data.length === 0) {
            contenedor.innerHTML = '<p class="text-muted text-center">No se encontraron alumnos con ese nombre.</p>';
            return;
        }
        
        let html = '';
        data.forEach(alumno => {
            const vigencia = calcularDiasRestantes(alumno.fecha_vigencia_hasta);
            const tieneClase = alumno.clase_disponible;
            
            let estadoLogico = 'sin-plan';
            if (vigencia.estado === 'Activo' || vigencia.estado === 'Vence hoy') estadoLogico = 'activo';
            if (vigencia.estado === 'Vencido') estadoLogico = 'vencido';
            
            let colorBorde = 'var(--border-color)';
            let alertaTxt = '';
            
            // Regla de negocio: si no tiene vigencia ni clase suelta = debe pagar
            if (estadoLogico === 'vencido' || estadoLogico === 'sin-plan') {
                if (!tieneClase) {
                    colorBorde = 'var(--accent-color)'; // Rojo alerta
                    alertaTxt = '<div style="color: var(--accent-color); font-weight: bold; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">⚠️ REQUIERE PAGO</div>';
                } else {
                    colorBorde = '#4CAF50'; // Verde (usará su clase suelta)
                    alertaTxt = '<div style="color: #4CAF50; font-weight: bold; margin-bottom: 0.5rem;">🎫 Tiene 1 clase suelta pagada</div>';
                }
            } else {
                colorBorde = '#4CAF50'; // Verde (vigente)
                alertaTxt = '<div style="color: #4CAF50; font-weight: bold; margin-bottom: 0.5rem;">✅ Plan Vigente (' + vigencia.dias + ' días rest.)</div>';
            }
            
            html += `
                <div style="border: 2px solid ${colorBorde}; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; background-color: rgba(255,255,255,0.02);">
                    ${alertaTxt}
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                        <div>
                            <h3 style="margin:0;">${alumno.nombre_completo}</h3>
                            <p class="text-muted" style="margin:0; text-transform: capitalize;">Modalidad: ${alumno.modalidad}</p>
                        </div>
                        <button class="btn" style="padding: 0.5rem 2rem;" onclick="registrarCheckin('${alumno.id}', '${alumno.nombre_completo}', ${tieneClase}, '${estadoLogico}')">Dar Acceso</button>
                    </div>
                </div>
            `;
        });
        
        contenedor.innerHTML = html;
        
    } catch (err) {
        console.error('Error buscando:', err);
    }
}

window.registrarCheckin = async function(alumnoId, nombre, tieneClase, estadoLogico) {
    const contenedor = document.getElementById('resultadosCheckin');
    
    // 1. Mostrar alerta visual si no tiene vigencia ni clase
    if ((estadoLogico === 'vencido' || estadoLogico === 'sin-plan') && !tieneClase) {
        const confirmar = confirm(`⚠️ ALERTA: ${nombre} NO tiene pagos vigentes.\n\n¿Deseas registrar su acceso de todos modos?`);
        if (!confirmar) return; // Si el recepcionista cancela, no hacemos el check-in
    }
    
    contenedor.innerHTML = '<p class="text-center font-bold">Registrando acceso en la nube...</p>';
    
    try {
        // 1.5 Obtener usuario actual para el campo registrado_por
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) throw new Error("No hay sesión activa para registrar el check-in.");
        
        // 2. Registrar en la tabla checkins
        const { error: insertError } = await supabaseClient
            .from('checkins')
            .insert([{ 
                alumno_id: alumnoId,
                registrado_por: user.id
            }]);
            
        if (insertError) throw insertError;
        
        // 3. Si tenía clase suelta y su plan principal está vencido, consumimos esa clase automáticamente
        if ((estadoLogico === 'vencido' || estadoLogico === 'sin-plan') && tieneClase) {
            await supabaseClient
                .from('alumnos')
                .update({ clase_disponible: false })
                .eq('id', alumnoId);
        }
        
        // 4. Éxito
        contenedor.innerHTML = `
            <div style="text-align: center; padding: 2rem; background: rgba(76, 175, 80, 0.1); border-radius: 8px; border: 2px solid #4CAF50;">
                <h2 style="color: #4CAF50; margin-bottom: 0.5rem;">✅ ¡Acceso Concedido!</h2>
                <p style="font-size: 1.1rem; margin-bottom: 1rem;">Se ha registrado la asistencia de <strong>${nombre}</strong>.</p>
                <button class="btn" onclick="document.getElementById('buscadorCheckin').value=''; document.getElementById('resultadosCheckin').innerHTML=''; document.getElementById('buscadorCheckin').focus();">Siguiente Alumno</button>
            </div>
        `;
        
        // 5. Recargar la tabla de últimos accesos
        cargarUltimosCheckins();
        
    } catch (err) {
        console.error('Error checkin:', err);
        contenedor.innerHTML = `<p class="text-center font-bold" style="color: var(--accent-color);">❌ Error: ${err.message}</p>`;
    }
}

async function cargarUltimosCheckins() {
    const tbody = document.getElementById('listaCheckinsBody');
    if (!tbody) return;
    
    try {
        const { data, error } = await supabaseClient
            .from('checkins')
            .select(`
                fecha_hora,
                alumnos ( nombre_completo, modalidad )
            `)
            .order('fecha_hora', { ascending: false })
            .limit(10);
            
        if (error) throw error;
        
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No hay accesos el día de hoy.</td></tr>';
            return;
        }
        
        let html = '';
        data.forEach(chk => {
            const date = new Date(chk.fecha_hora);
            const horaStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const fechaStr = date.toLocaleDateString();
            
            const nombre = chk.alumnos ? chk.alumnos.nombre_completo : 'Desconocido';
            const modalidad = chk.alumnos && chk.alumnos.modalidad ? chk.alumnos.modalidad : 'N/A';
            
            html += `
                <tr>
                    <td><strong>${nombre}</strong></td>
                    <td style="text-transform: capitalize;">${modalidad}</td>
                    <td>${fechaStr} ${horaStr}</td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
        
    } catch (err) {
        console.error("Error al cargar check-ins", err);
        tbody.innerHTML = '<tr><td colspan="3" class="text-center" style="color:var(--accent-color);">Error al cargar historial.</td></tr>';
    }
}
