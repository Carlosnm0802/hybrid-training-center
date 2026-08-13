// Lógica para el registro de pagos (Paso 5)

document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('modalPago');
    const closeBtn = document.getElementById('closeModalPago');
    const formPago = document.getElementById('formPago');
    const selectPlan = document.getElementById('pagoPlan');

    const checkInsc = document.getElementById('checkInscripcion');

    if (closeBtn) {
        closeBtn.onclick = () => modal.classList.remove('show');
    }
    
    // Cerrar si hace clic fuera del modal
    window.onclick = (event) => {
        if (event.target == modal) modal.classList.remove('show');
    };

    if (selectPlan) {
        selectPlan.addEventListener('change', actualizarTotal);
    }
    
    if (checkInsc) {
        checkInsc.addEventListener('change', actualizarTotal);
    }

    if (formPago) {
        formPago.addEventListener('submit', procesarPago);
    }
});

// Esta función es llamada desde el botón "Cobrar" de la tabla en alumnos.js
window.abrirModalPago = function(id, nombre, fechaHasta) {
    const modal = document.getElementById('modalPago');
    const msg = document.getElementById('pagoMsg');
    
    // Limpiar modal
    document.getElementById('formPago').reset();
    msg.style.display = 'none';
    
    document.getElementById('pagoAlumnoId').value = id;
    document.getElementById('pagoAlumnoNombre').textContent = 'Alumno: ' + nombre;
    
    // Detectar si es primer pago (fechaHasta vacía, null, o "null")
    const esPrimerPago = (!fechaHasta || fechaHasta === '' || fechaHasta === 'null');
    document.getElementById('esPrimerPago').value = esPrimerPago;
    
    const divInscripcion = document.getElementById('containerInscripcion');
    if (esPrimerPago) {
        divInscripcion.style.display = 'block';
    } else {
        divInscripcion.style.display = 'none';
    }
    
    actualizarTotal();
    modal.classList.add('show');
}

function actualizarTotal() {
    const selectPlan = document.getElementById('pagoPlan');
    const esPrimerPago = document.getElementById('esPrimerPago').value === 'true';
    const checkInsc = document.getElementById('checkInscripcion');
    
    let total = 0;
    
    if (selectPlan.selectedIndex > 0) { // Si ya eligió un plan
        const tipoPlan = selectPlan.value;
        const precioPlan = parseFloat(selectPlan.options[selectPlan.selectedIndex].getAttribute('data-precio'));
        total += precioPlan;
        
        // Reglas de negocio para inscripción
        if (esPrimerPago) {
            if (tipoPlan === 'mensual' || tipoPlan === 'combo') {
                checkInsc.checked = true;
                checkInsc.disabled = true;
            } else {
                checkInsc.disabled = false;
            }
        }
    }
    
    if (esPrimerPago && checkInsc.checked) {
        total += 150;
    }
    
    document.getElementById('pagoTotal').textContent = formatearMoneda(total);
}

async function procesarPago(e) {
    e.preventDefault();
    
    const btn = document.getElementById('btnProcesarPago');
    const msg = document.getElementById('pagoMsg');
    
    const alumnoId = document.getElementById('pagoAlumnoId').value;
    const esPrimerPago = document.getElementById('esPrimerPago').value === 'true';
    const selectPlan = document.getElementById('pagoPlan');
    const tipoPlan = selectPlan.value;
    const precioPlan = parseFloat(selectPlan.options[selectPlan.selectedIndex].getAttribute('data-precio'));
    
    const checkInsc = document.getElementById('checkInscripcion');
    
    let total = precioPlan;
    let conceptos = [];
    
    if (esPrimerPago && checkInsc.checked) {
        total += 150;
        conceptos.push({ concepto: 'Inscripción', monto: 150 });
    }
    
    conceptos.push({ concepto: tipoPlan, monto: precioPlan });
    
    btn.disabled = true;
    btn.textContent = 'Procesando...';
    msg.style.display = 'none';
    
    try {
        // 1. Obtener sesión activa
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        if (sessionError || !session) throw new Error("No hay sesión activa para registrar el pago");
        const userId = session.user.id;

        // 2. Generar folio (para el MVP usamos max + 1 manual)
        const { data: maxPago, error: folioError } = await supabaseClient
            .from('pagos')
            .select('folio')
            .order('fecha_pago', { ascending: false })
            .limit(1);
            
        if (folioError) throw folioError;
        
        let nuevoFolioNum = 1;
        if (maxPago && maxPago.length > 0 && maxPago[0].folio) {
            const partes = maxPago[0].folio.split('-'); // HTC-00001
            if (partes.length === 2) {
                nuevoFolioNum = parseInt(partes[1]) + 1;
            }
        }
        // Rellenar con 5 ceros (ej. HTC-00002)
        const nuevoFolio = 'HTC-' + String(nuevoFolioNum).padStart(5, '0');

        // 3. Registrar en tabla 'pagos'
        const { error: pagoError } = await supabaseClient
            .from('pagos')
            .insert([{
                folio: nuevoFolio,
                alumno_id: alumnoId,
                conceptos: conceptos,
                monto_total: total,
                metodo_pago: 'efectivo',
                registrado_por: userId
            }]);
            
        if (pagoError) throw pagoError;

        // 4. Actualizar tabla 'alumnos' (vigencia)
        const nuevaVigencia = calcularNuevaVigencia(tipoPlan);
        const daClase = (tipoPlan === 'clase');

        let updateData = { tipo_plan_actual: tipoPlan };
        
        if (daClase) {
            updateData.clase_disponible = true;
        } else {
            updateData.fecha_vigencia_hasta = nuevaVigencia;
        }

        const { error: updateError } = await supabaseClient
            .from('alumnos')
            .update(updateData)
            .eq('id', alumnoId);

        if (updateError) throw updateError;

        // Éxito
        msg.style.display = 'block';
        msg.style.color = '#4CAF50';
        msg.textContent = `✅ Pago registrado. Folio: ${nuevoFolio}`;
        
        // Recargar la tabla
        if (typeof cargarAlumnos === 'function') {
            cargarAlumnos();
        }
        
        // Cerrar modal tras 2 segundos
        setTimeout(() => {
            document.getElementById('modalPago').classList.remove('show');
        }, 2000);

    } catch (err) {
        console.error('Error al procesar pago:', err);
        msg.style.display = 'block';
        msg.style.color = 'var(--accent-color)';
        msg.textContent = '❌ Error al procesar: ' + err.message;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Procesar Pago';
    }
}
