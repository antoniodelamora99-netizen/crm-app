"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../components/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, MoreVertical, UploadCloud, Trash2, Pencil } from "lucide-react";

import { repo, LS_KEYS } from "@/lib/storage";
import { useSessionUser } from "@/lib/auth/useSessionUser";
import { useProfile } from "@/lib/auth/useProfile";
import type { KBSection, KBFile, User } from "@/lib/types";
import { uid } from "@/lib/types";

// ================================
// Repo
// ================================
const KBRepo = repo<KBSection>(LS_KEYS.kb);

// ================================
// Permisos
// ================================
function canManage(role?: string | null) {
  return role === "promotor" || role === "gerente" || role === "admin";
}

// ================================
// Página
// ================================
export default function KBPage() {
  const session = useSessionUser();
  const { profile } = useProfile(session?.id);
  const [sections, setSections] = useState<KBSection[]>([]);
  const [q, setQ] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [editModal, setEditModal] = useState<{ open: boolean; section: KBSection | null }>({
    open: false,
    section: null,
  });
  const [filesModal, setFilesModal] = useState<{ open: boolean; section: KBSection | null }>({
    open: false,
    section: null,
  });

  useEffect(() => {
    setSections(KBRepo.list());
  }, []);

  useEffect(() => {
    KBRepo.saveAll(sections);
  }, [sections]);

  const filtered = useMemo(() => {
    if (!q) return sections;
    const qq = q.toLowerCase();
    return sections.filter(
      (s) =>
        s.title.toLowerCase().includes(qq) ||
        (s.description || "").toLowerCase().includes(qq) ||
        s.files?.some((f) => f.name.toLowerCase().includes(qq))
    );
  }, [sections, q]);

  // CRUD Sección
  const createSection = (data: Pick<KBSection, "title" | "description">) => {
    const s: KBSection = {
      id: uid(),
      title: data.title.trim(),
      description: (data.description || "").trim(),
      files: [],
  ownerId: profile?.id,
    };
    setSections((prev) => [s, ...prev]);
  };

  const updateSection = (sec: KBSection) => {
    setSections((prev) => prev.map((s) => (s.id === sec.id ? sec : s)));
  };

  const deleteSection = (id: string) => {
    setSections((prev) => prev.filter((s) => s.id !== id));
  };

  // Archivos
  const addFilesToSection = async (sec: KBSection, fileList: FileList) => {
    const arr = Array.from(fileList);
    const dataUrls = await Promise.all(
      arr.map(
        (f) =>
          new Promise<KBFile>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                id: uid(),
                name: f.name,
                size: f.size,
                type: f.type || "application/octet-stream",
                dataUrl: String(reader.result || ""),
                uploadedAt: new Date().toISOString(),
                uploadedById: profile?.id || "unknown",
              });
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(f);
          })
      )
    );
    const next: KBSection = { ...sec, files: [...(sec.files || []), ...dataUrls] };
    updateSection(next);
  };

  const removeFileFromSection = (sec: KBSection, fileId: string) => {
    const next: KBSection = { ...sec, files: (sec.files || []).filter((f) => f.id !== fileId) };
    updateSection(next);
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Base de Conocimiento</h2>
          <p className="text-sm text-muted-foreground">
            Documentos, guías y materiales compartidos por tu organización.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Buscar por título, descripción o archivo…"
            className="w-64"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {canManage(profile?.role) && (
            <Dialog open={openNew} onOpenChange={setOpenNew}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2" size={16} />
                  Nuevo apartado
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Nuevo apartado</DialogTitle>
                </DialogHeader>
                <SectionForm
                  onSubmit={(data) => {
                    createSection(data);
                    setOpenNew(false);
                  }}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </header>

      {/* Grid de apartados */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((s) => (
          <Card key={s.id} className="shadow-sm">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-base font-semibold">{s.title}</div>
                  {s.description && (
                    <div className="text-sm text-muted-foreground whitespace-pre-line">
                      {s.description}
                    </div>
                  )}
                </div>
                <div className="ml-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical size={18} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        disabled={!canManage(profile?.role)}
                        onClick={() => setFilesModal({ open: true, section: s })}
                      >
                        <UploadCloud className="mr-2" size={16} />
                        Subir archivos
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={!canManage(profile?.role)}
                        onClick={() => setEditModal({ open: true, section: s })}
                      >
                        <Pencil className="mr-2" size={16} />
                        Editar apartado
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={!canManage(profile?.role)}
                        onClick={() => {
                          if (confirm("¿Eliminar este apartado y todos sus archivos?")) {
                            deleteSection(s.id);
                          }
                        }}
                        className="text-red-600 focus:text-red-700"
                      >
                        <Trash2 className="mr-2" size={16} />
                        Eliminar apartado
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <FilesList
                files={s.files || []}
                canManage={canManage(profile?.role)}
                onDelete={(fileId) => removeFileFromSection(s, fileId)}
              />
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="text-sm text-muted-foreground">No hay apartados para mostrar.</div>
        )}
      </div>

      {/* Editar sección */}
      <Dialog
        open={editModal.open}
        onOpenChange={(open) => setEditModal({ open, section: open ? editModal.section : null })}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar apartado</DialogTitle>
          </DialogHeader>
          {editModal.section && (
            <SectionForm
              initial={editModal.section}
              onSubmit={(data) => {
                updateSection({ ...editModal.section!, ...data });
                setEditModal({ open: false, section: null });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Subir archivos */}
      <Dialog
        open={filesModal.open}
        onOpenChange={(open) => setFilesModal({ open, section: open ? filesModal.section : null })}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Subir archivos</DialogTitle>
          </DialogHeader>
          {filesModal.section && (
            <UploadBox
              onFiles={(fl) => {
                addFilesToSection(filesModal.section!, fl);
                setFilesModal({ open: false, section: null });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ================================
// Componentes auxiliares
// ================================
function SectionForm({
  initial,
  onSubmit,
}: {
  initial?: Pick<KBSection, "title" | "description">;
  onSubmit: (data: Pick<KBSection, "title" | "description">) => void;
}) {
  const [title, setTitle] = useState(initial?.title || "");
  const [description, setDescription] = useState(initial?.description || "");

  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <Label className="text-xs text-neutral-600">Título</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="grid gap-1">
        <Label className="text-xs text-neutral-600">Descripción</Label>
        <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <DialogFooter className="mt-2">
        <Button
          className="w-full"
          onClick={() => {
            if (!title.trim()) {
              alert("El título es obligatorio.");
              return;
            }
            onSubmit({ title: title.trim(), description: description.trim() });
          }}
        >
          Guardar
        </Button>
      </DialogFooter>
    </div>
  );
}

function UploadBox({ onFiles }: { onFiles: (files: FileList) => void }) {
  const [files, setFiles] = useState<FileList | null>(null);
  return (
    <div className="space-y-3">
      <div className="grid gap-1">
        <Label className="text-xs text-neutral-600">Selecciona archivos</Label>
        <Input
          type="file"
          multiple
          onChange={(e) => setFiles(e.currentTarget.files)}
          accept="*/*"
        />
      </div>
      <DialogFooter>
        <Button
          className="w-full"
          onClick={() => {
            if (!files || files.length === 0) {
              alert("Selecciona al menos un archivo.");
              return;
            }
            onFiles(files);
          }}
        >
          Subir
        </Button>
      </DialogFooter>
    </div>
  );
}

function FilesList({
  files,
  canManage,
  onDelete,
}: {
  files: KBFile[];
  canManage: boolean;
  onDelete: (fileId: string) => void;
}) {
  if (!files || files.length === 0) {
    return <div className="text-xs text-muted-foreground">Sin archivos.</div>;
  }
  return (
    <div className="space-y-2">
      {files.map((f) => (
        <div
          key={f.id}
          className="flex items-center justify-between p-2 rounded border bg-white hover:bg-neutral-50"
        >
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={16} className="shrink-0" />
            <div className="min-w-0">
              <div className="text-sm truncate">{f.name}</div>
              <div className="text-xs text-muted-foreground">
                {(f.size / 1024).toFixed(1)} KB · {new Date(f.uploadedAt).toLocaleString()}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href={f.dataUrl} download={f.name}>
              <Button size="sm" variant="secondary">
                Descargar
              </Button>
            </a>
            {canManage && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  if (confirm(`¿Eliminar ${f.name}?`)) onDelete(f.id);
                }}
              >
                <Trash2 size={14} className="mr-1" />
                Borrar
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}