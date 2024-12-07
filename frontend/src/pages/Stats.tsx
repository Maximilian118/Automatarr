import React, { useContext, useEffect, useState } from "react"
import AppContext from "../context"
import { getData } from "../shared/requests/dataRequests"
import NivoLine from "../components/nivo/nivoLine/NivoLine"
import { CircularProgress } from "@mui/material"

const Stats: React.FC = () => {
  const { data, setData, settings } = useContext(AppContext)
  const [ loading, setLoading ] = useState<boolean>(false)

  useEffect(() => {
    if (!data._id) {
      getData(setData, setLoading)
    }
  }, [data, setData, loading])
  
  return (
    <main>
      { !data._id ? 
        <div className="spinner-centre">
          <CircularProgress/>
        </div> : 
        <>
          {settings.import_blocked && 
            <NivoLine 
              title={"Import Blocked"} 
              data={data.nivoCharts.import_blocked} 
              loading={loading}
            />
          }
          {settings.wanted_missing && 
            <NivoLine 
              title={"Wanted Missing"} 
              data={data.nivoCharts.wanted_mising} 
              loading={loading}
            />
          }
          {settings.remove_failed && 
            <NivoLine 
              title={"Remove Failed"} 
              data={data.nivoCharts.remove_failed} 
              loading={loading}
            />
          }
          {settings.remove_missing && 
            <NivoLine 
              title={"Remove Missing"} 
              data={data.nivoCharts.remove_missing} 
              loading={loading}
            />
          }
          {settings.permissions_change && 
            <NivoLine 
              title={"Permissions Change"} 
              data={data.nivoCharts.permissions_change} 
              loading={loading}
            />
          }
        </>
      }
    </main>
  )
}

export default Stats
