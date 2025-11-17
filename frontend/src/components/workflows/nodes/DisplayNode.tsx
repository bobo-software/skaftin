import { Eye, FileText, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import useWorkflowStore from '@stores/workflows/useWorkflowStore';
import useDatabaseStore from '@stores/data/useDatabaseStore';
import { DisplayNodeData, DbSelectNodeData } from '../../../types/workflow.types';
import { NodeWrapper, NodeActions } from '@components/ComponentsIndex';
import { useNodeConnection } from '@hooks/useNodeConnection';
import { useNodeOperations } from '@hooks/useNodeOperations';
import type { Column } from '@stores/data/useDatabaseStore';

interface DisplayNodeProps {
	id: string;
	data: DisplayNodeData;
	selected?: boolean;
}

function getValueAtPath(payload: any, path?: string): any {
	if (!payload || !path) return undefined;
	
	// Handle wildcard patterns for looping over arrays (e.g., rows.*.name)
	if (path.includes('.*.')) {
		const parts = path.split('.*.');
		if (parts.length === 2) {
			const arrayPath = parts[0]; // e.g., "rows"
			const fieldPath = parts[1]; // e.g., "name"
			
			// Get the array first
			const arraySegments = arrayPath.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
			let cur: any = payload;
			for (const seg of arraySegments) {
				if (cur == null) return [];
				cur = cur[seg as any];
			}
			
			// If it's an array, map over it and extract the field
			if (Array.isArray(cur)) {
				return cur.map((item: any) => {
					const fieldSegments = fieldPath.split('.').filter(Boolean);
					let fieldValue: any = item;
					for (const seg of fieldSegments) {
						if (fieldValue == null) return undefined;
						fieldValue = fieldValue[seg];
					}
					return fieldValue;
				}).filter((v: any) => v !== undefined);
			}
			return [];
		}
	}
	
	// Regular path extraction
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
	const edges = useWorkflowStore((s) => s.edges);
	const setNodes = useWorkflowStore((s) => s.setNodes);
	const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
	const results = useWorkflowStore((s) => s.nodeResults);
	const getTableSchema = useDatabaseStore((s) => s.getTableSchema);
	const [showConfig, setShowConfig] = useState(false);
	const [showSchemaModal, setShowSchemaModal] = useState(false);
	const [schemaColumns, setSchemaColumns] = useState<Column[]>([]);
	const [schemaLoading, setSchemaLoading] = useState(false);
	const [expandedSections, setExpandedSections] = useState({
		arrayAccess: false,
		columns: false,
		loopOverArray: false,
	});
	const { isConnected } = useNodeConnection(id);
	const { handleDelete } = useNodeOperations(id);

	// Auto-detect source node from connected edges
	useEffect(() => {
		// Find edges where this node is the target
		const incomingEdges = edges.filter((e) => e.target === id);
		if (incomingEdges.length > 0) {
			// Use the first incoming edge's source
			const sourceNodeId = incomingEdges[0].source;
			// Only update if it's different from current value
			if (data.sourceNodeId !== sourceNodeId) {
				updateNodeData<DisplayNodeData>(id, { sourceNodeId });
			}
		} else if (data.sourceNodeId) {
			// Clear sourceNodeId if no incoming edges
			updateNodeData<DisplayNodeData>(id, { sourceNodeId: undefined });
		}
	}, [edges, id, data.sourceNodeId, updateNodeData]);

	const sourceNode = useMemo(() => {
		return nodes.find((n) => n.id === data.sourceNodeId);
	}, [data.sourceNodeId, nodes]);

	const sourceLabel = useMemo(() => {
		return (sourceNode?.data as any)?.label ?? data.sourceNodeId ?? 'None';
	}, [sourceNode, data.sourceNodeId]);

	// Get schema from connected dbSelect node
	useEffect(() => {
		if (!sourceNode || sourceNode.type !== 'dbSelect') {
			setSchemaColumns([]);
			return;
		}

		const sourceData = sourceNode.data as DbSelectNodeData;

		// First, try to use schema stored in the source node (preferred - no API call needed)
		if (sourceData?.schema && sourceData.schema.length > 0) {
			setSchemaColumns(sourceData.schema as Column[]);
			setSchemaLoading(false);
			return;
		}

		// Fallback: fetch schema if not stored in source node
		const tableName = sourceData?.table;
		const projectId = sourceData?.projectId;

		if (!tableName || !projectId) {
			setSchemaColumns([]);
			return;
		}

		setSchemaLoading(true);
		getTableSchema(projectId, tableName)
			.then((columns) => {
				setSchemaColumns(columns);
			})
			.catch((error) => {
				console.error('[DisplayNode] failed to fetch table schema', error);
				setSchemaColumns([]);
			})
			.finally(() => {
				setSchemaLoading(false);
			});
	}, [sourceNode, getTableSchema, id, data.sourceNodeId]);

	// Build type-safe schema-based suggestions from table columns
	// Only schema suggestions are used to ensure type safety
	const schemaSuggestions = useMemo(() => {
		if (schemaColumns.length === 0) return [];

		const suggestions: string[] = [];
		
		// Primary pattern: rows array access (DbSelectNode returns { rows: [...] })
		schemaColumns.forEach((col) => {
			// Access specific column from first row
			suggestions.push(`rows.0.${col.column_name}`); // First row, specific column
			suggestions.push(`rows[0].${col.column_name}`); // Alternative bracket syntax
		});

		// Array structure access
		suggestions.push('rows'); // All rows array
		suggestions.push('rows.0'); // First row object
		suggestions.push('rows[0]'); // First row (bracket syntax)

		// Fallback patterns (in case data structure differs)
		schemaColumns.forEach((col) => {
			suggestions.push(`0.${col.column_name}`); // If payload is directly an array
		});
		suggestions.push('0'); // First item if payload is array

		return Array.from(new Set(suggestions));
	}, [schemaColumns]);

	const sourceResult = data.sourceNodeId ? results[data.sourceNodeId] : undefined;
	const sourcePayload = sourceResult?.payload;
	
	// Enhanced value extraction with array handling
	const value = useMemo(() => {
		if (!sourcePayload || !data.keyPath) return null;
		
		const extracted = getValueAtPath(sourcePayload, data.keyPath);
		
		// If the value is an array, format it nicely for display
		if (Array.isArray(extracted)) {
			return extracted;
		}
		
		return extracted;
	}, [sourcePayload, data.keyPath]);
	
	// Format value for display, handling arrays and objects specially
	const valueString = useMemo(() => {
		if (value == null) return '';
		
		if (Array.isArray(value)) {
			if (value.length === 0) return '[]';
			// Show array preview: [item1, item2, ...] or full array if small
			if (value.length <= 5) {
				return JSON.stringify(value, null, 2);
			}
			return `[${value.slice(0, 3).map(v => JSON.stringify(v)).join(', ')}, ...] (${value.length} items)`;
		}
		
		// Handle objects (including null which is typeof 'object')
		if (typeof value === 'object' && value !== null) {
			return JSON.stringify(value, null, 2);
		}
		
		return String(value);
	}, [value]);

	// Only use schema-based suggestions (type-safe)
	const suggestions = schemaSuggestions;

	return (
		<NodeWrapper
			id={id}
			selected={selected}
			isConnected={isConnected}
			minWidth="200px"
		>
			<NodeActions selected={selected || false} onDelete={handleDelete} />
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
					<div className="text-xs text-dark-500 dark:text-dark-400">Key Path</div>
					<input
						value={data.keyPath ?? ''}
						onChange={(e) => {
							const newKeyPath = e.target.value || undefined;
							updateNodeData<DisplayNodeData>(id, { keyPath: newKeyPath });
						}}
						placeholder="e.g. rows.0.name"
						className="w-full text-sm bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1"
					/>
					{schemaLoading && (
						<div className="text-xs text-dark-500 dark:text-dark-400 mt-1">Loading schema...</div>
					)}
					{!schemaColumns.length && !schemaLoading && (
						<div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
							⚠ Schema not available. Connect to a DbSelect node with a table selected.
						</div>
					)}
					{schemaColumns.length > 0 && (
						<div className="mt-2">
							<button
								onClick={() => setShowSchemaModal(true)}
								className="w-full px-3 py-2 text-sm rounded bg-primary-600 hover:bg-primary-700 text-white flex items-center justify-center space-x-2 transition-colors"
							>
								<FileText className="w-4 h-4" />
								<span>Select from Schema</span>
							</button>
						</div>
					)}
				</div>
			)}

			<div className="flex items-center justify-between mb-1">
				<div className="text-xs text-dark-500 dark:text-dark-400">From: {sourceLabel}</div>
			</div>
			<div className="text-sm font-mono bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1 min-h-[28px] break-all max-h-[500px] overflow-auto">
				{value != null ? (
					Array.isArray(value) ? (
						<div className="space-y-1">
							<div className="text-xs text-dark-500 dark:text-dark-400 mb-1">
								Array ({value.length} {value.length === 1 ? 'item' : 'items'})
							</div>
							{value.slice(0, 10).map((item, idx) => (
								<div key={idx} className="text-xs border-l-2 border-primary-400 pl-2">
									[{idx}]: {typeof item === 'object' ? JSON.stringify(item, null, 2) : String(item)}
								</div>
							))}
							{value.length > 10 && (
								<div className="text-xs text-dark-500 dark:text-dark-400 italic">
									... and {value.length - 10} more items
								</div>
							)}
						</div>
					) : (
						valueString
					)
				) : (
					<span className="opacity-60">Empty</span>
				)}
			</div>

			{/* Schema Selection Modal */}
			{showSchemaModal && (
				<div className="absolute inset-0 z-40 flex items-center justify-center">
					<div className="absolute inset-0 bg-black/30 rounded-lg" onClick={() => setShowSchemaModal(false)} />
					<div className="relative z-50 bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-lg shadow-xl w-[500px] max-w-[90vw] max-h-[80vh] flex flex-col">
						<div className="px-4 py-3 border-b border-dark-200 dark:border-dark-700 flex items-center justify-between">
							<div className="flex items-center space-x-2">
								<FileText className="w-4 h-4 text-primary-600 dark:text-primary-400" />
								<div className="text-sm font-semibold text-dark-900 dark:text-white">
									Select Column Path
								</div>
							</div>
							<button
								onClick={() => setShowSchemaModal(false)}
								className="p-1 rounded hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
								title="Close"
							>
								<X className="w-4 h-4 text-dark-600 dark:text-dark-400" />
							</button>
						</div>
						<div className="flex-1 overflow-auto p-4">
							{schemaColumns.length === 0 ? (
								<div className="text-center py-8">
									<div className="text-sm text-dark-500 dark:text-dark-400">No schema available</div>
								</div>
							) : (
								<div className="space-y-3">
									{/* Array Access Options */}
									<div className="border border-dark-200 dark:border-dark-700 rounded-lg overflow-hidden">
										<button
											onClick={() =>
												setExpandedSections((prev) => ({
													...prev,
													arrayAccess: !prev.arrayAccess,
												}))
											}
											className="w-full flex items-center justify-between px-3 py-2 bg-dark-50 dark:bg-dark-900 hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
										>
											<div className="text-xs font-semibold text-dark-700 dark:text-dark-300">
												Array Access
											</div>
											{expandedSections.arrayAccess ? (
												<ChevronUp className="w-4 h-4 text-dark-500 dark:text-dark-400" />
											) : (
												<ChevronDown className="w-4 h-4 text-dark-500 dark:text-dark-400" />
											)}
										</button>
										{expandedSections.arrayAccess && (
											<div className="p-2 space-y-1">
												<button
													onClick={() => {
														updateNodeData<DisplayNodeData>(id, { keyPath: 'rows' });
														setShowSchemaModal(false);
													}}
													className="w-full text-left px-3 py-2 text-sm rounded bg-white dark:bg-dark-800 hover:bg-dark-50 dark:hover:bg-dark-700 border border-dark-200 dark:border-dark-700 transition-colors"
												>
													<div className="font-mono text-primary-600 dark:text-primary-400">rows</div>
													<div className="text-xs text-dark-500 dark:text-dark-400 mt-0.5">All rows array</div>
												</button>
												<button
													onClick={() => {
														updateNodeData<DisplayNodeData>(id, { keyPath: 'rows.0' });
														setShowSchemaModal(false);
													}}
													className="w-full text-left px-3 py-2 text-sm rounded bg-white dark:bg-dark-800 hover:bg-dark-50 dark:hover:bg-dark-700 border border-dark-200 dark:border-dark-700 transition-colors"
												>
													<div className="font-mono text-primary-600 dark:text-primary-400">rows.0</div>
													<div className="text-xs text-dark-500 dark:text-dark-400 mt-0.5">First row object</div>
												</button>
											</div>
										)}
									</div>

									{/* Column Options */}
									<div className="border border-dark-200 dark:border-dark-700 rounded-lg overflow-hidden">
										<button
											onClick={() =>
												setExpandedSections((prev) => ({
													...prev,
													columns: !prev.columns,
												}))
											}
											className="w-full flex items-center justify-between px-3 py-2 bg-dark-50 dark:bg-dark-900 hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
										>
											<div className="text-xs font-semibold text-dark-700 dark:text-dark-300">
												Columns (First Row) <span className="text-dark-500 dark:text-dark-400 font-normal">({schemaColumns.length})</span>
											</div>
											{expandedSections.columns ? (
												<ChevronUp className="w-4 h-4 text-dark-500 dark:text-dark-400" />
											) : (
												<ChevronDown className="w-4 h-4 text-dark-500 dark:text-dark-400" />
											)}
										</button>
										{expandedSections.columns && (
											<div className="p-2 space-y-1 max-h-[300px] overflow-y-auto">
												{schemaColumns.map((col) => (
													<button
														key={col.column_name}
														onClick={() => {
															updateNodeData<DisplayNodeData>(id, { keyPath: `rows.0.${col.column_name}` });
															setShowSchemaModal(false);
														}}
														className="w-full text-left px-3 py-2 text-sm rounded bg-white dark:bg-dark-800 hover:bg-dark-50 dark:hover:bg-dark-700 border border-dark-200 dark:border-dark-700 transition-colors"
													>
														<div className="flex items-center justify-between">
															<div className="font-mono text-primary-600 dark:text-primary-400">
																rows.0.{col.column_name}
															</div>
															<div className="text-xs text-dark-500 dark:text-dark-400">
																{col.data_type}
																{col.character_maximum_length && `(${col.character_maximum_length})`}
															</div>
														</div>
														<div className="text-xs text-dark-500 dark:text-dark-400 mt-0.5">
															{col.column_name} • {col.is_nullable ? 'Nullable' : 'Not Null'}
														</div>
													</button>
												))}
											</div>
										)}
									</div>

									{/* Loop Over Array Options */}
									<div className="border border-dark-200 dark:border-dark-700 rounded-lg overflow-hidden">
										<button
											onClick={() =>
												setExpandedSections((prev) => ({
													...prev,
													loopOverArray: !prev.loopOverArray,
												}))
											}
											className="w-full flex items-center justify-between px-3 py-2 bg-dark-50 dark:bg-dark-900 hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
										>
											<div className="text-xs font-semibold text-dark-700 dark:text-dark-300">
												Loop Over Array <span className="text-dark-500 dark:text-dark-400 font-normal">({schemaColumns.length})</span>
											</div>
											{expandedSections.loopOverArray ? (
												<ChevronUp className="w-4 h-4 text-dark-500 dark:text-dark-400" />
											) : (
												<ChevronDown className="w-4 h-4 text-dark-500 dark:text-dark-400" />
											)}
										</button>
										{expandedSections.loopOverArray && (
											<div className="p-2 space-y-1 max-h-[300px] overflow-y-auto">
												{schemaColumns.map((col) => (
													<button
														key={col.column_name}
														onClick={() => {
															updateNodeData<DisplayNodeData>(id, { keyPath: `rows.*.${col.column_name}` });
															setShowSchemaModal(false);
														}}
														className="w-full text-left px-3 py-2 text-sm rounded bg-white dark:bg-dark-800 hover:bg-dark-50 dark:hover:bg-dark-700 border border-dark-200 dark:border-dark-700 transition-colors"
													>
														<div className="flex items-center justify-between">
															<div className="font-mono text-primary-600 dark:text-primary-400">
																rows.*.{col.column_name}
															</div>
															<div className="text-xs text-dark-500 dark:text-dark-400">
																{col.data_type}
																{col.character_maximum_length && `(${col.character_maximum_length})`}
															</div>
														</div>
														<div className="text-xs text-dark-500 dark:text-dark-400 mt-0.5">
															All {col.column_name} values from array • {col.is_nullable ? 'Nullable' : 'Not Null'}
														</div>
													</button>
												))}
											</div>
										)}
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</NodeWrapper>
	);
};

export default DisplayNode;


