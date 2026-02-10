import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { RunResult } from '@/lib/api/review';

const SOURCE_FILE_NAME = 'main.c';
const BINARY_FILE_NAME = 'main.out';

const readPositiveInt = (raw: string | undefined, fallback: number) => {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const COMPILE_TIMEOUT_MS = readPositiveInt(process.env.REVIEW_COMPILE_TIMEOUT_MS, 6_000);
const RUN_TIMEOUT_MS = readPositiveInt(process.env.REVIEW_RUN_TIMEOUT_MS, 3_000);
const MAX_OUTPUT_BYTES = readPositiveInt(process.env.REVIEW_MAX_OUTPUT_BYTES, 64 * 1024);

interface ProcessResult {
  exitCode: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  outputTruncated: boolean;
  spawnError: string | null;
}

interface ProcessOptions {
  command: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  maxOutputBytes: number;
  input?: string;
}

const toSeconds = (ms: number) => `${(ms / 1000).toFixed(2)}s`;

const combineOutput = (stderr: string, stdout: string) =>
  [stderr.trim(), stdout.trim()].filter(Boolean).join('\n');

const getCompileErrorInfo = (stderr: string, sourceFileName: string) => {
  const lines: number[] = [];
  let summary: string | undefined;
  const escapedFile = sourceFileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`${escapedFile}:(\\d+):\\d+:\\s*(?:fatal\\s+)?error:\\s*([^\\n]+)`, 'gi');
  let match: RegExpExecArray | null = null;
  while ((match = pattern.exec(stderr)) !== null) {
    const lineNumber = Number(match[1]);
    if (Number.isFinite(lineNumber)) {
      lines.push(lineNumber);
    }
    if (!summary) {
      summary = match[2].trim();
    }
  }
  const uniqueLines = Array.from(new Set(lines)).sort((a, b) => a - b);
  return { lines: uniqueLines, summary };
};

const buildFailure = (partial: Omit<RunResult, 'success'>): RunResult => ({
  success: false,
  ...partial,
});

