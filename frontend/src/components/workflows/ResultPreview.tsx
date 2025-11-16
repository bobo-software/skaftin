import JsonTree from './JsonTree';
interface ResultPreviewProps {
	title?: string;
	status: 'success' | 'fail';
	payload: any;
	onClose: () => void;
}

const ResultPreview = ({ title, status, payload, onClose }: ResultPreviewProps) => {
	return (
		<div className="absolute inset-0 z-40 flex items-start justify-center pt-24">
			<div className="absolute inset-0 bg-black/40" onClick={onClose} />
			<div className="relative z-50 bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-lg shadow-xl w-[720px] max-w-[95vw]">
				<div className="px-4 py-2 border-b border-dark-200 dark:border-dark-700 flex items-center justify-between">
					<div className="text-sm font-semibold text-dark-900 dark:text-white">
						{title ?? 'Result'} - {status.toUpperCase()}
					</div>
					<button
						onClick={onClose}
						className="text-xs px-2 py-1 rounded bg-dark-100 dark:bg-dark-700 hover:bg-dark-200 dark:hover:bg-dark-600 text-dark-900 dark:text-white"
					>
						Close
					</button>
				</div>
				<div className="p-3">
					<div className="bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded p-3 max-h-[65vh] overflow-auto">
						<JsonTree value={payload} />
					</div>
				</div>
			</div>
		</div>
	);
};

export default ResultPreview;


