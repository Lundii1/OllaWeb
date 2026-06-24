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
      <h2 className="text-foreground font-semibold text-lg mb-3">Model Status</h2>
      <div className="mb-3">
        <p className="text-muted-foreground text-sm whitespace-pre-wrap">{message}</p>
      </div>
      <div className="h-2 bg-[#404040] rounded-full overflow-hidden">
        <div className="h-full bg-green-500 council-pulse rounded-full" style={{ width: '100%' }} />
      </div>
    </Dialog>
  );
}
