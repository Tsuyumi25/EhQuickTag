import { useToast as useToastification } from 'vue-toastification'

const PREFIX = 'EhQuickTag - '

export function useEqtToast() {
  const toast = useToastification()
  return {
    success: (msg: string) => toast.success(PREFIX + msg),
    error:   (msg: string) => toast.error(PREFIX + msg),
    warning: (msg: string) => toast.warning(PREFIX + msg),
    info:    (msg: string) => toast.info(PREFIX + msg),
  }
}
