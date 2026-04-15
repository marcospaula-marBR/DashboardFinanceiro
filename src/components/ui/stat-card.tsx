"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  icon: ReactNode;
  trend?: string;
  color?: "primary" | "secondary" | "success" | "danger" | "info" | "warning";
  description?: string;
  className?: string;
}

const colorMap = {
  primary: {
    bg: "bg-primary/10",
    text: "text-primary",
    iconBg: "bg-primary",
  },
  secondary: {
    bg: "bg-secondary/10",
    text: "text-secondary",
    iconBg: "bg-secondary",
  },
  success: {
    bg: "bg-success/10",
    text: "text-success",
    iconBg: "bg-success",
  },
  danger: {
    bg: "bg-danger/10",
    text: "text-danger",
    iconBg: "bg-danger",
  },
  info: {
    bg: "bg-info/10",
    text: "text-info",
    iconBg: "bg-info",
  },
  warning: {
    bg: "bg-warning/10",
    text: "text-warning",
    iconBg: "bg-warning",
  },
};

export function StatCard({ 
  title, 
  value, 
  icon, 
  trend, 
  color = "primary", 
  description, 
  className 
}: StatCardProps) {
  const colors = colorMap[color];
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className={cn(
        "card-premium p-5 flex items-center gap-4",
        className
      )}
    >
      <div className={cn(
        "p-3 rounded-xl text-white shrink-0 flex items-center justify-center",
        colors.iconBg
      )}>
        {icon}
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide truncate">
          {title}
        </p>
        <div className="flex items-baseline gap-2 mt-0.5">
          <h3 className="font-black text-foreground tabular-nums text-xl md:text-2xl leading-none">
            {value}
          </h3>
          {trend && (
            <span className={cn(
              "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
              trend.startsWith("+") ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
            )}>
              {trend}
            </span>
          )}
        </div>
        {description && (
          <p className="text-[10px] text-muted-foreground mt-1 truncate">
            {description}
          </p>
        )}
      </div>
    </motion.div>
  );
}
