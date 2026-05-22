import { useState } from 'react';

export function useToast() {
  const [toast, setToast] = useState(null);

  function showToast(msg, type = "success") {
    setToast({ msg, type, id: Date.now() });
    setTimeout(() => setToast(null), 4000);
  }

  return { toast, showToast };
}
