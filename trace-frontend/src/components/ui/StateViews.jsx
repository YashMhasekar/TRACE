import { Loader2, AlertCircle, InboxIcon } from 'lucide-react'

export function LoadingState({ message = 'Loading data…' }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-sm">{message}</p>
    </div>
  )
}

export function ErrorState({ message = 'Failed to load data.', onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <AlertCircle className="w-8 h-8 text-destructive" />
      <p className="text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs font-medium text-primary hover:underline"
        >
          Try again
        </button>
      )}
    </div>
  )
}

export function EmptyState({ message = 'No data available for this period.' }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
      <InboxIcon className="w-8 h-8" />
      <p className="text-sm">{message}</p>
    </div>
  )
}
