// Supabase bağlantı ayarları.
// Supabase panelinde: Project Settings > API (Data API) bölümünden
//   - Project URL           -> supabaseUrl
//   - anon / publishable key -> supabaseAnonKey
// Bu anahtarın sayfada görünmesi normaldir: veriler giriş + RLS kurallarıyla korunur.
// İkisi de boş bırakılırsa uygulama eski yerel modda çalışır.
window.FILO_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: ''
};
