/**
 * Component interface and Container - the core building blocks.
 * Components return string[] lines. The TUI concatenates and diff-renders them.
 */

/** All components implement this interface */
export interface Component {
  /** Render to lines for the given viewport width */
  render(width: number): string[]
  /** Handle keyboard input when this component has focus */
  handleInput?(data: string): void
  /** Clear cached render state */
  invalidate(): void
}

/** Container holds child components, renders them sequentially */
export class Container implements Component {
  children: Component[] = []

  addChild(component: Component): void {
    this.children.push(component)
  }

  removeChild(component: Component): void {
    const index = this.children.indexOf(component)
    if (index !== -1) this.children.splice(index, 1)
  }

  clear(): void {
    this.children = []
  }

  invalidate(): void {
    for (const child of this.children) child.invalidate()
  }

  render(width: number): string[] {
    const lines: string[] = []
    for (const child of this.children) {
      lines.push(...child.render(width))
    }
    return lines
  }
}
