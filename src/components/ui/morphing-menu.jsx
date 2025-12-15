import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { cn } from '@/lib/utils';

export function MorphingMenu({
  trigger,
  children,
  className, // Wrapper dimensions (e.g., "h-8 w-8")
  triggerClassName, // Closed state visuals (e.g., "rounded-full border bg-background")
  contentClassName, // Inner content wrapper styles
  expandedClassName, // Expanded state visuals
  direction = 'top-right',
  expandedWidth = 320,
  collapsedRadius = '16px', // Radius of the collapsed button (16px for h-8)
  expandedRadius = '24px', // Radius of the expanded menu
  isOpen: controlledIsOpen,
  onOpenChange,
}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const [contentHeight, setContentHeight] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;

  const setIsOpen = (value) => {
    if (!isControlled) {
      setInternalIsOpen(value);
    }
    onOpenChange?.(value);
  };

  // Handle animation state for overflow control
  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => {
      setIsAnimating(false);
    }, 600); // Max duration is 0.6s
    return () => clearTimeout(timer);
  }, [isOpen]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Measure content height
  // We use ResizeObserver to handle dynamic content changes
  useEffect(() => {
    if (!contentRef.current) return;
    
    const updateHeight = () => {
      if (contentRef.current) {
        setContentHeight(contentRef.current.offsetHeight);
      }
    };

    // Initial measurement
    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(contentRef.current);

    return () => observer.disconnect();
  }, [children]);

  // Determine origin and positioning based on direction
  const getPositionClasses = () => {
    switch (direction) {
      case 'top-right': return 'top-0 right-0 origin-top-right';
      case 'top-left': return 'top-0 left-0 origin-top-left';
      case 'bottom-right': return 'bottom-0 right-0 origin-bottom-right';
      case 'bottom-left': return 'bottom-0 left-0 origin-bottom-left';
      default: return 'top-0 right-0 origin-top-right';
    }
  };

  return (
    <div
      className={cn("relative", className)}
      ref={containerRef}
      style={{
        zIndex: (isOpen || isAnimating) ? 60 : undefined
      }}
    >
      <div
        className={cn(
          "absolute flex flex-col",
          (!isOpen && !isAnimating) ? "overflow-visible" : "overflow-hidden",
          getPositionClasses(),
          isOpen 
            ? cn("shadow-2xl border border-border text-popover-foreground", expandedClassName || "bg-popover")
            : cn("bg-background cursor-pointer", triggerClassName)
        )}
        style={{
          width: isOpen ? expandedWidth : '100%',
          height: isOpen ? contentHeight : '100%',
          borderRadius: isOpen ? expandedRadius : collapsedRadius,
          zIndex: isOpen ? 50 : 1,
          transitionProperty: 'width, height, border-radius, background-color, box-shadow, transform',
          // Use different durations and curves for opening vs closing.
          // Opening: longer duration + spring effect for "pop"
          // Closing: shorter duration + mild spring effect for "snap back"
          transitionDuration: isOpen ? '0.6s' : '0.5s',
          transitionTimingFunction: isOpen 
            // Width/Height/Transform get the spring (0.34, 1.56, 0.64, 1)
            // Border-radius gets a smoother curve to avoid "pill-to-rect" glitch (0.25, 1, 0.5, 1)
            // The order matches transitionProperty: width, height, border-radius, ...
            ? 'cubic-bezier(0.34, 1.56, 0.64, 1), cubic-bezier(0.34, 1.56, 0.64, 1), cubic-bezier(0.25, 1, 0.5, 1), cubic-bezier(0.25, 1, 0.5, 1), cubic-bezier(0.25, 1, 0.5, 1), cubic-bezier(0.34, 1.56, 0.64, 1)' 
            : 'cubic-bezier(0.32, 1.2, 0.5, 1)',  // Mild spring collapse for all
        }}
        onClick={(e) => {
          if (!isOpen) {
            setIsOpen(true);
            e.stopPropagation();
          }
        }}
      >
        {/* Trigger Content */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center transition-all duration-300",
            isOpen ? "opacity-0 scale-90 pointer-events-none" : "opacity-100 scale-100"
          )}
        >
          {trigger}
        </div>

        {/* Menu Content Wrapper */}
        <div
          ref={contentRef}
          className={cn(
            contentClassName
          )}
          style={{
            width: expandedWidth,
            opacity: isOpen ? 1 : 0,
            transform: isOpen ? 'scale(1)' : 'scale(0.9)',
            transformOrigin: direction === 'top-right' ? 'top right' : 
                             direction === 'top-left' ? 'top left' :
                             direction === 'bottom-right' ? 'bottom right' : 'bottom left',
            pointerEvents: isOpen ? 'auto' : 'none',
            visibility: 'visible',
            transitionProperty: 'opacity, transform',
            transitionDuration: isOpen ? '0.6s' : '0.5s',
            transitionTimingFunction: isOpen 
              ? 'cubic-bezier(0.34, 1.56, 0.64, 1)' 
              : 'cubic-bezier(0.32, 1.2, 0.5, 1)',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
