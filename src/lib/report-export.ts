// ساخت و خروجی گرفتن گزارش‌ها در فرمت اکسل / CSV / چاپ (PDF)
import { faDateShort, faTime, faToman, faDuration } from '@/lib/format'
import type { AdminData } from '@/lib/types'
import type { DateRange } from '@/components/app/date-filter'
import { inRange } from '@/components/app/date-filter'

export type ReportType = 'all' | 'attendance' | 'cnc' | 'advance' | 'tasks'

export interface ReportSection {
  key: string
  title: string
  headers: string[]
  rows: (string | number)[][]
  widths: number[]
}

export function buildReportSections(
  data: AdminData,
  type: ReportType,
  range: DateRange,
  workerId: string
): ReportSection[] {
  const inR = (ts: number) => inRange(ts, range)
  const workerOk = (uid: string) => workerId === 'ALL' || uid === workerId
  const sections: ReportSection[] = []

  if (type === 'all' || type === 'attendance') {
    const rows = data.attendances
      .filter((a) => inR(new Date(a.timestamp).getTime()) && workerOk(a.userId))
      .map((a) => [a.userName, a.type === 'ENTRY' ? 'ورود' : 'خروج', faDateShort(a.timestamp), faTime(a.timestamp), a.note || ''])
    sections.push({
      key: 'attendance',
      title: 'حضور و غیاب',
      headers: ['نیرو', 'نوع', 'تاریخ', 'ساعت', 'یادداشت'],
      rows,
      widths: [18, 10, 14, 10, 32],
    })
  }

  if (type === 'all' || type === 'cnc') {
    const rows = data.cncJobs
      .filter((c) => inR(new Date(c.startTime).getTime()) && workerOk(c.userId))
      .map((c) => [
        c.userName,
        c.machine,
        c.partName,
        c.material || '',
        faDateShort(c.startTime),
        faTime(c.startTime),
        faTime(c.endTime),
        c.durationMin,
        faDuration(c.durationMin),
        c.status === 'RUNNING' ? 'در جریان' : 'تمام‌شده',
        c.note || '',
      ])
    sections.push({
      key: 'cnc',
      title: 'ماشین‌کاری CNC',
      headers: ['نیرو', 'دستگاه', 'قطعه', 'جنس', 'تاریخ', 'شروع', 'پایان', 'مدت (دقیقه)', 'مدت', 'وضعیت', 'یادداشت'],
      rows,
      widths: [18, 16, 18, 14, 13, 10, 10, 12, 16, 12, 24],
    })
  }

  if (type === 'all' || type === 'advance') {
    const rows = data.advances
      .filter((a) => inR(new Date(a.createdAt).getTime()) && workerOk(a.userId))
      .map((a) => [
        a.userName,
        a.amount,
        faToman(a.amount),
        a.reason,
        a.status === 'PENDING' ? 'در انتظار بررسی' : a.status === 'APPROVED' ? 'تایید شده' : 'رد شده',
        faDateShort(a.createdAt),
        a.reviewedAt ? faDateShort(a.reviewedAt) : '',
        a.reviewNote || '',
      ])
    sections.push({
      key: 'advance',
      title: 'درخواست مساعده',
      headers: ['نیرو', 'مبلغ (تومان)', 'مبلغ', 'دلیل', 'وضعیت', 'تاریخ ثبت', 'تاریخ بررسی', 'یادداشت بررسی'],
      rows,
      widths: [18, 14, 18, 34, 14, 13, 13, 26],
    })
  }

  if (type === 'all' || type === 'tasks') {
    const rows = data.tasks
      .filter((t) => inR(new Date(t.date).getTime()) && workerOk(t.userId))
      .map((t) => [t.userName, t.title, t.category, faDateShort(t.date), t.status === 'DONE' ? 'انجام‌شده' : 'در جریان', t.note || ''])
    sections.push({
      key: 'tasks',
      title: 'گزارش کارها',
      headers: ['نیرو', 'عنوان کار', 'دسته', 'تاریخ', 'وضعیت', 'یادداشت'],
      rows,
      widths: [18, 34, 16, 13, 12, 26],
    })
  }

  return sections
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 3000)
}

