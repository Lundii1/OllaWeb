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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
        {children}
      </div>
    </div>
  );
}

