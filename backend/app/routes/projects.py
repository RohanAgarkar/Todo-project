"""
TODO Checklist:
- [x] Create project creation endpoint
- [x] Create project retrieval endpoint
- [x] Create project rename endpoint
- [x] Create project deletion endpoint
- [x] Create project member management endpoints
    - [x] Add member
    - [x] Remove member
"""


from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, exists
from datetime import datetime, timezone



from app.config.db import get_db
from app.modals.Modals import User, Projects, ProjectMembers, UserRole
from app.routes.auth import get_current_user
from app.schemas.Projects import (
    GetAllProjectsResponse, 
    ProjectResponse, 
    GetProjectMembersResponse,
    ProjectMemberResponse,
    CreateProjectRequest,
    RenameProjectRequest
)
from app.websockets.manager import manager



async def check_user_access(project_id: int, current_user: User, db: AsyncSession):
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

    if not project or current_user.role == UserRole.USER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this project"
        )

    return project


projects_router = APIRouter(prefix="/projects", tags=["projects"])

@projects_router.get("/", response_model=GetAllProjectsResponse)
async def get_projects(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """
    Get all projects for the current user
    Returns projects where user is either owner or member
    """
    # Get projects where user is owner
    if current_user.role in [UserRole.ADMIN, UserRole.MODERATOR]:
        owner_projects_result = await db.execute(
            select(Projects).where(Projects.owner_id == current_user.id)
        )
        owner_projects = owner_projects_result.scalars().all()
    else:
        owner_projects = []
    
    # Get project IDs where user is member
    member_projects_result = await db.execute(
        select(ProjectMembers.project_id).where(ProjectMembers.user_id == current_user.id)
    )
    member_project_ids = [row[0] for row in member_projects_result.fetchall()]
    
    # Get projects where user is member (but not owner)
    if member_project_ids:
        member_projects_result = await db.execute(
            select(Projects).where(
                Projects.id.in_(member_project_ids),
                Projects.owner_id != current_user.id
            )
        )
        member_projects = member_projects_result.scalars().all()
    else:
        member_projects = []
    
    # Combine both lists
    all_projects = list(owner_projects) + member_projects
    
    project_responses = [
        ProjectResponse(
            id=project.id,
            project_name=project.project_name,
            created_at=project.created_at,
            updated_at=project.updated_at,
            is_owner=project.owner_id == current_user.id
        )
        for project in all_projects
    ]
    
    return GetAllProjectsResponse(projects=project_responses)

@projects_router.get("/{project_id}")
async def get_project(project_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    project_access = await check_user_access(project_id, current_user, db)
    return ProjectResponse(
        id=project_access.id,
        project_name=project_access.project_name,
        created_at=project_access.created_at,
        updated_at=project_access.updated_at,
        is_owner=project_access.owner_id == current_user.id
    )

@projects_router.get("/{project_id}/members", response_model=GetProjectMembersResponse)
async def get_project_members(project_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Check if user has access to this project (owner or member)
    project_access = await db.execute(
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
    
    if not project_access.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Access denied to this project"
        )
    
    # Get all members of the project
    members_result = await db.execute(
        select(ProjectMembers, User).join(User).where(ProjectMembers.project_id == project_id)
    )
    
    member_responses = []
    for member, user in members_result.fetchall():
        member_responses.append(
            ProjectMemberResponse(
                id=member.id,
                user_id_int=user.id,
                user_id=user.user_id,
                full_name=user.full_name,
                initials=user.initials,
                role=user.role.value,
                created_at=member.created_at
            )
        )
    
    return GetProjectMembersResponse(members=member_responses)


@projects_router.post("/create_project")
async def create_project(request: CreateProjectRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.role == UserRole.USER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and managers can create projects"
        )
    
    new_project = Projects(
        project_name=request.project_name,
        owner_id=current_user.id,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    db.add(new_project)
    await db.commit()
    await db.refresh(new_project)
    
    # Broadcast project creation to all connected clients
    await manager.broadcast("project_created", {
        "project": {
            "id": new_project.id,
            "project_name": new_project.project_name,
            "owner_id": new_project.owner_id,
            "created_at": new_project.created_at.isoformat(),
            "updated_at": new_project.updated_at.isoformat()
        },
        "created_by": current_user.user_id
    })
    
    return {"message": "Project created successfully", "project_id": new_project.id}

@projects_router.patch("/rename_project/{project_id}/{new_name}")
async def update_project(project_id: int, new_name: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    project_access = await check_user_access(project_id, current_user, db)
    if not project_access or project_access.owner_id != current_user.id or current_user.role == UserRole.USER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to rename this project"
        )
    
    # Update project name
    project_access.project_name = new_name
    project_access.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(project_access)
    
    # Broadcast project update to all connected clients
    await manager.broadcast("project_updated", {
        "project": {
            "id": project_access.id,
            "project_name": project_access.project_name,
            "updated_at": project_access.updated_at.isoformat()
        },
        "updated_by": current_user.user_id
    })

    return {"message": "Project renamed successfully"}

@projects_router.delete("/{project_id}")
async def delete_project(project_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    project_access = await check_user_access(project_id, current_user, db)
    if not project_access or project_access.owner_id != current_user.id or current_user.role == UserRole.USER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this project"
        )
    
    # Store project info for broadcast before deletion
    project_info = {
        "id": project_access.id,
        "project_name": project_access.project_name,
        "owner_id": project_access.owner_id
    }
    
    await db.delete(project_access)
    await db.commit()
    
    # Broadcast project deletion to all connected clients
    await manager.broadcast("project_deleted", {
        "project": project_info,
        "deleted_by": current_user.user_id
    })

    return {"message": "Project deleted successfully"}

@projects_router.post("/{project_id}/members/{user_id}")
async def add_member(project_id: int, user_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    project_access = await check_user_access(project_id, current_user, db)
    if not project_access or project_access.owner_id != current_user.id or current_user.role == UserRole.USER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to add members to this project"
        )
    
    # Check if user exists
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if already a member
    existing_member = await db.execute(
        select(ProjectMembers).where(
            ProjectMembers.project_id == project_id,
            ProjectMembers.user_id == user_id
        )
    )
    if existing_member.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this project"
        )
    
    project_member = ProjectMembers(
        project_id=project_id,
        user_id=user_id
    )
    db.add(project_member)
    await db.commit()
    await db.refresh(project_member)
    
    # Broadcast member addition to all connected clients
    await manager.broadcast("member_added", {
        "project_id": project_id,
        "member": {
            "id": project_member.id,
            "user_id": user.user_id,
            "full_name": user.full_name,
            "initials": user.initials,
            "role": user.role.value
        },
        "added_by": current_user.user_id
    })

    return {"message": "Member added successfully"}

@projects_router.delete("/{project_id}/members/{user_id}")
async def remove_member(project_id: int, user_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    project_access = await check_user_access(project_id, current_user, db)
    if not project_access or project_access.owner_id != current_user.id or current_user.role == UserRole.USER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to remove members from this project"
        )
    
    # Find the member to remove
    member_result = await db.execute(
        select(ProjectMembers).where(
            ProjectMembers.project_id == project_id,
            ProjectMembers.user_id == user_id
        )
    )
    project_member = member_result.scalar_one_or_none()
    
    if not project_member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found"
        )
    
    # Get user info for broadcast
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    
    await db.delete(project_member)
    await db.commit()
    
    # Broadcast member removal to all connected clients
    await manager.broadcast("member_removed", {
        "project_id": project_id,
        "member": {
            "id": project_member.id,
            "user_id": user.user_id if user else str(user_id),
            "full_name": user.full_name if user else "Unknown User",
            "initials": user.initials if user else "??"
        },
        "removed_by": current_user.user_id
    })

    return {"message": "Member removed successfully"}
