import React, { useEffect, useRef, useState } from "react"
import { Scale } from "lucide-react"
import InputPanel from "../../panel/inputPanel/InputPanel"
import Button from "../../ui/Button/Button"
import Notice from "../../ui/Notice/Notice"
import { NetworkStatus } from "../../../types/networkType"
import { formatWhen } from "../../../shared/format"
import "./_balancerSwitch.scss"

interface BalancerSwitchProps {
  status: NetworkStatus
  busy: boolean
  onEnable: () => Promise<void>
  onDisable: () => Promise<void>
}

// The on/off switch for the balancer. Turning it on asks first, because it takes over both clients' speed settings
const BalancerSwitch: React.FC<BalancerSwitchProps> = ({ status, busy, onEnable, onDisable }) => {
  const [confirming, setConfirming] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const blocked = !status.enabled && status.blockers.length > 0

  // Move focus to the question when it opens so keyboard and screen reader users land on it
  useEffect(() => {
    if (confirming) cancelRef.current?.focus()
  }, [confirming])

  // Ask before turning on; turn off straight away
  const onToggle = (value: boolean) => {
    if (value) setConfirming(true)
    else onDisable()
  }

  return (
    <InputPanel
      title="Load balancing"
      startIcon={<Scale aria-hidden="true" />}
      checked={status.enabled || confirming}
      onToggle={onToggle}
      disabled={busy || blocked}
      description={`
        Every 10 seconds Automatarr checks what each download client is doing and how busy your internet is, then gives the busy client nearly all of the clients' share.
        The clients' limits never add up to more than your ISP speed minus the reserve, even if Automatarr stops suddenly.
      `}
    >
      {status.enabled && (
        <p className="balancer-switch-state">On since {formatWhen(status.enabled_at)}.</p>
      )}

      {status.enabled && status.degraded && (
        <Notice tone="warn" title="UniFi can't be reached">
          <p>The clients' share is held where it was and won't grow until UniFi is back. Balancing between the clients carries on.</p>
        </Notice>
      )}

      {!status.enabled && status.disabled_reason && (
        <Notice tone="warn" title={`Turned itself off at ${formatWhen(status.disabled_at)}`}>
          <p>{status.disabled_reason}</p>
          <p>Both clients were put on their fixed split. Turn it back on once the problem is fixed.</p>
        </Notice>
      )}

      {blocked && (
        <Notice tone="info" title="Before this can be turned on">
          <ul>
            {status.blockers.map((b) => <li key={b}>{b}</li>)}
          </ul>
        </Notice>
      )}

      {!status.enabled && (
        <Notice tone="warn" title="Turning this on hands Automatarr your download clients' speed settings">
          <ul>
            <li>SABnzbd: Automatarr sets "Maximum line speed" and "Percentage of line speed", and turns off any speed limit schedules.</li>
            <li>qBittorrent: Automatarr sets the global download and upload limits and turns off the speed limit scheduler. The alternative limits are set very low and switched off, and limits are applied to µTP.</li>
            <li>Speed changes made in either app are set back by Automatarr.</li>
            <li>Turning this off, or Automatarr shutting down, leaves both clients on a fixed, even split of your connection. Your previous settings are listed on this page.</li>
          </ul>
        </Notice>
      )}

      {confirming && (
        <div className="balancer-switch-confirm" role="group" aria-label="Turn on load balancing?">
          <p>Take over SABnzbd's and qBittorrent's speed settings and turn on load balancing?</p>
          <div className="balancer-switch-actions">
            <Button ref={cancelRef} variant="secondary" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              loading={busy}
              onClick={async () => {
                await onEnable()
                setConfirming(false)
              }}
            >
              Take over and turn on
            </Button>
          </div>
        </div>
      )}
    </InputPanel>
  )
}

export default BalancerSwitch
