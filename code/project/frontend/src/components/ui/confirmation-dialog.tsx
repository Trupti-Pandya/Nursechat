import React from "react"
import { Button } from "./button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog"

type ConfirmationDialogProps = {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: "default" | "destructive"
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "OK",
  cancelText = "Cancel",
  variant = "default"
}: ConfirmationDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white/80 backdrop-blur-md border border-white/40 shadow-lg dark:bg-gray-800/80 dark:border-gray-700/40">
        <DialogHeader>
          <DialogTitle className="text-gray-800 font-semibold dark:text-gray-200">{title}</DialogTitle>
          <DialogDescription className="text-gray-600 mt-2 dark:text-gray-400">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4 flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="bg-white/70 dark:bg-gray-800/70 text-gray-700 dark:text-gray-300 hover:bg-gray-100/90 dark:hover:bg-gray-700/90 border border-gray-200/70 dark:border-gray-700/50"
          >
            {cancelText}
          </Button>
          <Button
            variant={variant}
            onClick={() => {
              onConfirm()
              onClose()
            }}
            className={
              variant === "destructive"
                ? "bg-red-500/70 hover:bg-red-500/80 text-white backdrop-blur-md shadow-sm border border-red-400/40 dark:border-red-500/30 dark:bg-red-600/30 dark:hover:bg-red-600/40"
                : "bg-blue-500/70 hover:bg-blue-500/80 text-white backdrop-blur-md shadow-sm border border-blue-400/40 dark:border-blue-500/30 dark:bg-blue-600/30 dark:hover:bg-blue-600/40"
            }
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 