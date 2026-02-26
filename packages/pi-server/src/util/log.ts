import pino from "pino"

const isProd = process.env.NODE_ENV === "production"

export const log = pino(
  {
    level: process.env.LOG_LEVEL ?? "info",
  },
  isProd
    ? undefined
    : pino.transport({
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss.l",
          ignore: "pid,hostname",
        },
      }),
)
