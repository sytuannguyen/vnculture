import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { PhoneApp } from "./phone/PhoneApp";
import { loadProfile, saveProfile } from "./lib/api";
import { adoptRestoreParam, initInstall, linkManifestToProfile } from "./lib/install";

const HostApp = lazy(() => import("./host/HostApp"));
const isHost = location.pathname.startsWith("/host");

if (!isHost) {
  initInstall();
  // launched from an iOS home-screen icon: adopt the profile carried in the start URL
  const cleaned = adoptRestoreParam(location.href, !!loadProfile(), saveProfile);
  if (cleaned !== null) history.replaceState(history.state, "", cleaned);
  linkManifestToProfile(loadProfile());
}
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("/sw.js").catch(() => undefined); });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isHost ? <Suspense fallback={null}><HostApp /></Suspense> : <PhoneApp />}
  </StrictMode>,
);
