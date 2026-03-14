export const isDataUrl = (value = '') => typeof value === 'string' && value.startsWith('data:')

export const assertNoDataUrls = (values = []) =>
  values.every((value) => !isDataUrl(value))
