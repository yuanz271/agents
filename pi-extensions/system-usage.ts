import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import * as os from "node:os";
import { spawnSync } from "node:child_process";

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

function queryNvidiaGpuUsage(): number | null {
	const result = spawnSync(
		"nvidia-smi",
		["--query-gpu=utilization.gpu", "--format=csv,noheader,nounits"],
		{ encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"], timeout: 1200 },
	);
	if (result.status !== 0 || !result.stdout) return null;
	const line = result.stdout.split(/\r?\n/).find((x) => x.trim().length > 0);
	if (!line) return null;
	const value = Number(line.trim());
	if (!Number.isFinite(value)) return null;
	return Math.max(0, Math.min(100, value));
}

export default function systemUsageExtension(pi: ExtensionAPI): void {
	let timer: NodeJS.Timeout | null = null;
	let prevCpu = takeCpuSnapshot();
	let lastCtx: ExtensionContext | null = null;

	function stop(): void {
		if (timer) {
			clearInterval(timer);
			timer = null;
		}
	}

	function render(ctx: ExtensionContext): void {
		const nextCpu = takeCpuSnapshot();
		const cpu = cpuUsagePercent(prevCpu, nextCpu);
		prevCpu = nextCpu;
		const gpu = queryNvidiaGpuUsage();

		const theme = ctx.ui.theme;
		const cpuText = theme.fg("accent", `CPU ${cpu.toFixed(0)}%`);
		const gpuText = gpu === null ? theme.fg("dim", "GPU n/a") : theme.fg("accent", `GPU ${gpu.toFixed(0)}%`);
		ctx.ui.setStatus("system-usage", `${theme.fg("dim", "SYS:")} ${cpuText} ${gpuText}`);
	}

	function start(ctx: ExtensionContext): void {
		stop();
		prevCpu = takeCpuSnapshot();
		lastCtx = ctx;
		if (!ctx.hasUI) return;
		render(ctx);
		timer = setInterval(() => {
			if (!lastCtx?.hasUI) return;
			render(lastCtx);
		}, 3000);
	}

	pi.on("session_start", async (_event, ctx) => {
		start(ctx);
	});

	pi.on("session_switch", async (_event, ctx) => {
		start(ctx);
	});

	pi.on("session_shutdown", async () => {
		stop();
		lastCtx?.ui.setStatus("system-usage", undefined);
		lastCtx = null;
	});
}
