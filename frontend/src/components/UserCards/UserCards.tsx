import React from "react"
import { Alert } from "@mui/material"
import { BotUserType, settingsType } from "../../types/settingsType"
import UserCard from "./UserCard/UserCard"
import "./user-cards.scss"

interface UserCardsProps {
  users: BotUserType[]
  settings: settingsType
  onSettingsUpdate: (newSettings: settingsType) => void
}

const UserCards: React.FC<UserCardsProps> = ({ users, settings, onSettingsUpdate }) => {
  return (
    <div className="users-cards">
      {users.length === 0 ? (
        <Alert severity="info">No users found</Alert>
      ) : (
        <div className="users-grid">
          {users.map((user, index) => (
            <UserCard
              key={user._id}
              user={user}
              settings={settings}
              onSettingsUpdate={onSettingsUpdate}
              isOwner={index === 0}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default UserCards