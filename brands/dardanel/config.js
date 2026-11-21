// Supabase bağlantı ayarları.
// Supabase panelinde: Project Settings > API (Data API) bölümünden
//   - Project URL           -> supabaseUrl
//   - publishable key (sb_publishable_...) -> supabaseAnonKey
// Bu anahtarın sayfada görünmesi normaldir: veriler giriş + RLS kurallarıyla korunur.
// İkisi de boş bırakılırsa uygulama eski yerel modda çalışır.
window.FILO_CONFIG = {
  supabaseUrl: 'https://wfqpjcidknvusdzblbim.supabase.co',
  supabaseAnonKey: 'sb_publishable_MPvtjTPNmL9svoL_yzjQJQ_-NNfW6Nv'
};
