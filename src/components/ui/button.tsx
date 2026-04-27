import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium  transition-all duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal-gold focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 transform hover:-translate-y-0.5",
  {
    variants: {
      variant: {
        default:
          "btn-primary text-luxury-white shadow-soft hover:shadow-soft-lg",
        destructive:
          "bg-red-500 text-luxury-white shadow-soft hover:bg-red-600 hover:shadow-soft-lg",
        outline:
          "border border-border bg-luxury-white shadow-soft hover:bg-royal-gold/5 hover:border-royal-gold/40 hover:text-charcoal",
        secondary:
          "btn-secondary text-luxury-white shadow-soft hover:shadow-soft-lg",
        emphasis:
          "btn-emphasis text-luxury-white shadow-soft hover:shadow-soft-lg",
        ghost: "hover:bg-royal-gold/10 hover:text-charcoal",
        link: "text-royal-gold underline-offset-4 hover:underline hover:text-royal-gold-light",
      },
      size: {
        default: "h-10 px-6 py-2.5",
        sm: "h-8 rounded-lg px-4 text-xs",
        lg: "h-12 rounded-lg px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
