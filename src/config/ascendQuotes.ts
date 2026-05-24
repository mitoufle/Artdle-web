/**
 * Spinoza-leaning quotes shown on the post-gate blackout overlay.
 * One is picked at random each ascend.
 */
export const ASCEND_QUOTES: readonly string[] = [
  "The highest activity a human being can attain is learning for understanding, because to understand is to be free.",
  "The more you struggle to live, the less you live. Give up the notion that you must be sure of what you are doing. Instead, surrender to what is real within you, for that alone is sure... you are above everything distressing.",
  "No matter how thin you slice it, there will always be two sides.",
  "If you want the present to be different from the past, study the past.",
  "Everything excellent is as difficult as it is rare.",
  "I have made a ceaseless effort not to ridicule, not to bewail, not to scorn human actions, but to understand them.",
  "The more clearly you understand yourself and your emotions, the more you become a lover of what is.",
  "Peace is not the absence of war, it is a virtue, a state of mind, a disposition of benevolence, confidence, justice.",
  "When a man is prey to his emotions, he is not his own master.",
  "What Paul says about Peter tells us more about Paul than about Peter.",
  "In so far as the mind sees things in their eternal aspect, it participates in eternity.",
  "The endeavor to understand is the first and only basis of virtue.",
  "Pride is pleasure arising from a man's thinking too highly of himself.",
  "A free man thinks of nothing less than of death, and his wisdom is a meditation, not on death, but on life.",
];

export function pickRandomAscendQuote(rng: () => number = Math.random): string {
  const i = Math.floor(rng() * ASCEND_QUOTES.length);
  return ASCEND_QUOTES[i] ?? ASCEND_QUOTES[0]!;
}
