import os from "os"
import path from "path"
import fs from "fs/promises"

import { xdgData, xdgCache, xdgConfig, xdgState } from "xdg-basedir"

export namespace Global {
  const appName = "codec"
  const isDev = process.env.NODE_ENV !== "production"

  const root = isDev ? path.join(process.cwd(), "data") : xdgData!

  const data = isDev ? root : xdgData!
  const cache = isDev ? path.join(root, "cache") : path.join(xdgCache!, appName)
  const config = isDev ? path.join(root, "config") : path.join(xdgConfig!, appName)
  const state = isDev ? path.join(root, "state") : path.join(xdgState!, appName)

  export const Path = {
    get home() {
      return process.env.CODEC_HOME || os.homedir()
    },
    data: data,
    log: path.join(data, "log"),
    cache: cache,
    config: config,
    state: state,
  }
}

await Promise.all([
  fs.mkdir(Global.Path.data, { recursive: true }),
  fs.mkdir(Global.Path.log, { recursive: true }),
  fs.mkdir(Global.Path.cache, { recursive: true }),
  fs.mkdir(Global.Path.config, { recursive: true }),
  fs.mkdir(Global.Path.state, { recursive: true }),
])
