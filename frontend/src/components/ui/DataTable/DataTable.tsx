import { ReactNode } from "react"
import "./_dataTable.scss"

export interface DataColumn<Row> {
  key: string
  header: string
  cell: (row: Row) => ReactNode
  numeric?: boolean
}

interface DataTableProps<Row> {
  caption: string
  columns: DataColumn<Row>[]
  rows: Row[]
  rowKey: (row: Row) => string
}

// A plain, scrollable data table. Used as the accessible alternative to every chart
const DataTable = <Row,>({ caption, columns, rows, rowKey }: DataTableProps<Row>) => (
  <div className="data-table-wrap" tabIndex={0} role="region" aria-label={caption}>
    <table className="data-table">
      <caption className="visually-hidden">{caption}</caption>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key} scope="col" className={col.numeric ? "numeric" : undefined}>{col.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={rowKey(row)}>
            {columns.map((col, i) =>
              i === 0 ? (
                <th key={col.key} scope="row">{col.cell(row)}</th>
              ) : (
                <td key={col.key} className={col.numeric ? "numeric" : undefined}>{col.cell(row)}</td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

export default DataTable
