import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { SupabaseClientService } from './supabase-client.service';

export interface AuthActionResult {
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class SupabaseAuthService {
  private readonly supabase = inject(SupabaseClientService);
  private readonly destroyRef = inject(DestroyRef);

  readonly isConfigured = signal(this.supabase.isConfigured);
  readonly session = signal<Session | null>(null);
  readonly user = computed<User | null>(() => this.session()?.user ?? null);
  readonly userId = computed<string | null>(() => this.user()?.id ?? null);
  readonly userEmail = computed<string | null>(() => this.user()?.email ?? null);
  readonly isAuthenticated = computed(() => this.user() !== null);
  readonly initialized = signal(false);
  readonly loading = signal(false);
  readonly needsPasswordSetup = signal(false);

  private initPromise: Promise<void> | null = null;
  private authStateListeners: Array<(event: AuthChangeEvent, session: Session | null) => void> = [];

  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.runInitialize();
    return this.initPromise;
  }

  onAuthEvent(listener: (event: AuthChangeEvent, session: Session | null) => void): () => void {
    this.authStateListeners.push(listener);
    return () => {
      this.authStateListeners = this.authStateListeners.filter((item) => item !== listener);
    };
  }

  async signInWithPassword(email: string, password: string): Promise<AuthActionResult> {
    const client = this.supabase.client;
    if (!client) {
      return { error: 'La sincronización en la nube no está configurada en este entorno.' };
    }

    this.loading.set(true);
    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return { error: this.mapAuthError(error.message) };
      }

      this.session.set(data.session ?? null);
      return { error: null };
    } catch {
      return { error: 'No se pudo conectar con el servidor de autenticación.' };
    } finally {
      this.loading.set(false);
    }
  }

  async sendPasswordResetEmail(email: string): Promise<AuthActionResult> {
    const client = this.supabase.client;
    if (!client) {
      return { error: 'La sincronización en la nube no está configurada en este entorno.' };
    }

    this.loading.set(true);
    try {
      const redirectTo = this.buildRedirectUrl();
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });

      if (error) {
        return { error: this.mapAuthError(error.message) };
      }

      return { error: null };
    } catch {
      return { error: 'No se pudo enviar el correo de recuperación.' };
    } finally {
      this.loading.set(false);
    }
  }

  async updatePassword(newPassword: string): Promise<AuthActionResult> {
    const client = this.supabase.client;
    if (!client) {
      return { error: 'La sincronización en la nube no está configurada en este entorno.' };
    }

    this.loading.set(true);
    try {
      const { error } = await client.auth.updateUser({ password: newPassword });
      if (error) {
        return { error: this.mapAuthError(error.message) };
      }

      this.needsPasswordSetup.set(false);
      return { error: null };
    } catch {
      return { error: 'No se pudo actualizar la contraseña.' };
    } finally {
      this.loading.set(false);
    }
  }

  async signOut(): Promise<AuthActionResult> {
    const client = this.supabase.client;
    if (!client) {
      this.session.set(null);
      return { error: null };
    }

    this.loading.set(true);
    try {
      const { error } = await client.auth.signOut();
      this.session.set(null);
      this.needsPasswordSetup.set(false);
      if (error) {
        return { error: this.mapAuthError(error.message) };
      }
      return { error: null };
    } catch {
      this.session.set(null);
      this.needsPasswordSetup.set(false);
      return { error: null };
    } finally {
      this.loading.set(false);
    }
  }

  dismissPasswordSetup(): void {
    this.needsPasswordSetup.set(false);
  }

  private async runInitialize(): Promise<void> {
    const client = this.supabase.client;
    if (!client) {
      this.initialized.set(true);
      return;
    }

    try {
      // Detecta si la URL de aterrizaje proviene de una invitación o recuperación de contraseña
      // (capturado antes de que createClient o Angular Router limpien el hash/query)
      if (this.supabase.initialUrlNeedsPasswordSetup) {
        this.needsPasswordSetup.set(true);
      } else if (typeof window !== 'undefined') {
        const combined = `${window.location.hash ?? ''}&${window.location.search ?? ''}`;
        if (/type=(invite|recovery)/i.test(combined)) {
          this.needsPasswordSetup.set(true);
        }
      }

      const { data } = await client.auth.getSession();
      this.session.set(data.session ?? null);

      const { data: subscriptionData } = client.auth.onAuthStateChange((event, nextSession) => {
        this.session.set(nextSession ?? null);

        if (event === 'PASSWORD_RECOVERY') {
          this.needsPasswordSetup.set(true);
        }

        for (const listener of this.authStateListeners) {
          listener(event, nextSession ?? null);
        }
      });

      this.destroyRef.onDestroy(() => {
        subscriptionData.subscription.unsubscribe();
      });
    } catch {
      // En modo offline o error de red inicial, no bloqueamos el arranque local-first
      this.session.set(null);
    } finally {
      this.initialized.set(true);
    }
  }

  private buildRedirectUrl(): string | undefined {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const baseHref = document.querySelector('base')?.getAttribute('href') ?? '/';
    const normalizedBase = baseHref.startsWith('/') ? baseHref : `/${baseHref}`;
    return `${window.location.origin}${normalizedBase}`;
  }

  private mapAuthError(rawMessage: string): string {
    const normalized = rawMessage.toLowerCase();
    if (normalized.includes('invalid login credentials')) {
      return 'Correo o contraseña incorrectos.';
    }
    if (normalized.includes('email not confirmed')) {
      return 'Debes confirmar tu correo antes de iniciar sesión.';
    }
    if (normalized.includes('password should be at least')) {
      return 'La contraseña debe tener al menos 6 caracteres.';
    }
    if (normalized.includes('rate limit') || normalized.includes('too many requests')) {
      return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';
    }
    if (normalized.includes('network') || normalized.includes('failed to fetch')) {
      return 'Sin conexión con el servidor. Puedes seguir estudiando en modo offline.';
    }
    return rawMessage;
  }
}
