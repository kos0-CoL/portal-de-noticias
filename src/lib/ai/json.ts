/**
 * Utilidades para leer el JSON que devuelven los modelos de IA.
 * Los modelos suelen envolver la respuesta en ```json ... ``` o agregar texto
 * suelto alrededor del objeto, así que el parseo tiene que ser tolerante.
 */

/**
 * Extrae el primer objeto JSON válido del texto devuelto por la IA.
 * Acepta ```json ... ``` y texto suelto alrededor del objeto.
 * `pista` se agrega al error para indicarle al usuario qué puede reintentar.
 */
export function extractJsonObject(raw: string, pista = 'Volvé a intentar la operación.'): string {
  let text = raw.trim();

  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text);
  if (fence) text = fence[1].trim();

  try {
    JSON.parse(text);
    return text;
  } catch {
    /* sigue con la extraccion manual */
  }

  const start = text.indexOf('{');
  if (start >= 0) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < text.length; i++) {
      const char = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') inString = true;
      else if (char === '{') depth++;
      else if (char === '}') {
        depth--;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
  }

  throw new Error(`La IA no devolvió un JSON válido. ${pista}`);
}
