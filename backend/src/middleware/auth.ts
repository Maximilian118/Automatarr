import { NextFunction, Request, Response } from "express"
import jwt, { JwtPayload } from "jsonwebtoken"
import User, { UserType } from "../models/user"
import logger from "../logger"

export interface AuthRequest extends Request {
  tokens: string[]
  _id?: string
  isAuth?: boolean
}

export const signTokens = (user: UserType) => {
  const access_token = jwt.sign({ _id: user._id }, user.jwt_access_secret, { expiresIn: "15m" })

  const refresh_token = jwt.sign(
    { _id: user._id, refresh_count: user.refresh_count },
    user.jwt_refresh_secret,
    { expiresIn: "7d" },
  )

  return [access_token, refresh_token]
}

export const auth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  req.isAuth = false
  req.tokens = []

  const extractToken = (header: string | undefined): string | null => {
    if (!header) return null
    const parts = header.split(" ")
    return parts.length === 2 && parts[0] === "Bearer" ? parts[1] : null
  }

  const accessToken = extractToken(req.get("accessToken"))
  const refreshToken = extractToken(req.get("refreshToken"))

  if (!accessToken && !refreshToken) {
    return next() // No tokens, not authenticated
  }

  // Fetch the single user to get secrets
  const user = await User.findOne()
  if (!user) {
    logger.error("No user found in database")
    res.status(500).end()
    return
  }

  // Try verifying access token
  try {
    const verifiedToken = jwt.verify(accessToken!, user.jwt_access_secret) as JwtPayload

    req.isAuth = true
    req._id = verifiedToken._id.toString()
    return next()
  } catch {
    logger.warn("Access token invalid or expired")
  }

  // Try verifying refresh token
  if (!refreshToken) {
    res.status(401).end()
    return
  }

  let verifiedRefreshToken: JwtPayload
  try {
    verifiedRefreshToken = jwt.verify(refreshToken, user.jwt_refresh_secret) as JwtPayload
  } catch (err) {
    logger.error("Refresh token verification failed:", err)
    res.status(401).end()
    return
  }

  // Validate refresh token contents
  if (
    user._id.toString() !== verifiedRefreshToken._id ||
    user.refresh_count !== verifiedRefreshToken.refresh_count
  ) {
    res.status(401).end()
    return
  }

  // Issue new tokens and allow access
  req.tokens = signTokens(user)
  req.isAuth = true
  req._id = user._id.toString()
  return next()
}
