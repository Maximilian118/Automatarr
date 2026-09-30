import React, { useEffect, useId, useState } from "react"
import { Clapperboard, Settings2, Trash2, Tv, X } from "lucide-react"
import { BotUserType, settingsType } from "../../../types/settingsType"
import { removePoolItem, deleteUser, updateUserStatus, updateUserOverwrites } from "../../../shared/requests/settingsRequests"
import Toggle from "../../utility/Toggle/Toggle"
import MUIAutocomplete from "../../utility/MUIAutocomplete/MUIAutocomplete"
import DraggablePoolItem from "./DraggablePoolItem/DraggablePoolItem"
import ConfirmButton from "../../ui/ConfirmButton/ConfirmButton"
import { getPlexAccounts, updateUserPlexLink } from "../../../shared/requests/aiRequests"
import { PlexAccountOption } from "../../../types/aiType"
import { userOverwriteSelection, userOverwriteToNumber, numberToUserOverwriteString } from "../../../shared/utility"
import {
  calculateUserMovieLimit,
  calculateUserSeriesLimit,
  calculateUserTotalStorageBytes,
  PoolItemType,
} from "../../../shared/userUtility"
import { formatSize } from "../../../shared/format"
import { useToast } from "../../../shared/toast/useToast"
import { TransferTarget } from "../UserCards"
import "./_user-card.scss"

// Label a Plex account for the picker, noting who else it's linked to
const plexAccountLabel = (account: PlexAccountOption, userName: string): string =>
  account.linked_to && account.linked_to !== userName ? `${account.name} (${account.linked_to})` : account.name

// The role shown under a user's name
const roleLabel = (user: BotUserType, isOwner?: boolean): string => {
  if (isOwner) return "Owner"
  if (user.admin) return "Admin"
  if (user.super_user) return "Super user"
  return "Member"
}

interface RemovalState {
  itemType: PoolItemType
  itemIndex: number
  confirming: boolean
}

interface UserCardProps {
  user: BotUserType
  settings: settingsType
  onSettingsUpdate: (newSettings: settingsType) => void
  isOwner?: boolean
  transferTargets: TransferTarget[]
  onTransfer: (sourceUserId: string, destUserId: string, itemType: PoolItemType, itemIndex: number, title: string) => Promise<void>
}

