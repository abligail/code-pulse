import type { ReviewResult, RunResult } from '@/lib/api/review';

export type ReviewMode = 'syntax' | 'style' | 'logic';

export interface WeakKnowledgeCandidate {
  knowledge_id: string;
  knowledge_name: string;
  knowledge_category: string[];
  weak_reason: string;
  weak_score: number;
}

interface ReviewIssue {
  id: string;
  reason: string;
  suggestion: string;
  question: string;
  knowledgeName: string;
  knowledgeCategory: string[];
  severity: number;
}

export interface ReviewAssessment {
  review: ReviewResult;
  weakCandidates: WeakKnowledgeCandidate[];
  metrics: {
    issueCount: number;
    highestSeverity: number;
    mode: ReviewMode;
  };
}

interface AssessReviewInput {
  code: string;
  mode: ReviewMode;
  runResult?: RunResult;
}

const unique = (items: string[]) => Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));

const clampScore = (value: number) => Math.max(0, Math.min(10, Math.round(value)));

const hasNullCheck = (code: string) =>
  /if\s*\(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*(?:!=|==)\s*NULL\s*\)/.test(code) ||
  /if\s*\(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\)/.test(code);

const hasPotentialPointerOps = (code: string) => /->|\*[a-zA-Z_][a-zA-Z0-9_]*/.test(code);

