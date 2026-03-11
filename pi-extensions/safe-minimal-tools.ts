import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createEditTool, createReadTool, createWriteTool } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";

const toolCache = new Map<
	string,
	{
		read: ReturnType<typeof createReadTool>;
		edit: ReturnType<typeof createEditTool>;
		write: ReturnType<typeof createWriteTool>;
	}
>();

function getTools(cwd: string) {
	let tools = toolCache.get(cwd);
	if (!tools) {
		tools = {
			read: createReadTool(cwd),
			edit: createEditTool(cwd),
			write: createWriteTool(cwd),
		};
		toolCache.set(cwd, tools);
	}
	return tools;
}

function minimalResult(result: { content: Array<{ type: string; text?: string }> }, expanded: boolean, theme: any) {
	if (!expanded) return new Text("", 0, 0);
	const text = result.content.find((c) => c.type === "text")?.text ?? "";
	if (!text) return new Text("", 0, 0);
	return new Text(`\n${theme.fg("toolOutput", text)}`, 0, 0);
}

export default function safeMinimalTools(pi: ExtensionAPI): void {
	const dangerousPatterns = [
		/\brm\s+(-rf?|--recursive)/i,
		/\bsudo\b/i,
		/\b(chmod|chown)\b.*777/i,
	];
	const protectedPaths = [".env", ".git/", "node_modules/"];

	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName === "bash") {
			const command = String(event.input.command ?? "");
			if (dangerousPatterns.some((p) => p.test(command))) {
				if (!ctx.hasUI) return { block: true, reason: "Dangerous bash command blocked (no UI confirmation)" };
				const choice = await ctx.ui.select(`⚠️ Potentially dangerous command:\n\n${command}\n\nAllow?`, ["Yes", "No"]);
				if (choice !== "Yes") return { block: true, reason: "Blocked by user" };
			}
		}

		if (event.toolName === "write" || event.toolName === "edit") {
			const path = String(event.input.path ?? "");
			if (protectedPaths.some((p) => path.includes(p))) {
				if (ctx.hasUI) ctx.ui.notify(`Blocked write/edit to protected path: ${path}`, "warning");
				return { block: true, reason: `Path \"${path}\" is protected` };
			}
		}

		return undefined;
	});

	pi.registerTool({
		name: "read",
		label: "read",
		description: getTools(process.cwd()).read.description,
		parameters: getTools(process.cwd()).read.parameters,
		async execute(toolCallId, params, signal, onUpdate, ctx) {
			return getTools(ctx.cwd).read.execute(toolCallId, params, signal, onUpdate);
		},
		renderResult(result, { expanded }, theme) {
			return minimalResult(result as any, expanded, theme);
		},
	});

	pi.registerTool({
		name: "edit",
		label: "edit",
		description: getTools(process.cwd()).edit.description,
		parameters: getTools(process.cwd()).edit.parameters,
		async execute(toolCallId, params, signal, onUpdate, ctx) {
			return getTools(ctx.cwd).edit.execute(toolCallId, params, signal, onUpdate);
		},
		renderResult(result, { expanded }, theme) {
			return minimalResult(result as any, expanded, theme);
		},
	});

	pi.registerTool({
		name: "write",
		label: "write",
		description: getTools(process.cwd()).write.description,
		parameters: getTools(process.cwd()).write.parameters,
		async execute(toolCallId, params, signal, onUpdate, ctx) {
			return getTools(ctx.cwd).write.execute(toolCallId, params, signal, onUpdate);
		},
		renderResult(result, { expanded }, theme) {
			return minimalResult(result as any, expanded, theme);
		},
	});
}
