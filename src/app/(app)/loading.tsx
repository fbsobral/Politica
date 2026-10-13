export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Carregando">
      <div className="skeleton mb-2 h-3 w-40" />
      <div className="skeleton mb-6 h-12 w-72" />
      <div className="skeleton mb-6 h-12 w-full sm:w-[28rem]" />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17.5rem]">
        <div className="space-y-3.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card flex gap-4 p-5">
              <div className="flex-1 space-y-3">
                <div className="skeleton h-3 w-48" />
                <div className="skeleton h-5 w-full" />
                <div className="skeleton h-5 w-2/3" />
                <div className="skeleton h-3 w-24" />
              </div>
              <div className="skeleton hidden h-24 w-32 sm:block" />
            </div>
          ))}
        </div>
        <div className="skeleton hidden h-96 lg:block" />
      </div>
    </div>
  );
}
