/* @refresh reload */
import { render } from "solid-js/web"
import "./globals.css"
import App from "./app"

const root = document.getElementById("root")

render(() => <App />, root!)
