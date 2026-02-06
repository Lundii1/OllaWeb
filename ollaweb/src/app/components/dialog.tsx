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
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-retro-surface retro-raised max-w-md w-full">
        <div className="retro-titlebar flex items-center justify-between">
          <span>System Message</span>
          <span className="retro-raised bg-retro-surface px-1 cursor-default text-sm">X</span>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
}
