export const isValidOtp = (value) => /^\d{6}$/.test(value)

export function twoFactorError(error) {
  switch (error.code) {
    case 'TWO_FACTOR_REQUIRED': return 'Ingresa el código de seis dígitos de tu aplicación autenticadora.'
    case 'TWO_FACTOR_INVALID': return 'Código incorrecto, vencido o ya utilizado. Espera al siguiente código de tu aplicación e intenta nuevamente.'
    case 'INVALID_CREDENTIALS': return 'La contraseña no es correcta.'
    case 'TWO_FACTOR_LOCKED': return 'Demasiados intentos. Espera antes de intentar nuevamente.'
    case 'TWO_FACTOR_SETUP_EXPIRED': return 'La configuración venció. Genera una nueva clave para continuar.'
    case 'TWO_FACTOR_ALREADY_ENABLED': return 'El segundo factor ya está activado. Actualiza el estado.'
    case 'TWO_FACTOR_UNAVAILABLE': return 'El segundo factor no está disponible en este momento. Intenta más tarde.'
    default: return error.message
  }
}
