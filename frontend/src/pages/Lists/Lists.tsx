import React, { useContext, useEffect, useState } from "react"
import AppContext from "../../context"
import { useNavigate } from "react-router-dom"
import { ImportList, ImportListApiStats, ImportListData, ImportListStats, RootFolderPaths } from "../../types/importListType"
import { QualityProfile } from "../../types/qualityProfileType"
import { getQualityProfiles, getSettingsWithState } from "../../shared/requests/settingsRequests"
import {
  getImportLists,
  getImportListStats,
  getRootFolderPaths,
  createImportList,
  updateImportList,
  deleteImportList,
  testImportList,
} from "../../shared/requests/importListRequests"
import Footer from "../../components/footer/Footer"
import { Button, CircularProgress } from "@mui/material"
import { Add, FiberManualRecord } from "@mui/icons-material"
import SegmentBar from "../../components/utility/SegmentBar/SegmentBar"
import ListCard, { ListCardTag } from "../../components/utility/ListCard/ListCard"
import ImportListModal, { ImportListFormState } from "../../components/modal/configs/ImportListModal"
import { formatBytes } from "../../shared/utility"
import "./_lists.scss"

// Logo URLs for each API
const apiLogos: Record<string, string> = {
  Radarr: "https://radarr.video/img/logo.png",
  Sonarr: "https://sonarr.tv/img/logo.png",
}

// Extract the list URL from the fields array (Radarr uses "url", Sonarr uses "baseUrl")
const getListUrl = (list: ImportListData): string => {
  const urlField = list.fields.find((f) => f.name === "url" || f.name === "baseUrl")
  return urlField?.value ?? ""
}

// Extract just the domain from a URL for display
const getUrlDomain = (url: string): string => {
  try {
    const parsed = new URL(url)
    return parsed.hostname
  } catch {
    return url
  }
}

// Determine if a list's "search on add" is enabled based on the API type
const getSearchOnAdd = (apiName: string, list: ImportListData): boolean => {
  if (apiName === "Radarr") return list.searchOnAdd ?? true
  return list.searchForMissingEpisodes ?? true
}

// Determine if a list is enabled based on the API type
const getEnabled = (apiName: string, list: ImportListData): boolean => {
  if (apiName === "Radarr") return list.enabled ?? true
  return list.enableAutomaticAdd ?? true
}

// Interpolate between green and red based on a 0-1 ratio (green=0, yellow=0.5, red=1)
const sizeToColor = (ratio: number): string => {
  const clamped = Math.max(0, Math.min(1, ratio))
  const r = clamped < 0.5 ? Math.round(clamped * 2 * 255) : 255
  const g = clamped < 0.5 ? 255 : Math.round((1 - (clamped - 0.5) * 2) * 255)
  return `rgb(${r}, ${g}, 80)`
}

// Default values for the add/edit form
const initFormState: ImportListFormState = {
  name: "",
  url: "",
  enabled: true,
  searchOnAdd: true,
  qualityProfileId: 0,
  rootFolderPath: "",
}

// Modal mode - either editing an existing list or adding a new one
type ModalState = {
  mode: "edit" | "add"
  apiName: string
  listId?: number
  form: ImportListFormState
}

