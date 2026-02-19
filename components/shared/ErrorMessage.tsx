type Variant = 'error' | 'warning' | 'info';

interface ErrorMessageProps {
  title: string;
  description: string;
  variant?: Variant;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const VARIANT_STYLES: Record<Variant, { container: string; icon: string; title: string; desc: string; button: string }> = {
  error: {
    container: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    icon: 'text-red-400',
    title: 'text-red-900 dark:text-red-200',
    desc: 'text-red-700 dark:text-red-300',
    button: 'bg-red-600 hover:bg-red-700 text-white',
  },
  warning: {
    container: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    icon: 'text-amber-400',
    title: 'text-amber-900 dark:text-amber-200',
    desc: 'text-amber-700 dark:text-amber-300',
    button: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
  info: {
    container: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    icon: 'text-blue-400',
    title: 'text-blue-900 dark:text-blue-200',
    desc: 'text-blue-700 dark:text-blue-300',
    button: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
};

export function ErrorMessage({ title, description, variant = 'error', action }: ErrorMessageProps) {
  const styles = VARIANT_STYLES[variant];

  return (
    <div className={`border rounded-xl p-6 text-center ${styles.container}`}>
      <svg className={`mx-auto h-8 w-8 ${styles.icon} mb-3`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        {variant === 'error' ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        ) : variant === 'warning' ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        )}
      </svg>
      <h3 className={`text-lg font-semibold ${styles.title} mb-1`}>{title}</h3>
      <p className={`text-sm ${styles.desc}`}>{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className={`mt-4 px-4 py-2 text-sm rounded-lg transition-colors ${styles.button}`}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
