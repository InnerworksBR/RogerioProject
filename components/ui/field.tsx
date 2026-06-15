"use client"

import * as React from "react"
import { Field as FieldPrimitive } from "@base-ui/react/field"

import { cn } from "@/lib/utils"

/**
 * Field.Root — agrupa label + controle com associação for/id automática via Base UI.
 * Substitui o padrão <label> + <input> sem associação.
 */
function FieldRoot({
  className,
  ...props
}: FieldPrimitive.Root.Props) {
  return (
    <FieldPrimitive.Root
      data-slot="field"
      className={cn("space-y-2", className)}
      {...props}
    />
  )
}

function FieldLabel({
  className,
  ...props
}: FieldPrimitive.Label.Props) {
  return (
    <FieldPrimitive.Label
      data-slot="field-label"
      className={cn(
        "block text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400",
        className
      )}
      {...props}
    />
  )
}

function FieldControl({
  className,
  ...props
}: FieldPrimitive.Control.Props) {
  return (
    <FieldPrimitive.Control
      data-slot="field-control"
      className={cn(className)}
      {...props}
    />
  )
}

function FieldDescription({
  className,
  ...props
}: FieldPrimitive.Description.Props) {
  return (
    <FieldPrimitive.Description
      data-slot="field-description"
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

function FieldError({
  className,
  ...props
}: FieldPrimitive.Error.Props) {
  return (
    <FieldPrimitive.Error
      data-slot="field-error"
      className={cn("text-xs font-medium text-destructive", className)}
      {...props}
    />
  )
}

export { FieldRoot, FieldLabel, FieldControl, FieldDescription, FieldError }
