import { en }      from '../en';
import { zhHant }  from '../zh-hant';
import { zh }      from '../zh';
import { ja }      from '../ja';

function collectLeafPaths(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v !== null && typeof v === 'object'
      ? collectLeafPaths(v, `${prefix}${k}.`)
      : [`${prefix}${k}`]
  );
}

const BASE = collectLeafPaths(en);

test.each([
  ['zh-hant', zhHant],
  ['zh',      zh],
  ['ja',      ja],
])('%s has every key present in en', (_locale, dict) => {
  const keys = collectLeafPaths(dict);
  const missing = BASE.filter(k => !keys.includes(k));
  expect(missing).toHaveLength(0);
});

test.each([
  ['zh-hant', zhHant],
  ['zh',      zh],
  ['ja',      ja],
])('%s has no extra keys not in en', (_locale, dict) => {
  const keys = collectLeafPaths(dict);
  const extra = keys.filter(k => !BASE.includes(k));
  expect(extra).toHaveLength(0);
});

test.each([
  ['en',      en],
  ['zh-hant', zhHant],
  ['zh',      zh],
  ['ja',      ja],
])('%s — no empty string values', (_locale, dict) => {
  function check(obj: object) {
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string') expect(v.trim(), `key ${k}`).not.toBe('');
      else if (typeof v === 'object' && v !== null) check(v);
    }
  }
  check(dict);
});
