export interface AppEnvironment {
  production: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export const environment: AppEnvironment = {
  production: false,
  supabaseUrl: "https://fnvtuncapkthewinfses.supabase.co",
  supabaseAnonKey: "sb_publishable_G2_RBb1_9hB4V3kbXjOBPw_r32A8VxQ",
};
