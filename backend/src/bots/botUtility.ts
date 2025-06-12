import moment from "moment"
import { PoolType, BotUserType } from "../models/settings"

const initPool: PoolType = {
  movies: [],
  series: [],
  albums: [],
  books: [],
}

export const initUser = (
  name: string,
  username: string,
  super_user: boolean = false,
  admin: boolean = false,
): BotUserType => {
  return {
    name,
    ids: [username],
    admin,
    super_user,
    max_movies_overwrite: null,
    max_series_overwrite: null,
    pool: initPool,
    created_at: moment().format(),
    updated_at: moment().format(),
  }
}
