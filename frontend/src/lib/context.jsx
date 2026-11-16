import React, { createContext, useContext, useEffect } from "react";
import content from "@shared/content.json";
import { useData } from "./api";

const Settings = createContext(content.settings);
export function BrandingProvider({ children }) {
  const resource = useData("public/settings");
  useEffect(() => {
    const refresh = () => resource.reload();
    const channel = window.BroadcastChannel
      ? new BroadcastChannel("sri-publication")
      : null;
    if (channel) channel.onmessage = refresh;
    const timer = setInterval(() => {
      if (!document.hidden) refresh();
    }, 45000);
    window.addEventListener("focus", refresh);
    window.addEventListener("sri:published", refresh);
    return () => {
      channel?.close();
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("sri:published", refresh);
    };
  }, [resource.reload]);
  return (
    <Settings.Provider value={resource.data || content.settings}>
      {children}
    </Settings.Provider>
  );
}
export function announcePublication() {
  window.dispatchEvent(new Event("sri:published"));
  if (window.BroadcastChannel) {
    const c = new BroadcastChannel("sri-publication");
    c.postMessage("updated");
    c.close();
  }
}
export const useSettings = () => useContext(Settings);
