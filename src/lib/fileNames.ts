export function uniqueFileNames(names: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    if (count === 0) return name;
    const dot = name.lastIndexOf(".");
    if (dot <= 0) return `${name}_${count + 1}`;
    return `${name.slice(0, dot)}_${count + 1}${name.slice(dot)}`;
  });
}
