const TYPE_LABELS = {
  bug: 'bicho', dark: 'siniestro', dragon: 'dragón', electric: 'eléctrico',
  fairy: 'hada', fighting: 'lucha', fire: 'fuego', flying: 'volador',
  ghost: 'fantasma', grass: 'planta', ground: 'tierra', ice: 'hielo',
  normal: 'normal', poison: 'veneno', psychic: 'psíquico', rock: 'roca',
  steel: 'acero', water: 'agua',
};

// opciones sugeridas
const RECOMMENDATION_POOL = [
  ['fire', 'arcanine'], ['water', 'lapras'], ['electric', 'ampharos'],
  ['grass', 'roserade'], ['psychic', 'gardevoir'], ['fighting', 'lucario'],
  ['ground', 'garchomp'], ['rock', 'tyranitar'], ['ghost', 'mimikyu'],
  ['ice', 'mamoswine'], ['dragon', 'dragapult'], ['dark', 'umbreon'],
  ['steel', 'metagross'], ['fairy', 'togekiss'], ['flying', 'corviknight'],
  ['bug', 'scizor'], ['poison', 'toxtricity'], ['normal', 'snorlax'],
];

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

// busca tipos faltantes
export function createCollectionInsights(items) {
  const typeCounts = new Map();
  const ownedNames = new Set();

  for (const item of items.slice(0, 100)) {
    ownedNames.add(cleanText(item.name, 60).toLowerCase());
    for (const type of item.types ?? []) {
      if (TYPE_LABELS[type]) typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
    }
  }

  const presentTypes = [...typeCounts.keys()];
  const topTypes = [...typeCounts.entries()]
    .sort(([, left], [, right]) => right - left)
    .slice(0, 2);
  const missingTypes = RECOMMENDATION_POOL
    .map(([type]) => type)
    .filter((type, index, types) => !typeCounts.has(type) && types.indexOf(type) === index);
  const candidates = [...RECOMMENDATION_POOL]
    .sort(([left], [right]) => Number(typeCounts.has(left)) - Number(typeCounts.has(right)))
    .filter(([, name]) => !ownedNames.has(name))
    .slice(0, 3);

  return {
    overview: `Tu colección tiene ${items.length} Pokémon y cubre ${presentTypes.length} tipo${presentTypes.length === 1 ? '' : 's'} diferente${presentTypes.length === 1 ? '' : 's'}.`,
    strengths: [
      ...topTypes.map(([type, count]) => `${TYPE_LABELS[type]} es el tipo con mayor presencia (${count} Pokémon).`),
      `Ya reúnes ${presentTypes.length} tipo${presentTypes.length === 1 ? '' : 's'} en tu colección.`,
    ].slice(0, 3),
    gaps: missingTypes.length
      ? missingTypes.slice(0, 3).map((type) => `Aún no tienes Pokémon de tipo ${TYPE_LABELS[type]}.`)
      : ['Tu colección ya cubre los tipos principales; puedes buscar variantes con roles diferentes.'],
    recommendations: candidates.map(([type, name]) => ({
      name,
      suggestedType: type,
      reason: typeCounts.has(type)
        ? `Suma una alternativa de tipo ${TYPE_LABELS[type]} para diversificar tu equipo.`
        : `Añade cobertura de tipo ${TYPE_LABELS[type]}, que todavía no aparece en tu colección.`,
    })),
    generatedAt: new Date().toISOString(),
  };
}

export function createRecommendationService() {
  return {
    generate(items) {
      return createCollectionInsights(items);
    },
  };
}
