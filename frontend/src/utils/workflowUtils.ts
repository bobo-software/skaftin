import { Node } from 'reactflow';

export type WorkflowNodeType = 'start' | 'httpRequest' | 'dbSelect';
// include display
export type ExtendedWorkflowNodeType = WorkflowNodeType | 'display';

export function buildNodeId(prefix: string, idNum: number) {
	return `${prefix}-${idNum}`;
}

export function createNode(
	type: ExtendedWorkflowNodeType,
	idNum: number,
	position?: { x: number; y: number },
	extraData?: Record<string, any>
): Node {
	const idPrefix = type === 'start' ? 'start' : type === 'httpRequest' ? 'http' : 'db';
	const resolvedPrefix = type === 'display' ? 'display' : idPrefix;
	const base = {
		id: buildNodeId(resolvedPrefix, idNum),
		type,
		position:
			position ??
			{
				x: Math.random() * 400 + 100,
				y: Math.random() * 400 + 100,
			},
	};

	if (type === 'start') {
		return {
			...base,
			data: {
				label: 'Start',
				inputs: [{ id: `input-${idNum}`, name: 'Input 1', value: '' }],
				...extraData,
			},
		};
	}

	if (type === 'httpRequest') {
		return {
			...base,
			data: {
				label: 'HTTP Request',
				method: 'POST',
				url: 'http://localhost:8001/api/auth/login',
				applicationContext: 'Mi App',
				headers: {},
				body: '',
				...extraData,
			},
		};
	}

	// dbSelect
	if (type === 'dbSelect') {
		return {
			...base,
			data: {
				label: 'Select from Table',
				projectId: extraData?.projectId,
				table: undefined,
				limit: 10,
				...extraData,
			},
		};
	}

	// display
	return {
		...base,
		data: {
			label: 'Display',
			sourceNodeId: undefined,
			keyPath: '',
			...extraData,
		},
	};
}


