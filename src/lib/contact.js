import { STATUSES } from './utils'

// Saudi local mobiles (05xxxxxxxx) get +966; 00-prefixed numbers are normalised; others are used as-is.
export function waNumber(phone) {
  let d = String(phone || '').replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  else if (/^05\d{8}$/.test(d)) d = '966' + d.slice(1)
  return d
}

const ref = (r) => String(r.id).slice(0, 8).toUpperCase()

// Arabic status templates. `extra` (optional) is appended, e.g. what the applicant must fix.
export function statusMessage(status, r, extra = '') {
  const name = r.full_name || ''
  const head = `السلام عليكم ${name}،`
  const id = `(رقم الطلب: ${ref(r)})`
  const body = {
    pending: `تم استلام طلب التأشيرة الخاص بكم ${id} وهو قيد المراجعة حالياً. سنوافيكم بأي مستجدات.`,
    approved: `يسعدنا إبلاغكم بالموافقة على طلب التأشيرة ${id}. ستصلكم التأشيرة قريباً، ويمكنكم متابعتها من حسابكم.`,
    rejected: `نأسف لإبلاغكم بأنه تعذّر قبول طلب التأشيرة ${id}. للاستفسار يرجى التواصل معنا.`,
    action_needed: `نحتاج منكم إجراءً لاستكمال طلب التأشيرة ${id}. يرجى تحديث البيانات أو المستندات المطلوبة في أقرب وقت.`,
  }[status] || ''
  return [head, body, extra && extra.trim()].filter(Boolean).join('\n')
}

export function whatsappUrl(r, text) {
  const n = waNumber(r.phone)
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : null
}

export function mailtoUrl(r, status, text) {
  if (!r.email) return null
  const subject = `تحديث حالة طلب التأشيرة ${ref(r)} – ${STATUSES[status]?.label || ''}`
  return `mailto:${r.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`
}
