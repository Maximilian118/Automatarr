import { IndexContentType } from "./aiTitleIndex"

// Free checks on a message's wording, so useful context can be looked up before the model is called
// instead of the model spending a tool round asking for it.

// What a recommendation request is after, when it says
export type RecommendationRequest = { genre: string; type?: IndexContentType }

// Phrases that ask for a recommendation
const ASKS_FOR_RECOMMENDATION =
  /\b(recommend|recommendation|suggest|suggestion|what should (i|we) watch|what to watch|anything good|something (good |new )?to watch|got any(thing)?|any good (films?|movies?|series|shows?)|give me (a|an|some)|in the mood for)\b/i

// The speaker recommending something themselves, e.g. "I recommend Swan Song"
const GIVES_RECOMMENDATION = /\b(i|we)('d| would)? (highly )?recommend\b/i

// Words people use for a genre, mapped to the genre names Radarr and Sonarr use (lower case)
const GENRE_WORDS: [RegExp, string][] = [
  [/\b(sci-?fi|science fiction|space)\b/i, "science fiction"],
  [/\b(horror|scary)\b/i, "horror"],
  [/\b(comed(y|ies)|funny|laugh)\b/i, "comedy"],
  [/\bthrillers?\b/i, "thriller"],
  [/\b(documentar(y|ies)|docs?)\b/i, "documentary"],
  [/\b(animated|animation|cartoons?|anime)\b/i, "animation"],
  [/\baction\b/i, "action"],
  [/\b(romance|romantic|rom-?coms?)\b/i, "romance"],
  [/\bcrime\b/i, "crime"],
  [/\bfantasy\b/i, "fantasy"],
  [/\bmyster(y|ies)\b/i, "mystery"],
  [/\bwar\b/i, "war"],
  [/\bwesterns?\b/i, "western"],
  [/\b(family|kids)\b/i, "family"],
  [/\b(musicals?)\b/i, "music"],
  [/\b(history|historical)\b/i, "history"],
  [/\bdramas?\b/i, "drama"],
]

// The genre a piece of text asks for, as Radarr and Sonarr name it (lower case). Empty if none.
export const genreFromText = (text: string): string => GENRE_WORDS.find(([pattern]) => pattern.test(text))?.[1] ?? ""

// Whether a piece of text asks for films or series. Undefined if it doesn't say.
export const typeFromText = (text: string): IndexContentType | undefined =>
  /\b(series|shows?|tv)\b/i.test(text) ? "series" : /\b(films?|movies?)\b/i.test(text) ? "movie" : undefined

// Whether a message asks for a recommendation, and for what genre and type. Null when it doesn't.
export const recommendationRequest = (text: string): RecommendationRequest | null => {
  if (!ASKS_FOR_RECOMMENDATION.test(text) || GIVES_RECOMMENDATION.test(text)) return null
  return { genre: genreFromText(text), type: typeFromText(text) }
}
