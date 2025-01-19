import React, { useEffect } from 'react';
import { Dialog } from './dialog';

interface InstallDialogProps {
  isOpen: boolean;
  message: string;
}

export function InstallDialog({ isOpen, message }: InstallDialogProps) {
  useEffect(() => {
    console.log('InstallDialog rendered with message:', message);
  }, [message]);

  return (
    <Dialog isOpen={isOpen}>
      <h2 className="text-xl font-semibold mb-4">Model Status</h2>
      <div className="mb-4">
        <p className="text-sm text-gray-500">{message}</p>
      </div>
      <div className="h-2 bg-blue-200 rounded-full">
        <div className="h-2 bg-blue-600 rounded-full animate-pulse" style={{ width: '100%' }}></div>
      </div>
    </Dialog>
  );
}

