import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium  transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-royal-gold focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "badge-gold shadow-soft hover:shadow-soft-lg",
        secondary:
          "badge-gray shadow-soft hover:shadow-soft-lg",
        destructive:
          "border-red-200 bg-red-50 text-red-600 shadow-soft hover:bg-red-100",
        outline: "badge-luxury text-charcoal",
        charcoal:
          "badge-charcoal shadow-soft hover:shadow-soft-lg",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
