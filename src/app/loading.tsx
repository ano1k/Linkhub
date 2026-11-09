export default function Loading() {
  return (
    <div className="min-h-screen">
      <div className="h-16 border-b border-white/6" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="h-10 w-64 rounded-lg shimmer" />
        <div className="h-24 w-full rounded-xl shimmer" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="h-40 rounded-xl shimmer" />
          <div className="h-40 rounded-xl shimmer" />
          <div className="h-40 rounded-xl shimmer" />
        </div>
      </div>
    </div>
  )
}
