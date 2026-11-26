import { TestBed } from '@angular/core/testing';
import { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { SupabaseAuthService } from './supabase-auth.service';
import { SUPABASE_CLIENT } from './supabase-client.service';

describe('SupabaseAuthService', () => {
  it('runs cleanly in local-only mode when SUPABASE_CLIENT is null', async () => {
    TestBed.configureTestingModule({
      providers: [{ provide: SUPABASE_CLIENT, useValue: null }],
    });

    const service = TestBed.inject(SupabaseAuthService);
    await service.initialize();

    expect(service.isConfigured()).toBe(false);
    expect(service.initialized()).toBe(true);
    expect(service.isAuthenticated()).toBe(false);

    const loginRes = await service.signInWithPassword('user@example.com', 'secret');
    expect(loginRes.error).toContain('no está configurada');
  });

  it('signs in, maps invalid credentials error, updates password and signs out with a mocked client', async () => {
    const unsubscribe = vi.fn();
    const authCallbacks: Array<(event: string, session: unknown) => void> = [];

    const mockSession = {
      user: { id: 'user-123', email: 'student@example.com' },
    };

    const mockClient = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: vi.fn().mockImplementation((cb) => {
          authCallbacks.push(cb);
          return { data: { subscription: { unsubscribe } } };
        }),
        signInWithPassword: vi
          .fn()
          .mockResolvedValueOnce({
            data: { session: null },
            error: { message: 'Invalid login credentials' },
          })
          .mockResolvedValueOnce({
            data: { session: mockSession },
            error: null,
          }),
        updateUser: vi.fn().mockResolvedValue({ error: null }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
    } as unknown as SupabaseClient;

    TestBed.configureTestingModule({
      providers: [{ provide: SUPABASE_CLIENT, useValue: mockClient }],
    });

    const service = TestBed.inject(SupabaseAuthService);
    await service.initialize();

    expect(service.isConfigured()).toBe(true);
    expect(service.isAuthenticated()).toBe(false);

    const failed = await service.signInWithPassword('student@example.com', 'wrong');
    expect(failed.error).toBe('Correo o contraseña incorrectos.');

    const ok = await service.signInWithPassword('student@example.com', 'correct');
    expect(ok.error).toBeNull();
    expect(service.isAuthenticated()).toBe(true);
    expect(service.userEmail()).toBe('student@example.com');

    // Simula evento de recuperación / invitación
    authCallbacks.forEach((cb) => cb('PASSWORD_RECOVERY', mockSession));
    expect(service.needsPasswordSetup()).toBe(true);

    const updated = await service.updatePassword('new-secure-password');
    expect(updated.error).toBeNull();
    expect(service.needsPasswordSetup()).toBe(false);

    await service.signOut();
    expect(service.isAuthenticated()).toBe(false);
  });
});
