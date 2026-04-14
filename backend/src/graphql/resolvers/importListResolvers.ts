import axios from "axios"
import logger from "../../logger"
import Settings, { settingsDocType } from "../../models/settings"
import { activeAPIsArr, APIData } from "../../shared/activeAPIsArr"
import {
  getAllImportLists,
  getAllRootFolderPaths,
  createImportList as createImportListReq,
  updateImportList as updateImportListReq,
  deleteImportList as deleteImportListReq,
  testImportList as testImportListReq,
} from "../../shared/StarrRequests"
import { AuthRequest } from "../../middleware/auth"
import { ImportListData, MdblistItem } from "../../types/types"
import { axiosErrorMessage } from "../../shared/requestError"
import { Movie } from "../../types/movieTypes"
import { Series } from "../../types/seriesTypes"
import { dataDocType } from "../../models/data"

// Build the correct payload for Radarr or Sonarr import list creation
const buildCreatePayload = (
  apiName: string,
  input: {
    name: string
    url: string
    enabled?: boolean
    qualityProfileId: number
    rootFolderPath: string
    searchOnAdd?: boolean
    minimumAvailability?: string
    monitor?: string
    shouldMonitor?: string
    monitorNewItems?: string
    seriesType?: string
    seasonFolder?: boolean
    tags?: number[]
  },
): Partial<ImportListData> => {
  if (apiName === "Radarr") {
    return {
      enabled: input.enabled ?? true,
      enableAuto: true,
      monitor: input.monitor ?? "movieOnly",
      qualityProfileId: input.qualityProfileId,
      searchOnAdd: input.searchOnAdd ?? true,
      minimumAvailability: input.minimumAvailability ?? "released",
      listType: "advanced",
      listOrder: 0,
      minRefreshInterval: "12:00:00",
      fields: [{ order: 0, name: "url", label: "List URL", helpText: "The URL for the movie list", value: input.url, type: "textbox", advanced: false, privacy: "normal", isFloat: false }],
      implementationName: "Custom Lists",
      implementation: "RadarrListImport",
      configContract: "RadarrListSettings",
      infoLink: "https://wiki.servarr.com/radarr/supported#radarrlistimport",
      tags: input.tags ?? [],
      name: input.name,
      rootFolderPath: input.rootFolderPath,
    }
  }

  // Sonarr payload
  return {
    enableAutomaticAdd: input.enabled ?? true,
    searchForMissingEpisodes: input.searchOnAdd ?? true,
    shouldMonitor: input.shouldMonitor ?? "all",
    monitorNewItems: input.monitorNewItems ?? "all",
    qualityProfileId: input.qualityProfileId,
    seriesType: input.seriesType ?? "standard",
    seasonFolder: input.seasonFolder ?? true,
    listType: "advanced",
    listOrder: 0,
    minRefreshInterval: "06:00:00",
    fields: [{ order: 0, name: "baseUrl", label: "List URL", helpText: "The URL for the series list", value: input.url, type: "textbox", advanced: false, privacy: "normal", isFloat: false }],
    implementationName: "Custom List",
    implementation: "CustomImport",
    configContract: "CustomSettings",
    infoLink: "https://wiki.servarr.com/sonarr/supported#customimport",
    tags: input.tags ?? [],
    name: input.name,
    rootFolderPath: input.rootFolderPath,
  }
}

// Build the correct payload for updating a Radarr or Sonarr import list
const buildUpdatePayload = (
  apiName: string,
  existing: ImportListData,
  input: {
    name?: string
    url?: string
    enabled?: boolean
    qualityProfileId?: number
    rootFolderPath?: string
    searchOnAdd?: boolean
    minimumAvailability?: string
    monitor?: string
    shouldMonitor?: string
    monitorNewItems?: string
    seriesType?: string
    seasonFolder?: boolean
    tags?: number[]
  },
): Partial<ImportListData> => {
  // Start with the existing data and overlay updates
  const payload: Partial<ImportListData> = { ...existing }

  if (input.name !== undefined) payload.name = input.name
  if (input.rootFolderPath !== undefined) payload.rootFolderPath = input.rootFolderPath
  if (input.qualityProfileId !== undefined) payload.qualityProfileId = input.qualityProfileId
  if (input.tags !== undefined) payload.tags = input.tags

  if (apiName === "Radarr") {
    if (input.enabled !== undefined) payload.enabled = input.enabled
    if (input.searchOnAdd !== undefined) payload.searchOnAdd = input.searchOnAdd
    if (input.minimumAvailability !== undefined) payload.minimumAvailability = input.minimumAvailability
    if (input.monitor !== undefined) payload.monitor = input.monitor

    // Update the URL field if provided
    if (input.url !== undefined) {
      payload.fields = existing.fields.map((f) =>
        f.name === "url" ? { ...f, value: input.url as string } : f,
      )
    }
  } else {
    // Sonarr
    if (input.enabled !== undefined) payload.enableAutomaticAdd = input.enabled
    if (input.searchOnAdd !== undefined) payload.searchForMissingEpisodes = input.searchOnAdd
    if (input.shouldMonitor !== undefined) payload.shouldMonitor = input.shouldMonitor
    if (input.monitorNewItems !== undefined) payload.monitorNewItems = input.monitorNewItems
    if (input.seriesType !== undefined) payload.seriesType = input.seriesType
    if (input.seasonFolder !== undefined) payload.seasonFolder = input.seasonFolder

    // Update the URL field if provided
    if (input.url !== undefined) {
      payload.fields = existing.fields.map((f) =>
        f.name === "baseUrl" ? { ...f, value: input.url as string } : f,
      )
    }
  }

  return payload
}

