import { createContext, useContext, type ReactNode } from "react";

/** Where the open library is kept, as the screens need to describe it. */
export type StorageKind = "github" | "browser" | "none";

type HubContextValue = { storage: StorageKind; openStorage: () => void };
export const HubContext = createContext<HubContextValue>({ storage: "none", openStorage() {} });
export const useHub = () => useContext(HubContext);

/** Shown wherever the sample library offers the way to a real one. */
export function ConnectButton({ children = "Connect your library" }: { children?: ReactNode }) {
  const { openStorage } = useHub();
  return (
    <button type="button" onClick={openStorage}>
      {children}
    </button>
  );
}

export function StorageLabel() {
  const { storage } = useHub();
  return (
    <>
      {storage === "github"
        ? "Private library · saved to your GitHub repository"
        : "Private library · saved in this browser only"}
    </>
  );
}
