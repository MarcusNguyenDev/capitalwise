import type { ReactNode } from "react";

import { joinClassNames } from "./join_class_names.util";

export interface TableColumn<Row> {
  key: string;
  header: string;
  is_numeric?: boolean;
  class_name?: string;
  renderCell: (row: Row) => ReactNode;
}

interface DataTableProps<Row> {
  caption: string;
  columns: TableColumn<Row>[];
  rows: Row[];
  readRowKey: (row: Row) => string;
  footer?: ReactNode;
}

/** A plain, readable table. The caption is visually hidden but names the table for screen readers. */
export function DataTable<Row>({ caption, columns, rows, readRowKey, footer }: DataTableProps<Row>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line bg-surface">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={joinClassNames("whitespace-nowrap py-3 pr-4 text-xs font-semibold text-brand-deep first:pl-2 last:pr-2", column.is_numeric && "text-right")}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={readRowKey(row)} className="border-b border-line align-top transition-colors last:border-b-0 hover:bg-surface">
              {columns.map((column) => (
                <td key={column.key} className={joinClassNames("py-3.5 pr-4 first:pl-2 last:pr-2", column.is_numeric && "text-right tabular-nums", column.class_name)}>
                  {column.renderCell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer ? <tfoot>{footer}</tfoot> : null}
      </table>
    </div>
  );
}
