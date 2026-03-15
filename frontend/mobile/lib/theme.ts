// Dark luxury gold theme constants
export const colors = {
  background: '#0f1118',
  card: '#161a24',
  cardHover: '#1c2130',
  gold: '#c9a84c',
  goldMuted: '#a08a3e',
  goldLight: '#dfc877',
  text: '#e8e4dc',
  textSecondary: '#9fa5b0',
  muted: '#6b7580',
  border: '#262c38',
  borderLight: '#323a4a',
  error: '#ef4444',
  success: '#22c55e',
  warning: '#f59e0b',
  info: '#3b82f6',

  // Status-specific
  statusPending: '#6b7580',
  statusAccepted: '#22c55e',
  statusRejected: '#ef4444',
  statusWaitlisted: '#f59e0b',
} as const;

export function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'accepted':
      return colors.statusAccepted;
    case 'rejected':
      return colors.statusRejected;
    case 'waitlisted':
      return colors.statusWaitlisted;
    case 'pending':
    default:
      return colors.statusPending;
  }
}
