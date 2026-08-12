import assert from 'node:assert/strict';
import test from 'node:test';

import { createApplication } from '../server/app.js';
import { HttpError } from '../server/errors.js';

const pikachu = {
  id: 25,
  name: 'pikachu',
  height: 4,
  weight: 60,
  sprites: {
    front_default: 'https://raw.githubusercontent.com/pikachu.png',
    other: { 'official-artwork': { front_default: 'https://raw.githubusercontent.com/pikachu-art.png' } },
  },
  types: [{ type: { name: 'electric' } }],
  abilities: [{ ability: { name: 'static' } }],
  stats: [{ base_stat: 35, stat: { name: 'hp' } }],
};

const bulbasaur = {
  ...pikachu,
  id: 1,
  name: 'bulbasaur',
  sprites: {
    front_default: 'https://raw.githubusercontent.com/bulbasaur.png',
    other: { 'official-artwork': { front_default: 'https://raw.githubusercontent.com/bulbasaur-art.png' } },
  },
  types: [{ type: { name: 'grass' } }, { type: { name: 'poison' } }],
};

function mockFetch(url) {
  if (String(url).endsWith('/pokemon/25') || String(url).endsWith('/pokemon/pikachu')) {
    return Promise.resolve(new Response(JSON.stringify(pikachu), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
  }
  if (String(url).endsWith('/pokemon/1') || String(url).endsWith('/pokemon/bulbasaur')) {
    return Promise.resolve(new Response(JSON.stringify(bulbasaur), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
  }
  return Promise.resolve(new Response(JSON.stringify({ count: 1, results: [{ name: 'pikachu' }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }));
}

function createFakeSupabaseService() {
  const sessions = new Map();
  const users = new Map();
  const collection = new Map();
  let nextUserId = 1;

  return {
    forRequest(request) {
      const token = request.headers.cookie?.match(/fake_session=([^;]+)/)?.[1];
      const responseHeaders = {};
      const currentUser = () => sessions.get(token) ?? null;

      return {
        responseHeaders: () => responseHeaders,
        currentUser,
        async register(credentials) {
          const user = {
            id: String(nextUserId++),
            name: credentials.name,
            email: credentials.email,
            createdAt: new Date().toISOString(),
          };
          users.set(credentials.email, { ...user, password: credentials.password });
          const sessionToken = `token-${user.id}`;
          sessions.set(sessionToken, user);
          responseHeaders['Set-Cookie'] = `fake_session=${sessionToken}; HttpOnly; SameSite=Lax`;
          return { user, confirmationRequired: false };
        },
        async login(credentials) {
          const record = users.get(credentials.email);
          if (!record || record.password !== credentials.password) {
            throw new HttpError(401, 'Correo o contraseña incorrectos.', 'INVALID_CREDENTIALS');
          }
          return record;
        },
        async logout() {
          responseHeaders['Set-Cookie'] = 'fake_session=; Max-Age=0';
        },
        async listCollection() {
          return [...collection.values()];
        },
        async findCollectionItem(pokemonId) {
          return collection.get(pokemonId) ?? null;
        },
        async addCollectionItem(_userId, pokemon) {
          const item = {
            ...pokemon,
            note: '',
            isFavorite: false,
            addedAt: new Date().toISOString(),
          };
          collection.set(pokemon.pokemonId, item);
          return item;
        },
        async updateCollectionItem(pokemonId, update) {
          const item = { ...collection.get(pokemonId), ...update };
          collection.set(pokemonId, item);
          return item;
        },
        async removeCollectionItem(pokemonId) {
          collection.delete(pokemonId);
        },
      };
    },
  };
}

async function startTestApp({ recommendationService, config = {} } = {}) {
  const application = createApplication({
    publicPath: new URL('../public', import.meta.url).pathname,
    isProduction: false,
    ...config,
  }, { fetchImpl: mockFetch, supabaseService: createFakeSupabaseService(), recommendationService });
  await new Promise((resolve) => application.server.listen(0, '127.0.0.1', resolve));
  const address = application.server.address();
  return { application, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function postJson(url, body) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('flujo de autenticación y colección', async (context) => {
  const { application, baseUrl } = await startTestApp();
  context.after(() => application.close());

  const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Ash', email: 'ash@kanto.test', password: 'pikachu-25' }),
  });
  assert.equal(registerResponse.status, 201);
  const cookie = registerResponse.headers.get('set-cookie').split(';')[0];

  const meResponse = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookie } });
  assert.equal((await meResponse.json()).user.email, 'ash@kanto.test');

  const pokemonResponse = await fetch(`${baseUrl}/api/pokemon/25`);
  const pokemon = (await pokemonResponse.json()).pokemon;
  assert.equal(pokemon.name, 'pikachu');
  assert.deepEqual(pokemon.types, ['electric']);

  const addResponse = await fetch(`${baseUrl}/api/collection/25`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(pokemon),
  });
  assert.equal(addResponse.status, 201);

  const updateResponse = await fetch(`${baseUrl}/api/collection/25`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ note: 'Mi compañero inicial', isFavorite: true }),
  });
  assert.equal(updateResponse.status, 200);

  const collectionResponse = await fetch(`${baseUrl}/api/collection`, { headers: { Cookie: cookie } });
  const collection = await collectionResponse.json();
  assert.equal(collection.summary.total, 1);
  assert.equal(collection.summary.favorites, 1);
  assert.equal(collection.items[0].note, 'Mi compañero inicial');
});

