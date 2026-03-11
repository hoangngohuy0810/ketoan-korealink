"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-4 bg-white rounded-xl border border-slate-200 shadow-sm", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        month_caption: "flex justify-center items-center h-10 relative gap-x-4",
        caption_label: "text-base font-bold text-slate-900 capitalize px-2",
        nav: "flex items-center gap-1",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-8 w-8 p-0 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-full transition-colors"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-8 w-8 p-0 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-full transition-colors"
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex justify-between w-full mb-2",
        weekday: "text-slate-400 w-10 font-bold text-[0.7rem] uppercase tracking-widest text-center",
        week: "flex w-full mt-1 justify-between",
        day: "p-0 relative flex items-center justify-center",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-10 w-10 p-0 font-medium rounded-xl hover:bg-slate-100 hover:text-slate-900 text-slate-700 transition-all active:scale-95"
        ),
        selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground font-bold shadow-md",
        today: "text-primary border-2 border-primary/20 bg-primary/5 font-bold",
        outside: "text-slate-300 opacity-50",
        disabled: "text-slate-200 opacity-50 cursor-not-allowed",
        range_middle: "aria-selected:bg-slate-100 aria-selected:text-slate-900",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          if (orientation === "left") {
            return <ChevronLeft className="h-4 w-4" />
          }
          return <ChevronRight className="h-4 w-4" />
        },
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
