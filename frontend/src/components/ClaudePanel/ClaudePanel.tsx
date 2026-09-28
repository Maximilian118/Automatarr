import React, { Dispatch, SetStateAction, useEffect, useState } from "react"
import { Autocomplete, LinearProgress, TextField } from "@mui/material"
import { AutoAwesome } from "@mui/icons-material"
import "./_claudePanel.scss"
import { BotPanel } from "../panel/botPanel/BotPanel"
import MUITextField from "../utility/MUITextField/MUITextField"
import MUIAutocomplete from "../utility/MUIAutocomplete/MUIAutocomplete"
import Toggle from "../utility/Toggle/Toggle"
import { AIBotType, settingsType } from "../../types/settingsType"
import { botsErrType } from "../../types/botType"
import { AIModel, AIUsage } from "../../types/aiType"
import { checkClaude, getAIModels, getAIUsage } from "../../shared/requests/aiRequests"
import { updateInput } from "../../shared/formValidation"

interface ClaudePanelType {
  settings: settingsType
  setSettings: Dispatch<SetStateAction<settingsType>>
  formErr: botsErrType
  setFormErr: Dispatch<SetStateAction<botsErrType>>
}

// Recommendation frequency options mapped to loop minutes
const frequencyOptions: Record<string, number> = {
  "Every hour": 60,
  "Every 3 hours": 180,
  "Every 6 hours": 360,
  "Every 12 hours": 720,
  "Daily": 1440,
}

// Minimum days between recommendations for the same person
const gapOptions: Record<string, number> = {
  "1 day": 1,
  "3 days": 3,
  "1 week": 7,
  "2 weeks": 14,
  "1 month": 30,
}

// Find the label for a value in an options map, falling back to the raw value
const labelFor = (options: Record<string, number>, value: number, unit: string): string =>
  Object.keys(options).find((key) => options[key] === value) ?? `${value} ${unit}`

// How long to wait after typing before checking the API key
const KEY_CHECK_DELAY_MS = 800

// Format a model option with its pricing so the cost trade-off is visible
const modelLabel = (model: AIModel): string =>
  `${model.label} ($${model.inputPerM}/$${model.outputPerM} per M tokens)`

