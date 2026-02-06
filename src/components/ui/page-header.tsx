import { cn } from "@/lib/utils"

function PageHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="page-header"
      className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}
      {...props}
    />
  )
}

function PageHeaderHeading({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="page-header-heading"
      className={cn("min-w-0 space-y-1.5", className)}
      {...props}
    />
  )
}

function PageHeaderTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="page-header-title"
      className={cn("text-[clamp(1.4rem,2.1vw,2rem)] font-semibold leading-tight tracking-tight text-balance", className)}
      {...props}
    />
  )
}

function PageHeaderDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="page-header-description"
      className={cn("max-w-3xl text-sm leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  )
}

function PageHeaderActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="page-header-actions"
      className={cn("flex flex-wrap items-center gap-2.5", className)}
      {...props}
    />
  )
}

function PageHeaderMeta({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="page-header-meta"
      className={cn("flex flex-wrap items-center gap-2 text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

function PageHeaderFilters({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="page-header-filters"
      className={cn("surface-panel flex flex-wrap items-center gap-3 px-3 py-3", className)}
      {...props}
    />
  )
}

export {
  PageHeader,
  PageHeaderActions,
  PageHeaderDescription,
  PageHeaderFilters,
  PageHeaderHeading,
  PageHeaderMeta,
  PageHeaderTitle,
}
