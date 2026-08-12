import assert from 'node:assert/strict';
import test from 'node:test';

import { createSupabaseService, mapSupabaseUser } from '../server/supabase.js';

test('mapSupabaseUser expone solo los datos públicos necesarios', () => {
  assert.deepEqual(mapSupabaseUser({
    id: 'user-id',
    email: 'misty@cerulean.gym',
    created_at: '2026-08-11T00:00:00.000Z',
    user_metadata: { name: 'Misty', role: 'admin-no-confiable' },
  }), {
    id: 'user-id',
    name: 'Misty',
    email: 'misty@cerulean.gym',
    createdAt: '2026-08-11T00:00:00.000Z',
  });
});

test('createSupabaseService exige configuración explícita', () => {
  assert.throws(
    () => createSupabaseService({}),
    /SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY/,
  );
});
