import pino from 'pino'

export const rootLogger = pino({ level: Bun.env['LOG_LEVEL'] || 'info' })
