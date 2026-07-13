/**
 * Inject a fake Supabase session into localStorage so cart page shows the form
 * without a real Supabase connection.
 *
 * Supabase JS v2 reads the session from localStorage at key
 * `sb-{projectRef}-auth-token`. If expires_at is in the future and the
 * session object is valid-shaped, getSession() returns it without a network call.
 */
export async function injectFakeSession(page) {
  await page.addInitScript(() => {
    const PROJECT_REF = 'fwjuoozfqzbpfllgudyk';
    const STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;
    const fakeSession = {
      access_token: 'fake-access-token-for-testing',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: 'fake-refresh-token',
      user: {
        id: '00000000-0000-0000-0000-000000000001',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'test@example.com',
        email_confirmed_at: '2024-01-01T00:00:00Z',
        user_metadata: { full_name: 'Test User' },
        created_at: '2024-01-01T00:00:00Z',
      },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fakeSession));
  });

  // Intercept any Supabase auth network calls so they don't fail with 401
  await page.route('**/auth/v1/**', async route => {
    const url = route.request().url();
    if (url.includes('/auth/v1/user')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '00000000-0000-0000-0000-000000000001',
          aud: 'authenticated',
          email: 'test@example.com',
          email_confirmed_at: '2024-01-01T00:00:00Z',
          user_metadata: { full_name: 'Test User' },
        }),
      });
    } else if (url.includes('/auth/v1/token')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'fake-access-token-for-testing',
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          refresh_token: 'fake-refresh-token',
          user: {
            id: '00000000-0000-0000-0000-000000000001',
            email: 'test@example.com',
            user_metadata: { full_name: 'Test User' },
          },
        }),
      });
    } else {
      await route.continue();
    }
  });
}
