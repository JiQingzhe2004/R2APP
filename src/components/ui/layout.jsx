import React from 'react';
import { cn } from '@/lib/utils';

const Layout = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('h-screen w-full flex', className)}
    {...props}
  />
));
Layout.displayName = 'Layout';

const LayoutHeader = React.forwardRef(({ className, ...props }, ref) => (
  <header
    ref={ref}
    className={cn('h-14 flex items-center gap-4 border-b bg-muted/40 px-6', className)}
    {...props}
  />
));
LayoutHeader.displayName = 'LayoutHeader';


const LayoutBody = React.forwardRef(({ className, ...props }, ref) => (
  <main
    ref={ref}
    className={cn('flex-1 flex flex-col', className)}
    {...props}
  />
));
LayoutBody.displayName = 'LayoutBody';

export { Layout, LayoutHeader, LayoutBody }; 