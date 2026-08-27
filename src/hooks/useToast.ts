import * as React from 'react'
import type { ToastActionElement, ToastProps } from '@/components/ui/toast'

/**
 * Minimal toast store (the shadcn pattern, trimmed).
 * A module-level store means services can raise a toast without prop drilling.
 */

const TOAST_LIMIT = 3
const TOAST_REMOVE_DELAY = 5000

/** `title` is widened to ReactNode, so the DOM `title` attribute is dropped. */
export interface ToasterToast extends Omit<ToastProps, 'title'> {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

type State = { toasts: ToasterToast[] }

let count = 0
function nextId(): string {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return String(count)
}

const listeners: Array<(state: State) => void> = []
let memoryState: State = { toasts: [] }

function setState(updater: (state: State) => State): void {
  memoryState = updater(memoryState)
  listeners.forEach((listener) => listener(memoryState))
}

function dismiss(toastId?: string): void {
  setState((state) => ({
    toasts: state.toasts.map((toast) =>
      toastId === undefined || toast.id === toastId ? { ...toast, open: false } : toast,
    ),
  }))
  window.setTimeout(() => {
    setState((state) => ({
      toasts: state.toasts.filter((toast) => (toastId ? toast.id !== toastId : toast.open)),
    }))
  }, 200)
}

export function toast(props: Omit<ToasterToast, 'id'>) {
  const id = nextId()

  setState((state) => ({
    toasts: [
      { ...props, id, open: true, onOpenChange: (open: boolean) => !open && dismiss(id) },
      ...state.toasts,
    ].slice(
      0,
      TOAST_LIMIT,
    ),
  }))

  window.setTimeout(() => dismiss(id), TOAST_REMOVE_DELAY)

  return { id, dismiss: () => dismiss(id) }
}

/** Convenience wrapper so error paths read the same everywhere. */
export function toastError(error: unknown, fallback = 'Something went wrong.') {
  return toast({
    variant: 'destructive',
    title: 'Error',
    description: error instanceof Error ? error.message : fallback,
  })
}

export function useToast() {
  const [state, setLocalState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setLocalState)
    return () => {
      const index = listeners.indexOf(setLocalState)
      if (index > -1) listeners.splice(index, 1)
    }
  }, [])

  return { ...state, toast, dismiss }
}