test('las rutas de colección requieren autenticación', async (context) => {
  const { application, baseUrl } = await startTestApp();
  context.after(() => application.close());
  const response = await fetch(`${baseUrl}/api/collection`);
  assert.equal(response.status, 401);
});

test('las sugerencias requieren sesión y se verifican con PokéAPI', async (context) => {
  const recommendationService = {
    generate(items) {
      assert.equal(items[0].name, 'pikachu');
      return {
        overview: 'Equipo con una base eléctrica.',
        strengths: ['Velocidad.'],
        gaps: ['Cobertura de planta.'],
        recommendations: [
          { name: 'bulbasaur', reason: 'Aporta planta y veneno.', suggestedType: 'grass' },
        ],
        generatedAt: '2026-08-11T00:00:00.000Z',
      };
    },
  };
  const { application, baseUrl } = await startTestApp({
    recommendationService,
    config: { recommendationMaxRequests: 1, recommendationWindowMinutes: 60 },
  });
  context.after(() => application.close());

  assert.equal((await fetch(`${baseUrl}/api/recommendations`, { method: 'POST' })).status, 401);
  const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Ash', email: 'ash-recommendation@kanto.test', password: 'pikachu-25' }),
  });
  const cookie = registerResponse.headers.get('set-cookie').split(';')[0];
  await fetch(`${baseUrl}/api/collection/25`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      id: 25,
      name: 'pikachu',
      image: 'https://raw.githubusercontent.com/pikachu-art.png',
      types: ['electric'],
    }),
  });

  const response = await fetch(`${baseUrl}/api/recommendations`, {
    method: 'POST',
    headers: { Cookie: cookie },
  });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.insights.recommendations[0].pokemonId, 1);
  assert.deepEqual(payload.insights.recommendations[0].types, ['grass', 'poison']);

  const limitedResponse = await fetch(`${baseUrl}/api/recommendations`, {
    method: 'POST',
    headers: { Cookie: cookie },
  });
  assert.equal(limitedResponse.status, 429);
  assert.ok(Number(limitedResponse.headers.get('retry-after')) > 0);
});

test('el registro exige JSON y agrega cabeceras de seguridad', async (context) => {
  const { application, baseUrl } = await startTestApp();
  context.after(() => application.close());

  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    body: 'name=Ash',
  });
  assert.equal(response.status, 415);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.match(response.headers.get('permissions-policy'), /camera=\(\)/);
});

test('el inicio de sesión limita intentos repetidos', async (context) => {
  const application = createApplication({
    publicPath: new URL('../public', import.meta.url).pathname,
    authRateLimitWindowMinutes: 15,
    authLoginMaxAttempts: 2,
    authRegisterMaxAttempts: 3,
    isProduction: false,
  }, { fetchImpl: mockFetch, supabaseService: createFakeSupabaseService() });
  await new Promise((resolve) => application.server.listen(0, '127.0.0.1', resolve));
  context.after(() => application.close());
  const { port } = application.server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const credentials = { email: 'missing@example.com', password: 'incorrecta-95' };

  assert.equal((await postJson(`${baseUrl}/api/auth/login`, credentials)).status, 401);
  assert.equal((await postJson(`${baseUrl}/api/auth/login`, credentials)).status, 401);
  const limited = await postJson(`${baseUrl}/api/auth/login`, credentials);
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
});
