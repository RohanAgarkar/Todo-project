from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, exists
from datetime import datetime, timezone
from typing import List

from app.config.db import get_db
from app.modals.Modals import User, Task, TaskAssignees, Comments, Projects, ProjectMembers, UserRole
from app.routes.auth import get_current_user
from app.schemas.Tasks import (
    TaskResponse,
    TaskAssigneeResponse,
    TaskWithAssigneesResponse,
    GetTasksResponse,
    CreateTaskRequest,
    UpdateTaskRequest,
    MoveTaskRequest,
    AssignTaskRequest,
    CommentResponse,
    GetCommentsResponse,
    AddCommentRequest
)
from app.websockets.manager import manager


async def check_user_project_access(project_id: int, current_user: User, db: AsyncSession):
    """Check if user has access to the project (owner or member)"""
    result = await db.execute(
        select(Projects).where(
            Projects.id == project_id,
            or_(
                Projects.owner_id == current_user.id,
                exists().where(
                    and_(
                        ProjectMembers.project_id == project_id,
                        ProjectMembers.user_id == current_user.id
                    )
                )
            )
        )
    )
    
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or access denied"
        )
    
    return project


async def check_task_access(task_id: int, current_user: User, db: AsyncSession):
    """Check if user has access to the task through project membership"""
    result = await db.execute(
        select(Task).join(Projects).where(
            Task.id == task_id,
            or_(
                Projects.owner_id == current_user.id,
                exists().where(
                    and_(
                        ProjectMembers.project_id == Task.project_id,
                        ProjectMembers.user_id == current_user.id
                    )
                )
            )
        )
    )
    
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found or access denied"
        )
    
    return task


tasks_router = APIRouter(prefix="/tasks", tags=["tasks"])


