import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"

import { Log } from "@/util/log"
import { Session } from "@/session"

const log = Log.create({ service: "server" })

export function SessionRoutes() {
  return new Hono()
    .get(
      "/",
      describeRoute({
        summary: "List sessions",
        description: "List all sessions ordered by last update.",
        operationId: "session.list",
        responses: {
          200: {
            description: "List of sessions",
            content: {
              "application/json": {
                schema: resolver(Session.Info.array()),
              },
            },
          },
        },
      }),
      async (c) => {
        const sessions = Session.list()
        return c.json(sessions)
      },
    )
    .get(
      "/:sessionID",
      describeRoute({
        summary: "Get session",
        description: "Retrieve a session by id.",
        operationId: "session.get",
        responses: {
          200: {
            description: "Session",
            content: {
              "application/json": {
                schema: resolver(Session.Info),
              },
            },
          },
          404: {
            description: "Session not found",
          },
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().min(1),
        }),
      ),
      async (c) => {
        const { sessionID } = c.req.valid("param")
        const session = Session.get(sessionID)
        if (!session) {
          return c.json({ error: "Session not found" }, 404)
        }
        return c.json(session)
      },
    )
    .post(
      "/",
      describeRoute({
        summary: "Create session",
        description: "Create a new session.",
        operationId: "session.create",
        requestBody: {
          content: {
            "application/json": {
              schema: resolver(Session.CreateInput) as any,
            },
          },
        },
        responses: {
          200: {
            description: "Created session",
            content: {
              "application/json": {
                schema: resolver(Session.Info),
              },
            },
          },
        },
      }),
      validator("json", Session.CreateInput),
      async (c) => {
        const input = c.req.valid("json")
        const session = Session.create(input)
        log.info("session created", { sessionID: session.id })
        return c.json(session)
      },
    )
    .patch(
      "/:sessionID",
      describeRoute({
        summary: "Update session",
        description: "Update an existing session.",
        operationId: "session.update",
        requestBody: {
          content: {
            "application/json": {
              schema: resolver(Session.UpdateInput) as any,
            },
          },
        },
        responses: {
          200: {
            description: "Updated session",
            content: {
              "application/json": {
                schema: resolver(Session.Info),
              },
            },
          },
          404: {
            description: "Session not found",
          },
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().min(1),
        }),
      ),
      validator("json", Session.UpdateInput),
      async (c) => {
        const { sessionID } = c.req.valid("param")
        const input = c.req.valid("json")
        const session = Session.update(sessionID, input)
        if (!session) {
          return c.json({ error: "Session not found" }, 404)
        }
        return c.json(session)
      },
    )
}