const importListResolvers = {
  // Get all import lists from all active APIs (fresh from Radarr/Sonarr)
  getImportLists: async (_: unknown, req: AuthRequest) => {
    if (!req.isAuth) {
      throw new Error("Unauthorised")
    }

    const settings = (await Settings.findOne()) as settingsDocType

    if (!settings) {
      logger.error("getImportLists: No Settings object was found.")
      return { data: [], tokens: req.tokens }
    }

    const { data, activeAPIs } = await activeAPIsArr(settings._doc)

    if (activeAPIs.length === 0) {
      logger.error("getImportLists: No active API's.")
      return { data: [], tokens: req.tokens }
    }

    const importLists = await getAllImportLists(activeAPIs, data)

    return { data: importLists, tokens: req.tokens }
  },

  // Get all root folder paths from all active APIs
  getRootFolderPaths: async (_: unknown, req: AuthRequest) => {
    if (!req.isAuth) {
      throw new Error("Unauthorised")
    }

    const settings = (await Settings.findOne()) as settingsDocType

    if (!settings) {
      logger.error("getRootFolderPaths: No Settings object was found.")
      return { data: [], tokens: req.tokens }
    }

    const { activeAPIs } = await activeAPIsArr(settings._doc)

    if (activeAPIs.length === 0) {
      logger.error("getRootFolderPaths: No active API's.")
      return { data: [], tokens: req.tokens }
    }

    const rootFolderPaths = await getAllRootFolderPaths(activeAPIs)

    return { data: rootFolderPaths, tokens: req.tokens }
  },

  // Create a new import list on a specific API
  createImportList: async (
    args: {
      input: {
        apiName: string
        name: string
        url: string
        enabled?: boolean
        qualityProfileId: number
        rootFolderPath: string
        searchOnAdd?: boolean
        minimumAvailability?: string
        monitor?: string
        shouldMonitor?: string
        monitorNewItems?: string
        seriesType?: string
        seasonFolder?: boolean
        tags?: number[]
      }
    },
    req: AuthRequest,
  ) => {
    if (!req.isAuth) {
      throw new Error("Unauthorised")
    }

    const settings = (await Settings.findOne()) as settingsDocType

    if (!settings) {
      throw new Error("No settings object was found.")
    }

    const { activeAPIs } = await activeAPIsArr(settings._doc)
    const API = activeAPIs.find((a) => a.name === args.input.apiName)

    if (!API) {
      throw new Error(`${args.input.apiName} is not active.`)
    }

    const payload = buildCreatePayload(args.input.apiName, args.input)
    const result = await createImportListReq(API, payload)

    if (!result) {
      throw new Error(`Failed to create import list on ${args.input.apiName}.`)
    }

    return { success: true, importList: result, tokens: req.tokens }
  },

  // Update an existing import list on a specific API
  updateImportList: async (
    args: {
      input: {
        apiName: string
        id: number
        name?: string
        url?: string
        enabled?: boolean
        qualityProfileId?: number
        rootFolderPath?: string
        searchOnAdd?: boolean
        minimumAvailability?: string
        monitor?: string
        shouldMonitor?: string
        monitorNewItems?: string
        seriesType?: string
        seasonFolder?: boolean
        tags?: number[]
      }
    },
    req: AuthRequest,
  ) => {
    if (!req.isAuth) {
      throw new Error("Unauthorised")
    }

    const settings = (await Settings.findOne()) as settingsDocType

    if (!settings) {
      throw new Error("No settings object was found.")
    }

    const { data, activeAPIs } = await activeAPIsArr(settings._doc)
    const API = activeAPIs.find((a) => a.name === args.input.apiName)

    if (!API) {
      throw new Error(`${args.input.apiName} is not active.`)
    }

    // Fetch existing import lists to get the current state of the list being updated
    const importLists = await getAllImportLists(activeAPIs, data)
    const apiLists = importLists.find((l) => l.name === args.input.apiName)
    const existing = apiLists?.data.find((l) => l.id === args.input.id)

    if (!existing) {
      throw new Error(`Import list with ID ${args.input.id} not found on ${args.input.apiName}.`)
    }

    const payload = buildUpdatePayload(args.input.apiName, existing, args.input)
    const result = await updateImportListReq(API, args.input.id, payload)

    if (!result) {
      throw new Error(`Failed to update import list on ${args.input.apiName}.`)
    }

    return { success: true, importList: result, tokens: req.tokens }
  },

  // Delete an import list from a specific API
  deleteImportList: async (
    args: { input: { apiName: string; id: number } },
    req: AuthRequest,
  ) => {
    if (!req.isAuth) {
      throw new Error("Unauthorised")
    }

    const settings = (await Settings.findOne()) as settingsDocType

    if (!settings) {
      throw new Error("No settings object was found.")
    }

    const { activeAPIs } = await activeAPIsArr(settings._doc)
    const API = activeAPIs.find((a) => a.name === args.input.apiName)

    if (!API) {
      throw new Error(`${args.input.apiName} is not active.`)
    }

    const success = await deleteImportListReq(API, args.input.id)

    if (!success) {
      throw new Error(`Failed to delete import list ${args.input.id} from ${args.input.apiName}.`)
    }

    return { success: true, importList: null, tokens: req.tokens }
  },

  // Test an import list configuration against a specific API
  testImportList: async (
    args: {
      input: {
        apiName: string
        id?: number
        name: string
        url: string
        qualityProfileId: number
        rootFolderPath: string
        searchOnAdd?: boolean
      }
    },
    req: AuthRequest,
  ) => {
    if (!req.isAuth) {
      throw new Error("Unauthorised")
    }

    const settings = (await Settings.findOne()) as settingsDocType

    if (!settings) {
      throw new Error("No settings object was found.")
    }

    const { data, activeAPIs } = await activeAPIsArr(settings._doc)
    const API = activeAPIs.find((a) => a.name === args.input.apiName)

    if (!API) {
      throw new Error(`${args.input.apiName} is not active.`)
    }

    let payload: Partial<ImportListData>

    // Edit mode: use the existing list's full data from Radarr/Sonarr (includes id, fields, implementation, etc.)
    if (args.input.id) {
      const importLists = await getAllImportLists(activeAPIs, data)
      const existing = importLists.find((l) => l.name === args.input.apiName)?.data.find((l) => l.id === args.input.id)

      if (!existing) {
        throw new Error(`Import list with ID ${args.input.id} not found on ${args.input.apiName}.`)
      }

      payload = { ...existing }
    } else {
      // Add mode: build a fresh payload
      payload = buildCreatePayload(args.input.apiName, args.input)
    }

    const success = await testImportListReq(API, payload)

    return { success, importList: null, tokens: req.tokens }
  },

  // Compute per-list stats (downloaded/downloading/missing) using the same Set-based matching as library_cleanup
  getImportListStats: async (_: unknown, req: AuthRequest) => {
    if (!req.isAuth) {
      throw new Error("Unauthorised")
    }

    const settings = (await Settings.findOne()) as settingsDocType

    if (!settings) {
      logger.error("getImportListStats: No Settings object was found.")
      return { data: [], tokens: req.tokens }
    }

    const { data, activeAPIs } = await activeAPIsArr(settings._doc)

    if (activeAPIs.length === 0) {
      return { data: [], tokens: req.tokens }
    }

    const results = await Promise.all(
      activeAPIs.map((API) => computeStatsForApi(API, data)),
    )

    return {
      data: results.filter((r) => r !== null),
      tokens: req.tokens,
    }
  },
}

