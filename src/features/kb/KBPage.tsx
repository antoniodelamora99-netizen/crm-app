

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";

import type { KBSection, KBFile, User } from "@/lib/types";
import { uid } from "@/lib/types";
import { repo, LS_KEYS } from "@/lib/storage";
import { getCurrentUser, filterByScope } from "@/lib/users";
import { useSessionUser } from "@/lib/auth/useSessionUser";
import { useProfile } from "@/lib/auth/useProfile";

const KBRepo = repo<KBSection>(LS_KEYS.kb);

/* ========================== Helpers UI ========================== */
function Field({label, children}:{label:string; children:React.ReactNode}){
  return (
    <div className="grid gap-1">
      <Label className="text-xs text-neutral-600">{label}</Label>
      {children}
    </div>
  );
}

function roleBadge(role: User["role"]) {
  if (role === "promotor") return "bg-emerald-100 text-emerald-800";
  if (role === "gerente") return "bg-amber-100 text-amber-800";
  return "bg-sky-100 text-sky-800";
}

/* ========================= File utils ========================= */
async function filesToKBFiles(fileList: FileList, uploaderId: string): Promise<KBFile[]> {
  const reads = Array.from(fileList).map(
    (f) =>
      new Promise<KBFile>((resolve, reject) => {
        const fr = new FileReader();
        fr.onerror = () => reject(fr.error);
        fr.onload = () =>
          resolve({
            id: uid(),
            name: f.name,
            size: f.size,
            type: f.type || "application/octet-stream",
            dataUrl: String(fr.result || ""),
            uploadedAt: new Date().toISOString(),
            uploadedById: uploaderId,
          });
        fr.readAsDataURL(f);
      })
  );
  return Promise.all(reads);
}

function canManage(user: User | null): boolean {
  return !!user && (user.role === "promotor" || user.role === "gerente" || (user as any).role === "admin");
}

