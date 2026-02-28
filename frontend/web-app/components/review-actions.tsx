"use client";

import { ThumbsDown, Clock, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReviewActionsProps {
  onReject: () => void;
  onWaitlist: () => void;
  onAccept: () => void;
  disabled?: boolean;
}

export function ReviewActions({ onReject, onWaitlist, onAccept, disabled }: ReviewActionsProps) {
  return (
    <div className="flex items-center justify-center gap-4">
      <Button
        variant="outline"
        size="lg"
        className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
        onClick={onReject}
        disabled={disabled}
      >
        <ThumbsDown className="size-5 mr-2" />
        Reject
      </Button>
      <Button
        variant="outline"
        size="lg"
        className="border-yellow-300 text-yellow-600 hover:bg-yellow-50 hover:text-yellow-700 dark:border-yellow-800 dark:text-yellow-400 dark:hover:bg-yellow-950"
        onClick={onWaitlist}
        disabled={disabled}
      >
        <Clock className="size-5 mr-2" />
        Waitlist
      </Button>
      <Button
        variant="outline"
        size="lg"
        className="border-green-300 text-green-600 hover:bg-green-50 hover:text-green-700 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950"
        onClick={onAccept}
        disabled={disabled}
      >
        <ThumbsUp className="size-5 mr-2" />
        Accept
      </Button>
    </div>
  );
}