const runProcess = async (options: ProcessOptions): Promise<ProcessResult> =>
  new Promise((resolve) => {
    const startedAt = Date.now();
    let settled = false;
    let timedOut = false;
    let outputTruncated = false;
    let totalOutputBytes = 0;
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    const finish = (partial?: Partial<ProcessResult>) => {
      if (settled) return;
      settled = true;
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
      }
      resolve({
        exitCode: partial?.exitCode ?? null,
        signal: partial?.signal ?? null,
        stdout: partial?.stdout ?? Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: partial?.stderr ?? Buffer.concat(stderrChunks).toString('utf8'),
        durationMs: Date.now() - startedAt,
        timedOut: partial?.timedOut ?? timedOut,
        outputTruncated: partial?.outputTruncated ?? outputTruncated,
        spawnError: partial?.spawnError ?? null,
      });
    };

    let child: ReturnType<typeof spawn> | null = null;
    try {
      child = spawn(options.command, options.args, {
        cwd: options.cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      finish({ spawnError: message });
      return;
    }

    if (!child) {
      finish({ spawnError: 'Failed to spawn process' });
      return;
    }

    const appendChunk = (target: Buffer[], chunk: Buffer) => {
      if (settled) return;
      if (outputTruncated) return;
      const remaining = options.maxOutputBytes - totalOutputBytes;
      if (remaining <= 0) {
        outputTruncated = true;
        child?.kill('SIGKILL');
        return;
      }
      if (chunk.length > remaining) {
        target.push(chunk.subarray(0, remaining));
        totalOutputBytes += remaining;
        outputTruncated = true;
        child?.kill('SIGKILL');
        return;
      }
      target.push(chunk);
      totalOutputBytes += chunk.length;
    };

    child.stdout.on('data', (chunk: Buffer | string) => {
      appendChunk(stdoutChunks, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    child.stderr.on('data', (chunk: Buffer | string) => {
      appendChunk(stderrChunks, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    child.on('error', (error) => {
      finish({
        spawnError: error.message,
      });
    });

    child.on('close', (code, signal) => {
      finish({
        exitCode: code,
        signal: signal ?? null,
      });
    });

    timeoutTimer = setTimeout(() => {
      timedOut = true;
      child?.kill('SIGKILL');
    }, options.timeoutMs);

    if (options.input) {
      child.stdin.write(options.input);
    }
    child.stdin.end();
  });

interface CompileResult {
  compiler: string | null;
  result: ProcessResult;
}

const compileCode = async (sourcePath: string, binaryPath: string, cwd: string): Promise<CompileResult> => {
  const configuredCompiler = process.env.C_COMPILER?.trim();
  const candidates = Array.from(
    new Set([configuredCompiler, 'gcc', 'clang'].filter((item): item is string => Boolean(item)))
  );

  const args = [sourcePath, '-std=c11', '-O0', '-Wall', '-Wextra', '-o', binaryPath];
  for (const compiler of candidates) {
    const result = await runProcess({
      command: compiler,
      args,
      cwd,
      timeoutMs: COMPILE_TIMEOUT_MS,
      maxOutputBytes: MAX_OUTPUT_BYTES,
    });
    if (result.spawnError && /ENOENT|not found/i.test(result.spawnError)) {
      continue;
    }
    return { compiler, result };
  }

  return {
    compiler: null,
    result: {
      exitCode: null,
      signal: null,
      stdout: '',
      stderr: '',
      durationMs: 0,
      timedOut: false,
      outputTruncated: false,
      spawnError: '未检测到可用的 C 编译器（gcc/clang）。',
    },
  };
};

const classifyRuntimeSummary = (result: ProcessResult) => {
  const merged = combineOutput(result.stderr, result.stdout).toLowerCase();
  if (result.signal === 'SIGSEGV' || merged.includes('segmentation fault') || merged.includes('sigsegv')) {
    return '程序触发段错误，通常由非法内存访问导致。';
  }
  if (result.signal === 'SIGABRT' || merged.includes('abort')) {
    return '程序被异常中止，请检查断言或内存相关错误。';
  }
  if (result.signal === 'SIGFPE' || merged.includes('floating point exception')) {
    return '程序出现数值异常（如除零）。';
  }
  return '程序以非零退出码结束，请检查运行时逻辑与边界条件。';
};

export interface RunCodeInput {
  code: string;
  input?: string;
}

export const runCCode = async ({ code, input }: RunCodeInput): Promise<RunResult> => {
  let workDir: string | null = null;
  try {
    workDir = await mkdtemp(path.join(tmpdir(), 'code-pulse-review-'));
    const sourcePath = path.join(workDir, SOURCE_FILE_NAME);
    const binaryPath = path.join(workDir, BINARY_FILE_NAME);
    await writeFile(sourcePath, code, 'utf8');

    const compile = await compileCode(sourcePath, binaryPath, workDir);
    if (!compile.compiler) {
      return buildFailure({
        errorType: '平台错误',
        errorSummary: '当前环境未配置 C 编译器，无法执行代码。',
        error: compile.result.spawnError ?? 'Compiler unavailable',
      });
    }

    if (compile.result.spawnError) {
      return buildFailure({
        errorType: '平台错误',
        errorSummary: '编译器调用失败，请稍后重试。',
        error: compile.result.spawnError,
      });
    }

    if (compile.result.timedOut) {
      return buildFailure({
        errorType: '编译超时',
        errorSummary: '编译时间超过限制，请简化代码后重试。',
        error: combineOutput(compile.result.stderr, compile.result.stdout) || 'Compile timed out',
      });
    }

    if ((compile.result.exitCode ?? -1) !== 0) {
      const compileOutput = combineOutput(compile.result.stderr, compile.result.stdout);
      const compileInfo = getCompileErrorInfo(compile.result.stderr, SOURCE_FILE_NAME);
      return buildFailure({
        errorType: '编译错误',
        errorLines: compileInfo.lines.length > 0 ? compileInfo.lines : undefined,
        errorLinesSummary: compileInfo.summary,
        errorSummary: '代码未通过编译，请先修复语法与声明问题。',
        error: compileOutput || 'Compile failed',
      });
    }

    const run = await runProcess({
      command: binaryPath,
      args: [],
      cwd: workDir,
      input,
      timeoutMs: RUN_TIMEOUT_MS,
      maxOutputBytes: MAX_OUTPUT_BYTES,
    });

    if (run.spawnError) {
      return buildFailure({
        errorType: '平台错误',
        errorSummary: '运行进程启动失败，请稍后重试。',
        error: run.spawnError,
      });
    }

    if (run.timedOut) {
      return buildFailure({
        errorType: '运行超时',
        errorSummary: '程序运行超过时间限制，可能存在死循环。',
        error: combineOutput(run.stderr, run.stdout) || 'Run timed out',
        exitCode: run.exitCode ?? undefined,
      });
    }

    if (run.outputTruncated) {
      return buildFailure({
        errorType: '运行输出超限',
        errorSummary: '程序输出超过上限，请减少打印或检查循环终止条件。',
        error: combineOutput(run.stderr, run.stdout) || 'Output exceeded limit',
        exitCode: run.exitCode ?? undefined,
      });
    }

    if ((run.exitCode ?? -1) !== 0) {
      return buildFailure({
        errorType: '运行时错误',
        errorSummary: classifyRuntimeSummary(run),
        error: combineOutput(run.stderr, run.stdout) || `Process exited with code ${run.exitCode}`,
        exitCode: run.exitCode ?? undefined,
      });
    }

    const totalMs = compile.result.durationMs + run.durationMs;
    return {
      success: true,
      data: {
        output: run.stdout,
        compileTime: toSeconds(compile.result.durationMs),
        runTime: toSeconds(run.durationMs),
        totalTime: toSeconds(totalMs),
        hasInput: Boolean(input),
        exitCode: run.exitCode ?? 0,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return buildFailure({
      errorType: '平台错误',
      errorSummary: '代码运行服务异常。',
      error: message,
    });
  } finally {
    if (workDir) {
      await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
};
