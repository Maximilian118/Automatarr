import { Artist } from "./artistTypes"
import { Episode } from "./episodeTypes"
import { Movie } from "./movieTypes"
import { Series } from "./seriesTypes"

// Type Guard to check if type is Movie
export const isMovie = (item: Movie | Series | Artist | Episode): item is Movie => {
  return (item as Movie).movieFileId !== undefined
}

// Type Guard to check if type is Series
export const isSeries = (item: Movie | Series | Artist | Episode): item is Series => {
  return (item as Series).seasonFolder !== undefined
}

// Type Guard to check if type is Artist
export const isArtist = (item: Movie | Series | Artist | Episode): item is Artist => {
  return (item as Artist).artistName !== undefined
}

// Type Guard to check if type is Episode
export const isEpisode = (item: Movie | Series | Artist | Episode): item is Episode => {
  return (item as Episode).episodeNumber !== undefined
}
