export const A_KEYS = ['full_name', 'nationality', 'passport_number', 'phone', 'email', 'date_of_birth', 'country_of_residence']
export const first = (o, keys) => { for (const k of keys) if (o?.[k] != null && o[k] !== '') return o[k] }
export const serviceName = (s) => first(s, ['name', 'name_en', 'title', 'label', 'slug', 'code']) ?? String(s.id)
