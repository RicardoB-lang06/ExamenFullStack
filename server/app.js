import { createServer } from 'node:http';

import { HttpError } from './errors.js';
import { readJson, sendJson, serveStatic } from './http.js';
import { createPokeApi } from './pokeapi.js';
import { createRateLimiter } from './rate-limit.js';
import { createRecommendationService } from './recommendations.js';
import { createSupabaseService } from './supabase.js';
import {
  validateCollectionUpdate,
  validateCredentials,
  validatePokemonSnapshot,
} from './validation.js';

function routePattern(pathname, pattern) {
  const match = pathname.match(pattern);
  return match ? match.groups ?? {} : null;
}

export function createApplication(
  config,
  { fetchImpl = fetch, supabaseService, recommendationService } = {},
) {
  const supabase = supabaseService ?? createSupabaseService(config);
  const pokeApi = createPokeApi(fetchImpl);
  const recommendations = recommendationService ?? createRecommendationService();
  const authWindowMs = (config.authRateLimitWindowMinutes ?? 15) * 60 * 1_000;
  const loginIpLimiter = createRateLimiter({
    limit: config.authLoginMaxAttempts ?? 5,
    windowMs: authWindowMs,
  });
  const loginAccountLimiter = createRateLimiter({
    limit: config.authLoginMaxAttempts ?? 5,
    windowMs: authWindowMs,
  });
  const registrationLimiter = createRateLimiter({
    limit: config.authRegisterMaxAttempts ?? 3,
    windowMs: authWindowMs,
  });
  const recommendationLimiter = createRateLimiter({
    limit: config.recommendationMaxRequests ?? 3,
    windowMs: (config.recommendationWindowMinutes ?? 60) * 60 * 1_000,
  });
  async function requireUser(requestContext) {
    const user = await requestContext.currentUser();
    if (!user) {
      throw new HttpError(401, 'Inicia sesión para continuar.', 'AUTH_REQUIRED');
    }
    return user;
  }

  function clientAddress(request) {
    return request.socket.remoteAddress ?? 'unknown';
  }

  function enforceRateLimits(entries) {
    for (const [limiter, key] of entries) {
      const result = limiter.consume(key);
      if (!result.allowed) {
        throw new HttpError(
          429,
          'Demasiados intentos. Espera un momento antes de volver a intentarlo.',
          'AUTH_RATE_LIMITED',
          { 'Retry-After': String(result.retryAfterSeconds) },
        );
      }
    }
  }

  // rutas de api
  async function handleApi(request, response, url, requestContext) {
    const { method = 'GET' } = request;
    const { pathname, searchParams } = url;
    const reply = (status, payload, headers = {}) => sendJson(
      response,
      status,
      payload,
      { ...requestContext.responseHeaders(), ...headers },
    );

    if (method === 'GET' && pathname === '/api/health') {
      return reply(200, { status: 'ok', database: 'supabase-postgres' });
    }

    if (method === 'GET' && pathname === '/api/auth/me') {
      return reply(200, { user: await requestContext.currentUser() });
    }

    if (method === 'POST' && pathname === '/api/auth/register') {
      enforceRateLimits([[registrationLimiter, clientAddress(request)]]);
      const credentials = validateCredentials(await readJson(request), {
        registration: true,
      });
      const result = await requestContext.register(credentials);
      return reply(201, result);
    }

    if (method === 'POST' && pathname === '/api/auth/login') {
      const credentials = validateCredentials(await readJson(request));
      const ipAddress = clientAddress(request);
      enforceRateLimits([
        [loginIpLimiter, ipAddress],
        [loginAccountLimiter, credentials.email],
      ]);
      const user = await requestContext.login(credentials);
      loginIpLimiter.reset(ipAddress);
      loginAccountLimiter.reset(credentials.email);
      return reply(200, { user });
    }

    if (method === 'POST' && pathname === '/api/auth/logout') {
      await requestContext.logout();
      return reply(200, { success: true });
    }

    if (method === 'GET' && pathname === '/api/pokemon') {
      const query = searchParams.get('query')?.trim();
      if (query) {
        const item = await pokeApi.getPokemon(query);
        return reply(200, {
          items: [item], page: 1, pageSize: 1, total: 1, totalPages: 1,
        });
      }
      const result = await pokeApi.listPokemon({
        page: searchParams.get('page'),
        limit: searchParams.get('limit'),
        type: searchParams.get('type')?.toLowerCase(),
      });
      return reply(200, result);
    }

    const pokemonMatch = routePattern(pathname, /^\/api\/pokemon\/(?<name>[a-z0-9-]+)$/i);
    if (method === 'GET' && pokemonMatch) {
      return reply(200, {
        pokemon: await pokeApi.getPokemon(pokemonMatch.name),
      });
    }

    if (method === 'GET' && pathname === '/api/collection') {
      await requireUser(requestContext);
      const items = await requestContext.listCollection();
      const typeCounts = items.flatMap((item) => item.types).reduce((counts, type) => {
        counts[type] = (counts[type] ?? 0) + 1;
        return counts;
      }, {});
      return reply(200, {
        items,
        summary: {
          total: items.length,
          favorites: items.filter((item) => item.isFavorite).length,
          typeCounts,
        },
      });
    }

    if (method === 'POST' && pathname === '/api/recommendations') {
      const user = await requireUser(requestContext);
      const items = await requestContext.listCollection();
      if (!items.length) {
        throw new HttpError(
          400,
          'Agrega al menos un Pokémon antes de solicitar un análisis.',
          'EMPTY_COLLECTION',
        );
      }
      enforceRateLimits([[recommendationLimiter, user.id]]);
      const insights = recommendations.generate(items);
      const ownedPokemon = new Set(items.map((item) => item.name.toLowerCase()));
      const verifiedRecommendations = await Promise.allSettled(
        insights.recommendations
          .filter((recommendation) => !ownedPokemon.has(recommendation.name))
          .map(async (recommendation) => {
            const pokemon = await pokeApi.getPokemon(recommendation.name);
            return {
              ...recommendation,
              pokemonId: pokemon.id,
              name: pokemon.name,
              image: pokemon.image,
              types: pokemon.types,
            };
          }),
      );
      return reply(200, {
        insights: {
          ...insights,
          recommendations: verifiedRecommendations
            .filter((result) => result.status === 'fulfilled')
            .map((result) => result.value),
        },
      });
    }

    // cambios de colección
    const collectionMatch = routePattern(
      pathname,
      /^\/api\/collection\/(?<pokemonId>\d+)$/,
    );
    if (collectionMatch) {
      const user = await requireUser(requestContext);
      const pokemonId = Number(collectionMatch.pokemonId);

      if (method === 'POST') {
        const submittedPokemon = validatePokemonSnapshot(await readJson(request));
        if (submittedPokemon.pokemonId !== pokemonId) {
          throw new HttpError(400, 'El identificador del Pokémon no coincide.');
        }
        const canonicalPokemon = await pokeApi.getPokemon(pokemonId);
        const pokemon = {
          pokemonId: canonicalPokemon.id,
          name: canonicalPokemon.name,
          image: canonicalPokemon.image,
          types: canonicalPokemon.types,
        };
        return reply(201, {
          item: await requestContext.addCollectionItem(user.id, pokemon),
        });
      }

      if (method === 'PATCH') {
        if (!(await requestContext.findCollectionItem(pokemonId))) {
          throw new HttpError(404, 'Ese Pokémon no está en tu colección.');
        }
        const update = validateCollectionUpdate(await readJson(request));
        return reply(200, {
          item: await requestContext.updateCollectionItem(pokemonId, update),
        });
      }

      if (method === 'DELETE') {
        await requestContext.removeCollectionItem(pokemonId);
        return reply(200, { success: true });
      }
    }

    throw new HttpError(404, 'Ruta no encontrada.', 'NOT_FOUND');
  }

  const server = createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
    let requestContext;
    try {
      response.setHeader('X-Frame-Options', 'DENY');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
      if (config.isProduction) {
        response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      }
      response.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; img-src 'self' https://raw.githubusercontent.com data:; style-src 'self'; script-src 'self'; connect-src 'self'",
      );

      if (url.pathname.startsWith('/api/')) {
        requestContext = supabase.forRequest(request);
        await handleApi(request, response, url, requestContext);
        return;
      }

      if (await serveStatic(response, config.publicPath, url.pathname)) return;
      if (request.method === 'GET') {
        await serveStatic(response, config.publicPath, '/');
        return;
      }
      throw new HttpError(404, 'Ruta no encontrada.', 'NOT_FOUND');
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      if (!(error instanceof HttpError) || error.cause) {
        console.error(error.cause ?? error);
      }
      sendJson(response, status, {
        error: {
          code: error.code ?? 'INTERNAL_ERROR',
          message: status === 500 ? 'Ocurrió un error inesperado.' : error.message,
        },
      }, {
        ...(requestContext?.responseHeaders() ?? {}),
        ...(error instanceof HttpError ? error.headers : {}),
      });
    }
  });

  return {
    server,
    close() {
      return new Promise((resolve, reject) => {
        server.close((error) => {
          error ? reject(error) : resolve();
        });
      });
    },
  };
}
