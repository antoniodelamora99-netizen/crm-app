import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export function Field({label, children}:{label:string; children:React.ReactNode}) {
  return (<div className="grid gap-1"><Label className="text-xs text-neutral-600">{label}</Label>{children}</div>);
}

export function StatCard({title, value, subtitle}:{title:string; value:React.ReactNode; subtitle?:string}) {
  return (
    <Card className="shadow">
      <CardContent className="p-5">
        <div className="text-sm text-muted-foreground">{title}</div>
        <div className="text-3xl font-semibold mt-1">{value}</div>
        {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
      </CardContent>
    </Card>
  );
}