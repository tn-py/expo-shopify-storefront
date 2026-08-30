import { StateView } from '@/components/ui/state-view';

export function LoadingState({ label }: { label?: string }) {
  return <StateView mode="loading" title={label} />;
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <StateView
      mode="error"
      message={message ?? 'Please check your connection and try again.'}
      actionLabel={onRetry ? 'Retry' : undefined}
      onAction={onRetry}
    />
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return <StateView mode="empty" title={title} message={subtitle} />;
}
