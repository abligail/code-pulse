interface QuestionStemSegment {
  type: 'text' | 'code';
  content: string;
}

const toHalfWidth = (value: string) =>
  Array.from(value)
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code === 0x3000) return '  ';
      if (code >= 0xff01 && code <= 0xff5e) {
        return String.fromCharCode(code - 0xfee0);
      }
      return char;
    })
    .join('');

const normalizeLines = (value: string) =>
  value
    .replace(/\r\n?/g, '\n')
    .split('\n');

const looksLikeCodeLine = (line: string) => {
  const text = toHalfWidth(line).trim();
  if (!text) return false;
  if (/^(#\s*include|#\s*define|int\s+main\s*\(|main\s*\()/i.test(text)) return true;
  if (/[{};<>]/.test(text)) return true;
  if (/(\+\+|--|==|!=|<=|>=|&&|\|\|)/.test(text)) return true;
  if (/\b(printf|scanf|while|for|if|else|return|char|int|void|double|float|switch|case|break)\b/i.test(text)) return true;
  return false;
};

const normalizeCodeLine = (line: string) =>
  toHalfWidth(line)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, '\'');

const dedentCode = (value: string) => {
  const lines = normalizeLines(value).map((line) => normalizeCodeLine(line).replace(/\s+$/g, ''));
  const nonEmpty = lines.filter((line) => line.trim().length > 0);
  if (nonEmpty.length === 0) return '';

  const minIndent = nonEmpty.reduce((min, line) => {
    const indent = (line.match(/^[ \t]*/) || [''])[0].length;
    return Math.min(min, indent);
  }, Number.POSITIVE_INFINITY);

  return lines
    .map((line) => {
      if (!line.trim()) return '';
      return line.slice(Math.min(minIndent, line.length));
    })
    .join('\n')
    .trimEnd();
};

const splitQuestionStem = (value: string): QuestionStemSegment[] => {
  const lines = normalizeLines(value);
  const flags = lines.map((line) => looksLikeCodeLine(line));

  for (let index = 1; index < lines.length - 1; index += 1) {
    if (lines[index].trim()) continue;
    if (flags[index - 1] && flags[index + 1]) {
      flags[index] = true;
    }
  }

  const segments: QuestionStemSegment[] = [];
  let current: QuestionStemSegment | null = null;
  const pushSegment = (segment: QuestionStemSegment | null) => {
    if (!segment) return;
    if (!segment.content.trim()) return;
    segments.push({ type: segment.type, content: segment.content.trimEnd() });
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const type: QuestionStemSegment['type'] = flags[index] ? 'code' : 'text';
    if (!current) {
      current = { type, content: line };
      continue;
    }
    if (current.type === type) {
      current = { type: current.type, content: `${current.content}\n${line}` };
      continue;
    }
    pushSegment(current);
    current = { type, content: line };
  }
  pushSegment(current);

  return segments;
};

export function QuestionStem({ value, className }: { value: string; className?: string }) {
  const segments = splitQuestionStem(value);

  return (
    <div className={className}>
      {segments.map((segment, index) =>
        segment.type === 'code' ? (
          <pre
            key={`stem-code-${index}`}
            className="my-2 overflow-x-auto rounded-md border bg-muted/30 px-3 py-2 font-mono text-sm leading-relaxed"
          >
            <code>{dedentCode(segment.content)}</code>
          </pre>
        ) : (
          <p key={`stem-text-${index}`} className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {segment.content}
          </p>
        )
      )}
    </div>
  );
}
