import { STATUSES } from './utils'

const COLS = [['id', 'ID'], ['created_at', 'Submitted'], ['full_name', 'Name'], ['nationality', 'Nationality'], ['passport_number', 'Passport'],
  ['visa_type', 'Visa type'], ['status', 'Status'], ['fee', 'Fee'], ['email', 'Email'], ['phone', 'Phone']]

const toRows = (rows) => rows.map((r) => Object.fromEntries(COLS.map(([k, h]) => [h,
  k === 'created_at' ? (r[k] || '').slice(0, 10) : k === 'status' ? (STATUSES[r[k]]?.label ?? r[k]) : (r[k] ?? '')])))
const stamp = () => new Date().toISOString().slice(0, 10)

export function exportCsv(rows, name = 'applications') {
  // neutralise spreadsheet formula injection from user-supplied text
  const esc = (v) => { let s = String(v ?? ''); if (/^[=@]|^[+-][^\d\s]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"` }
  const head = COLS.map((c) => c[1])
  const csv = [head.join(','), ...toRows(rows).map((r) => head.map((h) => esc(r[h])).join(','))].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })) // BOM → Excel reads Arabic correctly
  a.download = `${name}-${stamp()}.csv`; a.click(); URL.revokeObjectURL(a.href)
}

export async function exportXlsx(rows, name = 'applications') {
  const XLSX = await import('xlsx') // loaded on demand to keep the main bundle small
  const ws = XLSX.utils.json_to_sheet(toRows(rows))
  ws['!cols'] = COLS.map(([, h]) => ({ wch: Math.max(h.length + 2, 16) }))
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Applications')
  XLSX.writeFile(wb, `${name}-${stamp()}.xlsx`)
}
