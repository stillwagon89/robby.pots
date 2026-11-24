// Non-electric firing words per language. A place only qualifies if its own site text matches one of these.
// Add a language by adding words here; no other change needed. Words are deliberately specific (a bare "kiln" never counts).
export const TERMS = {
  raku: /\braku\b|楽焼|ラク焼|라쿠|樂燒/i,
  wood: /wood[- ]?(fire|fired|firing|kiln)|anagama|noborigama|bourry|holzbrand|holzgebrannt|holzbrenn|holzofen|cuisson (au |à )?bois|four à bois|cottura a legna|forno a legna|horno de le[ñn]a|cocci[óo]n (con|a) le[ñn]a|forno a lenha|houtgestookt|houtstook|vedbr[äa]nd|vedfyrt|puuuuni|薪窯|薪窑|登り窯|穴窯|장작가마|柴燒/i,
  soda: /soda[- ]?(fire|fired|firing|kiln)|sodabrand|soda-?gebrannt|cuisson (à la |a la )?soude|cottura a soda/i,
  salt: /salt[- ]?(fire|fired|firing|glaze|glazed|kiln)|salzbrand|salzglasur|cuisson (au |à )?sel|salzglasiert/i,
  pit_barrel_saggar: /pit[- ]?fir|barrel[- ]?fir|\bsagg?ar|smoke[- ]?fir|grubenbrand|cuisson en fosse|cottura in buca|野焼き|노천/i,
};
export const typesIn = (text) => Object.keys(TERMS).filter((t) => TERMS[t].test(text));
export function quoteFor(type, text) {
  const sentences = text.split(/(?<=[.!?。])\s+|\n+/);
  const s = sentences.find((x) => TERMS[type].test(x) && x.length >= 20 && x.length <= 400);
  return s ? s.trim().slice(0, 300) : null;
}
