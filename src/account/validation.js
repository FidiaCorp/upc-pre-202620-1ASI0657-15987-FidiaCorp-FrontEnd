export function normalizeProfile(values) {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    email: values.email.trim().toLowerCase(),
  }
}

export function validateAccount(values, { names = false, registration = false } = {}) {
  const errors = {}
  if (names) {
    for (const [field, label] of [['firstName', 'El nombre'], ['lastName', 'El apellido']]) {
      const value = values[field]?.trim() || ''
      if (!value) errors[field] = `${label} es obligatorio.`
      else if ([...value].length > 100) errors[field] = `${label} admite hasta 100 caracteres.`
    }
  }
  const email = values.email?.trim() || ''
  if (!email) errors.email = 'El correo es obligatorio.'
  else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Ingresa un correo válido de hasta 254 caracteres.'
  if ('password' in values) {
    if (!values.password) errors.password = 'La contraseña es obligatoria.'
    else if (registration && ([...values.password].length < 12 || [...values.password].length > 72 || new TextEncoder().encode(values.password).length > 72)) {
      errors.password = 'Usa entre 12 y 72 caracteres, sin superar 72 bytes UTF-8 (los caracteres especiales pueden ocupar varios bytes).'
    }
  }
  return errors
}

export function safeRedirect(value) {
  return typeof value === 'string' && /^\/(?!\/|\\)/.test(value) && !value.includes('\\') && !/^\/(login|register)(?:[/?#]|$)/.test(value) ? value : '/profile'
}
