import * as React from 'react'

/**
 * Global keyboard shortcuts.
 *
 * Shortcuts are suppressed while the user is typing in a field unless the combo
 * includes a modifier — otherwise pressing "n" inside the quick-add box would
 * trigger navigation instead of typing a letter.
 */

export interface ShortcutOptions {
  key: string
  meta?: boolean
  shift?: boolean
  alt?: boolean
  /** Allow the shortcut to fire while an input has focus. */
  allowInInput?: boolean
  enabled?: boolean
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable
}

export function useKeyboardShortcut(
  options: ShortcutOptions,
  handler: (event: KeyboardEvent) => void,
): void {
  const handlerRef = React.useRef(handler)
  handlerRef.current = handler

  const { key, meta = false, shift = false, alt = false, allowInInput = false, enabled = true } =
    options

  React.useEffect(() => {
    if (!enabled) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== key.toLowerCase()) return

      const modifierPressed = event.metaKey || event.ctrlKey
      if (meta !== modifierPressed) return
      if (shift !== event.shiftKey) return
      if (alt !== event.altKey) return
      if (!allowInInput && !meta && isTypingTarget(event.target)) return

      event.preventDefault()
      handlerRef.current(event)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [key, meta, shift, alt, allowInInput, enabled])
}

/** Human-readable shortcut hint, "⌘K" on macOS and "Ctrl K" elsewhere. */
export function shortcutLabel(key: string, withModifier = true): string {
  if (!withModifier) return key.toUpperCase()
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
  return isMac ? `⌘${key.toUpperCase()}` : `Ctrl ${key.toUpperCase()}`
}
