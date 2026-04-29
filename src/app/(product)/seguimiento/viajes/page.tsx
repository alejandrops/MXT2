import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function RedirectViajes({ searchParams }: PageProps) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (Array.isArray(v)) qs.set(k, v[0] ?? "");
    else if (typeof v === "string") qs.set(k, v);
  }
  const tail = qs.toString();
  redirect(`/actividad/viajes${tail ? `?${tail}` : ""}`);
}
