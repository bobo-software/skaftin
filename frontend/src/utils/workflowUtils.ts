import { Node } from 'reactflow';

export type WorkflowNodeType = 'start' | 'httpRequest' | 'dbSelect';
// include display and new node types
export type ExtendedWorkflowNodeType = 
  | WorkflowNodeType 
  | 'display' 
  | 'condition' 
  | 'forLoop' 
  | 'dbInsert' 
  | 'dbDelete' 
  | 'dbUpdate'
  | 'email'
  | 'sms';

export function buildNodeId(prefix: string, idNum: number) {
	return `${prefix}-${idNum}`;
}

export function createNode(
	type: ExtendedWorkflowNodeType,
	idNum: number,
	position?: { x: number; y: number },
	extraData?: Record<string, any>
): Node {
	const idPrefix = 
		type === 'start' ? 'start' 
		: type === 'httpRequest' ? 'http' 
		: type === 'dbSelect' ? 'db' 
		: type === 'display' ? 'display'
		: type === 'condition' ? 'condition'
		: type === 'forLoop' ? 'forLoop'
		: type === 'dbInsert' ? 'dbInsert'
		: type === 'dbDelete' ? 'dbDelete'
		: type === 'dbUpdate' ? 'dbUpdate'
		: type === 'email' ? 'email'
		: 'node';
	const resolvedPrefix = idPrefix;
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
	if (type === 'display') {
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

	// condition
	if (type === 'condition') {
		return {
			...base,
			data: {
				label: 'Condition',
				condition: '',
				...extraData,
			},
		};
	}

	// forLoop
	if (type === 'forLoop') {
		return {
			...base,
			data: {
				label: 'For Loop',
				sourceNodeId: undefined,
				arrayPath: 'rows',
				itemVariableName: 'item',
				...extraData,
			},
		};
	}

	// dbInsert
	if (type === 'dbInsert') {
		return {
			...base,
			data: {
				label: 'Insert Data',
				projectId: extraData?.projectId,
				table: undefined,
				fieldMappings: [],
				...extraData,
			},
		};
	}

	// dbDelete
	if (type === 'dbDelete') {
		return {
			...base,
			data: {
				label: 'Delete Data',
				projectId: extraData?.projectId,
				table: undefined,
				where: [],
				...extraData,
			},
		};
	}

	// dbUpdate
	if (type === 'dbUpdate') {
		return {
			...base,
			data: {
				label: 'Update Data',
				projectId: extraData?.projectId,
				table: undefined,
				updates: [],
				where: [],
				...extraData,
			},
		};
	}

	// email
	if (type === 'email') {
		return {
			...base,
			data: {
				label: 'Send Email',
				projectId: extraData?.projectId,
				templateId: undefined,
				templateName: undefined,
				recipientEmail: undefined,
				providerId: undefined,
				variableMappings: undefined,
				...extraData,
			},
		};
	}

	// sms
	return {
		...base,
		data: {
			label: 'Send SMS',
			projectId: extraData?.projectId,
			templateId: undefined,
			templateName: undefined,
			recipientPhone: undefined,
			providerId: undefined,
			variableMappings: undefined,
			...extraData,
		},
	};
}


