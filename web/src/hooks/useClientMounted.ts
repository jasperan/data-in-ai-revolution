import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

export function useClientMounted(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}
