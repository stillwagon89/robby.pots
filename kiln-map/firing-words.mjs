// A quote only counts as evidence for a firing type if it actually names that type or its kiln.
export const FIRING_WORDS = {
  wood: /wood|anagama|noborigama|train kiln|train fir|bourry|groundhog|cross.?draft|stok/i,
  soda: /soda/i, salt: /salt/i, raku: /raku/i, pit_barrel_saggar: /\bpit\b|pit.fir|barrel|saggar/i,
  gas_reduction: /gas|reduction/i, electric: /electric/i, rental_service: /rent|rental|firing service/i,
  other: /\bfir(e|ed|es|ing)\b|kiln/i,
};
export const namesType = (type, quote) => !FIRING_WORDS[type] || FIRING_WORDS[type].test(quote || "");
