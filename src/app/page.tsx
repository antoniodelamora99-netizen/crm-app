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
      className="fixed bottom-2 right-2 text-[10px] text-neutral-400 select-none font-medium"
      title={`Versión ${APP_VERSION} • ${BUILD_COMMIT_SHORT} • ${new Date(BUILD_DATE_ISO).toLocaleString()}`}
    >
      v{APP_VERSION} · {BUILD_COMMIT_SHORT}
    </div>
  );
}