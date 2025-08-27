"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootRedirect() {
  const router = useRouter();

  useEffect(() => {
    const id = typeof window !== "undefined" ? localStorage.getItem("crm_current_user_id") : null;
    router.replace(id ? "/dashboard" : "/login");
  }, [router]);

  return null;
}