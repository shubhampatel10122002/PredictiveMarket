// LaunchJustice configuration.
//
// These two values are the public identity of the Supabase project. The
// publishable key is meant to be shipped in the browser: it grants nothing on
// its own, because every table is protected by row level security policies.
// Never put the service_role or secret key in this file.
//
// Leave both empty to run in local mode, where pledges and comments are saved
// in each visitor's browser and accounts are unavailable.
window.LJ_CONFIG = {
  SUPABASE_URL: "https://aghqvulngojxdkwsrcax.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_Bf3VJUz6mn-paRp_HesTIQ_olYh_K0T"
};
