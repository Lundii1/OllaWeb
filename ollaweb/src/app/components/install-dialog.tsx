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
      <h2 className="text-retro-amber text-lg mb-3">Model Status</h2>
      <div className="mb-3">
        <p className="text-retro-text text-sm">{message}</p>
      </div>
      <div className="h-3 bg-retro-border-dark retro-sunken">
        <div className="h-full bg-retro-green council-pulse" style={{ width: '100%' }}></div>
      </div>
    </Dialog>
  );
}
