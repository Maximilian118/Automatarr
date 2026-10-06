import React, { useEffect, useState } from "react"
import { InputAdornment, TextField } from "@mui/material"
import { SlidersHorizontal } from "lucide-react"
import InputPanel from "../../panel/inputPanel/InputPanel"
import SaveBar from "../../ui/SaveBar/SaveBar"
import { SaveStatus } from "../../../shared/hooks/useSaveFeedback"
import { NetworkConfig, NetworkStatus } from "../../../types/networkType"
import { bpsToMbps, formatRate, mbpsToBps } from "../../../shared/format"
import "./_balancerConfigForm.scss"

interface BalancerConfigFormProps {
  status: NetworkStatus
  saving: boolean
  saveStatus: SaveStatus
  savedAt: Date | null
  onSave: (config: NetworkConfig) => Promise<void>
}

type FormValues = Record<string, string>

// A speed in bytes per second as an Mbps field value. Blank means "let Automatarr decide"
const toField = (bps: number | null): string => (bps ? String(Math.round(bpsToMbps(bps) * 10) / 10) : "")

// A field value as a number. Blank is null; anything that isn't a positive number is NaN
const fromField = (value: string): number | null => {
  if (value.trim() === "") return null
  const parsed = Number(value)
  return isFinite(parsed) && parsed > 0 ? parsed : NaN
}

// The form's starting values from the saved settings
const valuesFrom = (config: NetworkConfig): FormValues => ({
  capacity_down: toField(config.capacity_down),
  capacity_up: toField(config.capacity_up),
  reserve_down: toField(config.reserve_down),
  reserve_up: toField(config.reserve_up),
  overhead_pct: config.overhead_pct ? String(config.overhead_pct) : "",
  ...Object.fromEntries(config.caps.flatMap((c) => [[`${c.name}_down`, toField(c.down)], [`${c.name}_up`, toField(c.up)]])),
})

// The balancer's settings. Every field is optional: blank fields use the figure Automatarr works out, shown in the field
const BalancerConfigForm: React.FC<BalancerConfigFormProps> = ({ status, saving, saveStatus, savedAt, onSave }) => {
  const [values, setValues] = useState<FormValues>(() => valuesFrom(status.config))
  const configKey = JSON.stringify(status.config)

  // Reload the fields when the saved settings change, but not on every status refresh, so typing isn't lost
  useEffect(() => {
    setValues(valuesFrom(JSON.parse(configKey) as NetworkConfig))
  }, [configKey])

  const invalid = Object.values(values).some((v) => Number.isNaN(fromField(v)))

  // One number field with its unit and the automatic value as a placeholder
  const field = (key: string, label: string, auto: string, unit = "Mbps") => {
    const error = Number.isNaN(fromField(values[key] ?? ""))

    return (
      <TextField
        key={key}
        name={key}
        label={label}
        value={values[key] ?? ""}
        placeholder={auto}
        error={error}
        helperText={error ? "Must be a number above 0, or blank" : undefined}
        onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
        slotProps={{
          inputLabel: { shrink: true },
          input: { endAdornment: <InputAdornment position="end">{unit}</InputAdornment> },
          htmlInput: { inputMode: "decimal" },
        }}
      />
    )
  }

  // A speed field's value in bytes per second for saving
  const bps = (key: string): number | null => {
    const mbps = fromField(values[key] ?? "")
    return mbps === null ? null : mbpsToBps(mbps)
  }

  // Send the settings, converting Mbps back to bytes per second. Nothing is sent while a field is highlighted
  const save = () => {
    if (invalid) return

    return onSave({
      capacity_down: bps("capacity_down"),
      capacity_up: bps("capacity_up"),
      reserve_down: bps("reserve_down"),
      reserve_up: bps("reserve_up"),
      overhead_pct: fromField(values.overhead_pct ?? ""),
      caps: status.downloaders.map((d) => ({ name: d.name, down: bps(`${d.name}_down`), up: bps(`${d.name}_up`) })),
    })
  }

  const auto = (bpsValue: number | null) => (bpsValue ? `Auto: ${formatRate(bpsValue)}` : "Unknown, please enter")

  return (
    <InputPanel
      title="Balancer settings"
      startIcon={<SlidersHorizontal aria-hidden="true" />}
      description={`
        Leave a field blank to use the figure Automatarr works out, shown in grey. Speeds are in megabits per second, as your ISP quotes them.
      `}
      bottom={
        <SaveBar
          loading={saving}
          status={saveStatus}
          savedAt={savedAt}
          label="Save balancer settings"
          onClick={save}
        />
      }
    >
      <h3 className="balancer-config-heading">Your connection</h3>
      <div className="balancer-config-fields">
        {field("capacity_down", "ISP download speed", auto(status.recommended_capacity.down))}
        {field("capacity_up", "ISP upload speed", auto(status.recommended_capacity.up))}
        {field("reserve_down", "Download kept free", auto(status.recommended_reserve.down))}
        {field("reserve_up", "Upload kept free", auto(status.recommended_reserve.up))}
        {field("overhead_pct", "Protocol overhead", `Auto: ${status.recommended_overhead_pct}%`, "%")}
      </div>
      <h3 className="balancer-config-heading">Download client maximums</h3>
      <p className="balancer-config-note">
        Optional. A client is never given more than its maximum, even when it's the only one downloading.
      </p>
      <div className="balancer-config-fields">
        {status.downloaders.flatMap((d) => [
          field(`${d.name}_down`, `${d.label} maximum download`, "No maximum"),
          ...(d.supports_upload ? [field(`${d.name}_up`, `${d.label} maximum upload`, "No maximum")] : []),
        ])}
      </div>
    </InputPanel>
  )
}

export default BalancerConfigForm
