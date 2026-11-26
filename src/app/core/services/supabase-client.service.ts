import { InjectionToken, Injectable, inject } from '@angular/core';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { AppEnvironment, environment } from '../../../environments/environment';

export const APP_ENVIRONMENT = new InjectionToken<AppEnvironment>('APP_ENVIRONMENT', {
  providedIn: 'root',
  factory: () => environment,
});

/**
 * Captura el indicador de invitación/recuperación de la URL antes de que
 * `@supabase/supabase-js` (`detectSessionInUrl: true`) o el Router de Angular
 * limpien el hash o los query params.
 */
function detectInitialPasswordSetupUrl(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const combined = `${window.location.hash ?? ''}&${window.location.search ?? ''}`;
  return /type=(invite|recovery)/i.test(combined);
}

const INITIAL_PASSWORD_SETUP_FROM_URL = detectInitialPasswordSetupUrl();

function normalizeSupabaseUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return '';
  }
  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
  }
}

export const SUPABASE_CLIENT = new InjectionToken<SupabaseClient | null>('SUPABASE_CLIENT', {
  providedIn: 'root',
  factory: () => {
    const env = inject(APP_ENVIRONMENT);
    const url = normalizeSupabaseUrl(env.supabaseUrl);
    const anonKey = env.supabaseAnonKey.trim();

    if (!url || !anonKey) {
      return null;
    }

    return createClient(url, anonKey, {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  },
});

@Injectable({ providedIn: 'root' })
export class SupabaseClientService {
  private readonly clientInstance = inject(SUPABASE_CLIENT);

  readonly initialUrlNeedsPasswordSetup = INITIAL_PASSWORD_SETUP_FROM_URL;

  get client(): SupabaseClient | null {
    return this.clientInstance;
  }

  get isConfigured(): boolean {
    return this.clientInstance !== null;
  }
}