// Settings panel for the optional Claude API conversational layer
const ClaudePanel: React.FC<ClaudePanelType> = ({ settings, setSettings, formErr, setFormErr }) => {
  const [ models, setModels ] = useState<AIModel[]>([])
  const [ usage, setUsage ] = useState<AIUsage | null>(null)
  const [ keyValid, setKeyValid ] = useState<boolean>(false)
  const ai = settings.ai_bot

  // Load the selectable models and this month's spend once
  useEffect(() => {
    getAIModels().then(setModels).catch(() => setModels([]))
    getAIUsage().then(setUsage).catch(() => setUsage(null))
  }, [])

  // Check the API key works shortly after it changes
  useEffect(() => {
    if (!ai.api_key || formErr.ai_bot_api_key) {
      setKeyValid(false)
      return
    }

    const timer = setTimeout(() => {
      checkClaude(ai.api_key).then(setKeyValid).catch(() => setKeyValid(false))
    }, KEY_CHECK_DELAY_MS)

    return () => clearTimeout(timer)
  }, [ai.api_key, formErr.ai_bot_api_key])

  // Merge changes into the ai_bot settings object
  const updateAI = (changes: Partial<AIBotType>) => {
    setSettings(prev => ({ ...prev, ai_bot: { ...prev.ai_bot, ...changes } }))
  }

  const channels = settings.discord_bot.channel_list
  const noChannels = !settings.discord_bot.server_name || channels.length === 0
  const selectedModel = models.find(m => m.id === ai.model)
  const spent = usage ? usage.cost_usd : 0
  const budgetUsed = ai.monthly_budget > 0 ? Math.min(100, (spent / ai.monthly_budget) * 100) : 100

  return (
    <BotPanel
      title="Claude AI"
      startIcon={<AutoAwesome/>}
      description={`
        Optional. Lets Automatarr chat with people, work out what they meant when a ! command is malformed, remember what they like and make the odd recommendation.

        Well-formed ! commands never use the AI and always work, even if the AI is off, out of credit or over budget.

        You'll need your own Anthropic API key. Spend is capped by the monthly budget below.
      `}
      status={ai.active && keyValid ? "Connected" : "Disconnected"}
      active={ai.active}
      onToggle={(value: boolean) => updateAI({ active: value })}
    >
      <MUITextField
        name="ai_bot.api_key"
        label="Anthropic API Key"
        formErr={formErr}
        value={ai.api_key}
        onChange={(e) => updateInput(e, setSettings, setFormErr)}
        error={!!formErr.ai_bot_api_key}
        color={keyValid ? "success" : "primary"}
        type="password"
      />
      <MUIAutocomplete
        label="Model"
        options={models.map(modelLabel)}
        value={selectedModel ? modelLabel(selectedModel) : ai.model}
        loading={models.length === 0}
        setValue={(val) => {
          const model = models.find(m => modelLabel(m) === val)
          if (model) updateAI({ model: model.id })
        }}
      />
      <MUITextField
        name="ai_bot.monthly_budget"
        label="Monthly Budget (USD)"
        formErr={formErr}
        value={ai.monthly_budget}
        onlyNumbers
        onChange={(e) => {
          const budget = Number(e.target.value)
          updateAI({ monthly_budget: isFinite(budget) ? budget : 0 })
        }}
      />
      <div className="claude-panel-usage">
        <p>Spent this month: <strong>${spent.toFixed(2)}</strong> of ${ai.monthly_budget.toFixed(2)}{usage ? ` · ${usage.requests} requests` : ""}</p>
        <LinearProgress
          variant="determinate"
          value={budgetUsed}
          color={budgetUsed >= 90 ? "error" : "primary"}
        />
      </div>
      <Toggle
        name="Chat with people"
        checked={ai.chat}
        onToggle={(value) => updateAI({ chat: value })}
      />
      <Toggle
        name="Fix malformed ! commands"
        checked={ai.command_help}
        onToggle={(value) => updateAI({ command_help: value })}
      />
      <Autocomplete
        multiple
        options={channels}
        value={ai.chat_channels}
        disabled={noChannels}
        onChange={(_, value) => updateAI({ chat_channels: value })}
        renderInput={(params) => (
          <TextField {...params} label="Chat Channels" placeholder="Movie & series channels"/>
        )}
      />
      <Toggle
        name="Proactive recommendations"
        checked={settings.bot_recommendations}
        onToggle={(value) => setSettings(prev => ({ ...prev, bot_recommendations: value }))}
      />
      <MUIAutocomplete
        label="Recommendation Channel"
        options={channels}
        value={ai.recommendations_channel || null}
        placeholder="Movie or series channel"
        disabled={noChannels || !settings.bot_recommendations}
        setValue={(val) => updateAI({ recommendations_channel: val ?? "" })}
      />
      <MUIAutocomplete
        label="Recommendation Frequency"
        options={Object.keys(frequencyOptions)}
        value={labelFor(frequencyOptions, settings.bot_recommendations_loop, "mins")}
        disabled={!settings.bot_recommendations}
        setValue={(val) => {
          if (val && frequencyOptions[val]) {
            setSettings(prev => ({ ...prev, bot_recommendations_loop: frequencyOptions[val] }))
          }
        }}
      />
      <MUIAutocomplete
        label="Max One Recommendation Per Person Every"
        options={Object.keys(gapOptions)}
        value={labelFor(gapOptions, ai.recommendations_gap_days, "days")}
        disabled={!settings.bot_recommendations}
        setValue={(val) => {
          if (val && gapOptions[val]) updateAI({ recommendations_gap_days: gapOptions[val] })
        }}
      />
    </BotPanel>
  )
}

export default ClaudePanel
