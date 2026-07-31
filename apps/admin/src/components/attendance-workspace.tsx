"use client";

import { useEffect, useState } from "react";

import { MaterialIcon } from "./ui/material-icon";
import type { CompanyRecord, EmployeeProfile } from "../lib/employee-utils";
import { employeeInitials, employeePhotoSrc } from "../lib/employee-utils";

type AttendanceRecord = {
  id: string;
  time: string;
  type: "entrada" | "salida";
  employeeName: string;
};

type AttendanceWorkspaceProps = {
  readonly selectedCompany: CompanyRecord;
  readonly employees: EmployeeProfile[];
};

function RealTimeClock() {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!time) {
    return (
      <div className="h-20 w-full animate-pulse rounded-xl bg-slate-200" />
    );
  }

  const timeStr = time.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  const dateStr = time.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 text-center">
      <div className="font-display text-5xl font-bold tracking-tight text-[#0F172A]">
        {timeStr}
      </div>
      <div className="mt-2 text-sm font-medium uppercase tracking-widest text-[#64748B]">
        {dateStr}
      </div>
    </div>
  );
}

function EmployeeAvatar({
  companyId,
  employeeId,
  photoUrl,
  fullName,
  size = "md"
}: {
  companyId: string;
  employeeId: string;
  photoUrl: string | null | undefined;
  fullName: string;
  size?: "sm" | "md";
}) {
  const photoSource = employeePhotoSrc(companyId, employeeId, photoUrl);
  const sizeClass = size === "sm" ? "h-8 w-8 text-[10px]" : "h-10 w-10 text-xs";

  if (photoSource) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoSource}
        alt=""
        className={`${sizeClass} shrink-0 rounded-full border border-[#E5E7EB] object-cover`}
      />
    );
  }

  return (
    <div className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full border border-[#E5E7EB] bg-[#F1F5F9] font-medium text-[#475569]`}>
      {employeeInitials(fullName)}
    </div>
  );
}

