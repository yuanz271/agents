import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import * as os from "node:os";
import { spawn } from "node:child_process";

interface CpuSnapshot {
	idle: number;
	total: number;
}

function takeCpuSnapshot(): CpuSnapshot {
	const cpus = os.cpus();
	let idle = 0;
	let total = 0;
	for (const cpu of cpus) {
		idle += cpu.times.idle;
		total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq + cpu.times.idle;
	}
	return { idle, total };
}

function cpuUsagePercent(prev: CpuSnapshot, next: CpuSnapshot): number {
	const idleDelta = next.idle - prev.idle;
	const totalDelta = next.total - prev.total;
	if (totalDelta <= 0) return 0;
	return Math.max(0, Math.min(100, (1 - idleDelta / totalDelta) * 100));
}

async function queryNvidiaGpuUsage(timeoutMs = 1200): Promise<number | null> {
	return await new Promise<number | null>((resolve) => {
		const child = spawn("nvidia-smi", ["--query-gpu=utilization.gpu", "--format=csv,noheader,nounits"], {
			stdio: ["ignore", "pipe", "ignore"],
		});

		const chunks: Buffer[] = [];
		const timer = setTimeout(() => {
			child.kill();
			resolve(null);
		}, timeoutMs);

		child.stdout.on("data", (data: Buffer) => chunks.push(data));
		child.on("error", () => {
			clearTimeout(timer);
			resolve(null);
		});
		child.on("close", (code) => {
			clearTimeout(timer);
			if (code !== 0) return resolve(null);
			const output = Buffer.concat(chunks).toString("utf-8");
			const values = output
				.split(/\r?\n/)
				.map((line) => Number(line.trim()))
				.filter((n) => Number.isFinite(n)) as number[];
			if (values.length === 0) return resolve(null);
			// Multi-GPU hosts: show the busiest GPU so activity is visible.
			resolve(Math.max(...values.map((v) => Math.max(0, Math.min(100, v)))));
		});
	});
}

export default function systemUsageExtension(pi: ExtensionAPI): void {
	let timer: NodeJS.Timeout | null = null;
	let prevCpu = takeCpuSnapshot();
	let lastCtx: ExtensionContext | null = null;
	let inFlight = false;
	let gpuEma: number | null = null;
	let tick = 0;

	function stop(): void {
		if (timer) {
			clearInterval(timer);
			timer = null;
		}
	}

	async function render(ctx: ExtensionContext): Promise<void> {
		if (inFlight) return;
		inFlight = true;
		try {
			const nextCpu = takeCpuSnapshot();
			const cpu = cpuUsagePercent(prevCpu, nextCpu);
			prevCpu = nextCpu;

			tick++;
			// GPU polling is heavier; sample every other cycle.
			if (tick % 2 === 1 || gpuEma === null) {
				const gpuRaw = await queryNvidiaGpuUsage();
				if (gpuRaw !== null) {
					gpuEma = gpuEma === null ? gpuRaw : gpuEma * 0.6 + gpuRaw * 0.4;
				}
			}

			const theme = ctx.ui.theme;
			const cpuText = theme.fg("accent", `CPU ${cpu.toFixed(0)}%`);
			const gpuText =
				gpuEma === null ? theme.fg("dim", "GPU n/a") : theme.fg("accent", `GPU ${gpuEma.toFixed(0)}%`);
			ctx.ui.setStatus("system-usage", `${theme.fg("dim", "SYS:")} ${cpuText} ${gpuText}`);
		} finally {
			inFlight = false;
		}
	}

	function startPolling(ctx: ExtensionContext): void {
		stop();
		prevCpu = takeCpuSnapshot();
		gpuEma = null;
		tick = 0;
		lastCtx = ctx;
		if (!ctx.hasUI) return;
		void render(ctx);
		timer = setInterval(() => {
			if (!lastCtx?.hasUI) return;
			void render(lastCtx);
		}, 6000);
	}

	pi.on("session_start", async (_event, ctx) => {
		startPolling(ctx);
	});

	pi.on("session_switch", async (_event, ctx) => {
		startPolling(ctx);
	});

	pi.on("session_shutdown", async () => {
		stop();
		lastCtx?.ui.setStatus("system-usage", undefined);
		lastCtx = null;
	});
}
