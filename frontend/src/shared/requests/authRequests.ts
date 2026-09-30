import axios from "axios"

// Whether the admin account already exists. Defaults to true on failure so "Create account" stays hidden
export const hasAccount = async (): Promise<boolean> => {
  try {
    const res = await axios.post("", { query: `query { hasAccount }` })
    return res.data?.data?.hasAccount !== false
  } catch {
    return true
  }
}