function EmployeeSelector({
  companyId,
  employees,
  selectedEmployee,
  onSelect
}: {
  companyId: string;
  employees: EmployeeProfile[];
  selectedEmployee: EmployeeProfile | null;
  onSelect: (employee: EmployeeProfile | null) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const filteredEmployees = employees.filter(
    (employee) =>
      employee.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (employee.title?.toLowerCase() ?? "").includes(searchQuery.toLowerCase())
  );

  return (
    <div className="relative">
      <label className="stitch-label mb-2 block">Empleado</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-3 rounded-lg border border-[#E5E7EB] bg-white p-3 text-left transition hover:border-[#CBD5E1]"
      >
        {selectedEmployee ? (
          <>
            <EmployeeAvatar
              companyId={companyId}
              employeeId={selectedEmployee.id}
              photoUrl={selectedEmployee.photoUrl}
              fullName={selectedEmployee.fullName}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-[#0F172A]">{selectedEmployee.fullName}</p>
              <p className="truncate text-sm text-[#64748B]">
                {selectedEmployee.title || "Sin puesto"}
              </p>
            </div>
          </>
        ) : (
          <span className="text-[#94A3B8]">Seleccionar empleado...</span>
        )}
        <MaterialIcon
          name={isOpen ? "expand_less" : "expand_more"}
          className="ml-auto text-[#64748B]"
        />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-hidden rounded-lg border border-[#E5E7EB] bg-white shadow-lg">
            <div className="sticky top-0 border-b border-[#E5E7EB] bg-white p-2">
              <div className="relative">
                <MaterialIcon
                  name="search"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar empleado..."
                  className="stitch-input w-full pl-9 pr-3 py-2"
                  autoFocus
                />
              </div>
            </div>
            <ul className="max-h-48 overflow-y-auto py-1">
              {filteredEmployees.length === 0 ? (
                <li className="px-4 py-3 text-sm text-[#64748B]">
                  No se encontraron empleados
                </li>
              ) : (
                filteredEmployees.map((employee) => (
                  <li key={employee.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(employee);
                        setIsOpen(false);
                        setSearchQuery("");
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-[#F8FAFC]"
                    >
                      <EmployeeAvatar
                        companyId={companyId}
                        employeeId={employee.id}
                        photoUrl={employee.photoUrl}
                        fullName={employee.fullName}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[#0F172A]">
                          {employee.fullName}
                        </p>
                        <p className="truncate text-xs text-[#64748B]">
                          {employee.title || "Sin puesto"}
                        </p>
                      </div>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: "en_turno" | "fuera_de_turno" }) {
  if (status === "en_turno") {
    return (
      <span className="stitch-badge-success inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-[#15803b]" />
        En turno
      </span>
    );
  }
  return (
    <span className="stitch-badge-warning inline-flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full bg-[#b45309]" />
      Fuera de turno
    </span>
  );
}

function ActionButtons({
  selectedEmployee,
  currentStatus,
  onClockIn,
  onClockOut,
  isLoading
}: {
  selectedEmployee: EmployeeProfile | null;
  currentStatus: "en_turno" | "fuera_de_turno";
  onClockIn: () => void;
  onClockOut: () => void;
  isLoading: boolean;
}) {
  const isDisabled = !selectedEmployee || isLoading;

  return (
    <div className="flex gap-4">
      <button
        type="button"
        onClick={onClockIn}
        disabled={isDisabled}
        className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#059669] px-6 py-4 text-base font-semibold text-white transition hover:bg-[#047857] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <MaterialIcon name="login" className="text-xl" />
        Registrar Entrada
      </button>
      <button
        type="button"
        onClick={onClockOut}
        disabled={isDisabled || currentStatus === "fuera_de_turno"}
        className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#DC2626] px-6 py-4 text-base font-semibold text-white transition hover:bg-[#B91C1C] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <MaterialIcon name="logout" className="text-xl" />
        Registrar Salida
      </button>
    </div>
  );
}

function AttendanceTable({ records }: { records: AttendanceRecord[] }) {
  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-[#E5E7EB] bg-white p-8 text-center">
        <MaterialIcon name="event_busy" className="mx-auto mb-3 text-4xl text-[#CBD5E1]" />
        <p className="text-sm text-[#64748B]">No hay registros de asistencia hoy</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
      <div className="border-b border-[#E5E7EB] bg-[#f9fafb] px-5 py-3">
        <h3 className="text-sm font-semibold text-[#0F172A]">Registros de Hoy</h3>
      </div>
      <table className="stitch-table w-full text-left">
        <thead>
          <tr className="border-b border-[#E5E7EB] bg-[#f9fafb]">
            <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wider text-[#434655]">
              Hora
            </th>
            <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wider text-[#434655]">
              Tipo
            </th>
            <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wider text-[#434655]">
              Empleado
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F1F5F9]">
          {records.map((record) => (
            <tr key={record.id} className="transition hover:bg-[#F8FAFC]">
              <td className="px-5 py-3.5 text-sm text-[#0F172A]">{record.time}</td>
              <td className="px-5 py-3.5">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    record.type === "entrada"
                      ? "bg-[#bbf7d0] text-[#15803b]"
                      : "bg-[#ffdad6] text-[#93000a]"
                  }`}
                >
                  {record.type === "entrada" ? "Entrada" : "Salida"}
                </span>
              </td>
              <td className="px-5 py-3.5 text-sm text-[#0F172A]">{record.employeeName}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Sample data for demonstration - in production this would come from API
const SAMPLE_RECORDS: AttendanceRecord[] = [
  { id: "1", time: "08:32", type: "entrada", employeeName: "Carlos Méndez" },
  { id: "2", time: "08:45", type: "entrada", employeeName: "María López" },
  { id: "3", time: "09:15", type: "entrada", employeeName: "Juan Pérez" },
  { id: "4", time: "12:30", type: "salida", employeeName: "María López" },
  { id: "5", time: "13:00", type: "entrada", employeeName: "María López" }
];

export function AttendanceWorkspace({
  selectedCompany,
  employees
}: AttendanceWorkspaceProps) {
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeProfile | null>(null);
  const [currentStatus, setCurrentStatus] = useState<"en_turno" | "fuera_de_turno">("fuera_de_turno");
  const [isLoading, setIsLoading] = useState(false);
  const [records] = useState<AttendanceRecord[]>(SAMPLE_RECORDS);

  const handleClockIn = () => {
    if (!selectedEmployee) return;
    setIsLoading(true);
    // Simulate API call - in production this would call the punch API
    setTimeout(() => {
      setCurrentStatus("en_turno");
      setIsLoading(false);
    }, 500);
  };

  const handleClockOut = () => {
    if (!selectedEmployee) return;
    setIsLoading(true);
    // Simulate API call - in production this would call the punch API
    setTimeout(() => {
      setCurrentStatus("fuera_de_turno");
      setIsLoading(false);
    }, 500);
  };

  return (
    <div className="space-y-6">
      {/* Real-time Clock */}
      <RealTimeClock />

      {/* Main Control Card */}
      <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
        {/* Status Badge */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-[#64748B]">Estado actual:</span>
            <StatusBadge status={currentStatus} />
          </div>
        </div>

        {/* Employee Selector */}
        <div className="mb-6">
          <EmployeeSelector
            companyId={selectedCompany.id}
            employees={employees}
            selectedEmployee={selectedEmployee}
            onSelect={setSelectedEmployee}
          />
        </div>

        {/* Action Buttons */}
        <ActionButtons
          selectedEmployee={selectedEmployee}
          currentStatus={currentStatus}
          onClockIn={handleClockIn}
          onClockOut={handleClockOut}
          isLoading={isLoading}
        />
      </div>

      {/* Today's Records */}
      <AttendanceTable records={records} />
    </div>
  );
}
