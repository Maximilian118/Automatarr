import React, { useState } from "react"
import PageHeader from "../../components/ui/PageHeader/PageHeader"
import Footer from "../../components/footer/Footer"
import CenteredLoading from "../../components/utility/CenteredLoading/CenteredLoading"
import Notice from "../../components/ui/Notice/Notice"
import NetworkTiles from "../../components/network/NetworkTiles/NetworkTiles"
import DownloaderCard from "../../components/network/DownloaderCard/DownloaderCard"
import LiveBandwidthChart from "../../components/network/LiveBandwidthChart/LiveBandwidthChart"
import BalancerSwitch from "../../components/network/BalancerSwitch/BalancerSwitch"
import BalancerConfigForm from "../../components/network/BalancerConfigForm/BalancerConfigForm"
import OwnershipNotice from "../../components/network/OwnershipNotice/OwnershipNotice"
import BalancerEvents from "../../components/network/BalancerEvents/BalancerEvents"
import { useNetworkStatus } from "../../shared/hooks/useNetworkStatus"
import { useAuthHandlers } from "../../shared/hooks/useAuthHandlers"
import { useToast } from "../../shared/toast/useToast"
import { SaveStatus } from "../../shared/hooks/useSaveFeedback"
import { setNetworkBalancer, updateNetworkBalancer } from "../../shared/requests/networkRequests"
import { NetworkConfig } from "../../types/networkType"
import { formatWhen } from "../../shared/format"
import "./_network.scss"

// Share the internet connection between the download clients, and show everything the sharing is based on
const Network: React.FC = () => {
  const { status, setStatus, error } = useNetworkStatus()
  const auth = useAuthHandlers()
  const { showToast } = useToast()
  const [switching, setSwitching] = useState<boolean>(false)
  const [saving, setSaving] = useState<boolean>(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  // Turn the balancer on or off and show the outcome. Turning on can fail with the reasons why
  const toggle = async (enabled: boolean) => {
    setSwitching(true)
    try {
      setStatus(await setNetworkBalancer(enabled, auth))
      showToast({ tone: "success", title: enabled ? "Load balancing is on" : "Load balancing is off" })
    } catch (err) {
      showToast({
        tone: "error",
        title: enabled ? "Load balancing wasn't turned on" : "Load balancing wasn't turned off",
        message: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setSwitching(false)
    }
  }

  // Save the balancer's settings and show the outcome
  const save = async (config: NetworkConfig) => {
    setSaving(true)
    setSaveStatus("saving")
    try {
      setStatus(await updateNetworkBalancer(config, auth))
      setSaveStatus("saved")
      setSavedAt(new Date())
      showToast({ tone: "success", title: "Balancer settings saved" })
    } catch (err) {
      setSaveStatus("failed")
      showToast({
        tone: "error",
        title: "Balancer settings not saved",
        message: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  const header = (
    <PageHeader
      title="Network"
      description="Shares your internet connection between the download clients. Whichever one is busy gets nearly all of it, and everything else on your network always comes first."
    />
  )

  if (!status) {
    return (
      <main>
        {header}
        {error ? <Notice tone="error" title="Couldn't load the network status"><p>{error}</p></Notice> : <CenteredLoading label="Reading your network" />}
      </main>
    )
  }

  return (
    <main className="network">
      {header}

      {error && (
        <Notice tone="error" title="Couldn't refresh the network status">
          <p>{error}. Showing the last reading.</p>
        </Notice>
      )}

      {status.unifi.login_paused_until && (
        <Notice tone="warn" title="UniFi login paused">
          <p>
            UniFi refused the username and password, so Automatarr has stopped trying until {formatWhen(status.unifi.login_paused_until)} to
            avoid locking the account. Check them on the Connections page.
          </p>
        </Notice>
      )}

      <BalancerSwitch
        status={status}
        busy={switching}
        onEnable={() => toggle(true)}
        onDisable={() => toggle(false)}
      />

      <NetworkTiles status={status} />

      <div className="network-downloaders">
        {status.downloaders.map((d) => (
          <DownloaderCard key={d.name} downloader={d} enabled={status.enabled} />
        ))}
      </div>

      <LiveBandwidthChart history={status.history} downloaders={status.downloaders} />

      <div className="network-panels">
        <BalancerConfigForm status={status} saving={saving} saveStatus={saveStatus} savedAt={savedAt} onSave={save} />
        <div className="network-side">
          <OwnershipNotice status={status} />
          <BalancerEvents events={status.events} />
        </div>
      </div>

      <div className="page-bottom">
        <Footer />
      </div>
    </main>
  )
}

export default Network