// Compute stats for all import lists under a single API (Radarr or Sonarr)
const computeStatsForApi = async (
  API: APIData,
  data: dataDocType,
): Promise<{ name: string; stats: { listId: number; total: number; downloaded: number; downloading: number; missing: number; sizeOnDisk: number }[] } | null> => {
  const importLists = API.data.importLists
  if (!importLists || importLists.length === 0) return null

  // Get cached library and queue for this API from MongoDB data
  const library = data.libraries.find((l) => l.name === API.name)?.data ?? []
  const queue = data.downloadQueues.find((q) => q.name === API.name)?.data ?? []

  // Build "downloaded" lookup Sets from library items that have files
  // Uses the same proven matching pattern as library_cleanup.ts:307-309
  const downloadedTmdb = new Set<number>()
  const downloadedImdb = new Set<string>()
  const downloadedTvdb = new Set<number>()

  // Build a map from internal ID to external IDs for queue matching
  const internalToExternal = new Map<number, { tmdbId: number; imdbId: string; tvdbId?: number }>()

  // Build a tmdbId→sizeOnDisk lookup for disk usage accumulation (same loop, no extra cost)
  const sizeByTmdb = new Map<number, number>()

  for (const item of library) {
    const tmdbId = (item as Movie | Series).tmdbId
    const imdbId = (item as Movie | Series).imdbId

    // Store internal ID mapping for queue lookups
    internalToExternal.set((item as Movie | Series).id, {
      tmdbId,
      imdbId,
      tvdbId: "tvdbId" in item ? (item as Series).tvdbId : undefined,
    })

    // Determine if item has files downloaded and get its disk size
    let hasFiles = false
    let itemSize = 0
    if (API.name === "Radarr") {
      hasFiles = (item as Movie).hasFile === true
      itemSize = (item as Movie).sizeOnDisk ?? 0
    } else {
      itemSize = (item as Series).statistics?.sizeOnDisk ?? 0
      hasFiles = itemSize > 0
    }

    if (hasFiles) {
      if (tmdbId) {
        downloadedTmdb.add(tmdbId)
        sizeByTmdb.set(tmdbId, itemSize)
      }
      if (imdbId) downloadedImdb.add(imdbId)
      if ("tvdbId" in item && (item as Series).tvdbId) {
        downloadedTvdb.add((item as Series).tvdbId)
      }
    }
  }

  // Build "downloading" lookup Sets from queue items
  const downloadingTmdb = new Set<number>()
  const downloadingImdb = new Set<string>()
  const downloadingTvdb = new Set<number>()

  for (const queueItem of queue) {
    const internalId = API.name === "Radarr" ? queueItem.movieId : queueItem.seriesId
    if (internalId === undefined) continue

    const ids = internalToExternal.get(internalId)
    if (!ids) continue

    if (ids.tmdbId) downloadingTmdb.add(ids.tmdbId)
    if (ids.imdbId) downloadingImdb.add(ids.imdbId)
    if (ids.tvdbId) downloadingTvdb.add(ids.tvdbId)
  }

  // Fetch mdblist JSON for each import list in parallel
  const listFetches = importLists.map(async (list) => {
    const urlField = list.fields?.find((f) => f.name === "url" || f.name === "baseUrl")
    if (!urlField?.value?.includes("mdblist")) return { listId: list.id, items: [] as MdblistItem[], error: false, errorMessage: null as string | null }

    try {
      const res = await axios.get(`${urlField.value}/json`, { timeout: 10000 })
      const items = Array.isArray(res.data) ? res.data as MdblistItem[] : []

      if (!Array.isArray(res.data)) {
        return { listId: list.id, items, error: true, errorMessage: "Invalid response from list URL" }
      }
      if (items.length === 0) {
        return { listId: list.id, items, error: true, errorMessage: "List returned no items" }
      }

      return { listId: list.id, items, error: false, errorMessage: null as string | null }
    } catch (err) {
      const msg = axiosErrorMessage(err)
      logger.warn(`getImportListStats: Failed to fetch mdblist for "${list.name}": ${msg}`)
      return { listId: list.id, items: [] as MdblistItem[], error: true, errorMessage: msg }
    }
  })

  const listResults = await Promise.all(listFetches)

  // Classify each item per list using the same OR-match as library_cleanup.ts:312-320
  const stats = listResults.map(({ listId, items, error, errorMessage }) => {
    let downloaded = 0
    let downloading = 0
    let missing = 0
    let sizeOnDisk = 0

    for (const item of items) {
      const matchDownloaded =
        downloadedTmdb.has(item.id) ||
        downloadedImdb.has(item.imdb_id) ||
        (item.tvdbid !== null && downloadedTvdb.has(item.tvdbid))

      if (matchDownloaded) {
        downloaded++
        // Accumulate disk size from the tmdb lookup (primary match key)
        sizeOnDisk += sizeByTmdb.get(item.id) ?? 0
        continue
      }

      const matchDownloading =
        downloadingTmdb.has(item.id) ||
        downloadingImdb.has(item.imdb_id) ||
        (item.tvdbid !== null && downloadingTvdb.has(item.tvdbid))

      if (matchDownloading) {
        downloading++
      } else {
        missing++
      }
    }

    return { listId, total: items.length, downloaded, downloading, missing, sizeOnDisk, error, errorMessage }
  })

  return { name: API.name, stats }
}

export default importListResolvers
