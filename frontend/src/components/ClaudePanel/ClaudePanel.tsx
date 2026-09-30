import React, { Dispatch, SetStateAction, useEffect, useState } from "react"
import { LinearProgress } from "@mui/material"
import { Sparkles } from "lucide-react"
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
  const [ keyError, setKeyError ] = useState<string>("") // Why the API key check failed
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
      setKeyError("")
      return
    }

    const timer = setTimeout(() => {
      checkClaude(ai.api_key.trim())
        .then(({ ok, message }) => {
          setKeyValid(ok)
          setKeyError(ok ? "" : message)
        })
        .catch(() => {
          setKeyValid(false)
          setKeyError("Couldn't check the API key.")
        })
    }, KEY_CHECK_DELAY_MS)

    return () => clearTimeout(timer)
  }, [ai.api_key, formErr.ai_bot_api_key])

  // Merge changes into the ai_bot settings object
  const updateAI = (changes: Partial<AIBotType>) => {
    setSettings(prev => ({ ...prev, ai_bot: { ...prev.ai_bot, ...changes } }))
  }

  const selectedModel = models.find(m => m.id === ai.model)
  const spent = usage ? usage.cost_usd : 0
  const budgetUsed = ai.monthly_budget > 0 ? Math.min(100, (spent / ai.monthly_budget) * 100) : 100

  return (
    <BotPanel
      title="Claude AI"
      startIcon={<Sparkles aria-hidden="true"/>}
      description={`
        Optional. Lets Automatarr chat with people in any channel, work out what they meant when a ! command is malformed, remember what they like and make the odd recommendation.

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
      <p className="claude-panel-error" aria-live="polite">{keyError}</p>
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
        <p id="claude-panel-spend">Spent this month: <strong>${spent.toFixed(2)}</strong> of ${ai.monthly_budget.toFixed(2)}{usage ? `, across ${usage.requests.toLocaleString()} requests` : ""}</p>
        <LinearProgress
          variant="determinate"
          value={budgetUsed}
          color={budgetUsed >= 90 ? "error" : "primary"}
          aria-labelledby="claude-panel-spend"
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
      <Toggle
        name="Proactive recommendations"
        checked={ai.recommendations}
        onToggle={(value) => updateAI({ recommendations: value })}
      />
      <p className="claude-panel-note">
        Rare by design: at most once every few days to once a month across the whole server, when something new lands that someone will love or when someone comes back after a while. They go to the movie or series channel, or by DM for private users.
      </p>
    </BotPanel>
  )
}

export default ClaudePanel
