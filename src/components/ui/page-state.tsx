import type { ComponentType } from "react"

import { cva, type VariantProps } from "class-variance-authority"
import { AlertTriangle, Inbox } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"

const pageStateVariants = cva("", {
  variants: {
    size: {
      default: "p-6 md:p-12",
      sm: "p-4 md:p-6",
    },
  },
  defaultVariants: {
    size: "default",
  },
})

type PageStateVariant = "loading" | "empty" | "error"

type IconType = ComponentType<{ className?: string }>

const defaultIcons: Record<PageStateVariant, IconType> = {
  loading: Spinner,
  empty: Inbox,
  error: AlertTriangle,
}

const defaultCopy: Record<
  PageStateVariant,
  { title: string; description: string }
> = {
  loading: {
    title: "加载中",
    description: "正在获取数据，请稍候。",
  },
  empty: {
    title: "暂无数据",
    description: "可以尝试调整筛选或稍后再试。",
  },
  error: {
    title: "加载失败",
    description: "请检查网络连接后重试。",
  },
}

interface PageStateProps
  extends React.ComponentProps<typeof Empty>,
    VariantProps<typeof pageStateVariants> {
  variant?: PageStateVariant
  title?: string
  description?: string
  action?: React.ReactNode
  icon?: IconType
}

function PageState({
  variant = "empty",
  title,
  description,
  action,
  icon,
  size,
  className,
  children,
  ...props
}: PageStateProps) {
  const Icon = icon ?? defaultIcons[variant]
  const copy = defaultCopy[variant]
  const iconNode =
    variant === "loading" && !icon ? (
      <Spinner className="size-5" />
    ) : (
      <Icon className="size-5" />
    )

  return (
    <Empty
      className={cn(pageStateVariants({ size }), className)}
      data-variant={variant}
      {...props}
    >
      <EmptyHeader>
        <EmptyMedia variant="icon">{iconNode}</EmptyMedia>
        <EmptyTitle>{title ?? copy.title}</EmptyTitle>
        {(description ?? copy.description) && (
          <EmptyDescription>{description ?? copy.description}</EmptyDescription>
        )}
      </EmptyHeader>
      {(action || children) && (
        <EmptyContent>
          {children}
          {action}
        </EmptyContent>
      )}
    </Empty>
  )
}

export { PageState }