@tasks_router.post("/", response_model=TaskResponse)
async def create_task(
    request: CreateTaskRequest, 
    current_user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    """Create a new task in a project"""
    # Check project access
    project = await check_user_project_access(request.project_id, current_user, db)
    
    # Create the task
    new_task = Task(
        project_id=request.project_id,
        column_name=request.column_name,
        title=request.title,
        description=request.description,
        priority=request.priority,
        due_date=request.due_date,
        created_by=current_user.id,
        updated_by=current_user.id,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    
    db.add(new_task)
    await db.commit()
    await db.refresh(new_task)
    
    # Broadcast task creation
    await manager.broadcast("task_created", {
        "task": {
            "id": new_task.id,
            "project_id": new_task.project_id,
            "column_name": new_task.column_name.value,
            "title": new_task.title,
            "description": new_task.description,
            "priority": new_task.priority.value,
            "due_date": new_task.due_date.isoformat(),
            "created_by": new_task.created_by,
            "updated_by": new_task.updated_by,
            "created_at": new_task.created_at.isoformat(),
            "updated_at": new_task.updated_at.isoformat()
        },
        "created_by": current_user.user_id
    })
    
    return TaskResponse(
        id=new_task.id,
        project_id=new_task.project_id,
        column_name=new_task.column_name.value,
        title=new_task.title,
        description=new_task.description,
        priority=new_task.priority.value,
        due_date=new_task.due_date,
        created_by=new_task.created_by,
        updated_by=new_task.updated_by,
        created_at=new_task.created_at,
        updated_at=new_task.updated_at
    )


@tasks_router.get("/{task_id}", response_model=TaskWithAssigneesResponse)
async def get_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific task with its assignees"""
    task = await check_task_access(task_id, current_user, db)
    
    # Get task assignees
    assignees_result = await db.execute(
        select(TaskAssignees, User).join(User).where(TaskAssignees.task_id == task_id)
    )
    
    assignees = []
    for assignee, user in assignees_result.fetchall():
        assignees.append(TaskAssigneeResponse(
            id=user.id,
            user_id=user.user_id,
            full_name=user.full_name,
            initials=user.initials
        ))
    
    return TaskWithAssigneesResponse(
        task=TaskResponse(
            id=task.id,
            project_id=task.project_id,
            column_name=task.column_name.value,
            title=task.title,
            description=task.description,
            priority=task.priority.value,
            due_date=task.due_date,
            created_by=task.created_by,
            updated_by=task.updated_by,
            created_at=task.created_at,
            updated_at=task.updated_at
        ),
        assignees=assignees
    )


@tasks_router.get("/project/{project_id}", response_model=GetTasksResponse)
async def get_project_tasks(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all tasks for a project with their assignees"""
    # Check project access
    project = await check_user_project_access(project_id, current_user, db)
    
    # Get all tasks for the project
    tasks_result = await db.execute(
        select(Task).where(Task.project_id == project_id).order_by(Task.created_at.desc())
    )
    tasks = tasks_result.scalars().all()
    
    tasks_with_assignees = []
    for task in tasks:
        # Get assignees for each task
        assignees_result = await db.execute(
            select(TaskAssignees, User).join(User).where(TaskAssignees.task_id == task.id)
        )
        
        assignees = []
        for assignee, user in assignees_result.fetchall():
            assignees.append(TaskAssigneeResponse(
                id=user.id,
                user_id=user.user_id,
                full_name=user.full_name,
                initials=user.initials
            ))
        
        tasks_with_assignees.append(TaskWithAssigneesResponse(
            task=TaskResponse(
                id=task.id,
                project_id=task.project_id,
                column_name=task.column_name.value,
                title=task.title,
                description=task.description,
                priority=task.priority.value,
                due_date=task.due_date,
                created_by=task.created_by,
                updated_by=task.updated_by,
                created_at=task.created_at,
                updated_at=task.updated_at
            ),
            assignees=assignees
        ))
    
    return GetTasksResponse(tasks=tasks_with_assignees)


@tasks_router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: int,
    request: UpdateTaskRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update task details"""
    task = await check_task_access(task_id, current_user, db)
    
    # Update task fields if provided
    if request.title is not None:
        task.title = request.title
    if request.description is not None:
        task.description = request.description
    if request.priority is not None:
        task.priority = request.priority
    if request.due_date is not None:
        task.due_date = request.due_date
    
    task.updated_by = current_user.id
    task.updated_at = datetime.now(timezone.utc)
    
    await db.commit()
    await db.refresh(task)
    
    # Broadcast task update
    await manager.broadcast("task_updated", {
        "task": {
            "id": task.id,
            "project_id": task.project_id,
            "column_name": task.column_name.value,
            "title": task.title,
            "description": task.description,
            "priority": task.priority.value,
            "due_date": task.due_date.isoformat(),
            "updated_by": task.updated_by,
            "updated_at": task.updated_at.isoformat()
        },
        "updated_by": current_user.user_id
    })
    
    return TaskResponse(
        id=task.id,
        project_id=task.project_id,
        column_name=task.column_name.value,
        title=task.title,
        description=task.description,
        priority=task.priority.value,
        due_date=task.due_date,
        created_by=task.created_by,
        updated_by=task.updated_by,
        created_at=task.created_at,
        updated_at=task.updated_at
    )


@tasks_router.delete("/{task_id}")
async def delete_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a task"""
    task = await check_task_access(task_id, current_user, db)
    
    # Store task info for broadcast
    task_info = {
        "id": task.id,
        "project_id": task.project_id,
        "title": task.title
    }
    
    await db.delete(task)
    await db.commit()
    
    # Broadcast task deletion
    await manager.broadcast("task_deleted", {
        "task": task_info,
        "deleted_by": current_user.user_id
    })
    
    return {"message": "Task deleted successfully"}


@tasks_router.patch("/{task_id}/move", response_model=TaskResponse)
async def move_task(
    task_id: int,
    request: MoveTaskRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Move a task to a different column"""
    task = await check_task_access(task_id, current_user, db)
    
    # Update task column
    task.column_name = request.column_name
    task.updated_by = current_user.id
    task.updated_at = datetime.now(timezone.utc)
    
    await db.commit()
    await db.refresh(task)
    
    # Broadcast task movement
    await manager.broadcast("task_moved", {
        "task": {
            "id": task.id,
            "project_id": task.project_id,
            "column_name": task.column_name.value,
            "updated_by": task.updated_by,
            "updated_at": task.updated_at.isoformat()
        },
        "moved_by": current_user.user_id
    })
    
    return TaskResponse(
        id=task.id,
        project_id=task.project_id,
        column_name=task.column_name.value,
        title=task.title,
        description=task.description,
        priority=task.priority.value,
        due_date=task.due_date,
        created_by=task.created_by,
        updated_by=task.updated_by,
        created_at=task.created_at,
        updated_at=task.updated_at
    )


@tasks_router.post("/{task_id}/assign")
async def assign_task(
    task_id: int,
    request: AssignTaskRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Assign users to a task"""
    task = await check_task_access(task_id, current_user, db)
    
    assigned_users = []
    
    for user_id in request.user_ids:
        # Check if user exists and has project access
        user_result = await db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {user_id} not found"
            )
        
        # Check if user has project access
        project_access = await db.execute(
            select(Projects).where(
                Projects.id == task.project_id,
                or_(
                    Projects.owner_id == user_id,
                    exists().where(
                        and_(
                            ProjectMembers.project_id == task.project_id,
                            ProjectMembers.user_id == user_id
                        )
                    )
                )
            )
        )
        
        if not project_access.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User {user.user_id} does not have access to this project"
            )
        
        # Check if already assigned
        existing_assignment = await db.execute(
            select(TaskAssignees).where(
                TaskAssignees.task_id == task_id,
                TaskAssignees.user_id == user_id
            )
        )
        
        if not existing_assignment.scalar_one_or_none():
            # Create assignment
            assignment = TaskAssignees(
                task_id=task_id,
                user_id=user_id,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            db.add(assignment)
            assigned_users.append({
                "id": user.id,
                "user_id": user.user_id,
                "full_name": user.full_name,
                "initials": user.initials
            })
    
    await db.commit()
    
    # Broadcast task assignment
    await manager.broadcast("task_assigned", {
        "task_id": task_id,
        "assigned_users": assigned_users,
        "assigned_by": current_user.user_id
    })
    
    return {"message": f"Assigned {len(assigned_users)} users to task successfully"}


@tasks_router.delete("/{task_id}/assign/{user_id}")
async def unassign_task(
    task_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Unassign a user from a task"""
    task = await check_task_access(task_id, current_user, db)
    
    # Find the assignment
    assignment_result = await db.execute(
        select(TaskAssignees).where(
            TaskAssignees.task_id == task_id,
            TaskAssignees.user_id == user_id
        )
    )
    assignment = assignment_result.scalar_one_or_none()
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    # Get user info for broadcast
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    
    await db.delete(assignment)
    await db.commit()
    
    # Broadcast task unassignment
    await manager.broadcast("task_unassigned", {
        "task_id": task_id,
        "unassigned_user": {
            "id": user.id,
            "user_id": user.user_id,
            "full_name": user.full_name,
            "initials": user.initials
        } if user else {"id": user_id},
        "unassigned_by": current_user.user_id
    })
    
    return {"message": "User unassigned from task successfully"}


@tasks_router.post("/{task_id}/comments", response_model=CommentResponse)
async def add_comment(
    task_id: int,
    request: AddCommentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Add a comment to a task"""
    task = await check_task_access(task_id, current_user, db)
    
    # Create comment
    new_comment = Comments(
        task_id=task_id,
        user_id=current_user.id,
        comment=request.comment,
        created_at=datetime.now(timezone.utc)
    )
    
    db.add(new_comment)
    await db.commit()
    await db.refresh(new_comment)
    
    # Broadcast comment addition
    await manager.broadcast("comment_added", {
        "comment": {
            "id": new_comment.id,
            "task_id": new_comment.task_id,
            "user_id": current_user.user_id,
            "comment": new_comment.comment,
            "created_at": new_comment.created_at.isoformat()
        },
        "added_by": current_user.user_id
    })
    
    return CommentResponse(
        id=new_comment.id,
        task_id=new_comment.task_id,
        user_id=current_user.user_id,
        comment=new_comment.comment,
        created_at=new_comment.created_at
    )


@tasks_router.get("/{task_id}/comments", response_model=GetCommentsResponse)
async def get_comments(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all comments for a task"""
    task = await check_task_access(task_id, current_user, db)
    
    # Get all comments for the task
    comments_result = await db.execute(
        select(Comments, User).join(User).where(Comments.task_id == task_id).order_by(Comments.created_at.desc())
    )
    
    comments = []
    for comment, user in comments_result.fetchall():
        comments.append(CommentResponse(
            id=comment.id,
            task_id=comment.task_id,
            user_id=user.user_id,
            comment=comment.comment,
            created_at=comment.created_at
        ))
    
    return GetCommentsResponse(comments=comments)