// One person's pool: what they're keeping, how close they are to their limits, and their admin settings
const UserCard: React.FC<UserCardProps> = ({ user, settings, onSettingsUpdate, isOwner, transferTargets, onTransfer }) => {
  const [removalState, setRemovalState] = useState<RemovalState | null>(null)
  const [removing, setRemoving] = useState(false)
  const [contentType, setContentType] = useState<PoolItemType>('movies')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [plexAccounts, setPlexAccounts] = useState<PlexAccountOption[]>([])
  const { showToast } = useToast()
  const nameId = useId()
  const settingsId = useId()

  // Load the server's Plex accounts when the settings view opens
  useEffect(() => {
    if (!settingsOpen || !settings.plex_active) return

    getPlexAccounts()
      .then(setPlexAccounts)
      .catch((error) => console.error("Failed to load Plex accounts:", error))
  }, [settingsOpen, settings.plex_active])

  // Run a settings change for this user and report a failure if it doesn't go through
  const runUpdate = async (action: () => Promise<settingsType>, failure: string) => {
    try {
      onSettingsUpdate(await action())
    } catch (error) {
      console.error(failure, error)
      showToast({ tone: "error", title: failure, message: "Nothing was changed. Try again." })
    }
  }

  const handleRemoveClick = (itemType: PoolItemType, itemIndex: number) => {
    setRemovalState({
      itemType,
      itemIndex,
      confirming: true
    })
  }

  const handleCancelRemove = () => {
    setRemovalState(null)
  }

  const handleConfirmRemove = async () => {
    if (!removalState || !user._id) return

    setRemoving(true)
    await runUpdate(
      () => removePoolItem(user._id as string, removalState.itemType, removalState.itemIndex),
      "Couldn't remove the item from the pool",
    )
    setRemoving(false)
    setRemovalState(null)
  }

  const isItemBeingRemoved = (itemType: PoolItemType, itemIndex: number) => {
    return removalState?.itemType === itemType &&
           removalState?.itemIndex === itemIndex
  }

  const handleDeleteUser = async () => {
    if (!user._id) return

    setDeleting(true)
    await runUpdate(() => deleteUser(user._id as string), `Couldn't delete ${user.name}`)
    setDeleting(false)
  }

  const handleAdminToggle = async (value: boolean) => {
    if (!user._id) return
    await runUpdate(() => updateUserStatus(user._id as string, value, undefined), "Couldn't change admin status")
  }

  const handleSuperUserToggle = async (value: boolean) => {
    if (!user._id) return
    await runUpdate(() => updateUserStatus(user._id as string, undefined, value), "Couldn't change super user status")
  }

  const handleMoviesOverwriteChange = async (value: string | null) => {
    if (!user._id) return
    const numericValue = userOverwriteToNumber(value)
    await runUpdate(() => updateUserOverwrites(user._id as string, numericValue, undefined), "Couldn't change the movie limit")
  }

  const handleSeriesOverwriteChange = async (value: string | null) => {
    if (!user._id) return
    const numericValue = userOverwriteToNumber(value)
    await runUpdate(() => updateUserOverwrites(user._id as string, undefined, numericValue), "Couldn't change the series limit")
  }

  // Link the user to the picked Plex account, or unlink them when cleared
  const handlePlexLinkChange = async (label: string | null) => {
    if (!user._id) return

    const account = plexAccounts.find((a) => plexAccountLabel(a, user.name) === label)
    const accountId = account ? account.id : null
    if (accountId === user.plex_account_id) return

    await runUpdate(() => updateUserPlexLink(user._id as string, accountId), "Couldn't change the Plex link")
  }

  const currentItems = contentType === 'movies' ? user.pool.movies : user.pool.series
  const otherUsers = transferTargets.filter((t) => t.id !== user._id)

  return (
    <article className="user-card" aria-labelledby={nameId}>
      <div className="user-card-header">
        <div className="user-card-identity">
          <span className="user-card-avatar" aria-hidden="true">{user.name.charAt(0).toUpperCase()}</span>
          <div>
            <h3 id={nameId} className="user-name">{user.name}</h3>
            <p className="user-card-role">{roleLabel(user, isOwner)}</p>
          </div>
        </div>
        <button
          type="button"
          className="user-card-icon-button"
          aria-expanded={settingsOpen}
          aria-controls={settingsId}
          onClick={() => setSettingsOpen((open) => !open)}
        >
          {settingsOpen ? <X aria-hidden="true" /> : <Settings2 aria-hidden="true" />}
          <span className="visually-hidden">{settingsOpen ? `Close settings for ${user.name}` : `Settings for ${user.name}`}</span>
        </button>
      </div>

      {!settingsOpen && (
        <>
          <div className="user-card-tabs" role="group" aria-label={`${user.name}'s pool`}>
            <button
              type="button"
              className="user-card-tab"
              aria-pressed={contentType === 'movies'}
              onClick={() => setContentType('movies')}
            >
              <Clapperboard aria-hidden="true" />
              <span>Movies</span>
              <span className="user-card-tab-count">{user.pool.movies.length} of {calculateUserMovieLimit(user, settings)}</span>
            </button>
            <button
              type="button"
              className="user-card-tab"
              aria-pressed={contentType === 'series'}
              onClick={() => setContentType('series')}
            >
              <Tv aria-hidden="true" />
              <span>Series</span>
              <span className="user-card-tab-count">{user.pool.series.length} of {calculateUserSeriesLimit(user, settings)}</span>
            </button>
          </div>

          {currentItems.length === 0 ? (
            <p className="user-card-empty">No {contentType} in this pool yet.</p>
          ) : (
            <ul className="user-card-pool" aria-label={`${user.name}'s ${contentType}`}>
              {currentItems.map((item, index) => (
                <DraggablePoolItem
                  key={`${user._id}-${contentType}-${index}`}
                  userId={user._id || ""}
                  itemType={contentType}
                  itemIndex={index}
                  item={item}
                  removing={removing}
                  isBeingRemoved={isItemBeingRemoved(contentType, index)}
                  onRemoveClick={handleRemoveClick}
                  onConfirmRemove={handleConfirmRemove}
                  onCancelRemove={handleCancelRemove}
                  moveTargets={otherUsers}
                  onMove={(destUserId) => onTransfer(user._id || "", destUserId, contentType, index, item.title)}
                />
              ))}
            </ul>
          )}

          <p className="user-card-footer">
            Storage kept by {user.name}: <strong>{formatSize(calculateUserTotalStorageBytes(user))}</strong>
          </p>
        </>
      )}

      {settingsOpen && (
        <div className="user-settings-container" id={settingsId}>
          <div className="user-settings-toggles">
            <Toggle
              name="Admin"
              checked={user.admin}
              onToggle={handleAdminToggle}
            />
            <Toggle
              name="Super user (double limits)"
              checked={user.super_user}
              onToggle={handleSuperUserToggle}
            />
          </div>

          <div className="user-settings-autocompletes">
            <MUIAutocomplete
              label="Max Movies Overwrite"
              placeholder="No Overwrite"
              options={userOverwriteSelection()}
              value={user.max_movies_overwrite === null ? null : numberToUserOverwriteString(user.max_movies_overwrite)}
              setValue={handleMoviesOverwriteChange}
            />
            <MUIAutocomplete
              label="Max Series Overwrite"
              placeholder="No Overwrite"
              options={userOverwriteSelection()}
              value={user.max_series_overwrite === null ? null : numberToUserOverwriteString(user.max_series_overwrite)}
              setValue={handleSeriesOverwriteChange}
            />
            {settings.plex_active && (
              <MUIAutocomplete
                label="Plex Account"
                placeholder="Not linked"
                options={plexAccounts.map((a) => plexAccountLabel(a, user.name))}
                value={user.plex_account_id !== null && user.plex_username ? user.plex_username : null}
                setValue={handlePlexLinkChange}
              />
            )}
          </div>

          <div className="user-settings-danger">
            <ConfirmButton
              label="Delete user"
              confirmLabel={`Delete ${user.name}`}
              question={`Delete ${user.name}? Their pool and settings are removed for good.`}
              icon={<Trash2 aria-hidden="true" />}
              loading={deleting}
              onConfirm={handleDeleteUser}
            />
          </div>
        </div>
      )}
    </article>
  )
}

export default UserCard
