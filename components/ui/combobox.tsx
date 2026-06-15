"use client"

import * as React from "react"
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"
import { ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export interface ComboboxItem {
  value: string
  /** Texto principal exibido e pesquisável */
  label: string
  /** Rótulo auxiliar exibido à direita (ex.: código do cliente). Também pesquisável. */
  sublabel?: string
}

export interface ComboboxProps {
  /** Lista completa de itens */
  items: ComboboxItem[]
  /** Valor selecionado atualmente (string) */
  value?: string | null
  /** Chamado quando o usuário seleciona um item */
  onValueChange?: (value: string | null) => void
  /**
   * Chamado a cada mudança do texto digitado no input.
   * Útil para busca server-side: o chamador atualiza `items` conforme o termo.
   */
  onInputChange?: (query: string) => void
  /** Placeholder do input de busca */
  placeholder?: string
  /** Rótulo acessível do campo (aria-label) */
  "aria-label"?: string
  /** Mensagem exibida quando nenhum item corresponde à busca */
  emptyMessage?: string
  /** Classes extras para o container raiz */
  className?: string
  /** Classes extras para o grupo de input (borda + fundo) */
  inputGroupClassName?: string
  /** Classes extras para o elemento input */
  inputClassName?: string
  /** Desabilitar o combobox */
  disabled?: boolean
}

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
}

/**
 * Componente interno que lê os itens filtrados do contexto do Root
 * e renderiza apenas os itens que passaram pelo filtro.
 */
function ComboboxItemList({
  itemMap,
  emptyMessage,
}: {
  itemMap: Map<string, ComboboxItem>
  emptyMessage: string
}) {
  // useFilteredItems lê do contexto interno do ComboboxRoot
  // e retorna apenas os valores que passaram pelo filter.
  const filteredValues = ComboboxPrimitive.useFilteredItems() as string[]

  return (
    <>
      <ComboboxPrimitive.Empty className="px-3 py-6 text-center text-sm text-slate-400">
        {emptyMessage}
      </ComboboxPrimitive.Empty>
      {filteredValues.map((itemValue) => {
        const item = itemMap.get(itemValue)
        if (!item) return null
        return (
          <ComboboxPrimitive.Item
            key={item.value}
            value={item.value}
            className={cn(
              "flex w-full cursor-default items-center justify-between rounded-lg px-3 py-2",
              "text-sm text-slate-200 outline-none select-none transition-colors",
              "data-highlighted:bg-indigo-500/20 data-highlighted:text-white",
              "data-selected:font-semibold"
            )}
          >
            <span className="truncate">{item.label}</span>
            {item.sublabel && (
              <span className="ml-3 shrink-0 rounded-md bg-white/5 px-2 py-0.5 font-mono text-xs text-slate-500">
                {item.sublabel}
              </span>
            )}
          </ComboboxPrimitive.Item>
        )
      })}
    </>
  )
}

/**
 * Combobox genérico e acessível sobre @base-ui/react/combobox.
 *
 * - ARIA: role="combobox" + role="listbox" + role="option" automáticos pelo primitivo
 * - Teclado: ArrowUp/ArrowDown navegam, Enter seleciona, Escape fecha
 * - Filtragem: por label E sublabel (código) — case-insensitive, sem acentos
 * - Genérico: baseado em { value, label, sublabel? }, reutilizável pela impl 013
 */
export function Combobox({
  items,
  value,
  onValueChange,
  onInputChange,
  placeholder = "Buscar...",
  "aria-label": ariaLabel,
  emptyMessage = "Nenhum resultado encontrado.",
  className,
  inputGroupClassName,
  inputClassName,
  disabled = false,
}: ComboboxProps) {
  // Array de valores (strings) passado ao Root para gerenciar filtragem interna
  const itemValues = React.useMemo(() => items.map((i) => i.value), [items])

  // Mapa value -> ComboboxItem para lookup rápido no filtro e na renderização
  const itemMap = React.useMemo(
    () => new Map(items.map((item) => [item.value, item])),
    [items]
  )

  // Função de filtro: recebe (itemValue: string, query: string) -> boolean
  // Pesquisa por label OU sublabel, ignorando acentos e capitalização.
  const filter = React.useCallback(
    (itemValue: string, query: string): boolean => {
      if (!query) return true
      const item = itemMap.get(itemValue)
      if (!item) return false
      const q = normalize(query)
      return (
        normalize(item.label).includes(q) ||
        (item.sublabel != null ? normalize(item.sublabel).includes(q) : false)
      )
    },
    [itemMap]
  )

  // itemToStringLabel: usado pelo Root para preencher o input ao selecionar
  const itemToStringLabel = React.useCallback(
    (itemValue: string) => itemMap.get(itemValue)?.label ?? itemValue,
    [itemMap]
  )

  const handleValueChange = React.useCallback(
    (newValue: string | null) => {
      onValueChange?.(newValue ?? null)
    },
    [onValueChange]
  )

  return (
    <div className={cn("relative w-full", className)}>
    <ComboboxPrimitive.Root
      value={value ?? null}
      onValueChange={handleValueChange}
      disabled={disabled}
      items={itemValues}
      filter={filter}
      itemToStringLabel={itemToStringLabel}
    >
      <ComboboxPrimitive.InputGroup
        className={cn(
          "relative flex w-full items-center",
          "rounded-xl border border-input",
          "bg-transparent dark:bg-input/30",
          "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
          "transition-colors",
          inputGroupClassName
        )}
      >
        <ComboboxPrimitive.Input
          aria-label={ariaLabel}
          placeholder={placeholder}
          onChange={
            onInputChange
              ? (e: React.ChangeEvent<HTMLInputElement>) =>
                  onInputChange(e.target.value)
              : undefined
          }
          className={cn(
            "h-10 w-full min-w-0 bg-transparent px-3 py-2 text-sm",
            "rounded-xl text-foreground placeholder:text-muted-foreground",
            "outline-none disabled:cursor-not-allowed disabled:opacity-50",
            inputClassName
          )}
        />
        <ComboboxPrimitive.Trigger
          className="flex h-10 items-center pr-2 text-muted-foreground transition-transform data-open:rotate-180"
          aria-label="Abrir lista"
        >
          <ChevronDownIcon className="size-4" />
        </ComboboxPrimitive.Trigger>
      </ComboboxPrimitive.InputGroup>

      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner
          side="bottom"
          align="start"
          sideOffset={4}
          className="isolate z-50 w-(--anchor-width)"
        >
          <ComboboxPrimitive.Popup
            className={cn(
              "origin-(--transform-origin)",
              "max-h-72 overflow-y-auto rounded-xl p-1 shadow-2xl",
              "border border-white/10 bg-[#080d1e]/95 backdrop-blur-xl",
              "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
              "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
              "duration-150"
            )}
          >
            <ComboboxPrimitive.List>
              <ComboboxItemList itemMap={itemMap} emptyMessage={emptyMessage} />
            </ComboboxPrimitive.List>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
    </div>
  )
}
