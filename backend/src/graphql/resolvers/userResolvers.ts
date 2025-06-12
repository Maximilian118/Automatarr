import { AuthRequest, signTokens } from "../../middleware/auth"
import User, { UserDocType, UserType } from "../../models/user"
import { hashPass } from "../../shared/userUtility"
import logger from "../../logger"
import { compare, hash } from "bcrypt"
import { saveWithRetry } from "../../shared/database"
import Settings, { settingsDocType } from "../../models/settings"
import crypto from "crypto"

let failedAttempts = 0
let lockoutUntil: Date | null = null

interface UserTypeWithRecovery extends UserType {
  recovery_key: string
  tokens: string[]
}

interface UserTypeWithTokens extends UserType {
  tokens: string[]
}

const userResolvers = {
  createUser: async ({
    name,
    password,
  }: {
    name: string
    password: string
  }): Promise<UserTypeWithRecovery> => {
    try {
      const existingUser = (await User.findOne()) as UserDocType

      if (existingUser) {
        logger.error(`Auth | ${name} tried to create a user but a user already exists.`)
        throw new Error("User already created.")
      }

      const salt = Math.floor(Math.random() * 5) + 12
      const recovery_key = crypto.randomBytes(32).toString("hex")
      const recovery_key_hash = await hash(recovery_key, salt)

      const user = new User(
        {
          name,
          password: await hashPass(password, salt),
          recovery_key_hash,
          bcrypt_salt_rounds: salt,
        },
        (err: string) => {
          if (err) throw new Error(err)
        },
      ) as UserDocType

      await saveWithRetry(user, "createUser")

      return {
        ...user._doc,
        tokens: signTokens(user),
        recovery_key,
        password: "",
      }
    } catch (err) {
      throw err
    }
  },
  login: async ({
    name,
    password,
  }: {
    name: string
    password: string
  }): Promise<UserTypeWithTokens> => {
    try {
      const user = (await User.findOne()) as UserDocType

      if (!user) {
        logger.error(`Auth | ${name} tried to login but there's no user in the database.`)
        throw new Error("No user found in the database.")
      }

      // Find settings
      let settings = (await Settings.findOne()) as settingsDocType

      // Throw error if no settings
      if (!settings) {
        logger.error("updateSettings: No settings by that ID were found.")
        throw new Error("No settings by that ID were found.")
      }

      // Check lockout
      const now = new Date()
      if (settings && (settings.lockout ?? true) && lockoutUntil && now < lockoutUntil) {
        const mins = Math.ceil((lockoutUntil.getTime() - now.getTime()) / 60000)
        logger.warn(`Auth | ${name} is locked out. Try again in ${mins} minutes.`)
        throw new Error(`Too many failed login attempts. Try again in ${mins} minutes.`)
      }

      // Check username
      if (!name) {
        logger.error(`Auth | ${name} tried to login but didn't pass a user name.`)
        throw new Error("No user name provided.")
      }

      if (user.name !== name) {
        logger.error(`Auth | Incorrect user name.`)
        throw new Error("Incorrect user name.")
      }

      // Check password
      if (!password) {
        logger.error(`Auth | ${name} tried to login but didn't pass a password.`)
        throw new Error("No password provided.")
      }

      const passwordMatch = await compare(password, user.password)

      if (!passwordMatch) {
        failedAttempts++

        logger.warn(
          `Auth | ${name} failed login attempt ${failedAttempts}/${settings.lockout_attempts}`,
        )

        if (failedAttempts >= settings.lockout_attempts) {
          lockoutUntil = new Date(Date.now() + settings.lockout_mins * 60_000)
          failedAttempts = 0 // reset counter once locked
          logger.error(`Auth | ${name} is now locked out until ${lockoutUntil.toISOString()}`)
          throw new Error("Too many failed login attempts. Try again later.")
        }

        throw new Error("Incorrect password.")
      }

      // Successful login: reset lockout
      failedAttempts = 0
      lockoutUntil = null
      user.logged_in_at = new Date()

      await saveWithRetry(user, "login")

      return {
        ...user._doc,
        tokens: signTokens(user),
        password: "",
      }
    } catch (err) {
      throw err
    }
  },
  updateUser: async (
    args: { userInput: UserType },
    req: AuthRequest,
  ): Promise<UserTypeWithTokens> => {
    if (!req.isAuth) {
      throw new Error("Unauthorised")
    }

    const user = (await User.findOne()) as UserDocType

    if (!user) {
      logger.error(`Auth | No user in the database.`)
      throw new Error("No user found in the database.")
    }

    const { name, password, password_check } = args.userInput

    // Update name if changed
    if (name && name !== user.name) {
      logger.info(`Auth | Name changed from ${user.name} to ${name}`)
      user.name = name
    }

    // Handle password update
    if (password || password_check) {
      if (!password || !password_check) {
        throw new Error("Both password and password_check are required to change password.")
      }

      if (password !== password_check) {
        throw new Error("Passwords do not match.")
      }

      const salt = user.bcrypt_salt_rounds || 12
      user.password = await hashPass(password, salt)
      logger.info(`Auth | Password updated for user ${user.name}`)
    }

    user.updated_at = new Date()

    await saveWithRetry(user, "updateUser")

    return {
      ...user._doc,
      tokens: signTokens(user),
      password: "",
      password_check: "",
    }
  },
  forgot: async ({ recovery_key }: { recovery_key: string }): Promise<UserTypeWithTokens> => {
    try {
      const user = (await User.findOne()) as UserDocType

      if (!user) {
        logger.error("Auth | Attempted recovery but no user was found.")
        throw new Error("No user found for recovery.")
      }

      const isValidKey = await compare(recovery_key, user.recovery_key_hash)

      if (!isValidKey) {
        logger.warn("Auth | Invalid recovery key provided.")
        throw new Error("Invalid recovery key.")
      }

      return {
        ...user._doc,
        tokens: signTokens(user),
        password: "",
      }
    } catch (err) {
      throw err
    }
  },
}

export default userResolvers
