import React, { useState, useEffect } from 'react';
import { Minus, Square, X } from 'lucide-react';
import { Button } from "@/components/ui/Button";

export function PreviewHeader({ fileName }) {
  const handleMinimize = () => {
    window.api.minimizeWindow();
  };

  const handleMaximize = () => {
    window.api.maximizeWindow();
  };

  const handleClose = () => {
    window.api.closeWindow();
  };

  return (
    <header className="flex items-center justify-between h-8 bg-background border-b" style={{ WebkitAppRegion: 'drag' }}>
      <div className="px-2 text-sm truncate">{fileName}</div>
      <div className="flex items-center" style={{ WebkitAppRegion: 'no-drag' }}>
        <Button variant="ghost" size="icon" className="w-8 h-8 rounded-none" onClick={handleMinimize}>
          <Minus className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="w-8 h-8 rounded-none" onClick={handleMaximize}>
          <Square className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="w-8 h-8 rounded-none hover:bg-red-500" onClick={handleClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
} 