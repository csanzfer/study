import { AppEnvironment } from './environment';

/**
 * Copia este archivo a `src/environments/environment.local.ts` (ignorado por Git)
 * y rellena las credenciales públicas de tu proyecto de Supabase.
 * Después ejecuta `npm run env:local` para activar la configuración en desarrollo.
 */
export const localEnvironment: AppEnvironment = {
  production: false,
  supabaseUrl: 'https://TU-PROYECTO.supabase.co',
  supabaseAnonKey: 'TU_SUPABASE_ANON_KEY',
};
