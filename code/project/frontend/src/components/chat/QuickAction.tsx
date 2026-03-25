"use client";

import React from 'react';
import { Button } from "@/components/ui/button";

interface QuickActionProps {
  icon: React.ReactNode;
  text: string;
  onClick: () => void;
}

export function QuickAction({ icon, text, onClick }: QuickActionProps) {
  return (
    <Button 
      variant="outline" 
      className="flex items-center gap-2 quick-action-button whitespace-normal text-left min-w-[200px] h-auto py-2 transition-all hover:shadow-md active:scale-[0.98]"
      onClick={onClick}
    >
      <span className="flex-shrink-0 text-gray-600 dark:text-gray-300">{icon}</span>
      <span className="text-sm line-clamp-2">{text}</span>
    </Button>
  );
} 