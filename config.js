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
  SUPABASE_ANON_KEY: "sb_publishable_Bf3VJUz6mn-paRp_HesTIQ_olYh_K0T",

  // Whether to offer "Continue with Google" on the sign-in sheet.
  //
  // This has to match the Supabase project, because the button cannot discover
  // on its own whether the provider is switched on. Asking Supabase for a
  // Google redirect while the provider is off answers 400 "provider is not
  // enabled", which reaches the person as a dead button, so the button is
  // simply not drawn until the provider exists.
  //
  // To switch it on: create an OAuth client in Google Cloud Console, add
  // https://aghqvulngojxdkwsrcax.supabase.co/auth/v1/callback to its
  // authorised redirect URIs, paste the client ID and secret into Supabase
  // under Authentication -> Providers -> Google, then set this to true.
  // The sign-in code itself is already written and needs no changes.
  GOOGLE_SIGN_IN: false
};
