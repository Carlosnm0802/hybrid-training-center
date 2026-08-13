document.addEventListener('DOMContentLoaded', () => {
    // Si auth.js pasa checkSession (el cual redirige si no hay sesión),
    // procedemos a cargar el dashboard.
    cargarDashboard();
});

async function cargarDashboard() {
    try {
        await Promise.all([
            cargarStatsAlumnos(),
            cargarStatsCheckins(),
            cargarStatsIngresos()
        ]);
    } catch (err) {
        console.error("Error al cargar datos del dashboard", err);
    }
}

async function cargarStatsAlumnos() {
    const { data, error } = await supabaseClient
        .from('alumnos')
        .select('fecha_vigencia_hasta, modalidad');
        
    if (error) throw error;
    
    let activos = 0, vencidos = 0, sinPlan = 0;
    let boxeo = 0, hibrido = 0, combo = 0;
    
    // Configurar 'hoy' a medianoche
    const hoyDate = new Date();
    hoyDate.setHours(0,0,0,0);
    
    data.forEach(al => {
        // Vigencia
        if (!al.fecha_vigencia_hasta) {
            sinPlan++;
        } else {
            // Comparar fechas correctamente
            const [year, month, day] = al.fecha_vigencia_hasta.split('-');
            const limite = new Date(year, month - 1, day);
            limite.setHours(0,0,0,0);
            
            if (limite >= hoyDate) {
                activos++;
            } else {
                vencidos++;
            }
        }
        
        // Distribución
        if (al.modalidad === 'boxeo') boxeo++;
        else if (al.modalidad === 'hibrido') hibrido++;
        else if (al.modalidad === 'combo') combo++;
    });
    
    document.getElementById('statActivos').textContent = activos;
    document.getElementById('statVencidos').textContent = vencidos;
    document.getElementById('statSinPlan').textContent = sinPlan;
    
    document.getElementById('statBoxeo').textContent = boxeo;
    document.getElementById('statHibrido').textContent = hibrido;
    document.getElementById('statCombo').textContent = combo;

    // Renderizar Gráficas
    renderizarGraficas(activos, vencidos, sinPlan, boxeo, hibrido, combo);
}

let chartE = null;
let chartM = null;

function renderizarGraficas(activos, vencidos, sinPlan, boxeo, hibrido, combo) {
    // Configuración general para tema oscuro
    Chart.defaults.color = '#fff';
    Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';

    const ctxEstado = document.getElementById('chartEstado');
    if (chartE) chartE.destroy();
    
    chartE = new Chart(ctxEstado, {
        type: 'doughnut',
        data: {
            labels: ['Activos', 'Vencidos', 'Sin Plan'],
            datasets: [{
                data: [activos, vencidos, sinPlan],
                backgroundColor: ['#4caf50', '#f44336', '#9e9e9e'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#fff' } }
            }
        }
    });

    const ctxModalidad = document.getElementById('chartModalidad');
    if (chartM) chartM.destroy();
    
    chartM = new Chart(ctxModalidad, {
        type: 'pie',
        data: {
            labels: ['Boxeo', 'Híbrido', 'Combo'],
            datasets: [{
                data: [boxeo, hibrido, combo],
                backgroundColor: ['#2196f3', '#ff9800', '#9c27b0'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#fff' } }
            }
        }
    });
}

async function cargarStatsCheckins() {
    // Checkins últimos 7 días
    const date7 = new Date();
    date7.setDate(date7.getDate() - 7);
    const date7Str = date7.toISOString();
    
    const { data, error } = await supabaseClient
        .from('checkins')
        .select('fecha_hora')
        .gte('fecha_hora', date7Str);
        
    if (error) throw error;
    
    let hoy = 0;
    let semana = data.length; // todos los traídos son de los últimos 7 días
    
    // Obtener la fecha local actual en formato YYYY-MM-DD
    const hoyD = new Date();
    const mm = String(hoyD.getMonth() + 1).padStart(2, '0');
    const dd = String(hoyD.getDate()).padStart(2, '0');
    const hoyStr = `${hoyD.getFullYear()}-${mm}-${dd}`;
    
    data.forEach(c => {
        // La fecha en supabase es UTC pero al instanciarla se pasa a local
        const chkDate = new Date(c.fecha_hora);
        const cmm = String(chkDate.getMonth() + 1).padStart(2, '0');
        const cdd = String(chkDate.getDate()).padStart(2, '0');
        const cStr = `${chkDate.getFullYear()}-${cmm}-${cdd}`;
        
        if (cStr === hoyStr) {
            hoy++;
        }
    });
    
    document.getElementById('statCheckinsHoy').textContent = hoy;
    document.getElementById('statCheckinsSemana').textContent = semana;
}

async function cargarStatsIngresos() {
    // Ingresos del mes actual
    const date = new Date();
    // Primer día del mes a las 00:00 local time
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const firstDayISO = firstDay.toISOString();
    
    const { data, error } = await supabaseClient
        .from('pagos')
        .select('monto_total')
        .gte('fecha_pago', firstDayISO);
        
    if (error) throw error;
    
    let total = 0;
    data.forEach(p => {
        total += Number(p.monto_total);
    });
    
    document.getElementById('statIngresosMes').textContent = formatearMoneda(total);
    
    // Set mes label
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    document.getElementById('statMesLabel').textContent = `Mes de ${meses[date.getMonth()]}`;
}
