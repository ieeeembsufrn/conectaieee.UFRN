import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Project, Task, Profile } from '../types';
import { useGlobalAlert } from '../components/GlobalAlert';

export const usePermissions = () => {
    const { profile } = useAuth();
    const { tasks } = useData();
    const { showAlert } = useGlobalAlert();

    /**
     * Helper to get user roles for a specific chapter
     */
    const getChapterRole = (chapterId: number) => {
        if (!profile || !profile.profileChapters) return null;
        const relation = profile.profileChapters.find(pc => pc.chapter_id === chapterId);
        return relation ? relation.permission_slug : null;
    };

    /**
     * Check if user is Admin or Chair of the associated chapter
     */
    const isElevatedUser = (project?: Project) => {
        if (!profile) return false;

        // Global Admin Check (New Model: Chapter 1 + Admin Slug)
        const chaptersList = (profile as any).profile_chapters || (profile as any).profileChapters || [];
        const isGlobalAdmin = chaptersList.some((pc: any) => pc.chapter_id === 1 && pc.permission_slug === 'admin');

        if (isGlobalAdmin) return true;

        // Check 'admin' role in any chapter (if that's how it works) or specifically associated chapter
        const userChapters = profile.profileChapters || [];
        if (userChapters.some(c => c.permission_slug === 'admin')) return true;

        // Chair of the project's chapter
        if (project && project.chapters) {
            return project.chapters.some(pChapter => {
                const role = getChapterRole(pChapter.id);
                return role === 'chair' || role === 'admin';
            });
        }

        return false;
    };

    /**
     * Project Permissions
     */
    const checkProjectPermissions = (project: Project | null) => {
        if (!project || !profile) return { canEdit: false, canCreateTask: false };

        const elevated = isElevatedUser(project);

        // Project Manager? (Is in owners list)
        // Note: Project interface 'owners' is Profile[].
        const isManager = project.owners?.some(o => o.id === profile.id);

        // Can Edit Project Settings: Manager OR Admin/Chair
        const canEdit = isManager || elevated;

        // Can Create Task: Manager OR Admin/Chair
        // (Usually same as edit, but kept separate in case granular logic changes)
        const canCreateTask = isManager || elevated;

        return { canEdit, canCreateTask };
    };

    /**
     * Task Permissions
     */
    const checkTaskPermissions = (task: Task | null, project: Project | null) => {
        if (!task || !project || !profile) return { canEdit: false };

        const elevated = isElevatedUser(project);
        const isManager = project.owners?.some(o => o.id === profile.id);

        // Task Assignee?
        const isAssignee =
            task.assignees?.some(a => a.id === profile.id) ||
            (task as any).responsavelIds?.includes(profile.id) ||
            (task as any).assignee_ids?.includes(profile.id);

        const parentTask = (task as any).parentTaskId
            ? tasks.find((t: any) => t.id === (task as any).parentTaskId)
            : null;

        const isParentAssignee = !!parentTask && (
            parentTask.assignees?.some(a => a.id === profile.id) ||
            (parentTask as any).responsavelIds?.includes(profile.id) ||
            (parentTask as any).assignee_ids?.includes(profile.id)
        );

        // Can Edit Task: Assignee OR parent task assignee OR Manager OR Admin/Chair
        const canEdit = isAssignee || isParentAssignee || isManager || elevated;

        return { canEdit };
    };

    /**
     * Wrapper meant to be called in UI handlers.
     * If allowed, executes callback. If not, shows alert.
     */
    const withProjectEditPermission = (project: Project, action: () => void) => {
        const { canEdit } = checkProjectPermissions(project);
        if (canEdit) {
            action();
        } else {
            showAlert(
                "Acesso Negado",
                "Você precisa ser GERENTE deste projeto (ou Chair/Admin) para editar as configurações.",
                "warning"
            );
        }
    };

    const withTaskCreatePermission = (project: Project, action: () => void) => {
        const { canCreateTask } = checkProjectPermissions(project);
        if (canCreateTask) {
            action();
        } else {
            showAlert(
                "Acesso Negado",
                "Você precisa ser GERENTE deste projeto para criar novas tarefas.",
                "warning"
            );
        }
    };

    const withTaskEditPermission = (task: Task, project: Project, action: () => void) => {
        const { canEdit } = checkTaskPermissions(task, project);
        if (canEdit) {
            action();
        } else {
            showAlert(
                "Acesso Negado",
                "Apenas o responsável pela tarefa ou gerentes podem editá-la.",
                "warning"
            );
        }
    };

    return {
        checkProjectPermissions,
        checkTaskPermissions,
        withProjectEditPermission,
        withTaskCreatePermission,
        withTaskEditPermission
    };
};
