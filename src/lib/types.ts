// Modelos y tipos compartidos

export type UserRole = "asesor" | "gerente" | "promotor";
export type User = {
  id: string;
  role: UserRole;
  name: string;
  username: string;
  password: string;
  startDate?: string;
  managerId?: string;
  promoterId?: string;
};

export const uid = () => Math.random().toString(36).slice(2, 10);

export type Client = {
  id: string;
  nombre: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  telefono?: string;
  email?: string;
  fechaNacimiento?: string;
  sexo?: "Masculino" | "Femenino" | "Otro";
  estadoCivil?: "Soltero(a)" | "Casado(a)" | "Unión libre" | "Divorciado(a)" | "Viudo(a)";
  estadoResidencia?: string;
  ocupacion?: string;
  empresa?: string;
  ingresoHogar?: number;
  dependientes?: number;
  fumador?: boolean;
  fuente?: "Mercado natural" | "Referido" | "Redes" | "Frío" | "Evento" | "COI" | "Otros";
  necesidades?: string[];
  estatus?: "Prospecto" | "Cliente" | "Inactivo" | "Referido" | "No interesado";
  referidoPorId?: string | null;
  asesor?: string;
  ultimoContacto?: string;
  anfRealizado?: boolean;
  anfFecha?: string;
  createdAt?: string;
  ownerId?: string;
  // Contacto quick flag + fecha
  contactado?: boolean;
  contactado_fecha?: string | Date | null; // ISO string or Date when marked contactado
};

export type Policy = {
  id: string;
  clienteId: string;
  plan: string;
  numeroPoliza?: string;
  estado: "Vigente" | "Propuesta" | "Rechazada" | "En proceso";
  sumaAsegurada?: number;
  primaMensual?: number;
  fechaIngreso?: string;
  fechaExamenMedico?: string;
  formaPago?: "Mensual" | "Trimestral" | "Semestral" | "Anual";
  fechaPago?: string;
  fechaEntrega?: string;
  comisionEstimada?: number;
  participa?: { mdrt?: boolean; convencion?: boolean; reconocimiento?: boolean };
  necesidadesFuturas?: string;
  proximoSeguimiento?: string;
  pdfUrl?: string;
  createdAt?: string;
  ownerId?: string;
  msi?: boolean; // meses sin intereses
  moneda?: "MXN" | "USD" | "UDIS"; // tipo de moneda
};

export type Activity = {
  id: string;
  tipo: "Llamada" | "Cita Inicial" | "Cita Cierre" | "Entrega" | "Seguimiento";
  clienteId: string;
  fechaHora: string;
  fechaHoraFin?: string;
  lugar?: string;
  notas?: string;
  realizada?: boolean;
  generoCierre?: boolean;
  obtuvoReferidos?: boolean;
  reagendada?: boolean;
  // colores permitidos para actividades
  color?: "verde" | "verdeamarillento" | "amarillo" | "naranja" | "rojo";
  ownerId?: string;
};

export type Goal = {
  id: string;
  tipo: "Ingreso mensual" | "Pólizas mensuales" | "Citas semanales" | "Referidos";
  mes: string;
  metaMensual?: number;
  metaAnual?: number;
};

export type MedicalForm = {
  id: string;
  clienteId: string;
  fecha: string;
  enfermedades?: string;
  hospitalizacion?: string;
  medicamentos?: string;
  cirugias?: string;
  antecedentes?: string;
  otros?: string;
  pdfUrl?: string;
  ownerId?: string;
};

export type KBFile = {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string;
  uploadedAt: string;
  uploadedById: string;
};

export type KBSection = {
  id: string;
  title: string;
  description?: string;
  files: KBFile[];
  ownerId?: string;
};