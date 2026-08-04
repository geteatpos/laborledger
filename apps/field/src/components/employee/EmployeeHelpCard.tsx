export function EmployeeHelpCard() {
  return (
    <div className="ll-card border border-slate-200 bg-slate-50">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200">
          <svg className="h-4 w-4 text-slate-600" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-slate-900">Cómo funciona</p>
          <p className="mt-1 text-sm text-slate-600">
            Recibe un vehículo, luego abre Mis Trabajos para comenzar el servicio asignado, 
            sigue el progreso y competa cuando termines.
          </p>
        </div>
      </div>
    </div>
  );
}