const collectSyntaxIssues = (code: string, runResult?: RunResult): ReviewIssue[] => {
  const issues: ReviewIssue[] = [];
  const hasMain = /\bint\s+main\s*\(/.test(code);
  const usesPrintfOrScanf = /\b(printf|scanf)\s*\(/.test(code);
  const hasStdio = /#include\s*<stdio\.h>/.test(code);

  if (!runResult?.success && runResult?.errorType?.includes('编译')) {
    const reason = runResult.errorSummary || runResult.errorLinesSummary || '代码当前无法通过编译。';
    issues.push({
      id: 'syntax_compile',
      reason: `编译未通过：${reason}`,
      suggestion: '先修复编译错误行，再重新运行评审。',
      question: '你能定位首个编译错误，并解释它为何导致后续连锁报错吗？',
      knowledgeName: 'C 语法与声明基础',
      knowledgeCategory: ['程序调试', 'C语言'],
      severity: 8,
    });
  }

  if (!hasMain) {
    issues.push({
      id: 'syntax_main_entry',
      reason: '代码中未检测到标准入口函数 `int main()`。',
      suggestion: '补充 `int main()` 作为程序入口，并确保有 `return 0;`。',
      question: '你的程序执行入口在哪里，是否符合 C 语言规范？',
      knowledgeName: '程序入口函数',
      knowledgeCategory: ['C语言', '程序结构'],
      severity: 7,
    });
  }

  if (usesPrintfOrScanf && !hasStdio) {
    issues.push({
      id: 'syntax_stdio_header',
      reason: '检测到 `printf/scanf` 调用，但未包含 `<stdio.h>`。',
      suggestion: '在文件顶部补充 `#include <stdio.h>`。',
      question: '你调用的标准库函数，是否都包含了对应头文件？',
      knowledgeName: '标准库头文件匹配',
      knowledgeCategory: ['C语言', '语法规范'],
      severity: 6,
    });
  }

  const leftBrace = (code.match(/{/g) || []).length;
  const rightBrace = (code.match(/}/g) || []).length;
  if (leftBrace !== rightBrace) {
    issues.push({
      id: 'syntax_brace_balance',
      reason: '花括号数量不匹配，存在代码块边界风险。',
      suggestion: '逐层检查函数与控制流代码块，确保 `{}` 成对出现。',
      question: '是否有某个分支少了右花括号，导致后续语句归属错误？',
      knowledgeName: '代码块边界',
      knowledgeCategory: ['C语言', '语法规范'],
      severity: 6,
    });
  }

  const leftParen = (code.match(/\(/g) || []).length;
  const rightParen = (code.match(/\)/g) || []).length;
  if (leftParen !== rightParen) {
    issues.push({
      id: 'syntax_parenthesis_balance',
      reason: '圆括号数量不匹配，可能影响表达式和函数调用。',
      suggestion: '检查条件表达式、函数参数列表是否闭合。',
      question: '哪一个表达式的括号层级与你预期不一致？',
      knowledgeName: '表达式括号匹配',
      knowledgeCategory: ['C语言', '表达式'],
      severity: 5,
    });
  }

  return issues;
};

const collectStyleIssues = (code: string): ReviewIssue[] => {
  const issues: ReviewIssue[] = [];
  const lines = code.split(/\r?\n/);
  const longLineCount = lines.filter((line) => line.length > 100).length;
  const hasTabIndent = lines.some((line) => /^\t+/.test(line));
  const hasComments = /\/\/|\/\*/.test(code);

  if (longLineCount > 0) {
    issues.push({
      id: 'style_line_length',
      reason: `发现 ${longLineCount} 行代码超过 100 字符，可读性偏低。`,
      suggestion: '将过长语句拆分为更短的表达式或辅助变量。',
      question: '哪些长语句可以通过中间变量提高可读性？',
      knowledgeName: '代码可读性与格式化',
      knowledgeCategory: ['编码规范', 'C语言'],
      severity: 5,
    });
  }

  if (hasTabIndent) {
    issues.push({
      id: 'style_indent_consistency',
      reason: '检测到 Tab 缩进，可能与空格缩进混用。',
      suggestion: '统一缩进风格（建议 2 或 4 空格），减少团队协作冲突。',
      question: '你当前项目的缩进约定是什么，是否已统一？',
      knowledgeName: '缩进一致性',
      knowledgeCategory: ['编码规范'],
      severity: 4,
    });
  }

  const variableNames = Array.from(
    code.matchAll(/\b(?:int|long|short|float|double|char)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g),
    (match) => match[1]
  );
  const shortNames = variableNames.filter((name) => name.length <= 1 && !['i', 'j', 'k'].includes(name));
  if (shortNames.length >= 2) {
    issues.push({
      id: 'style_variable_naming',
      reason: `存在较多语义弱变量名（如：${unique(shortNames).join(', ')}）。`,
      suggestion: '将变量名改为可表达意图的命名（如 `count`, `index`, `headNode`）。',
      question: '读者仅看变量名，能否立即理解该变量的角色？',
      knowledgeName: '变量命名表达力',
      knowledgeCategory: ['编码规范'],
      severity: 5,
    });
  }

  if (lines.length >= 25 && !hasComments) {
    issues.push({
      id: 'style_commenting',
      reason: '代码体量较大但缺少注释，不利于后续维护。',
      suggestion: '为关键分支、边界处理和核心逻辑补充简洁注释。',
      question: '你认为哪些逻辑如果不写注释，三天后最难快速回忆？',
      knowledgeName: '注释与可维护性',
      knowledgeCategory: ['工程实践'],
      severity: 4,
    });
  }

  return issues;
};

const collectLogicIssues = (code: string, runResult?: RunResult): ReviewIssue[] => {
  const issues: ReviewIssue[] = [];
  const lowerError = `${runResult?.errorType ?? ''} ${runResult?.errorSummary ?? ''} ${runResult?.error ?? ''}`.toLowerCase();

  if (!runResult?.success) {
    if (runResult?.errorType?.includes('超时')) {
      issues.push({
        id: 'logic_loop_termination',
        reason: '程序运行超时，可能存在循环终止条件缺失或条件永真问题。',
        suggestion: '为循环增加明确终止条件，并使用小规模输入验证退出路径。',
        question: '你的循环在最坏情况下何时结束？如何证明它一定结束？',
        knowledgeName: '循环终止条件设计',
        knowledgeCategory: ['程序调试', '算法'],
        severity: 8,
      });
    } else if (lowerError.includes('segmentation') || lowerError.includes('sigsegv')) {
      issues.push({
        id: 'logic_pointer_safety',
        reason: '检测到段错误信号，通常由空指针或越界访问引发。',
        suggestion: '在解引用前增加空指针与边界校验。',
        question: '本次解引用的指针来源是否可靠，生命周期是否有效？',
        knowledgeName: '指针与内存安全',
        knowledgeCategory: ['程序调试', 'C语言'],
        severity: 9,
      });
    } else if (runResult?.errorType?.includes('运行时')) {
      issues.push({
        id: 'logic_runtime_stability',
        reason: runResult.errorSummary || '程序出现运行时异常。',
        suggestion: '补充边界输入测试并定位触发异常的最小复现样例。',
        question: '在异常发生前，哪些变量的值偏离了你的预期？',
        knowledgeName: '运行时稳定性',
        knowledgeCategory: ['程序调试'],
        severity: 7,
      });
    }
  }

  if (/\bwhile\s*\(\s*1\s*\)/.test(code) && !/\bbreak\s*;/.test(code)) {
    issues.push({
      id: 'logic_infinite_loop',
      reason: '检测到 `while(1)` 且未发现 `break`，存在死循环风险。',
      suggestion: '增加可达的退出条件，或改为条件循环。',
      question: '该循环的退出条件是什么，触发路径是否真实可达？',
      knowledgeName: '循环控制与退出路径',
      knowledgeCategory: ['算法', '程序调试'],
      severity: 8,
    });
  }

  if (/\bmalloc\s*\(/.test(code) && !/\bfree\s*\(/.test(code)) {
    issues.push({
      id: 'logic_memory_release',
      reason: '检测到动态内存分配但未发现对应释放，存在内存泄漏风险。',
      suggestion: '为每个 `malloc/calloc/realloc` 路径补充 `free`，并考虑异常分支回收。',
      question: '每一块动态内存在成功和失败路径下都被释放了吗？',
      knowledgeName: '动态内存生命周期',
      knowledgeCategory: ['C语言', '内存管理'],
      severity: 7,
    });
  }

  if (hasPotentialPointerOps(code) && !hasNullCheck(code)) {
    issues.push({
      id: 'logic_null_guard',
      reason: '检测到指针操作，但未识别到显式空指针保护逻辑。',
      suggestion: '在关键解引用位置增加 `NULL` 判定。',
      question: '哪些指针来自外部输入或函数返回，可能为空？',
      knowledgeName: '空指针防护',
      knowledgeCategory: ['C语言', '程序调试'],
      severity: 6,
    });
  }

  if (/\bfor\s*\([^;]*;[^;]*<=\s*[a-zA-Z_][a-zA-Z0-9_]*[^;]*;/.test(code) && /\[[^\]]+\]/.test(code)) {
    issues.push({
      id: 'logic_index_boundary',
      reason: '循环条件出现 `<=` 且存在数组访问，可能产生越界风险。',
      suggestion: '优先使用 `< length` 形式，并统一边界定义来源。',
      question: '当前上界是否包含最后一个合法下标？',
      knowledgeName: '数组边界控制',
      knowledgeCategory: ['C语言', '程序调试'],
      severity: 7,
    });
  }

  return issues;
};

const buildPositiveReview = (mode: ReviewMode): ReviewResult => {
  const modeName = {
    syntax: '语法',
    style: '风格',
    logic: '逻辑',
  }[mode];

  return {
    status: 'ok',
    summary: `${modeName}层面未发现明显问题，建议继续用更多测试样例验证稳定性。`,
    details: [`当前代码在${modeName}层面表现稳定。`],
    suggestions: ['继续补充边界输入与异常输入测试，防止隐藏问题在复杂场景暴露。'],
    questions: ['如果输入规模扩大 10 倍，这段代码最先可能出现什么问题？'],
  };
};

const buildReviewSummary = (mode: ReviewMode, issues: ReviewIssue[]) => {
  const modeName = {
    syntax: '语法',
    style: '风格',
    logic: '逻辑',
  }[mode];
  const maxSeverity = Math.max(...issues.map((issue) => issue.severity));
  if (maxSeverity >= 8) {
    return `${modeName}评审发现高风险问题 ${issues.length} 项，建议优先处理。`;
  }
  return `${modeName}评审发现可改进点 ${issues.length} 项，可逐步优化。`;
};

const buildWeakCandidates = (issues: ReviewIssue[]): WeakKnowledgeCandidate[] => {
  const merged = new Map<string, WeakKnowledgeCandidate>();
  for (const issue of issues) {
    const knowledgeId = `k_review_${issue.id}`;
    const nextScore = clampScore(issue.severity);
    const existing = merged.get(knowledgeId);
    if (!existing) {
      merged.set(knowledgeId, {
        knowledge_id: knowledgeId,
        knowledge_name: issue.knowledgeName,
        knowledge_category: unique(issue.knowledgeCategory),
        weak_reason: issue.reason,
        weak_score: nextScore,
      });
      continue;
    }
    existing.weak_score = Math.max(existing.weak_score, nextScore);
    existing.knowledge_category = unique([...existing.knowledge_category, ...issue.knowledgeCategory]);
    existing.weak_reason = unique([existing.weak_reason, issue.reason]).join('；');
  }
  return Array.from(merged.values());
};

export const assessReview = ({ code, mode, runResult }: AssessReviewInput): ReviewAssessment => {
  const normalizedCode = code || '';
  let issues: ReviewIssue[] = [];

  if (mode === 'syntax') {
    issues = collectSyntaxIssues(normalizedCode, runResult);
  } else if (mode === 'style') {
    issues = collectStyleIssues(normalizedCode);
  } else {
    issues = collectLogicIssues(normalizedCode, runResult);
  }

  if (issues.length === 0) {
    return {
      review: buildPositiveReview(mode),
      weakCandidates: [],
      metrics: {
        issueCount: 0,
        highestSeverity: 0,
        mode,
      },
    };
  }

  const details = unique(issues.map((issue) => issue.reason)).slice(0, 4);
  const suggestions = unique(issues.map((issue) => issue.suggestion)).slice(0, 4);
  const questions = unique(issues.map((issue) => issue.question)).slice(0, 3);

  return {
    review: {
      status: 'ok',
      summary: buildReviewSummary(mode, issues),
      details,
      suggestions,
      questions,
    },
    weakCandidates: buildWeakCandidates(issues),
    metrics: {
      issueCount: issues.length,
      highestSeverity: Math.max(...issues.map((issue) => issue.severity)),
      mode,
    },
  };
};

