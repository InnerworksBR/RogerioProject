"use client"

import * as React from "react"
import { AlertDialog } from "./alert-dialog"

export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "default" | "destructive"
}

interface ConfirmState extends ConfirmOptions {
  open: boolean
  resolve: (value: boolean) => void
}

const NOOP_RESOLVE = () => undefined

/**
 * useConfirm — hook imperativo que substitui window.confirm().
 *
 * Uso:
 *   const { confirm, ConfirmDialog } = useConfirm()
 *   ...
 *   const ok = await confirm({ title: "Excluir?", variant: "destructive" })
 *   if (!ok) return
 *
 * Renderize <ConfirmDialog /> uma vez na árvore do componente (componente estável,
 * não recriado a cada render).
 */
export function useConfirm() {
  const [state, setState] = React.useState<ConfirmState>({
    open: false,
    title: "",
    resolve: NOOP_RESOLVE,
  })

  const confirm = React.useCallback(
    (options: ConfirmOptions): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        setState({
          ...options,
          open: true,
          resolve,
        })
      })
    },
    []
  )

  const handleClose = React.useCallback((open: boolean) => {
    if (!open) {
      setState((current) => {
        current.resolve(false)
        return { ...current, open: false }
      })
    }
  }, [])

  const handleConfirm = React.useCallback(() => {
    setState((current) => {
      current.resolve(true)
      return { ...current, open: false }
    })
  }, [])

  // ConfirmDialog é um elemento JSX estável — não recriamos o component type em cada render.
  // Usamos uma ref para manter acesso ao state mais recente sem criar um novo componente.
  const stateRef = React.useRef(state)
  stateRef.current = state

  // Componente estável: a function reference nunca muda, logo React não vai
  // unmount/remount o AlertDialog ao atualizar o estado do diálogo.
  const ConfirmDialog = React.useMemo(
    () =>
      function ConfirmDialogComponent() {
        const s = stateRef.current
        return (
          <AlertDialog
            open={s.open}
            onOpenChange={handleClose}
            title={s.title}
            description={s.description}
            confirmLabel={s.confirmLabel}
            cancelLabel={s.cancelLabel}
            variant={s.variant}
            onConfirm={handleConfirm}
          />
        )
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handleClose, handleConfirm]
  )

  return { confirm, ConfirmDialog }
}
