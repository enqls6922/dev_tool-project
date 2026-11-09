/**
 * Tagged template that refuses substitutions.
 * C# editor scripts stay static; sprite names and other metadata go out as JSON.
 */
export function staticScript(strings: TemplateStringsArray, ...values: readonly unknown[]): string {
  if (values.length > 0) {
    throw new Error("C# 스크립트에 값을 보간할 수 없습니다. 메타데이터는 JSON 파일로 분리하세요.");
  }
  const source = strings.join("");
  if (source.includes("${")) {
    throw new Error("C# 스크립트 템플릿에 보간 흔적이 남아 있습니다.");
  }
  return source;
}

/** Isolate variable metadata in a JSON document. Scripts read this back with JsonUtility. */
export function serializeMetadata(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
