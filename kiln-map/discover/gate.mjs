// Evidence gate: the judge's firing types and "qualifies" only count when the page's own words back them.
// A type is supported only if its keyword appears in the verified quote or in the saved page text.
// A place stays "qualifies" only if the quote itself names a specific non-electric firing (not just "kiln" or "firing").
export const TYPE_RE = {
  raku: /\brak|horsehair|obvara/i,
  wood: /wood[- ]?(fire|fired|kiln|firing)|anagama|noborigama|manabigama/i,
  soda: /\bsoda\b/i,
  salt: /\bsalt[- ]?(fire|fired|glaze|glazed|kiln|firing)/i,
  pit_barrel_saggar: /\bpit[- ]?fir|barrel[- ]?fir|\bsagg?ar|smoke[- ]?fir|pit-fired/i,
  gas_reduction: /\bgas[- ](fired|kiln|firing|reduction)|reduction[- ](fir|kiln|cooled)|\bcone ?10\b|high[- ]fire reduction/i,
};
export function gate(judged, pageText) {
  const quote = judged.quote || "";
  const quoteTypes = Object.keys(TYPE_RE).filter((t) => TYPE_RE[t].test(quote));
  const pageTypes = Object.keys(TYPE_RE).filter((t) => TYPE_RE[t].test(pageText));
  const claimed = (judged.firing_types || []).filter((t) => t in TYPE_RE);
  const supported = claimed.filter((t) => pageTypes.includes(t) || quoteTypes.includes(t));
  const specific = quoteTypes.length > 0;
  let decision = judged.decision;
  let why = null;
  if (decision === "qualifies" && !specific) { decision = "unclear"; why = "quote names no specific non-electric firing"; }
  if (decision === "qualifies" && !supported.length) { decision = "unclear"; why = "no claimed firing type appears in the pages"; }
  return { decision, supported, unsupported: claimed.filter((t) => !supported.includes(t)), why };
}