/* ========================== Page ========================== */
export default function KBPage() {
  // Prefer Supabase session/profile; fallback to local demo user if present
  const session = useSessionUser();
  const { profile } = useProfile(session?.id);
  const user = React.useMemo<User | null>(() => {
    if (profile) {
      return {
        id: profile.id,
        role: (profile.role as any) || "asesor",
        name: profile.name || "Usuario",
        password: "", // not used here
      } as unknown as User;
    }
    return getCurrentUser();
  }, [profile]);
  const [sections, setSections] = useState<KBSection[]>(KBRepo.list());
  const [q, setQ] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [openEdit, setOpenEdit] = useState<{open:boolean, section: KBSection | null}>({open:false, section:null});

  useEffect(() => { KBRepo.saveAll(sections); }, [sections]);

  const visible = useMemo(() => {
    if (!user) return [];
    const scoped = filterByScope(sections, user, s => (s as KBSection).ownerId);
    const t = q.trim().toLowerCase();
    if (!t) return scoped;
    return scoped.filter(sec =>
      (sec.title || "").toLowerCase().includes(t) ||
      (sec.description || "").toLowerCase().includes(t) ||
      (sec.files || []).some(f => f.name.toLowerCase().includes(t))
    );
  }, [sections, user, q]);

  if (!user) {
    return (
      <Card className="shadow">
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold mb-2">Base de Conocimiento</h2>
          <p className="text-sm text-muted-foreground">Inicia sesión para ver tu base de conocimiento.</p>
        </CardContent>
      </Card>
    );
  }

  const handleCreate = (sec: KBSection) => { setSections(prev => [sec, ...prev]); setOpenNew(false); };
  const handleUpdate = (sec: KBSection) => {
    setSections(prev => prev.map(x => x.id === sec.id ? sec : x));
    setOpenEdit({open:false, section:null});
  };
  const handleDelete = (id: string) => { setSections(prev => prev.filter(x => x.id !== id)); };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Base de Conocimiento</h2>
        <div className="flex items-center gap-2">
          <Input placeholder="Buscar apartados o archivos…" value={q} onChange={e=>setQ((e.target as HTMLInputElement).value)} className="w-72"/>
          {canManage(user) && (
            <Dialog open={openNew} onOpenChange={setOpenNew}>
              <DialogTrigger asChild><Button><Plus className="mr-2" size={16}/>Nuevo apartado</Button></DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>Nuevo apartado</DialogTitle></DialogHeader>
                <SectionForm
                  onSubmit={(s)=> handleCreate({ ...s, id: uid(), files: s.files || [], ownerId: user.id })}
                  currentUser={user}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid gap-3">
        {visible.map(sec => (
          <Card key={sec.id} className="shadow">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold">{sec.title}</div>
                  {sec.description && <div className="text-sm text-neutral-600 mt-1">{sec.description}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{sec.files?.length || 0} archivo(s)</Badge>
                  {canManage(user) ? (
                    <Dialog open={openEdit.open && openEdit.section?.id === sec.id} onOpenChange={(o)=> setOpenEdit({open:o, section: o? sec : null})}>
                      <DialogTrigger asChild><Button variant="secondary" size="sm">Editar</Button></DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader><DialogTitle>Editar apartado</DialogTitle></DialogHeader>
                        {openEdit.section && (
                          <SectionForm
                            initial={openEdit.section}
                            currentUser={user}
                            onSubmit={handleUpdate}
                            onDelete={()=> {
                              if (window.confirm("¿Eliminar este apartado y todos sus archivos?")) {
                                handleDelete(sec.id);
                                setOpenEdit({open:false, section:null});
                              }
                            }}
                          />
                        )}
                      </DialogContent>
                    </Dialog>
                  ) : (
                    <Badge className={roleBadge(user.role)}>solo lectura</Badge>
                  )}
                </div>
              </div>

              {/* Archivos */}
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
                {(sec.files || []).map(file => (
                  <div key={file.id} className="border rounded p-3 flex items-center justify-between">
                    <div className="text-sm">
                      <div className="font-medium">{file.name}</div>
                      <div className="text-xs text-neutral-500">{(file.size/1024).toFixed(1)} KB • {new Date(file.uploadedAt).toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Descargar */}
                      <a
                        href={file.dataUrl}
                        download={file.name}
                        className="text-xs underline"
                        target="_blank" rel="noreferrer"
                      >
                        Descargar
                      </a>
                      {/* Borrar (solo manager/promotor) */}
                      {canManage(user) && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={()=>{
                            if (window.confirm("¿Eliminar este archivo?")) {
                              const updated: KBSection = {
                                ...sec,
                                files: (sec.files || []).filter(f => f.id !== file.id),
                              };
                              handleUpdate(updated);
                            }
                          }}
                        >
                          Borrar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {(sec.files || []).length === 0 && (
                  <div className="text-sm text-neutral-500">No hay archivos en este apartado.</div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {visible.length === 0 && (
          <div className="text-sm text-neutral-500">No hay apartados (o no tienes permisos para verlos).</div>
        )}
      </div>
    </div>
  );
}

/* ======================== Forms ======================== */

function SectionForm({
  initial,
  onSubmit,
  onDelete,
  currentUser
}:{
  initial?: KBSection;
  onSubmit: (sec: KBSection) => void;
  onDelete?: () => void;
  currentUser: User;
}) {
  const [form, setForm] = useState<KBSection>(initial || {
    id: uid(),
    title: "",
    description: "",
    files: [],
    ownerId: currentUser.id,
  });
  useEffect(()=> { if (initial) setForm(initial); }, [initial]);

  const set = (k: keyof KBSection, v:any)=> setForm(prev => ({...prev, [k]: v}));

  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Título del apartado">
        <Input value={form.title || ""} onChange={e=>set("title", (e.target as HTMLInputElement).value)} />
      </Field>
      <Field label="Descripción (opcional)">
        <Textarea value={form.description || ""} onChange={e=>set("description", (e.target as HTMLTextAreaElement).value)} />
      </Field>

      <Field label="Agregar archivos">
        <Input
          type="file"
          multiple
          onChange={async (e)=>{
            const files = e.target.files;
            if (!files || files.length === 0) return;
            const converted = await filesToKBFiles(files, currentUser.id);
            setForm(prev => ({ ...prev, files: [ ...(prev.files || []), ...converted ] }));
            // limpiar input para permitir volver a seleccionar el mismo archivo si se desea
            (e.target as HTMLInputElement).value = "";
          }}
        />
      </Field>

      <div className="col-span-2">
        {/* lista de nuevos archivos en el formulario, previo a guardar */}
        {(form.files || []).length > 0 && (
          <div className="border rounded p-2 max-h-52 overflow-auto">
            <div className="text-xs font-medium mb-1">Archivos en este apartado:</div>
            <div className="grid sm:grid-cols-2 gap-2">
              {form.files!.map(f => (
                <div key={f.id} className="border rounded p-2 flex items-center justify-between">
                  <div className="text-xs">
                    <div className="font-medium">{f.name}</div>
                    <div className="text-[10px] text-neutral-500">{(f.size/1024).toFixed(1)} KB • {new Date(f.uploadedAt).toLocaleString()}</div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={()=>{
                      setForm(prev => ({ ...prev, files: prev.files?.filter(x => x.id !== f.id) || [] }));
                    }}
                  >
                    Quitar
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <DialogFooter className="col-span-2 mt-2 flex items-center justify-between">
        {onDelete && (
          <Button
            variant="destructive"
            onClick={()=>{
              if (window.confirm("¿Eliminar este apartado por completo?")) onDelete();
            }}
          >
            Eliminar apartado
          </Button>
        )}
        <Button
          className="ml-auto"
          onClick={()=>{
            if (!form.title.trim()) { alert("El título es obligatorio."); return; }
            onSubmit(form);
          }}
        >
          {initial ? "Guardar cambios" : "Crear apartado"}
        </Button>
      </DialogFooter>
    </div>
  );
}

/* ======================== Mini tests (console) ======================== */
(function selfTests(){
  const log = (name: string, ok: boolean) => console.log(`TEST ${ok?"✔":"✘"} ${name}`);
  try {
    // repo roundtrip for KB
    const tmpKey = "__test_kb__" + Math.random();
    const TmpRepo = repo<KBSection>(tmpKey);
    const sample: KBSection = { id: "k1", title: "Doc", description: "d", files: [], ownerId: "u1" };
    TmpRepo.saveAll([sample]);
    const loaded = TmpRepo.list();
    log("KB repo roundtrip", Array.isArray(loaded) && loaded[0].id === "k1");
  } catch(e) {
    log("KB repo roundtrip", false);
  }
})();