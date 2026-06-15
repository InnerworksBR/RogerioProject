"use client"

import * as React from "react"
import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * AlertDialog — diálogo de confirmação estilizado no tema dark/glass.
 * Substitui window.confirm() em ações destrutivas.
 *
 * Props declarativas:
 *   open, onOpenChange, title, description,
 *   confirmLabel, cancelLabel, variant, onConfirm
 */

const confirmButtonVariants = cva(
  "inline-flex h-9 items-center justify-center rounded-xl px-5 text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:ring-indigo-500/50",
        destructive:
          "bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500/50",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface AlertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "default" | "destructive"
  onConfirm: () => void
  children?: React.ReactNode
}

export function AlertDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "default",
  onConfirm,
}: AlertDialogProps) {
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        {/* Backdrop */}
        <AlertDialogPrimitive.Backdrop
          className={cn(
            "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm",
            "data-open:animate-in data-open:fade-in-0",
            "data-closed:animate-out data-closed:fade-out-0",
            "duration-200"
          )}
        />

        {/* Popup */}
        <AlertDialogPrimitive.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "w-full max-w-sm rounded-2xl p-6 shadow-2xl",
            // dark glass
            "border border-white/10 bg-[#080d1e]/90 backdrop-blur-xl",
            // animação
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-open:slide-in-from-left-1/2 data-open:slide-in-from-top-1/2",
            "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            "duration-200"
          )}
        >
          <AlertDialogPrimitive.Title className="text-base font-bold text-white">
            {title}
          </AlertDialogPrimitive.Title>

          {description && (
            <AlertDialogPrimitive.Description className="mt-2 text-sm leading-relaxed text-slate-400">
              {description}
            </AlertDialogPrimitive.Description>
          )}

          <div className="mt-6 flex justify-end gap-3">
            {/* Cancelar — botão seguro, recebe foco por padrão */}
            <AlertDialogPrimitive.Close
              autoFocus
              className={cn(
                "inline-flex h-9 items-center justify-center rounded-xl px-5 text-sm font-medium transition-colors outline-none",
                "border border-white/10 text-slate-300 hover:bg-white/5 focus-visible:ring-3 focus-visible:ring-ring/50"
              )}
            >
              {cancelLabel}
            </AlertDialogPrimitive.Close>

            {/* Confirmar */}
            <button
              type="button"
              className={confirmButtonVariants({ variant })}
              onClick={() => {
                onConfirm()
                onOpenChange(false)
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </AlertDialogPrimitive.Popup>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  )
}
