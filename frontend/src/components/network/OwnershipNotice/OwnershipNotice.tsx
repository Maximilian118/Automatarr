import React from "react"
import { History } from "lucide-react"
import InputPanel from "../../panel/inputPanel/InputPanel"
import { NetworkStatus } from "../../../types/networkType"
import { formatWhen } from "../../../shared/format"
import "./_ownershipNotice.scss"

interface OwnershipNoticeProps {
  status: NetworkStatus
}

// What taking over changed in each client, and each client's own speed settings from before, so they can be put back
const OwnershipNotice: React.FC<OwnershipNoticeProps> = ({ status }) => {
  const snapshots = status.downloaders.filter((d) => d.snapshot.length > 0)
  if (!status.takeover_at && snapshots.length === 0) return null

  return (
    <InputPanel title="Taken over settings" startIcon={<History aria-hidden="true" />}>
      {status.takeover_at && (
        <p className="ownership-when">Automatarr took over the download clients' speed settings {formatWhen(status.takeover_at)}.</p>
      )}

      {status.changes.length > 0 && (
        <>
          <h3 className="ownership-heading">What Automatarr changed</h3>
          <ul className="ownership-list">
            {status.changes.map((c) => <li key={c}>{c}</li>)}
          </ul>
        </>
      )}

      {snapshots.map((d) => (
        <details key={d.name} className="ownership-details">
          <summary>{d.label}'s settings before Automatarr took over</summary>
          <ul className="ownership-list">
            {d.snapshot.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </details>
      ))}
    </InputPanel>
  )
}

export default OwnershipNotice
