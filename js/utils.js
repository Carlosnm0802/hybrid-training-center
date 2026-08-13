// Funciones compartidas

// Calcula el estado y los días restantes de una vigencia
function calcularDiasRestantes(fechaHasta) {
    if (!fechaHasta) return { estado: 'Sin plan', dias: 0 };
    
    // Asumimos que fechaHasta es 'YYYY-MM-DD' de Postgres
    const hoy = new Date();
    hoy.setHours(0,0,0,0);
    
    const [year, month, day] = fechaHasta.split('-');
    const limite = new Date(year, month - 1, day);
    limite.setHours(0,0,0,0);
    
    const diffTime = limite.getTime() - hoy.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { estado: 'Vencido', dias: diffDays };
    if (diffDays === 0) return { estado: 'Vence hoy', dias: 0 };
    return { estado: 'Activo', dias: diffDays };
}

// Calcula la nueva fecha de vigencia a partir de hoy según el plan
function calcularNuevaVigencia(tipoPlan) {
    const hoy = new Date();
    
    if (tipoPlan === 'clase') return null; // La clase suelta no da vigencia en días
    
    if (tipoPlan === 'semana') {
        hoy.setDate(hoy.getDate() + 7);
    } else if (tipoPlan === 'mensual' || tipoPlan === 'combo') {
        hoy.setDate(hoy.getDate() + 30);
    }
    
    return hoy.toISOString().split('T')[0]; // Formato YYYY-MM-DD
}

// Formateador de moneda
function formatearMoneda(cantidad) {
    return '$' + parseFloat(cantidad).toFixed(2) + ' MXN';
}
