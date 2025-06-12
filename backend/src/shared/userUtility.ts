import { genSalt, hash } from "bcrypt"

// Hash a password.
export const hashPass = async (pass: string, salt: number): Promise<string> => {
  const s = await genSalt(salt)
  return hash(pass, s)
}
