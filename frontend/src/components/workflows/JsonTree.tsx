import { useState } from 'react';

type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

interface JsonTreeProps {
	value: JsonValue;
	label?: string;
	level?: number;
	defaultCollapsed?: boolean;
}

const INDENT = '  ';

const isObject = (v: unknown): v is JsonObject =>
	typeof v === 'object' && v !== null && !Array.isArray(v);

const JsonLeaf = ({ value }: { value: Exclude<JsonValue, JsonObject | JsonArray> }) => {
	const type = typeof value;
	let cls = 'text-dark-800 dark:text-dark-100';
	if (type === 'string') cls = 'text-emerald-700 dark:text-emerald-300';
	if (type === 'number') cls = 'text-blue-700 dark:text-blue-300';
	if (type === 'boolean') cls = 'text-purple-700 dark:text-purple-300';
	if (value === null) cls = 'text-gray-500';
	return <span className={cls}>{JSON.stringify(value)}</span>;
};

const JsonNode = ({ value, label, level = 0, defaultCollapsed }: JsonTreeProps) => {
	const [open, setOpen] = useState(!defaultCollapsed);

	if (Array.isArray(value)) {
		return (
			<div>
				<div className="cursor-pointer select-none" onClick={() => setOpen(!open)}>
					<span className="mr-1 text-dark-500 dark:text-dark-400">{open ? '▾' : '▸'}</span>
					{label && <span className="text-dark-900 dark:text-white mr-1">{label}:</span>}
					<span className="text-gray-600">[{value.length}]</span>
				</div>
				{open && (
					<div className="pl-4">
						{value.map((child, idx) => (
							<div key={idx}>
								<JsonNode value={child} level={level + 1} defaultCollapsed={defaultCollapsed} />
							</div>
						))}
					</div>
				)}
			</div>
		);
	}

	if (isObject(value)) {
		const keys = Object.keys(value);
		return (
			<div>
				<div className="cursor-pointer select-none" onClick={() => setOpen(!open)}>
					<span className="mr-1 text-dark-500 dark:text-dark-400">{open ? '▾' : '▸'}</span>
					{label && <span className="text-dark-900 dark:text-white">{label}: </span>}
					<span className="text-gray-600">{'{'}{keys.length} keys{'}'}</span>
				</div>
				{open && (
					<div className="pl-4">
						{keys.map((k) => (
							<div key={k}>
								<JsonNode value={(value as JsonObject)[k]} label={k} level={level + 1} defaultCollapsed={defaultCollapsed} />
							</div>
						))}
					</div>
				)}
			</div>
		);
	}

	return (
		<div>
			{label && <span className="text-dark-900 dark:text-white mr-1">{label}: </span>}
			<JsonLeaf value={value} />
		</div>
	);
};

const JsonTree = ({ value, defaultCollapsed = false }: { value: JsonValue; defaultCollapsed?: boolean }) => {
	return (
		<div className="text-xs leading-relaxed">
			<JsonNode value={value} defaultCollapsed={defaultCollapsed} />
		</div>
	);
};

export default JsonTree;


