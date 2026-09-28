import { buildSchema } from "graphql"
import settingsSchema from "./settingsSchema"
import dataSchema from "./dataSchema"
import generalSchema from "./generalSchema"
import qBittorrentSchema from "./qBittorrentSchema"
import movieSchema from "./movieSchema"
import seriesSchema from "./seriesSchema"
import episodeSchema from "./episodeSchema"
import qualityProfileSchema from "./qualityProfileSchema"
import checkSchema from "./checkSchema"
import miscSchema from "./miscSchema"
import userSchema from "./userSchema"
import statsSchema from "./statsSchema"
import importListSchema from "./importListSchema"
import aiSchema from "./aiSchema"

const Schema = buildSchema(`
  ${miscSchema}
  ${checkSchema}
  ${generalSchema}
  ${qBittorrentSchema}
  ${movieSchema}
  ${episodeSchema}
  ${seriesSchema}
  ${qualityProfileSchema}
  ${settingsSchema}
  ${dataSchema}
  ${userSchema}
  ${statsSchema}
  ${importListSchema}
  ${aiSchema}

  type RootQuery {
    login(name: String!, password: String!): User!
    forgot(recovery_key: String!): User!
    getSettings: Settings
    getChildPaths(path: String): StringArr!
    getDiscordChannels(server_name: String!): StringArr!
    getQualityProfiles: QPReturn!
    getBackupFiles: StringArr!
    getBackupFile(fileName: String!): Settings
    checkRadarr(URL: String, KEY: String): CheckStatus!
    checkSonarr(URL: String, KEY: String): CheckStatus!
    checkLidarr(URL: String, KEY: String): CheckStatus!
    checkqBittorrent(URL: String, USER: String, PASS: String): CheckStatus!
    checkPlex(URL: String, KEY: String): CheckStatus!
    checkClaude(KEY: String): CheckStatus!
    checkUnixUsers: StringArr!
    checkUnixGroups: StringArr!
    checkWebhooks(webhookURL: String!): StringArr!
    getStats(statsInput: StatsQueryInput): Stats
    getImportLists: ImportListReturn!
    getRootFolderPaths: RootFolderPathsReturn!
    getImportListStats: ImportListStatsReturn!
    getAIModels: AIModelsReturn!
    getAIUsage: AIUsageReturn!
    getBotMemories: BotMemoriesReturn!
  }

  type RootMutation {
    createUser(name: String!, password: String!): User!
    updateUser(userInput: userInput): User!
    updateSettings(settingsInput: settingsInput): Settings
    removePoolItem(userId: String!, itemType: String!, itemIndex: Int!): Settings
    transferPoolItem(sourceUserId: String!, destUserId: String!, itemType: String!, itemIndex: Int!): Settings
    deleteUser(userId: String!): Settings
    updateUserStatus(userId: String!, admin: Boolean, superUser: Boolean): Settings
    updateUserOverwrites(userId: String!, maxMoviesOverwrite: Int, maxSeriesOverwrite: Int): Settings
    createImportList(input: ImportListCreateInput!): ImportListMutationReturn!
    updateImportList(input: ImportListUpdateInput!): ImportListMutationReturn!
    deleteImportList(input: ImportListDeleteInput!): ImportListMutationReturn!
    testImportList(input: ImportListTestInput!): ImportListMutationReturn!
    deleteBotMemoryNote(discord_id: String!, index: Int!): BotMemoriesReturn!
    forgetBotUser(discord_id: String!): BotMemoriesReturn!
    updateBotMemoryPreferences(discord_id: String!, private: Boolean, learning: Boolean, chat: Boolean, recommendations: Boolean): BotMemoriesReturn!
    updateUserPlexUsername(userId: String!, plexUsername: String!): Settings
  }

  schema {
    query: RootQuery
    mutation: RootMutation
  }
`)

export default Schema
