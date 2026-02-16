import { EventEmitter } from "events"
import z from "zod"

export const ServerConnectedEvent = z.object({
  type: z.literal("server.connected"),
  properties: z.object({}),
})

export const ServerHeartbeatEvent = z.object({
  type: z.literal("server.heartbeat"),
  properties: z.object({}),
})

export const Event = z.discriminatedUnion("type", [
  ServerConnectedEvent,
  ServerHeartbeatEvent,
])

export type Event = z.infer<typeof Event>

class BusClass extends EventEmitter<{
  event: [Event]
}> {
  publish<T extends Event>(event: T) {
    this.emit("event", event)
  }

  subscribe(callback: (event: Event) => void) {
    this.on("event", callback)
    return () => this.off("event", callback)
  }
}

export const Bus = new BusClass()
