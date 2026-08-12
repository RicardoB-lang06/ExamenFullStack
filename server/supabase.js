import {
  createServerClient,
  parseCookieHeader,
  serializeCookieHeader,
} from '@supabase/ssr';

import { HttpError } from './errors.js';

const COLLECTION_COLUMNS = [
  'pokemon_id',
  'name',
  'image',
  'types',
  'note',
  'is_favorite',
  'added_at',
].join(',');

export function mapSupabaseUser(user) {
  if (!user) return null;
  const fallbackName = user.email?.split('@')[0] ?? 'Entrenador';
  return {
    id: user.id,
    name: String(user.user_metadata?.name ?? fallbackName).slice(0, 60),
    email: user.email,
    createdAt: user.created_at,
  };
}

function mapCollectionItem(row) {
  if (!row) return null;
  return {
    pokemonId: row.pokemon_id,
    name: row.name,
    image: row.image,
    types: row.types,
    note: row.note,
    isFavorite: row.is_favorite,
    addedAt: row.added_at,
  };
}

function databaseError(error) {
  const wrapped = new HttpError(
    503,
    'No fue posible acceder a la colección. Inténtalo de nuevo.',
    'DATABASE_ERROR',
  );
  wrapped.cause = error;
  return wrapped;
}

function authenticationError(error, fallbackMessage, { credentials = false } = {}) {
  if (error?.status === 429) {
    return new HttpError(
      429,
      'Demasiados intentos. Espera un momento antes de volver a intentarlo.',
      'AUTH_RATE_LIMITED',
    );
  }
  if (credentials) {
    return new HttpError(401, fallbackMessage, 'INVALID_CREDENTIALS');
  }
  if (error?.status === 400 || error?.status === 422) {
    return new HttpError(400, fallbackMessage, 'AUTH_INVALID_REQUEST');
  }
  const wrapped = new HttpError(
    503,
    'El servicio de autenticación no está disponible. Inténtalo de nuevo.',
    'AUTH_UNAVAILABLE',
  );
  wrapped.cause = error;
  return wrapped;
}

export function createSupabaseService(config) {
  if (!config.supabaseUrl || !config.supabasePublishableKey) {
    throw new Error(
      'Faltan SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY. Copia .env.example como .env.',
    );
  }

  function forRequest(request) {
    const responseCookies = [];
    const responseHeaders = {};
    const incomingCookies = parseCookieHeader(request.headers.cookie ?? '');
    const client = createServerClient(
      config.supabaseUrl,
      config.supabasePublishableKey,
      {
        cookieOptions: {
          httpOnly: true,
          sameSite: 'lax',
          secure: config.isProduction,
          path: '/',
        },
        cookies: {
          getAll() {
            return incomingCookies;
          },
          setAll(cookiesToSet, headers) {
            for (const { name, value, options } of cookiesToSet) {
              responseCookies.push(serializeCookieHeader(name, value, options));
            }
            Object.assign(responseHeaders, headers);
          },
        },
      },
    );

    async function selectCollectionItem(pokemonId) {
      const { data, error } = await client
        .from('collection')
        .select(COLLECTION_COLUMNS)
        .eq('pokemon_id', pokemonId)
        .maybeSingle();
      if (error) throw databaseError(error);
      return mapCollectionItem(data);
    }

    return {
      responseHeaders() {
        return {
          ...responseHeaders,
          ...(responseCookies.length ? { 'Set-Cookie': responseCookies } : {}),
        };
      },

      async currentUser() {
        const { data, error } = await client.auth.getUser();
        if (error || !data.user) return null;
        return mapSupabaseUser(data.user);
      },

      async register({ name, email, password }) {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        if (error) {
          throw authenticationError(error, 'No fue posible crear la cuenta.');
        }
        return {
          user: data.session ? mapSupabaseUser(data.user) : null,
          confirmationRequired: !data.session,
        };
      },

      async login({ email, password }) {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error || !data.user) {
          throw authenticationError(
            error,
            'Correo o contraseña incorrectos.',
            { credentials: true },
          );
        }
        return mapSupabaseUser(data.user);
      },

      async logout() {
        await client.auth.signOut({ scope: 'local' });
      },

      async listCollection() {
        const { data, error } = await client
          .from('collection')
          .select(COLLECTION_COLUMNS)
          .order('is_favorite', { ascending: false })
          .order('added_at', { ascending: false });
        if (error) throw databaseError(error);
        return data.map(mapCollectionItem);
      },

      findCollectionItem(pokemonId) {
        return selectCollectionItem(pokemonId);
      },

      async addCollectionItem(userId, pokemon) {
        const { data, error } = await client
          .from('collection')
          .upsert({
            user_id: userId,
            pokemon_id: pokemon.pokemonId,
            name: pokemon.name,
            image: pokemon.image,
            types: pokemon.types,
          }, { onConflict: 'user_id,pokemon_id' })
          .select(COLLECTION_COLUMNS)
          .single();
        if (error) throw databaseError(error);
        return mapCollectionItem(data);
      },

      async updateCollectionItem(pokemonId, update) {
        const { data, error } = await client
          .from('collection')
          .update({ note: update.note, is_favorite: update.isFavorite })
          .eq('pokemon_id', pokemonId)
          .select(COLLECTION_COLUMNS)
          .maybeSingle();
        if (error) throw databaseError(error);
        return mapCollectionItem(data);
      },

      async removeCollectionItem(pokemonId) {
        const { error } = await client
          .from('collection')
          .delete()
          .eq('pokemon_id', pokemonId);
        if (error) throw databaseError(error);
      },
    };
  }

  return { forRequest };
}
