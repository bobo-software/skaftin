import express from 'express';
import BackupController from '../controllers/BackupController';
import { authenticateAndAttachUser, verifyProjectAccess } from '../middleware/supertokensAuthMiddleware';

const router = express.Router();

// All backup routes require authentication
router.use(authenticateAndAttachUser);

// All routes need project access verification
router.post('/:projectId/create', verifyProjectAccess, BackupController.createBackup);
router.get('/:projectId/list', verifyProjectAccess, BackupController.listBackups);
// backupId is now just the filename (extracted from full path in frontend)
router.get('/:projectId/:backupId/download', verifyProjectAccess, BackupController.downloadBackup);
router.post('/:projectId/:backupId/restore', verifyProjectAccess, BackupController.restoreBackup);
router.delete('/:projectId/:backupId', verifyProjectAccess, BackupController.deleteBackup);

// Backup schedule routes
router.get('/:projectId/schedules', verifyProjectAccess, BackupController.listBackupSchedules);
router.post('/:projectId/schedules', verifyProjectAccess, BackupController.createBackupSchedule);
router.put('/:projectId/schedules/:scheduleId', verifyProjectAccess, BackupController.updateBackupSchedule);
router.delete('/:projectId/schedules/:scheduleId', verifyProjectAccess, BackupController.deleteBackupSchedule);

export { router };

