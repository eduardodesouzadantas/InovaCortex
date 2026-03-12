import "dotenv/config";
import { runEventBus } from "../workers/event-bus-runner";
import { runPublishingDispatcher } from "../workers/publish-dispatcher";
import { dispatchOutreach } from "../workers/outreach-dispatcher";
import { runPlaybookEngine } from "../workers/playbook-runner";
import { runSystemScheduler } from "../workers/system-scheduler";

type ResultRecord = {
  worker: string;
  ok: boolean;
  result?: unknown;
  error?: string;
};

async function safeRun(worker: string, fn: () => Promise<unknown>): Promise<ResultRecord> {
  try {
    const result = await fn();
    return { worker, ok: true, result };
  } catch (error) {
    return {
      worker,
      ok: false,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    };
  }
}

async function main() {
  const rows: ResultRecord[] = [];

  rows.push(await safeRun("event-bus-runner", async () => runEventBus({ limit: 5 })));
  rows.push(await safeRun("publish-dispatcher", async () => runPublishingDispatcher({ limit: 5 })));
  rows.push(await safeRun("outreach-dispatcher", async () => dispatchOutreach()));
  rows.push(await safeRun("playbook-runner", async () => runPlaybookEngine({ limitDeals: 5 })));
  rows.push(
    await safeRun("system-scheduler", async () =>
      runSystemScheduler({
        maxTenants: 1,
        concurrency: 1,
        force: false,
      }),
    ),
  );

  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
