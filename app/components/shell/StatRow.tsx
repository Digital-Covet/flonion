interface StatRowProps {
  label: string;
  value: string | number;
  description?: string;
}

export function StatRow({ label, value, description }: StatRowProps) {
  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {description && (
        <div className="text-xs text-gray-400 mt-1">{description}</div>
      )}
    </div>
  );
}
