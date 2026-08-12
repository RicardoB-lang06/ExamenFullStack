import { HttpError } from './errors.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export function validateCredentials(input, { registration = false } = {}) {
  const email = cleanText(input?.email, 160).toLowerCase();
  const password = typeof input?.password === 'string' ? input.password : '';
  const name = cleanText(input?.name, 60);

  if (!EMAIL_PATTERN.test(email)) {
    throw new HttpError(400, 'Escribe un correo electrónico válido.', 'INVALID_EMAIL');
  }
  const minimumLength = 8;
  if (password.length < minimumLength || password.length > 128) {
    throw new HttpError(
      400,
      `La contraseña debe tener entre ${minimumLength} y 128 caracteres.`,
      'INVALID_PASSWORD',
    );
  }
  if (registration && name.length < 2) {
    throw new HttpError(400, 'El nombre debe tener al menos 2 caracteres.', 'INVALID_NAME');
  }

  return { email, password, name };
}

export function validatePokemonSnapshot(input) {
  const pokemonId = Number(input?.id);
  const name = cleanText(input?.name, 60).toLowerCase();
  const image = cleanText(input?.image, 500);
  const types = Array.isArray(input?.types)
    ? input.types.map((type) => cleanText(type, 30).toLowerCase()).filter(Boolean).slice(0, 3)
    : [];

  if (!Number.isInteger(pokemonId) || pokemonId < 1 || !name || !types.length) {
    throw new HttpError(400, 'Los datos del Pokémon no son válidos.', 'INVALID_POKEMON');
  }

  return { pokemonId, name, image, types };
}

export function validateCollectionUpdate(input) {
  return {
    note: cleanText(input?.note, 500),
    isFavorite: Boolean(input?.isFavorite),
  };
}
