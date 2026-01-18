import { useState } from "react";
import { toast } from "sonner";

type CallbackFunction<T, A extends unknown[] = unknown[]> = (
  ...args: A
) => Promise<T>;

export function useFetch<T, A extends unknown[] = unknown[]>(cb: CallbackFunction<T, A>) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fn = async (...args: A): Promise<T | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await cb(...args);
      setData(response);
      return response;
    } catch (err: unknown) {
      // Safe error extraction
      let message = "Something went wrong";

      if (err instanceof Error) {
        message = err.message;
      }

      setError(message);
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, fn, setData };
}
