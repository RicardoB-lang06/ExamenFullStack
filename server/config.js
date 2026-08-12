import path from 'node:path';
import { loadEnvFile } from 'node:process';

const projectRoot = path.resolve(import.meta.dirname, '..');

export function loadConfig(overrides = {}) {
  try {
    loadEnvFile(path.resolve(projectRoot, '.env'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  return {
    port: Number(overrides.port ?? process.env.PORT ?? 3000),
    supabaseUrl: overrides.supabaseUrl ?? process.env.SUPABASE_URL,
    supabasePublishableKey:
      overrides.supabasePublishableKey ?? process.env.SUPABASE_PUBLISHABLE_KEY,
    publicPath: path.resolve(projectRoot, 'public'),
    authRateLimitWindowMinutes: Number(
      overrides.authRateLimitWindowMinutes
        ?? process.env.AUTH_RATE_LIMIT_WINDOW_MINUTES
        ?? 15,
    ),
    authLoginMaxAttempts: Number(
      overrides.authLoginMaxAttempts ?? process.env.AUTH_LOGIN_MAX_ATTEMPTS ?? 5,
    ),
    authRegisterMaxAttempts: Number(
      overrides.authRegisterMaxAttempts ?? process.env.AUTH_REGISTER_MAX_ATTEMPTS ?? 3,
    ),
    recommendationWindowMinutes: Number(
      overrides.recommendationWindowMinutes
        ?? process.env.RECOMMENDATION_WINDOW_MINUTES
        ?? 60,
    ),
    recommendationMaxRequests: Number(
      overrides.recommendationMaxRequests ?? process.env.RECOMMENDATION_MAX_REQUESTS ?? 3,
    ),
    isProduction:
      overrides.isProduction ?? process.env.NODE_ENV === 'production',
  };
}
