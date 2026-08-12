// Placeholders para las credenciales de Supabase
// (NO hacer commit de llaves reales a repositorios públicos)
const SUPABASE_URL = 'TU_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'TU_SUPABASE_ANON_KEY';

// Inicializar cliente Supabase desde el CDN global
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
