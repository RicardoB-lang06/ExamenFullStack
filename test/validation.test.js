import assert from 'node:assert/strict';
import test from 'node:test';

import {
  validateCollectionUpdate,
  validateCredentials,
  validatePokemonSnapshot,
} from '../server/validation.js';

test('validateCredentials normaliza el correo y el nombre', () => {
  assert.deepEqual(
    validateCredentials(
      { name: '  Misty  ', email: '  MISTY@CERULEAN.GYM ', password: 'starmie-121' },
      { registration: true },
    ),
    { name: 'Misty', email: 'misty@cerulean.gym', password: 'starmie-121' },
  );
});

test('validateCredentials rechaza contraseñas cortas', () => {
  assert.throws(
    () => validateCredentials({ email: 'ash@example.com', password: 'pika' }),
    /entre 8 y 128/,
  );
});

test('validateCredentials acepta contraseñas de ocho caracteres al registrar cuentas', () => {
  assert.throws(
    () => validateCredentials(
      { name: 'Brock', email: 'brock@example.com', password: '1234567' },
      { registration: true },
    ),
    /entre 8 y 128/,
  );
  assert.doesNotThrow(() => validateCredentials(
    { name: 'Brock', email: 'brock@example.com', password: 'abcdefgh' },
    { registration: true },
  ));
});

test('validatePokemonSnapshot limita y limpia los datos persistidos', () => {
  assert.deepEqual(
    validatePokemonSnapshot({
      id: 25,
      name: ' Pikachu ',
      image: 'https://example.com/pikachu.png',
      types: ['Electric'],
    }),
    {
      pokemonId: 25,
      name: 'pikachu',
      image: 'https://example.com/pikachu.png',
      types: ['electric'],
    },
  );
});

test('validateCollectionUpdate limita una nota a 500 caracteres', () => {
  const result = validateCollectionUpdate({ note: 'a'.repeat(700), isFavorite: 1 });
  assert.equal(result.note.length, 500);
  assert.equal(result.isFavorite, true);
});
