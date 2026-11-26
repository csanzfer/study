export interface AppEnvironment {
  production: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

/**
 * Configuración por defecto (modo 100 % local-first).
 * En GitHub Pages se sobreescribe en build mediante scripts/write-supabase-env.mjs
 * usando las GitHub Actions Variables SUPABASE_URL y SUPABASE_ANON_KEY.
 * En desarrollo local puedes crear src/environments/environment.local.ts
 * (ignorado por Git) y ejecutar `npm run env:local`.
 */
export const environment: AppEnvironment = {
  production: false,
  supabaseUrl: '',
  supabaseAnonKey: '',
};
