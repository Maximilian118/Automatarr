import { NavigateFunction } from "react-router-dom"
import { UserType } from "../types/userType"

// A user object template with falsy values.
const blankUser: UserType = {
  _id: "",
  token: "",
  name: "",
  password: "",
  password_check: "",
  admin: false,
  email: "",
  icon: "",
  profile_picture: "",
  logged_in_at: new Date(0),
  created_at: new Date(0),
  updated_at: new Date(0),
  localStorage: false,
}

// If there are tokens in local storage, retrieve user object.
// Otherwise, call logout.
export const checkUserLS = (): UserType => {
  const token = localStorage.getItem("access_token") || ""
  const refreshToken = localStorage.getItem("refresh_token") || ""

  if (!token && !refreshToken) {
    return logout()
  } else {
    const _id = localStorage.getItem("_id")
    const name = localStorage.getItem("name")
    const admin = localStorage.getItem("admin")
    const email = localStorage.getItem("email")
    const icon = localStorage.getItem("icon")
    const profile_picture = localStorage.getItem("profile_picture")
    const logged_in_at = localStorage.getItem("logged_in_at")
    const created_at = localStorage.getItem("created_at")
    const updated_at = localStorage.getItem("updated_at")

    const user: UserType = {
      token,
      _id: _id ? _id : "",
      name: name ? name : "",
      password: "",
      password_check: "",
      admin: admin === "true",
      email: email ? email : "",
      icon: icon ? icon : "",
      profile_picture: profile_picture ? profile_picture : "",
      logged_in_at: logged_in_at ? new Date(logged_in_at) : new Date(0),
      created_at: created_at ? new Date(created_at) : new Date(0),
      updated_at: updated_at ? new Date(updated_at) : new Date(0),
      localStorage: true,
    }

    return user
  }
}

// Log the user out removing all local storage and return a blank user object.
// If the navigate function is passed, navigate to /login.
export const logout = (
  setUser?: React.Dispatch<React.SetStateAction<UserType>>,
  navigate?: NavigateFunction,
): UserType => {
  localStorage.removeItem("_id")
  localStorage.removeItem("access_token")
  localStorage.removeItem("refresh_token")
  localStorage.removeItem("name")
  localStorage.removeItem("admin")
  localStorage.removeItem("email")
  localStorage.removeItem("icon")
  localStorage.removeItem("profile_picture")
  localStorage.removeItem("logged_in_at")
  localStorage.removeItem("created_at")
  localStorage.removeItem("updated_at")

  if (setUser) {
    setUser(() => blankUser)
  }

  if (navigate) {
    navigate("/")
  }

  return blankUser
}

interface UserWithTokensType extends UserType {
  tokens: string[]
}

// Populate local storage and return the populated user object.
export const loginSuccess = (
  request: string,
  res: {
    data: {
      data: {
        [key: string]: UserType
      }
    }
  },
  setUser?: React.Dispatch<React.SetStateAction<UserType>>,
  log?: boolean,
): UserType => {
  const rawUser = res.data.data[request] as UserWithTokensType
  const tokens = rawUser.tokens ?? []

  const accessToken = tokens[0] || ""
  const refreshToken = tokens[1] || ""

  // Store tokens in localStorage
  localStorage.setItem("access_token", accessToken)

  if (refreshToken) {
    localStorage.setItem("refresh_token", refreshToken)
  }

  // Store other user properties
  localStorage.setItem("_id", rawUser._id)
  localStorage.setItem("name", rawUser.name)
  localStorage.setItem("admin", String(rawUser.admin ?? false))
  localStorage.setItem("email", rawUser.email || "")
  localStorage.setItem("icon", rawUser.icon || "")
  localStorage.setItem("profile_picture", rawUser.profile_picture || "")
  localStorage.setItem("logged_in_at", rawUser.logged_in_at?.toString() || "")
  localStorage.setItem("created_at", rawUser.created_at?.toString() || "")
  localStorage.setItem("updated_at", rawUser.updated_at?.toString() || "")

  const user: UserType = {
    _id: rawUser._id,
    token: accessToken,
    name: rawUser.name,
    password: "",
    password_check: "",
    admin: rawUser.admin,
    email: rawUser.email || "",
    icon: rawUser.icon || "",
    profile_picture: rawUser.profile_picture || "",
    logged_in_at: rawUser.logged_in_at ? new Date(rawUser.logged_in_at) : new Date(0),
    created_at: rawUser.created_at ? new Date(rawUser.created_at) : new Date(0),
    updated_at: rawUser.updated_at ? new Date(rawUser.updated_at) : new Date(0),
    localStorage: true,
  }

  if (setUser) {
    setUser(() => user)
  }

  if (log) {
    console.log(user)
  }

  return user
}

export const tokensHandler = (
  user: UserType,
  tokens?: string[],
  setUser?: React.Dispatch<React.SetStateAction<UserType>>,
): string => {
  if (!Array.isArray(tokens) || tokens.length < 2) {
    return user.token
  }

  const [accessToken, refreshToken] = tokens

  localStorage.setItem("access_token", accessToken)
  localStorage.setItem("refresh_token", refreshToken)

  if (setUser) {
    setUser((prevUser) => ({
      ...prevUser,
      token: accessToken, // only access token in state
    }))
  }

  return accessToken
}
