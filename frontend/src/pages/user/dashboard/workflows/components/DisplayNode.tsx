import { Handle, Position } from 'reactflow';
import { Eye } from 'lucide-react';
import { useMemo, useState } from 'react';
import useWorkflowStore from '../../../../../stores/workflows/useWorkflowStore';
import { DisplayNodeData } from '../types/workflow.types';

interface DisplayNodeProps {
	id: string;
	data: DisplayNodeData;
	selected?: boolean;
}

function getValueAtPath(payload: any, path?: string): any {
	if (!payload || !path) return undefined;
	const segments = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
	let cur: any = payload;
	for (const seg of segments) {
		if (cur == null) return undefined;
		cur = cur[seg as any];
	}
	return cur;
}

function buildKeyPathSuggestions(payload: any, maxDepth = 3, maxArray = 5): string[] {
	const results: string[] = [];
	function walk(node: any, prefix: string, depth: number) {
		if (depth > maxDepth) return;
		if (node === null || node === undefined) return;
		if (Array.isArray(node)) {
			const count = Math.min(node.length, maxArray);
			for (let i = 0; i < count; i++) {
				const p = prefix ? `${prefix}.${i}` : String(i);
				results.push(p);
				walk(node[i], p, depth + 1);
			}
			return;
		}
		if (typeof node === 'object') {
			for (const key of Object.keys(node)) {
				const p = prefix ? `${prefix}.${key}` : key;
				results.push(p);
				walk(node[key], p, depth + 1);
			}
			return;
		}
		// primitives
		if (prefix && !results.includes(prefix)) results.push(prefix);
	}
	walk(payload, '', 0);
	// de-duplicate while preserving order
	return Array.from(new Set(results));
}

const DisplayNode = ({ id, data, selected }: DisplayNodeProps) => {
	const nodes = useWorkflowStore((s) => s.nodes);
	const results = useWorkflowStore((s) => s.nodeResults);
	const [showConfig, setShowConfig] = useState(false);

	const availableSources = useMemo(() => Object.keys(results), [results]);
	const sourceLabel = useMemo(() => {
		const n = nodes.find((n) => n.id === data.sourceNodeId);
		return (n?.data as any)?.label ?? data.sourceNodeId ?? 'None';
	}, [data.sourceNodeId, nodes]);

	const value = getValueAtPath(data.sourceNodeId ? results[data.sourceNodeId]?.payload : undefined, data.keyPath);
	const valueString = value == null ? '' : String(value);
	const sourcePayload = data.sourceNodeId ? results[data.sourceNodeId]?.payload : undefined;
	const suggestions = useMemo(
		() => (sourcePayload ? buildKeyPathSuggestions(sourcePayload, 3, 5) : []),
		[sourcePayload]
	);

	return (
		<div
			className={`relative px-4 py-3 shadow-lg rounded-lg border-2 min-w-[260px] bg-white dark:bg-dark-800 ${
				selected ? 'border-primary-500 dark:border-primary-400' : 'border-dark-200 dark:border-dark-700'
			}`}
		>
			<div className="flex items-center space-x-2 mb-2">
				<Eye className="w-4 h-4 text-primary-600 dark:text-primary-400" />
				<div className="font-semibold text-sm text-dark-900 dark:text-white flex-1 truncate">
					{data.label || 'Display'}
				</div>
				<button
					onClick={() => setShowConfig((v) => !v)}
					className="text-xs px-2 py-0.5 rounded bg-dark-100 dark:bg-dark-700 hover:bg-dark-200 dark:hover:bg-dark-600 text-dark-900 dark:text-white"
				>
					{showConfig ? 'Close' : 'Configure'}
				</button>
			</div>

			{showConfig && (
				<div className="mb-2 space-y-2">
					<div className="text-xs text-dark-500 dark:text-dark-400">Source Node</div>
					<select
						value={data.sourceNodeId ?? ''}
						onChange={(e) => ((data as any).sourceNodeId = e.target.value || undefined)}
						className="w-full text-sm bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1"
					>
						<option value="">Select source</option>
						{availableSources.map((nid) => (
							<option key={nid} value={nid}>
								{(nodes.find((n) => n.id === nid)?.data as any)?.label ?? nid}
							</option>
						))}
					</select>

					<div className="text-xs text-dark-500 dark:text-dark-400">Key Path</div>
					<input
						value={data.keyPath ?? ''}
						onChange={(e) => ((data as any).keyPath = e.target.value || undefined)}
						placeholder="e.g. rows.0.name"
						className="w-full text-sm bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1"
					/>
					{suggestions.length > 0 && (
						<div>
							<div className="text-xs text-dark-500 dark:text-dark-400 mt-1 mb-1">Suggestions</div>
							<select
								value=""
								onChange={(e) => {
									const v = e.target.value;
									if (v) (data as any).keyPath = v;
								}}
								className="w-full text-sm bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1"
							>
								<option value="">Pick key path…</option>
								{suggestions.slice(0, 200).map((p) => (
									<option key={p} value={p}>
										{p}
									</option>
								))}
							</select>
						</div>
					)}
				</div>
			)}

			<div className="text-xs text-dark-500 dark:text-dark-400 mb-1">From: {sourceLabel}</div>
			<div className="text-sm font-mono bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1 min-h-[28px] break-all">
				{valueString || <span className="opacity-60">Empty</span>}
			</div>

			<Handle type="target" position={Position.Left} className="w-3 h-3 bg-primary-500 dark:bg-primary-400" />
		</div>
	);
};

export default DisplayNode;


