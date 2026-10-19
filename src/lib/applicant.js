export const A_KEYS = ['full_name', 'nationality', 'passport_number', 'phone', 'email', 'date_of_birth', 'country_of_residence']
export const first = (o, keys) => { for (const k of keys) if (o?.[k] != null && o[k] !== '') return o[k] }
export const serviceName = (s) => first(s, ['name', 'name_en', 'title', 'label', 'slug', 'code']) ?? String(s.id)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-/i
// service_id may be a readable code like "family_visit": show it as "Family visit"
export const prettyService = (v) => (v == null || v === '' ? undefined : UUID.test(String(v)) ? String(v) : String(v).replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase()))
