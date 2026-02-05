import { Database, Edit3, Trash2, Calendar } from 'lucide-react';

interface Project {
  id: string | number;
  name: string;
  schema_name?: string;
  description?: string;
  created_at: string;
}

interface ProjectTileItemProps {
  project: Project;
  onClick?: (project: Project) => void;
  onEdit?: (project: Project) => void;
  onDelete?: (project: Project) => void;
}

const ProjectTileItem = ({ project, onClick, onEdit, onDelete }: ProjectTileItemProps) => {
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(project);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(project);
  };

  return (
    <div
      className="bg-white dark:bg-dark-800 rounded-xl shadow-lg border border-dark-200 dark:border-dark-700 p-4 hover:shadow-xl transition-all duration-200 cursor-pointer group"
      onClick={() => onClick?.(project)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-dark-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
              {project.name}
            </h3>
            {project.schema_name && (
              <p className="text-sm text-dark-500 dark:text-dark-400">
                {project.schema_name}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button 
              className="p-1 rounded hover:bg-dark-100 dark:hover:bg-dark-700"
              onClick={handleEdit}
            >
              <Edit3 className="w-4 h-4 text-dark-400" />
            </button>
          )}
          {onDelete && (
            <button 
              className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20"
              onClick={handleDelete}
            >
              <Trash2 className="w-4 h-4 text-red-400" />
            </button>
          )}
        </div>
      </div>
      
      {project.description && (
        <p className="text-dark-600 dark:text-dark-300 text-sm mb-4 line-clamp-2">
          {project.description}
        </p>
      )}
      
      <div className="flex items-center justify-between text-sm text-dark-500 dark:text-dark-400">
        <div className="flex items-center space-x-1">
          <Calendar className="w-4 h-4" />
          <span>
            {new Date(project.created_at).toLocaleDateString()}
          </span>
        </div>
        
        <div className="flex items-center space-x-1 text-primary-600 dark:text-primary-400">
          <span>Open</span>
          <Database className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
};

export default ProjectTileItem;