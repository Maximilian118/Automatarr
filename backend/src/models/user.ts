import mongoose, { Document } from "mongoose"
import { ObjectId } from "mongodb"
import crypto from "crypto"

export interface UserType {
  _id: ObjectId
  name: string
  password: string
  password_check?: string
  recovery_key_hash: string
  refresh_count: number
  admin: boolean
  email?: string
  icon?: string
  profile_picture?: string
  jwt_access_secret: string
  jwt_refresh_secret: string
  bcrypt_salt_rounds: number
  logged_in_at: Date
  created_at: Date
  updated_at: Date
}

// User object from MongoDB Database
export interface UserDocType extends UserType, Document {
  _id: ObjectId
  _doc: UserType
}

const userSchema = new mongoose.Schema<UserType>(
  {
    name: { type: String, required: true },
    password: { type: String, required: true, minlength: 8 },
    recovery_key_hash: { type: String, required: true },
    refresh_count: { type: Number, default: 0 },
    admin: { type: Boolean, default: false },
    email: { type: String, default: "" },
    icon: { type: String, default: "" },
    profile_picture: { type: String, default: "" },
    jwt_access_secret: { type: String, default: () => crypto.randomBytes(64).toString("hex") },
    jwt_refresh_secret: { type: String, default: () => crypto.randomBytes(64).toString("hex") },
    bcrypt_salt_rounds: { type: Number, required: true },
    logged_in_at: { type: Date, default: Date.now },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    optimisticConcurrency: true, // Fixes an issue with __v not updating in db on save().
  },
)

// Add indexes for efficient querying
userSchema.index({ name: 1 }, { unique: true })
userSchema.index({ created_at: -1 })

const User = mongoose.model<UserType>("User", userSchema)

export default User