/** خروجی اکسل — هر بخش یک شیت */
export async function exportXlsx(sections: ReportSection[], fileName: string) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  for (const s of sections) {
    const ws = XLSX.utils.aoa_to_sheet([s.headers, ...s.rows])
    ws['!cols'] = s.widths.map((w) => ({ wch: w }))
    ;(ws as unknown as Record<string, unknown>)['!views'] = [{ RTL: true }]
    XLSX.utils.book_append_sheet(wb, ws, s.title.replace(/[\\/?*[\]:]/g, '').slice(0, 31))
  }
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  downloadBlob(new Blob([wbout], { type: 'application/octet-stream' }), fileName)
}

/** خروجی CSV سازگار با اکسل (BOM + جداکننده کاما) */
export function exportCsv(section: ReportSection, fileName: string) {
  const esc = (v: string | number) => {
    const s = String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [section.headers, ...section.rows].map((r) => r.map(esc).join(','))
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, fileName)
}

/** چاپ / ذخیره PDF از طریق دیالوگ چاپ مرورگر */
export function printReport(
  sections: ReportSection[],
  meta: { rangeLabel: string; workerLabel: string; generatedAt: string }
) {
  const esc = (v: string | number) =>
    String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const tablesHtml = sections
    .map(
      (s) => `
      <section>
        <h2>${esc(s.title)} <span class="count">(${s.rows.length.toLocaleString('fa-IR')} رکورد)</span></h2>
        ${
          s.rows.length === 0
            ? '<p class="empty">رکوردی در این بازه یافت نشد</p>'
            : `<table>
            <thead><tr>${s.headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
            <tbody>${s.rows
              .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`)
              .join('')}</tbody>
          </table>`
        }
      </section>`
    )
    .join('')

  const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8" />
<title>گزارش اسپاد مبتکران پیشه</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600;800&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Vazirmatn, Tahoma, sans-serif; color: #292524; margin: 0; padding: 16px; }
  header { border-bottom: 3px solid #d97706; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; }
  h1 { font-size: 20px; margin: 0 0 4px; color: #b45309; }
  .meta { font-size: 11px; color: #78716c; line-height: 1.9; }
  section { margin-bottom: 22px; page-break-inside: auto; }
  h2 { font-size: 14px; margin: 0 0 8px; padding-right: 8px; border-right: 4px solid #d97706; }
  h2 .count { font-weight: 400; font-size: 11px; color: #78716c; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  th, td { border: 1px solid #d6d3d1; padding: 5px 7px; text-align: right; }
  thead th { background: #fef3c7; color: #92400e; font-weight: 600; }
  tbody tr:nth-child(even) { background: #fafaf9; }
  tr { page-break-inside: avoid; }
  .empty { color: #a8a29e; font-size: 11px; }
  footer { margin-top: 20px; font-size: 10px; color: #a8a29e; text-align: center; border-top: 1px solid #e7e5e4; padding-top: 8px; }
</style>
</head>
<body>
  <header>
    <div>
      <h1>⚙️ اسپاد مبتکران پیشه — گزارش کارگاه</h1>
      <div class="meta">بازه گزارش: ${esc(meta.rangeLabel)} · نیرو: ${esc(meta.workerLabel)}</div>
    </div>
    <div class="meta">تاریخ تهیه: ${esc(meta.generatedAt)}</div>
  </header>
  ${tablesHtml}
  <footer>اسپاد مبتکران پیشه — بانک اطلاعات مدیریت کارگاه · توسعه‌دهنده: Mostafa Morovati</footer>
</body>
</html>`

  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;'
  document.body.appendChild(iframe)
  const win = iframe.contentWindow
  if (!win) return
  const doc = win.document
  doc.open()
  doc.write(html)
  doc.close()
  setTimeout(() => {
    try {
      win.focus()
      win.print()
    } catch {
      /* ignore */
    }
    setTimeout(() => iframe.remove(), 2000)
  }, 350)
}
