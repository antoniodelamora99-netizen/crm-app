"use client";
import { useEffect } from "react";
import { APP_VERSION } from "@/lib/version";
import { BUILD_COMMIT_SHORT, BUILD_DATE_ISO } from "@/lib/buildMeta";
import { useRouter } from "next/navigation";

export default function RootRedirect() {
  const router = useRouter();

  useEffect(() => {
    const id = typeof window !== "undefined" ? localStorage.getItem("crm_current_user_id") : null;
    router.replace(id ? "/dashboard" : "/login");
  }, [router]);

  return (
    <div
      className="fixed bottom-2 right-2 text-[10px] text-neutral-400 select-none font-medium text-right"
      title={`Versión ${APP_VERSION} • ${BUILD_COMMIT_SHORT} • ${new Date(BUILD_DATE_ISO).toLocaleString()}`}
    >
      <div>v{APP_VERSION} · {BUILD_COMMIT_SHORT}</div>
      <div>{new Date(BUILD_DATE_ISO).toLocaleDateString('es-MX', { year: '2-digit', month: '2-digit', day: '2-digit' })} {new Date(BUILD_DATE_ISO).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
  );
}