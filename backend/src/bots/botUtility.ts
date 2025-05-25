import moment from "moment"
import { UserType } from "../models/settings"

export const initUser = (
  name: string,
  username: string,
  super_user: boolean = false,
  admin: boolean = false,
): UserType => {
  return {
    name,
    ids: [username],
    admin,
    super_user,
    max_movies_overwrite: null,
    max_series_overwrite: null,
    created_at: moment().format(),
    updated_at: moment().format(),
  }
}
