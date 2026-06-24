import React, { useEffect } from 'react';

interface DialogProps {
  isOpen: boolean;
  children: React.ReactNode;
}

export function Dialog({ isOpen, children }: DialogProps) {
  useEffect(() => {
    console.log('Dialog isOpen:', isOpen);
  }, [isOpen]);

  if (!isOpen) {
    console.log('Dialog is not open.');
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#2f2f2f] border border-[#404040] rounded-2xl max-w-md w-full shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#404040]">
          <span className="text-sm font-medium text-foreground">System</span>
          <span className="text-muted-foreground text-sm cursor-default">×</span>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
}
