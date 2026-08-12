import { HttpError } from './errors.js';

const API_BASE = 'https://pokeapi.co/api/v2';
const CACHE_TTL_MS = 10 * 60 * 1000;

function normalizePokemon(data) {
  return {
    id: data.id,
    name: data.name,
    image:
      data.sprites?.other?.['official-artwork']?.front_default ??
      data.sprites?.front_default ??
      '',
    sprite: data.sprites?.front_default ?? '',
    types: (data.types ?? []).map(({ type }) => type.name),
    height: data.height / 10,
    weight: data.weight / 10,
    abilities: (data.abilities ?? []).map(({ ability }) => ability.name),
    stats: Object.fromEntries(
      (data.stats ?? []).map(({ base_stat: value, stat }) => [stat.name, value]),
    ),
  };
}

export function createPokeApi(fetchImpl = fetch) {
  const cache = new Map();

  async function fetchJson(url) {
    const cached = cache.get(url);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    let response;
    try {
      response = await fetchImpl(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8_000),
      });
    } catch {
      throw new HttpError(
        503,
        'PokéAPI no está disponible en este momento. Inténtalo de nuevo.',
        'POKEAPI_UNAVAILABLE',
      );
    }

    if (response.status === 404) {
      throw new HttpError(404, 'No encontramos ese Pokémon.', 'POKEMON_NOT_FOUND');
    }
    if (!response.ok) {
      throw new HttpError(502, 'PokéAPI respondió con un error.', 'POKEAPI_ERROR');
    }

    const value = await response.json();
    cache.set(url, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  }

  async function getPokemon(nameOrId) {
    const normalized = String(nameOrId).trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(normalized)) {
      throw new HttpError(400, 'La búsqueda no es válida.', 'INVALID_SEARCH');
    }
    return normalizePokemon(await fetchJson(`${API_BASE}/pokemon/${normalized}`));
  }

  async function listPokemon({ page = 1, limit = 18, type = '' } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(24, Math.max(6, Number(limit) || 18));
    let count;
    let entries;

    if (type) {
      const typeData = await fetchJson(`${API_BASE}/type/${encodeURIComponent(type)}`);
      entries = typeData.pokemon.map(({ pokemon }) => pokemon);
      count = entries.length;
      entries = entries.slice((safePage - 1) * safeLimit, safePage * safeLimit);
    } else {
      const list = await fetchJson(
        `${API_BASE}/pokemon?offset=${(safePage - 1) * safeLimit}&limit=${safeLimit}`,
      );
      count = list.count;
      entries = list.results;
    }

    const items = await Promise.all(
      entries.map(({ name }) => getPokemon(name)),
    );

    return {
      items,
      page: safePage,
      pageSize: safeLimit,
      total: count,
      totalPages: Math.max(1, Math.ceil(count / safeLimit)),
    };
  }

  return { getPokemon, listPokemon };
}
