import { Response } from 'express';
import { db } from '../db/drizzle.config';
import { organizations, organization_members } from '../db/schemas/OrganizationsSchema';
import { projects } from '../db/schemas/ProjectsSchema';
import { eq, and, sql } from 'drizzle-orm';
import ResponseUtils from '../utils/ResponseUtils';
import { 
  CreateOrganizationDto, 
  UpdateOrganizationDto, 
  AddMemberDto,
  UpdateMemberRoleDto,
  OrganizationRole
} from '../types/Types';
import { SuperTokensAuthenticatedRequest } from '../middleware/supertokensAuthMiddleware';

class OrganizationsController {
  /**
   * Get all organizations for the authenticated user
   */
  static async getUserOrganizations(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return ResponseUtils.error(res, 'Unauthorized', null, null, 401);
    }

    try {
      const userId = req.user.userId;

      // Get organizations where user is a member
      const userOrgs = await db
        .select({
          id: organizations.id,
          name: organizations.name,
          description: organizations.description,
          owner_id: organizations.owner_id,
          created_at: organizations.created_at,
          updated_at: organizations.updated_at,
          role: organization_members.role,
        })
        .from(organization_members)
        .innerJoin(organizations, eq(organization_members.organization_id, organizations.id))
        .where(eq(organization_members.user_id, userId));

      // Get project counts for each organization
      const orgsWithCounts = await Promise.all(
        userOrgs.map(async (org) => {
          const projectCount = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(projects)
            .where(eq(projects.organization_id, org.id));

          const memberCount = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(organization_members)
            .where(eq(organization_members.organization_id, org.id));

          return {
            ...org,
            projectCount: projectCount[0]?.count || 0,
            memberCount: memberCount[0]?.count || 0,
            isOwner: org.owner_id === userId,
          };
        })
      );

      return ResponseUtils.success(res, 'Organizations retrieved successfully', orgsWithCounts);
    } catch (error) {
      console.error('Error fetching organizations:', error);
      return ResponseUtils.error(res, 'Failed to fetch organizations', error);
    }
  }

  /**
   * Get a specific organization by ID
   */
  static async getOrganizationById(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return ResponseUtils.error(res, 'Unauthorized', null, null, 401);
    }

    try {
      const orgId = parseInt(req.params.id);
      const userId = req.user.userId;

      // Check if user is a member of the organization
      const membership = await db
        .select()
        .from(organization_members)
        .where(
          and(
            eq(organization_members.organization_id, orgId),
            eq(organization_members.user_id, userId)
          )
        );

      if (membership.length === 0) {
        return ResponseUtils.error(res, 'You do not have access to this organization', null, null, 403);
      }

      // Get organization details
      const org = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, orgId));

      if (org.length === 0) {
        return ResponseUtils.error(res, 'Organization not found', null, null, 404);
      }

      // Get all members
      const members = await db
        .select()
        .from(organization_members)
        .where(eq(organization_members.organization_id, orgId));

      // Get project count
      const projectCount = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(projects)
        .where(eq(projects.organization_id, orgId));

      return ResponseUtils.success(res, 'Organization retrieved successfully', {
        ...org[0],
        members,
        memberCount: members.length,
        projectCount: projectCount[0]?.count || 0,
        userRole: membership[0].role,
        isOwner: org[0].owner_id === userId,
      });
    } catch (error) {
      console.error('Error fetching organization:', error);
      return ResponseUtils.error(res, 'Failed to fetch organization', error);
    }
  }

  /**
   * Create a new organization
   */
  static async createOrganization(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return ResponseUtils.error(res, 'Unauthorized', null, null, 401);
    }

    try {
      const userId = req.user.userId;
      const { name, description }: CreateOrganizationDto = req.body;

      // Validation
      if (!name || name.trim() === '') {
        return ResponseUtils.error(res, 'Organization name is required', null, null, 400);
      }

      // Create organization
      const result = await db
        .insert(organizations)
        .values({
          name: name.trim(),
          description: description?.trim() || null,
          owner_id: userId,
        })
        .returning();

      const newOrg = result[0];

      // Add the creator as an admin member
      await db
        .insert(organization_members)
        .values({
          organization_id: newOrg.id,
          user_id: userId,
          role: 'admin',
        });

      return ResponseUtils.success(res, 'Organization created successfully', newOrg, 201);
    } catch (error) {
      console.error('Error creating organization:', error);
      return ResponseUtils.error(res, 'Failed to create organization', error);
    }
  }

  /**
   * Update an organization
   */
  static async updateOrganization(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return ResponseUtils.error(res, 'Unauthorized', null, null, 401);
    }

    try {
      const orgId = parseInt(req.params.id);
      const userId = req.user.userId;
      const { name, description }: UpdateOrganizationDto = req.body;

      // Check if user is admin or owner
      const membership = await db
        .select()
        .from(organization_members)
        .where(
          and(
            eq(organization_members.organization_id, orgId),
            eq(organization_members.user_id, userId)
          )
        );

      if (membership.length === 0) {
        return ResponseUtils.error(res, 'You do not have access to this organization', null, null, 403);
      }

      const org = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, orgId));

      if (org.length === 0) {
        return ResponseUtils.error(res, 'Organization not found', null, null, 404);
      }

      // Only admin or owner can update
      if (membership[0].role !== 'admin' && org[0].owner_id !== userId) {
        return ResponseUtils.error(res, 'You do not have permission to update this organization', null, null, 403);
      }

      // Update organization
      const updateData: any = {};
      if (name) updateData.name = name.trim();
      if (description !== undefined) updateData.description = description?.trim() || null;

      const result = await db
        .update(organizations)
        .set(updateData)
        .where(eq(organizations.id, orgId))
        .returning();

      return ResponseUtils.success(res, 'Organization updated successfully', result[0]);
    } catch (error) {
      console.error('Error updating organization:', error);
      return ResponseUtils.error(res, 'Failed to update organization', error);
    }
  }

  /**
   * Delete an organization
   */
  static async deleteOrganization(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return ResponseUtils.error(res, 'Unauthorized', null, null, 401);
    }

    try {
      const orgId = parseInt(req.params.id);
      const userId = req.user.userId;

      // Get organization
      const org = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, orgId));

      if (org.length === 0) {
        return ResponseUtils.error(res, 'Organization not found', null, null, 404);
      }

      // Only owner can delete
      if (org[0].owner_id !== userId) {
        return ResponseUtils.error(res, 'Only the organization owner can delete it', null, null, 403);
      }

      // Delete organization (cascade will handle members and projects)
      await db
        .delete(organizations)
        .where(eq(organizations.id, orgId));

      return ResponseUtils.success(res, 'Organization deleted successfully', null);
    } catch (error) {
      console.error('Error deleting organization:', error);
      return ResponseUtils.error(res, 'Failed to delete organization', error);
    }
  }

  /**
   * Get all members of an organization
   */
  static async getOrganizationMembers(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return ResponseUtils.error(res, 'Unauthorized', null, null, 401);
    }

    try {
      const orgId = parseInt(req.params.id);
      const userId = req.user.userId;

      // Check if user is a member
      const membership = await db
        .select()
        .from(organization_members)
        .where(
          and(
            eq(organization_members.organization_id, orgId),
            eq(organization_members.user_id, userId)
          )
        );

      if (membership.length === 0) {
        return ResponseUtils.error(res, 'You do not have access to this organization', null, null, 403);
      }

      // Get all members
      const members = await db
        .select()
        .from(organization_members)
        .where(eq(organization_members.organization_id, orgId));

      return ResponseUtils.success(res, 'Members retrieved successfully', members);
    } catch (error) {
      console.error('Error fetching members:', error);
      return ResponseUtils.error(res, 'Failed to fetch members', error);
    }
  }

  /**
   * Add a member to an organization
   * Note: This is a simplified version. In production, you'd want to:
   * - Send email invitations
   * - Use invitation tokens
   * - Verify email before adding
   */
  static async addMember(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return ResponseUtils.error(res, 'Unauthorized', null, null, 401);
    }

    try {
      const orgId = parseInt(req.params.id);
      const userId = req.user.userId;
      const { email, role }: AddMemberDto = req.body;

      // Validation
      if (!email || !role) {
        return ResponseUtils.error(res, 'Email and role are required', null, null, 400);
      }

      const validRoles: OrganizationRole[] = ['admin', 'dev', 'member', 'viewer'];
      if (!validRoles.includes(role)) {
        return ResponseUtils.error(res, 'Invalid role', null, null, 400);
      }

      // Check if user is admin or owner
      const membership = await db
        .select()
        .from(organization_members)
        .where(
          and(
            eq(organization_members.organization_id, orgId),
            eq(organization_members.user_id, userId)
          )
        );

      if (membership.length === 0) {
        return ResponseUtils.error(res, 'You do not have access to this organization', null, null, 403);
      }

      if (membership[0].role !== 'admin') {
        const org = await db
          .select()
          .from(organizations)
          .where(eq(organizations.id, orgId));

        if (org.length === 0 || org[0].owner_id !== userId) {
          return ResponseUtils.error(res, 'Only admins and owners can add members', null, null, 403);
        }
      }

      // TODO: In production, look up user by email and get their user_id
      // For now, we'll just use the email as a placeholder
      // You'd need to integrate with SuperTokens to look up users by email

      return ResponseUtils.error(
        res,
        'Adding members by email requires email invitation system (not yet implemented). Please provide user_id instead.',
        null,
        null,
        501
      );

      // This would be the actual implementation:
      // const newMemberId = await lookupUserIdByEmail(email);
      // await db.insert(organization_members).values({
      //   organization_id: orgId,
      //   user_id: newMemberId,
      //   role,
      // });
    } catch (error) {
      console.error('Error adding member:', error);
      return ResponseUtils.error(res, 'Failed to add member', error);
    }
  }

  /**
   * Add a member by user ID (internal/testing use)
   */
  static async addMemberByUserId(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return ResponseUtils.error(res, 'Unauthorized', null, null, 401);
    }

    try {
      const orgId = parseInt(req.params.id);
      const userId = req.user.userId;
      const { user_id, role } = req.body;

      // Validation
      if (!user_id || !role) {
        return ResponseUtils.error(res, 'user_id and role are required', null, null, 400);
      }

      const validRoles: OrganizationRole[] = ['admin', 'dev', 'member', 'viewer'];
      if (!validRoles.includes(role)) {
        return ResponseUtils.error(res, 'Invalid role', null, null, 400);
      }

      // Check if requester is admin or owner
      const membership = await db
        .select()
        .from(organization_members)
        .where(
          and(
            eq(organization_members.organization_id, orgId),
            eq(organization_members.user_id, userId)
          )
        );

      if (membership.length === 0) {
        return ResponseUtils.error(res, 'You do not have access to this organization', null, null, 403);
      }

      if (membership[0].role !== 'admin') {
        const org = await db
          .select()
          .from(organizations)
          .where(eq(organizations.id, orgId));

        if (org.length === 0 || org[0].owner_id !== userId) {
          return ResponseUtils.error(res, 'Only admins and owners can add members', null, null, 403);
        }
      }

      // Check if user is already a member
      const existingMember = await db
        .select()
        .from(organization_members)
        .where(
          and(
            eq(organization_members.organization_id, orgId),
            eq(organization_members.user_id, user_id)
          )
        );

      if (existingMember.length > 0) {
        return ResponseUtils.error(res, 'User is already a member of this organization', null, null, 409);
      }

      // Add member
      const result = await db
        .insert(organization_members)
        .values({
          organization_id: orgId,
          user_id: user_id,
          role,
        })
        .returning();

      return ResponseUtils.success(res, 'Member added successfully', result[0], 201);
    } catch (error) {
      console.error('Error adding member:', error);
      return ResponseUtils.error(res, 'Failed to add member', error);
    }
  }

  /**
   * Update a member's role
   */
  static async updateMemberRole(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return ResponseUtils.error(res, 'Unauthorized', null, null, 401);
    }

    try {
      const orgId = parseInt(req.params.id);
      const memberId = parseInt(req.params.memberId);
      const userId = req.user.userId;
      const { role }: UpdateMemberRoleDto = req.body;

      // Validation
      const validRoles: OrganizationRole[] = ['admin', 'dev', 'member', 'viewer'];
      if (!role || !validRoles.includes(role)) {
        return ResponseUtils.error(res, 'Invalid role', null, null, 400);
      }

      // Check if requester is admin or owner
      const membership = await db
        .select()
        .from(organization_members)
        .where(
          and(
            eq(organization_members.organization_id, orgId),
            eq(organization_members.user_id, userId)
          )
        );

      if (membership.length === 0) {
        return ResponseUtils.error(res, 'You do not have access to this organization', null, null, 403);
      }

      if (membership[0].role !== 'admin') {
        const org = await db
          .select()
          .from(organizations)
          .where(eq(organizations.id, orgId));

        if (org.length === 0 || org[0].owner_id !== userId) {
          return ResponseUtils.error(res, 'Only admins and owners can update member roles', null, null, 403);
        }
      }

      // Get the organization to check if target is owner
      const org = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, orgId));

      if (org.length === 0) {
        return ResponseUtils.error(res, 'Organization not found', null, null, 404);
      }

      // Get target member
      const targetMember = await db
        .select()
        .from(organization_members)
        .where(eq(organization_members.id, memberId));

      if (targetMember.length === 0) {
        return ResponseUtils.error(res, 'Member not found', null, null, 404);
      }

      // Cannot change owner's role
      if (targetMember[0].user_id === org[0].owner_id) {
        return ResponseUtils.error(res, 'Cannot change the owner\'s role', null, null, 403);
      }

      // Update role
      const result = await db
        .update(organization_members)
        .set({ role })
        .where(eq(organization_members.id, memberId))
        .returning();

      return ResponseUtils.success(res, 'Member role updated successfully', result[0]);
    } catch (error) {
      console.error('Error updating member role:', error);
      return ResponseUtils.error(res, 'Failed to update member role', error);
    }
  }

  /**
   * Remove a member from an organization
   */
  static async removeMember(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return ResponseUtils.error(res, 'Unauthorized', null, null, 401);
    }

    try {
      const orgId = parseInt(req.params.id);
      const memberId = parseInt(req.params.memberId);
      const userId = req.user.userId;

      // Check if requester is admin or owner
      const membership = await db
        .select()
        .from(organization_members)
        .where(
          and(
            eq(organization_members.organization_id, orgId),
            eq(organization_members.user_id, userId)
          )
        );

      if (membership.length === 0) {
        return ResponseUtils.error(res, 'You do not have access to this organization', null, null, 403);
      }

      // Get the organization
      const org = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, orgId));

      if (org.length === 0) {
        return ResponseUtils.error(res, 'Organization not found', null, null, 404);
      }

      // Get target member
      const targetMember = await db
        .select()
        .from(organization_members)
        .where(eq(organization_members.id, memberId));

      if (targetMember.length === 0) {
        return ResponseUtils.error(res, 'Member not found', null, null, 404);
      }

      // Cannot remove owner
      if (targetMember[0].user_id === org[0].owner_id) {
        return ResponseUtils.error(res, 'Cannot remove the organization owner', null, null, 403);
      }

      // Only admin or owner can remove members (or members can remove themselves)
      if (membership[0].role !== 'admin' && org[0].owner_id !== userId && targetMember[0].user_id !== userId) {
        return ResponseUtils.error(res, 'You do not have permission to remove this member', null, null, 403);
      }

      // Remove member
      await db
        .delete(organization_members)
        .where(eq(organization_members.id, memberId));

      return ResponseUtils.success(res, 'Member removed successfully', null);
    } catch (error) {
      console.error('Error removing member:', error);
      return ResponseUtils.error(res, 'Failed to remove member', error);
    }
  }
}

export default OrganizationsController;

