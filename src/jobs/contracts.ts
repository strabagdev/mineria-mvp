export type JobTrigger = "manual" | "scheduled" | "webhook" | "system" | "replay";

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "skipped" | "cancelled";

export type JobRuntime = "next-route" | "script" | "cron" | "worker";

export type JobRetryPolicy = {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
};

export type JobScheduleMetadata = {
  enabled: boolean;
  cron?: string;
  intervalMs?: number;
  timezone?: string;
  description?: string;
};

export type JobContext = {
  jobName: string;
  trigger: JobTrigger;
  runtime: JobRuntime;
  idempotencyKey: string;
  correlationId?: string;
  actorId?: string;
  organizationId?: string;
  siteId?: string;
  startedAt: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
};

export type JobError = {
  code: string;
  message: string;
  retryable: boolean;
};

export type JobSuccess<TOutput = void> = {
  ok: true;
  status: "succeeded" | "skipped";
  output: TOutput;
  completedAt: string;
};

export type JobFailure = {
  ok: false;
  status: "failed";
  error: JobError;
  completedAt: string;
};

export type JobResult<TOutput = void> = JobSuccess<TOutput> | JobFailure;

export type JobDefinition<TInput = void, TOutput = void> = {
  name: string;
  description: string;
  runtime: JobRuntime;
  retryPolicy: JobRetryPolicy;
  schedule?: JobScheduleMetadata;
  run(input: TInput, context: JobContext): Promise<JobResult<TOutput>>;
};

export const DEFAULT_JOB_RETRY_POLICY: JobRetryPolicy = {
  maxAttempts: 3,
  initialDelayMs: 30_000,
  maxDelayMs: 15 * 60_000,
  backoffMultiplier: 2,
};

export function buildJobIdempotencyKey(jobName: string, parts: Array<string | number | boolean | null | undefined>) {
  const normalizedParts = [jobName, ...parts]
    .filter((part): part is string | number | boolean => part !== null && part !== undefined && part !== "")
    .map((part) => String(part).trim().toLowerCase())
    .filter(Boolean);

  return normalizedParts.join(":");
}

export function getJobRetryDelayMs(policy: JobRetryPolicy, attempt: number) {
  const safeAttempt = Math.max(1, attempt);
  const exponentialDelay = policy.initialDelayMs * policy.backoffMultiplier ** (safeAttempt - 1);
  return Math.min(policy.maxDelayMs, Math.round(exponentialDelay));
}

export function shouldRetryJobFailure(result: JobResult, attempt: number, policy: JobRetryPolicy) {
  return !result.ok && result.error.retryable && attempt < policy.maxAttempts;
}

export function createJobSuccess<TOutput>(output: TOutput): JobSuccess<TOutput> {
  return {
    ok: true,
    status: "succeeded",
    output,
    completedAt: new Date().toISOString(),
  };
}

export function createJobSkipped<TOutput>(output: TOutput): JobSuccess<TOutput> {
  return {
    ok: true,
    status: "skipped",
    output,
    completedAt: new Date().toISOString(),
  };
}

export function createJobFailure(error: JobError): JobFailure {
  return {
    ok: false,
    status: "failed",
    error,
    completedAt: new Date().toISOString(),
  };
}
