export type LyricScores = {
  hookStrength: number;
  rhymeDensity: number;
  punchlines: number;
  storytelling: number;
  emotionalImpact: number;
  cadenceVariation: number;
  imagery: number;
  originality: number;
  replayValue: number;
  overall: number;
};

export type LyricAnalysis = {
  scores: LyricScores;
  strengths: string[];
  improvements: string[];
  signals: { lines: number; words: number; repeatedEndWords: string[]; sectionCount: number };
};

const filler = ["in my feelings", "heart on my sleeve", "ride or die", "pain in my heart", "love is blind", "came from nothing"];
const imageryWords = ["room", "street", "door", "mirror", "light", "dark", "rain", "smoke", "bed", "phone", "car", "city", "eyes", "blood", "fire"];
const emotionWords = ["hurt", "pain", "love", "hate", "miss", "alone", "trust", "betray", "cry", "fear", "proud", "sorry", "need"];

const clamp = (value: number) => Math.max(0, Math.min(10, Math.round(value * 10) / 10));

export function analyzeLyrics(text: string): LyricAnalysis {
  const clean = text.trim();
  const lines = clean.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const lyricLines = lines.filter((line) => !/^\[[^\]]+\]$/.test(line));
  const words = clean.toLowerCase().match(/[a-z0-9']+/g) || [];
  const unique = new Set(words);
  const sections = lines.filter((line) => /^\[[^\]]+\]$/.test(line));
  const endWords = lyricLines.map((line) => (line.toLowerCase().match(/([a-z']+)[^a-z']*$/)?.[1] || "")).filter(Boolean);
  const endCounts = endWords.reduce<Record<string, number>>((acc, word) => ((acc[word] = (acc[word] || 0) + 1), acc), {});
  const repeatedEndWords = Object.entries(endCounts).filter(([, count]) => count > 1).map(([word]) => word);
  const repeatedLines = lyricLines.length - new Set(lyricLines.map((line) => line.toLowerCase())).size;
  const internalPunctuation = lyricLines.filter((line) => /[,;:\-]/.test(line)).length;
  const longWords = words.filter((word) => word.length >= 7).length;
  const imageryHits = words.filter((word) => imageryWords.includes(word)).length;
  const emotionHits = words.filter((word) => emotionWords.some((root) => word.startsWith(root))).length;
  const staleHits = filler.filter((phrase) => clean.toLowerCase().includes(phrase)).length;
  const questionHits = (clean.match(/\?/g) || []).length;
  const quoteHits = (clean.match(/["""]/g) || []).length;
  const hookSection = sections.findIndex((section) => /hook|chorus/i.test(section));
  const hookPresent = hookSection >= 0;
  const lexicalDiversity = words.length ? unique.size / words.length : 0;
  const avgLineWords = lyricLines.length ? words.length / lyricLines.length : 0;

  const scores: LyricScores = {
    hookStrength: clamp((hookPresent ? 5.5 : 2.5) + Math.min(2.5, repeatedLines * 0.8) + (lyricLines.length > 5 ? 1 : 0)),
    rhymeDensity: clamp(2.5 + Math.min(4, internalPunctuation / Math.max(1, lyricLines.length) * 7) + Math.min(2.5, repeatedEndWords.length * 0.65)),
    punchlines: clamp(2.5 + Math.min(3, longWords / Math.max(1, words.length) * 35) + Math.min(2, questionHits * 0.5) + Math.min(1.5, quoteHits * 0.2)),
    storytelling: clamp(2.5 + Math.min(3, sections.length * 0.55) + Math.min(2.5, questionHits * 0.4 + quoteHits * 0.12) + (lyricLines.length >= 16 ? 1 : 0)),
    emotionalImpact: clamp(2.5 + Math.min(5, emotionHits / Math.max(1, words.length) * 55) + (questionHits ? 0.8 : 0)),
    cadenceVariation: clamp(3 + Math.min(3, internalPunctuation / Math.max(1, lyricLines.length) * 6) + (avgLineWords >= 6 && avgLineWords <= 14 ? 2 : 0)),
    imagery: clamp(2 + Math.min(6, imageryHits / Math.max(1, words.length) * 75) + Math.min(1, quoteHits * 0.12)),
    originality: clamp(4 + lexicalDiversity * 5 - staleHits * 1.4 - Math.max(0, repeatedEndWords.length - 4) * 0.25),
    replayValue: 0,
    overall: 0,
  };
  scores.replayValue = clamp((scores.hookStrength + scores.punchlines + scores.emotionalImpact + scores.originality) / 4);
  scores.overall = clamp(Object.entries(scores).filter(([key]) => !["overall"].includes(key)).reduce((sum, [, value]) => sum + value, 0) / 9);

  const strengths = Object.entries(scores).filter(([key, value]) => key !== "overall" && value >= 7).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([key]) => key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()));
  const improvements = Object.entries(scores).filter(([key, value]) => key !== "overall" && value < 6).sort((a, b) => a[1] - b[1]).slice(0, 3).map(([key]) => `Strengthen ${key.replace(/([A-Z])/g, " $1").toLowerCase()}.`);
  if (!hookPresent) improvements.unshift("Add a clearly labeled hook or chorus with a memorable repeated anchor.");
  if (staleHits) improvements.push("Replace familiar stock phrases with more specific, personal observations.");
  if (repeatedEndWords.length > 5) improvements.push("Vary repeated end-rhyme words while keeping the rhyme family consistent.");

  return { scores, strengths: strengths.length ? strengths : ["Clear usable draft foundation"], improvements: improvements.slice(0, 4), signals: { lines: lyricLines.length, words: words.length, repeatedEndWords, sectionCount: sections.length } };
}
