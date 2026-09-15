'use client';

import * as React from 'react';
import { Moon, Sun, Monitor, Check } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * A premium, micro-animated theme selection dropdown component.
 * Allows users to choose between Light, Dark, and System preference options
 * with smooth transitions and hydration-safe theme states.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<span className="inline-flex shrink-0" />}>
        <Button
          variant="outline"
          size="icon"
          className="w-9 h-9 rounded-full shrink-0 border-border/50 hover:bg-muted/60 hover:text-foreground relative overflow-hidden transition-all duration-300 shadow-sm cursor-pointer"
        >
          <Sun className="h-[1.1rem] w-[1.1rem] rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0 text-amber-500" />
          <Moon className="absolute h-[1.1rem] w-[1.1rem] rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100 text-indigo-400" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36 rounded-xl border-border/60 bg-background/95 backdrop-blur-md p-1.5 shadow-xl">
        <DropdownMenuItem
          onClick={() => setTheme('light')}
          className="flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold cursor-pointer hover:bg-muted/80 transition-colors"
        >
          <span className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <Sun className="h-3.5 w-3.5 text-amber-500" /> Light
          </span>
          {theme === 'light' && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme('dark')}
          className="flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold cursor-pointer hover:bg-muted/80 transition-colors"
        >
          <span className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <Moon className="h-3.5 w-3.5 text-indigo-400" /> Dark
          </span>
          {theme === 'dark' && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme('system')}
          className="flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold cursor-pointer hover:bg-muted/80 transition-colors"
        >
          <span className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <Monitor className="h-3.5 w-3.5 text-muted-foreground" /> System
          </span>
          {theme === 'system' && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
