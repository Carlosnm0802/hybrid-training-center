// Placeholders para las credenciales de Supabase
// (NO hacer commit de llaves reales a repositorios públicos)
const SUPABASE_URL = 'https://aurbzvmkbvcqjxuegllg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_MTmSqHrEGdHGgJWLLOBvlQ_QBEcnec-';

// Cambiamos el nombre de la variable a "supabaseClient" para evitar chocar con la librería global del CDN
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);