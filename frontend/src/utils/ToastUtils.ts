import toast from 'react-hot-toast';

class ToastUtils {
  /**
   * Show a success toast notification
   */
  static success(message: string, duration?: number) {
    return toast.success(message, {
      duration: duration || 3000,
    });
  }

  /**
   * Show an error toast notification
   */
  static error(message: string, duration?: number) {
    return toast.error(message, {
      duration: duration || 5000,
    });
  }

  /**
   * Show an info/warning toast notification
   */
  static info(message: string, duration?: number) {
    return toast(message, {
      duration: duration || 4000,
      icon: 'ℹ️',
    });
  }

  /**
   * Show a warning toast notification
   */
  static warning(message: string, duration?: number) {
    return toast(message, {
      duration: duration || 4000,
      icon: '⚠️',
      style: {
        background: '#fef3c7',
        color: '#92400e',
      },
    });
  }

  /**
   * Show a loading toast notification
   */
  static loading(message: string) {
    return toast.loading(message);
  }

  /**
   * Dismiss a specific toast or all toasts
   */
  static dismiss(toastId?: string) {
    if (toastId) {
      toast.dismiss(toastId);
    } else {
      toast.dismiss();
    }
  }

  /**
   * Show a promise-based toast that updates based on promise state
   */
  static promise<T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    }
  ) {
    return toast.promise(promise, messages);
  }
}

export default ToastUtils;

