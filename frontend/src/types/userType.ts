export interface UserType {
  _id: string
  name: string
  password: string
  password_check: string
  admin: boolean
  email: string
  icon: string
  profile_picture: string
  logged_in_at: Date
  created_at: Date
  updated_at: Date
  token: string
  localStorage: boolean
}

// An error type mirroring UserType to use with forms
export type UserErrorType = {
  [K in keyof UserType]: string
}
