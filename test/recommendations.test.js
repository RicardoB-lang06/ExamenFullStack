import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createCollectionInsights,
  createRecommendationService,
} from '../server/recommendations.js';

test('las sugerencias funcionan sin claves o servicios adicionales', () => {
  const service = createRecommendationService();
  const result = service.generate([
    { pokemonId: 25, name: 'pikachu', types: ['electric'] },
  ]);

  assert.match(result.overview, /1 Pokémon/);
  assert.equal(result.recommendations.length, 3);
  assert.ok(result.generatedAt);
});

test('las reglas priorizan tipos que no están en la colección', () => {
  const result = createCollectionInsights([
    { pokemonId: 25, name: 'pikachu', types: ['electric'] },
  ]);

  assert.equal(result.recommendations[0].suggestedType, 'fire');
  assert.ok(result.gaps.some((gap) => gap.includes('fuego')));
});

test('las sugerencias nunca repiten un Pokémon ya guardado', () => {
  const result = createCollectionInsights([
    { pokemonId: 59, name: 'arcanine', types: ['fire'] },
    { pokemonId: 25, name: 'pikachu', types: ['electric'] },
  ]);

  assert.ok(result.recommendations.every(({ name }) => name !== 'arcanine'));
});
