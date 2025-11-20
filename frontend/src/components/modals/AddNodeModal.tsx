import { Database, Globe2, PlaySquare, Eye, GitBranch, Repeat, Plus, Trash2, Edit, Mail, MessageSquare } from 'lucide-react';

interface AddNodeModalProps {
	onClose: () => void;
	onAdd: (type: 'start' | 'http' | 'db' | 'display' | 'condition' | 'forLoop' | 'dbInsert' | 'dbDelete' | 'dbUpdate' | 'email' | 'sms') => void;
}

const AddNodeModal = ({ onClose, onAdd }: AddNodeModalProps) => {
	return (
		<div className="absolute inset-0 z-30 flex items-start justify-center pt-24">
			<div className="absolute inset-0 bg-black/30" onClick={onClose} />
			<div className="relative z-40 bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-lg shadow-xl w-[420px]">
				<div className="px-4 py-2 border-b border-dark-200 dark:border-dark-700 flex items-center justify-between">
					<div className="text-sm font-semibold text-dark-900 dark:text-white">Add Node</div>
					<button
						onClick={onClose}
						className="text-xs px-2 py-1 rounded bg-dark-100 dark:bg-dark-700 hover:bg-dark-200 dark:hover:bg-dark-600 text-dark-900 dark:text-white"
					>
						Close
					</button>
				</div>
				<div className="p-3 grid grid-cols-1 gap-2">
					<button
						onClick={() => onAdd('start')}
						className="flex items-center space-x-3 p-3 rounded border border-dark-200 dark:border-dark-700 hover:bg-dark-50 dark:hover:bg-dark-900 text-left"
					>
						<PlaySquare className="w-4 h-4 text-primary-600 dark:text-primary-400" />
						<div>
							<div className="text-sm font-medium text-dark-900 dark:text-white">Start</div>
							<div className="text-xs text-dark-500 dark:text-dark-400">Entry point for a workflow</div>
						</div>
					</button>
					<button
						onClick={() => onAdd('http')}
						className="flex items-center space-x-3 p-3 rounded border border-dark-200 dark:border-dark-700 hover:bg-dark-50 dark:hover:bg-dark-900 text-left"
					>
						<Globe2 className="w-4 h-4 text-primary-600 dark:text-primary-400" />
						<div>
							<div className="text-sm font-medium text-dark-900 dark:text-white">HTTP Request</div>
							<div className="text-xs text-dark-500 dark:text-dark-400">Call an API endpoint</div>
						</div>
					</button>
					<button
						onClick={() => onAdd('db')}
						className="flex items-center space-x-3 p-3 rounded border border-dark-200 dark:border-dark-700 hover:bg-dark-50 dark:hover:bg-dark-900 text-left"
					>
						<Database className="w-4 h-4 text-primary-600 dark:text-primary-400" />
						<div>
							<div className="text-sm font-medium text-dark-900 dark:text-white">Data Select</div>
							<div className="text-xs text-dark-500 dark:text-dark-400">Select data from a table</div>
						</div>
					</button>
				<button
					onClick={() => onAdd('display')}
					className="flex items-center space-x-3 p-3 rounded border border-dark-200 dark:border-dark-700 hover:bg-dark-50 dark:hover:bg-dark-900 text-left"
				>
					<Eye className="w-4 h-4 text-primary-600 dark:text-primary-400" />
					<div>
						<div className="text-sm font-medium text-dark-900 dark:text-white">Display</div>
						<div className="text-xs text-dark-500 dark:text-dark-400">Show a field from previous result</div>
					</div>
				</button>
				<button
					onClick={() => onAdd('condition')}
					className="flex items-center space-x-3 p-3 rounded border border-dark-200 dark:border-dark-700 hover:bg-dark-50 dark:hover:bg-dark-900 text-left"
				>
					<GitBranch className="w-4 h-4 text-primary-600 dark:text-primary-400" />
					<div>
						<div className="text-sm font-medium text-dark-900 dark:text-white">Condition</div>
						<div className="text-xs text-dark-500 dark:text-dark-400">Branch based on condition</div>
					</div>
				</button>
				<button
					onClick={() => onAdd('forLoop')}
					className="flex items-center space-x-3 p-3 rounded border border-dark-200 dark:border-dark-700 hover:bg-dark-50 dark:hover:bg-dark-900 text-left"
				>
					<Repeat className="w-4 h-4 text-primary-600 dark:text-primary-400" />
					<div>
						<div className="text-sm font-medium text-dark-900 dark:text-white">For Loop</div>
						<div className="text-xs text-dark-500 dark:text-dark-400">Iterate over an array</div>
					</div>
				</button>
				<button
					onClick={() => onAdd('dbInsert')}
					className="flex items-center space-x-3 p-3 rounded border border-dark-200 dark:border-dark-700 hover:bg-dark-50 dark:hover:bg-dark-900 text-left"
				>
					<Plus className="w-4 h-4 text-green-600 dark:text-green-400" />
					<div>
						<div className="text-sm font-medium text-dark-900 dark:text-white">Insert Data</div>
						<div className="text-xs text-dark-500 dark:text-dark-400">Insert data into a table</div>
					</div>
				</button>
				<button
					onClick={() => onAdd('dbDelete')}
					className="flex items-center space-x-3 p-3 rounded border border-dark-200 dark:border-dark-700 hover:bg-dark-50 dark:hover:bg-dark-900 text-left"
				>
					<Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
					<div>
						<div className="text-sm font-medium text-dark-900 dark:text-white">Delete Data</div>
						<div className="text-xs text-dark-500 dark:text-dark-400">Delete data from a table</div>
					</div>
				</button>
				<button
					onClick={() => onAdd('dbUpdate')}
					className="flex items-center space-x-3 p-3 rounded border border-dark-200 dark:border-dark-700 hover:bg-dark-50 dark:hover:bg-dark-900 text-left"
				>
					<Edit className="w-4 h-4 text-primary-600 dark:text-primary-400" />
					<div>
						<div className="text-sm font-medium text-dark-900 dark:text-white">Update Data</div>
						<div className="text-xs text-dark-500 dark:text-dark-400">Update data in a table</div>
					</div>
				</button>
				<button
					onClick={() => onAdd('email')}
					className="flex items-center space-x-3 p-3 rounded border border-dark-200 dark:border-dark-700 hover:bg-dark-50 dark:hover:bg-dark-900 text-left"
				>
					<Mail className="w-4 h-4 text-primary-600 dark:text-primary-400" />
					<div>
						<div className="text-sm font-medium text-dark-900 dark:text-white">Send Email</div>
						<div className="text-xs text-dark-500 dark:text-dark-400">Send email using template</div>
					</div>
				</button>
				<button
					onClick={() => onAdd('sms')}
					className="flex items-center space-x-3 p-3 rounded border border-dark-200 dark:border-dark-700 hover:bg-dark-50 dark:hover:bg-dark-900 text-left"
				>
					<MessageSquare className="w-4 h-4 text-primary-600 dark:text-primary-400" />
					<div>
						<div className="text-sm font-medium text-dark-900 dark:text-white">Send SMS</div>
						<div className="text-xs text-dark-500 dark:text-dark-400">Send SMS using template</div>
					</div>
				</button>
				</div>
			</div>
		</div>
	);
};

export default AddNodeModal;


