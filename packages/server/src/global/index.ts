import os from "os"
import path from "path"
import fs from "fs/promises"

import { xdgData, xdgCache, xdgConfig, xdgState } from "xdg-basedir"

export namespace Global {
  const appName = "piclaw"
  const isDev = process.env.NODE_ENV !== "production"

  const root = isDev ? path.join(resolveRepoRoot(), "data") : xdgData!

  const data = isDev ? root : xdgData!
  const cache = isDev ? path.join(root, "cache") : path.join(xdgCache!, appName)
  const config = isDev ? path.join(root, "config") : path.join(xdgConfig!, appName)
  const state = isDev ? path.join(root, "state") : path.join(xdgState!, appName)

  export const Path = {
    get home() {
      return process.env.PICLAW_HOME || os.homedir()
    },
    data: data,
    log: path.join(data, "log"),
    cache: cache,
    config: config,
    state: state,
  }
}

function resolveRepoRoot() {
  const cwd = process.cwd()
  const parts = cwd.split(path.sep)
  if (parts.slice(-2).join(path.sep) === path.join("packages", "server")) {
    return path.resolve(cwd, "..", "..")
  }
  return cwd
}

await Promise.all([
  fs.mkdir(Global.Path.data, { recursive: true }),
  fs.mkdir(Global.Path.log, { recursive: true }),
  fs.mkdir(Global.Path.cache, { recursive: true }),
  fs.mkdir(Global.Path.config, { recursive: true }),
  fs.mkdir(Global.Path.state, { recursive: true }),
])
