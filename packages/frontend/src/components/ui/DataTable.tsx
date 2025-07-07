import { ReactNode } from 'react';
import styles from './DataTable.module.css';

interface Column {
  key: string;
  label: string;
  width?: string;
}

interface DataTableProps {
  columns: Column[];
  data: Record<string, any>[];
  className?: string;
}

export function DataTable({ columns, data, className }: DataTableProps) {
  return (
    <div className={`${styles.tableContainer} ${className || ''}`}>
      <table className={styles.table}>
        <thead className={styles.header}>
          <tr>
            {columns.map((column) => (
              <th 
                key={column.key} 
                className={styles.headerCell}
                style={{ width: column.width }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={index} className={styles.row}>
              {columns.map((column) => (
                <td key={column.key} className={styles.cell}>
                  {row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}