const Lists: React.FC = () => {
  const { user, setUser, settings, setSettings, loading, setLoading } = useContext(AppContext)
  const navigate = useNavigate()

  const [importLists, setImportLists] = useState<ImportList[]>([])
  const [qualityProfiles, setQualityProfiles] = useState<QualityProfile[]>([])
  const [rootFolderPaths, setRootFolderPaths] = useState<RootFolderPaths[]>([])
  const [listStats, setListStats] = useState<ImportListApiStats[]>([])
  const [localLoading, setLocalLoading] = useState<boolean>(false)
  const [qpLoading, setQPLoading] = useState<boolean>(false)
  const [dataFetched, setDataFetched] = useState<boolean>(false)
  const [actionLoading, setActionLoading] = useState<boolean>(false)

  // Modal state - null when closed
  const [modal, setModal] = useState<ModalState | null>(null)

  // Get latest settings from db on page load if settings has not been populated
  useEffect(() => {
    if (!settings.updated_at) {
      getSettingsWithState(setSettings, user, setUser, setLocalLoading, navigate)
    }
  }, [user, setUser, settings, setSettings, navigate])

  // Fetch import lists, quality profiles, root folder paths, and stats on mount
  useEffect(() => {
    if (!dataFetched) {
      getImportLists(setImportLists, setLocalLoading, user, setUser, navigate)
      getQualityProfiles(setQualityProfiles, setQPLoading, user, setUser, navigate)
      getRootFolderPaths(setRootFolderPaths, user, setUser, navigate)
      // Stats load asynchronously - cards appear immediately, numbers fill in when ready
      getImportListStats(setListStats, user, setUser, navigate)
      setDataFetched(true)
    }
  }, [dataFetched, user, setUser, navigate])

  // Sync global loading state
  useEffect(() => {
    if (localLoading !== loading) {
      setLoading(localLoading)
    }
  }, [localLoading, loading, setLoading])

  // Re-fetch import lists and stats after a mutation
  const refreshLists = () => {
    getImportLists(setImportLists, setLocalLoading, user, setUser, navigate)
    getImportListStats(setListStats, user, setUser, navigate)
  }

  // Look up stats for a specific list by API name and list ID
  const getStatsForList = (apiName: string, listId: number): ImportListStats | undefined => {
    return listStats.find((s) => s.name === apiName)?.stats.find((s) => s.listId === listId)
  }

  // Get quality profile name by ID for a given API
  const getQPName = (apiName: string, qpId: number): string => {
    const apiProfiles = qualityProfiles.find((qp) => qp.name === apiName)
    return apiProfiles?.data.find((p) => p.id === qpId)?.name ?? ""
  }

  // Get quality profile ID by name for a given API
  const getQPId = (apiName: string, qpName: string): number => {
    const apiProfiles = qualityProfiles.find((qp) => qp.name === apiName)
    return apiProfiles?.data.find((p) => p.name === qpName)?.id ?? 0
  }

  // Get root folder path options for a given API
  const getRootPaths = (apiName: string): string[] => {
    return rootFolderPaths.find((rf) => rf.name === apiName)?.paths ?? []
  }

  // Get quality profile options for a given API
  const getQPOptions = (apiName: string): string[] => {
    return qualityProfiles.find((qp) => qp.name === apiName)?.data.map((p) => p.name) ?? []
  }

  // Open the modal to edit an existing import list
  const openEdit = (apiName: string, list: ImportListData) => {
    setModal({
      mode: "edit",
      apiName,
      listId: list.id,
      form: {
        name: list.name,
        url: getListUrl(list),
        enabled: getEnabled(apiName, list),
        searchOnAdd: getSearchOnAdd(apiName, list),
        qualityProfileId: list.qualityProfileId,
        rootFolderPath: list.rootFolderPath,
      },
    })
  }

  // Open the modal to add a new import list
  const openAdd = (apiName: string) => {
    const paths = getRootPaths(apiName)
    const qpOptions = getQPOptions(apiName)
    setModal({
      mode: "add",
      apiName,
      form: {
        ...initFormState,
        rootFolderPath: paths[0] ?? "",
        qualityProfileId: getQPId(apiName, qpOptions[0] ?? ""),
      },
    })
  }

  // Close the modal
  const closeModal = () => {
    setModal(null)
  }

  // Update a form field in the modal
  const updateForm = (field: keyof ImportListFormState, value: ImportListFormState[keyof ImportListFormState]) => {
    setModal((prev) =>
      prev ? { ...prev, form: { ...prev.form, [field]: value } } : prev,
    )
  }

  // Save changes (create or update)
  const handleSave = async () => {
    if (!modal) return

    setActionLoading(true)

    if (modal.mode === "add") {
      if (!modal.form.name || !modal.form.url) {
        setActionLoading(false)
        return
      }

      const success = await createImportList(
        {
          apiName: modal.apiName,
          name: modal.form.name,
          url: modal.form.url,
          enabled: modal.form.enabled,
          qualityProfileId: modal.form.qualityProfileId,
          rootFolderPath: modal.form.rootFolderPath,
          searchOnAdd: modal.form.searchOnAdd,
        },
        user,
        setUser,
        navigate,
      )

      if (success) {
        closeModal()
        refreshLists()
      }
    } else {
      const success = await updateImportList(
        {
          apiName: modal.apiName,
          id: modal.listId!,
          name: modal.form.name,
          url: modal.form.url,
          enabled: modal.form.enabled,
          searchOnAdd: modal.form.searchOnAdd,
          qualityProfileId: modal.form.qualityProfileId,
          rootFolderPath: modal.form.rootFolderPath,
        },
        user,
        setUser,
        navigate,
      )

      if (success) {
        closeModal()
        refreshLists()
      }
    }

    setActionLoading(false)
  }

  // Delete an import list from the modal
  const handleDelete = async () => {
    if (!modal || modal.mode !== "edit" || !modal.listId) return

    setActionLoading(true)
    const success = await deleteImportList(modal.apiName, modal.listId, user, setUser, navigate)

    if (success) {
      closeModal()
      refreshLists()
    }
    setActionLoading(false)
  }

  // Render a compact summary card for a single import list
  const renderListCard = (apiName: string, list: ImportListData, sizeColor?: string) => {
    const url = getListUrl(list)
    const qpName = getQPName(apiName, list.qualityProfileId)
    const stats = getStatsForList(apiName, list.id)

    // Build tags array with optional colored size tag
    const tags: ListCardTag[] = [qpName, url ? getUrlDomain(url) : ""].filter(Boolean)
    if (stats && stats.sizeOnDisk > 0) {
      tags.push(sizeColor
        ? { text: formatBytes(stats.sizeOnDisk), color: sizeColor }
        : formatBytes(stats.sizeOnDisk),
      )
    }

    return (
      <ListCard
        key={`${apiName}-${list.id}`}
        title={list.name}
        enabled={getEnabled(apiName, list)}
        error={stats?.error}
        errorMessage={stats?.errorMessage}
        tags={tags}
        onClick={() => openEdit(apiName, list)}
      >
        {stats && (
          <SegmentBar
            segments={[
              { value: stats.downloaded, color: "#66bb6a", label: "Downloaded", align: "left" },
              { value: stats.downloading, color: "#ffa726", label: "Downloading", align: "center" },
              { value: stats.missing, color: "#F44336", label: "Missing", align: "right" },
            ]}
            total={stats.total}
          />
        )}
      </ListCard>
    )
  }

  // Build a map of listId → color for size colorization (only when >6 lists)
  const getSizeColorMap = (apiName: string, lists: ImportListData[]): Map<number, string> => {
    const colorMap = new Map<number, string>()
    if (lists.length < 3) return colorMap

    // Collect sizes for lists that have stats
    const sizes: { id: number; size: number }[] = []
    for (const list of lists) {
      const stats = getStatsForList(apiName, list.id)
      if (stats && stats.sizeOnDisk > 0) {
        sizes.push({ id: list.id, size: stats.sizeOnDisk })
      }
    }

    if (sizes.length < 2) return colorMap

    const min = Math.min(...sizes.map((s) => s.size))
    const max = Math.max(...sizes.map((s) => s.size))
    const range = max - min

    // If all sizes are equal, no colorization needed
    if (range === 0) return colorMap

    for (const { id, size } of sizes) {
      colorMap.set(id, sizeToColor((size - min) / range))
    }

    return colorMap
  }

  // Compute aggregate stats for an API across all its import lists
  const getAggregateStats = (apiName: string) => {
    const apiStats = listStats.find((s) => s.name === apiName)?.stats ?? []
    let downloaded = 0, downloading = 0, missing = 0, sizeOnDisk = 0
    for (const s of apiStats) {
      downloaded += s.downloaded
      downloading += s.downloading
      missing += s.missing
      sizeOnDisk += s.sizeOnDisk
    }
    return { downloaded, downloading, missing, sizeOnDisk, hasData: apiStats.length > 0 }
  }

  // Render a section for a specific API (Radarr or Sonarr)
  const renderApiSection = (apiName: "Radarr" | "Sonarr", isActive: boolean) => {
    const apiLists = importLists.find((l) => l.name === apiName)?.data ?? []
    const sizeColors = getSizeColorMap(apiName, apiLists)
    const agg = getAggregateStats(apiName)

    return (
      <div className="lists-section" key={apiName}>
        <div className="lists-section-header">
          <div className="lists-section-title">
            <img src={apiLogos[apiName]} alt={`${apiName} logo`} />
            <h2>{apiName} Import Lists</h2>
          </div>
          {isActive && agg.hasData && (
            <div className="lists-section-stats">
              <div className="lists-stat">
                <FiberManualRecord className="lists-stat-dot downloaded" />
                <span>{agg.downloaded}</span>
              </div>
              <div className="lists-stat">
                <FiberManualRecord className="lists-stat-dot downloading" />
                <span>{agg.downloading}</span>
              </div>
              <div className="lists-stat">
                <FiberManualRecord className="lists-stat-dot missing" />
                <span>{agg.missing}</span>
              </div>
              {agg.sizeOnDisk > 0 && (
                <div className="lists-stat">
                  <span className="lists-stat-size">{formatBytes(agg.sizeOnDisk)}</span>
                </div>
              )}
            </div>
          )}
          {isActive && (
            <Button
              endIcon={<Add sx={{ fontSize: "1.6rem !important" }} />}
              onClick={() => openAdd(apiName)}
              className="lists-new-btn"
            >
              New
            </Button>
          )}
        </div>

        {!isActive && <p className="lists-inactive">Connect {apiName} to manage import lists.</p>}

        {isActive && apiLists.length === 0 && !localLoading && (
          <p className="lists-empty">No import lists found.</p>
        )}

        {isActive && localLoading && apiLists.length === 0 && (
          <div className="lists-loading">
            <CircularProgress size={24} />
          </div>
        )}

        {isActive && apiLists.length > 0 && (
          <div className="lists-grid">
            {apiLists.map((list) => renderListCard(apiName, list, sizeColors.get(list.id)))}
          </div>
        )}
      </div>
    )
  }

  return (
    <main className="lists-page">
      {renderApiSection("Radarr", settings.radarr_active)}
      {renderApiSection("Sonarr", settings.sonarr_active)}
      {modal && (
        <ImportListModal
          open={true}
          onClose={closeModal}
          mode={modal.mode}
          apiName={modal.apiName}
          form={modal.form}
          onFormChange={updateForm}
          onSave={handleSave}
          onDelete={modal.mode === "edit" ? handleDelete : undefined}
          onTest={() => testImportList(
            {
              apiName: modal.apiName,
              ...(modal.listId ? { id: modal.listId } : {}),
              name: modal.form.name,
              url: modal.form.url,
              qualityProfileId: modal.form.qualityProfileId,
              rootFolderPath: modal.form.rootFolderPath,
              searchOnAdd: modal.form.searchOnAdd,
            },
            user,
            setUser,
            navigate,
          )}
          actionLoading={actionLoading}
          qualityProfileOptions={getQPOptions(modal.apiName)}
          qualityProfileValue={getQPName(modal.apiName, modal.form.qualityProfileId)}
          rootFolderOptions={getRootPaths(modal.apiName)}
          qpLoading={qpLoading}
          onQualityProfileChange={(val) => updateForm("qualityProfileId", getQPId(modal.apiName, val))}
        />
      )}
      <Footer />
    </main>
  )
}

export default Lists
