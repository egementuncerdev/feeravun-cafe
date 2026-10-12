/* ==========================================================================
   "Ne içsem?" — kural tabanlı öneri motoru
   --------------------------------------------------------------------------
   Saf fonksiyonlar; DOM'a dokunmaz. Önerileri ayarlamak için yalnızca
   aşağıdaki WEIGHTS / PAIRING tablolarını değiştirmeniz yeterli.

   Bir içeceğin puanı = ruh hali puanı + sıcaklık puanı + tat puanı
     • Ruh hali: kafein seviyesine (ve isteğe bağlı gövde/tat eğilimine) göre
     • Sıcaklık: istenenle aynıysa ödül, değilse ceza
     • Tat:      istenenle aynıysa ödül, değilse küçük ceza
   ========================================================================== */

/** Önerilecek kategoriler (asistan yalnızca içecek önerir). */
export const DRINK_CATEGORIES = ['hot-coffee', 'cold-coffee', 'tea'];

/** Yanına önerilecek yiyecek kategorileri. */
export const FOOD_CATEGORIES = ['dessert', 'snack'];

export const WEIGHTS = {
  mood: {
    // Uykulu → kafein ne kadar yüksekse o kadar iyi
    sleepy: {
      caffeine: { high: 5, medium: 3, low: 0, none: -4 },
    },
    // Enerjik → zaten enerjin var; orta/düşük kafein ve hafif içecekler
    energetic: {
      caffeine: { high: 0, medium: 2, low: 2, none: 1 },
      body: { light: 1, filling: -1 },
    },
    // Stresli → kafeinsiz/düşük kafein öne çıkar, yüksek kafein geri düşer
    stressed: {
      caffeine: { high: -4, medium: -1, low: 3, none: 5 },
      body: { light: 1 },
    },
    // Keyifli → biraz şımartan, doyurucu ve tatlı seçimler
    cheerful: {
      caffeine: { high: 0, medium: 2, low: 1, none: 0 },
      body: { filling: 2 },
      taste: { sweet: 1 },
    },
  },
  temp: { match: 4, mismatch: -5 },
  taste: { match: 3, mismatch: -2 },
};

/** Ruh hali puanı bu değere ulaşırsa açıklamada ruh hali "eşleşti" sayılır. */
export const MOOD_FIT_THRESHOLD = 2;

/**
 * Sonuç sayısı: en az `min`, en fazla `max`. `min`'den sonraki adaylar ancak
 * ruh haline uyuyorsa ve en iyi puana `maxGapFromTop` kadar yakınsa eklenir.
 */
export const RESULT_LIMITS = { min: 2, max: 3, maxGapFromTop: 6 };

/** Yanına ne gider? Tatlı istediyse tatlılar, sade istediyse atıştırmalıklar. */
export const PAIRING = {
  category: { sweet: 'dessert', plain: 'snack' },
  taste: { match: 2 },
  temp: { match: 2 },
  mood: { cheerful: { body: { filling: 1 } }, stressed: { body: { light: 1 } } },
};

/* ------------------------------------------------------------------------ */

const sumRule = (rule, item) => {
  if (!rule) return 0;
  return (rule.caffeine?.[item.caffeine] ?? 0)
    + (rule.body?.[item.tags.body] ?? 0)
    + (rule.taste?.[item.tags.taste] ?? 0);
};

/**
 * Tek bir ürünü puanla.
 * @param {object} item     menu.json'daki ürün
 * @param {{mood: string, temp: string, taste: string}} answers
 * @returns {{score: number, matches: {mood: boolean, temp: boolean, taste: boolean}}}
 */
export function scoreItem(item, answers, weights = WEIGHTS) {
  const moodScore = sumRule(weights.mood[answers.mood], item);
  const tempMatch = item.tags.temp === answers.temp;
  const tasteMatch = item.tags.taste === answers.taste;

  const score = moodScore
    + (tempMatch ? weights.temp.match : weights.temp.mismatch)
    + (tasteMatch ? weights.taste.match : weights.taste.mismatch);

  return {
    score,
    matches: { mood: moodScore >= MOOD_FIT_THRESHOLD, temp: tempMatch, taste: tasteMatch },
  };
}

/**
 * En iyi 2-3 içeceği döndür.
 * @param {object[]} items       tüm menü ürünleri
 * @param {object}   answers     { mood, temp, taste }
 * @param {object}   [options]
 * @param {(item) => boolean} [options.allow]  ör. aktif filtreler (sütsüz vb.)
 * @returns {{item, score, matches}[]}
 */
export function recommend(items, answers, { allow = () => true, weights = WEIGHTS } = {}) {
  const ranked = items
    .filter((item) => DRINK_CATEGORIES.includes(item.category) && allow(item))
    .map((item) => ({ item, ...scoreItem(item, answers, weights) }))
    // eşit puanda: daha çok kriter tutan, sonra menü sırası
    .sort((a, b) => b.score - a.score || matchCount(b) - matchCount(a));

  if (!ranked.length) return [];
  const top = ranked[0].score;
  return ranked.filter((r, i) => i < RESULT_LIMITS.min
    || (i < RESULT_LIMITS.max && r.matches.mood && top - r.score <= RESULT_LIMITS.maxGapFromTop))
    .slice(0, RESULT_LIMITS.max);
}

const matchCount = (r) => Object.values(r.matches).filter(Boolean).length;

/**
 * İçeceğin yanına bir yiyecek öner.
 * @returns {object|null} menü ürünü
 */
export function pairFood(items, answers, { allow = () => true } = {}) {
  const category = PAIRING.category[answers.taste];
  const moodRule = PAIRING.mood[answers.mood];
  const candidates = items
    .filter((item) => item.category === category && allow(item))
    .map((item) => ({
      item,
      score: (item.tags.taste === answers.taste ? PAIRING.taste.match : 0)
        + (item.tags.temp === answers.temp ? PAIRING.temp.match : 0)
        + sumRule(moodRule, item),
    }))
    .sort((a, b) => b.score - a.score);
  return candidates[0]?.item ?? null;
}
