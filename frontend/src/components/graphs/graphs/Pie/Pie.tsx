import React from "react"
import { ResponsivePie } from "@nivo/pie"
import { useTheme } from "@mui/material"
import "./_pie.scss"

interface PieDataItem {
  id: string
  value: number
  color: string
}

interface PieProps {
  data: PieDataItem[]
}

// Responsive pie chart with sensible defaults for styling and legend configuration
const Pie: React.FC<PieProps> = ({ data }) => {
  const theme = useTheme()

  return (
    <div className="pie-chart-container">
      <ResponsivePie
        data={data}
        margin={{ top: 40, right: 80, bottom: 80, left: 80 }}
        innerRadius={0.5}
        padAngle={0.7}
        cornerRadius={3}
        activeOuterRadiusOffset={8}
        borderWidth={1}
        borderColor={{ from: "color", modifiers: [["darker", 0.2]] }}
        arcLinkLabelsSkipAngle={10}
        arcLinkLabelsTextColor={theme.palette.text.primary}
        arcLinkLabelsThickness={2}
        arcLinkLabelsColor={{ from: "color" }}
        arcLabelsSkipAngle={10}
        arcLabelsTextColor={{ from: "color", modifiers: [["darker", 2]] }}
        legends={[
          {
            anchor: "bottom",
            direction: "row",
            justify: false,
            translateX: 0,
            translateY: 56,
            itemsSpacing: 0,
            itemWidth: 100,
            itemHeight: 18,
            itemTextColor: theme.palette.text.primary,
            itemDirection: "left-to-right",
            itemOpacity: 1,
            symbolSize: 18,
            symbolShape: "circle",
            effects: [
              {
                on: "hover",
                style: { itemTextColor: theme.palette.primary.main },
              },
            ],
          },
        ]}
      />
    </div>
  )
}

export default Pie
